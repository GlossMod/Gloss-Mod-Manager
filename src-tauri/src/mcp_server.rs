use serde::Serialize;
use serde_json::json;
use std::collections::HashMap;
use std::io::{ErrorKind, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex, MutexGuard};
use std::thread::{self, JoinHandle};
use std::time::Duration;
use tauri::AppHandle;
use tauri::Emitter;
use tauri::State;

const MCP_EVENT_NAME: &str = "mcp-http-request";
const MCP_STATUS_EVENT_NAME: &str = "mcp-server-status-changed";
const MCP_DEFAULT_HOST: &str = "127.0.0.1";
const READ_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const ACCEPT_LOOP_DELAY: Duration = Duration::from_millis(50);
const MAX_HEADER_BYTES: usize = 64 * 1024;
const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum McpServerStatus {
    Stopped,
    Starting,
    Running,
    Stopping,
}

#[derive(Clone, Serialize)]
pub struct McpServerSnapshot {
    pub status: McpServerStatus,
    pub port: Option<u16>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct McpHttpRequestEvent {
    request_id: String,
    body: String,
}

struct PendingHttpResponse {
    status_code: u16,
    body: Option<String>,
}

struct ParsedHttpRequest {
    method: String,
    path: String,
    body: String,
}

pub struct McpRuntimeState {
    status: Mutex<McpServerStatus>,
    port: Mutex<Option<u16>>,
    pending_requests: Mutex<HashMap<String, mpsc::Sender<PendingHttpResponse>>>,
    shutdown_sender: Mutex<Option<mpsc::Sender<()>>>,
    worker: Mutex<Option<JoinHandle<()>>>,
    request_counter: AtomicU64,
}

impl Default for McpRuntimeState {
    fn default() -> Self {
        Self {
            status: Mutex::new(McpServerStatus::Stopped),
            port: Mutex::new(None),
            pending_requests: Mutex::new(HashMap::new()),
            shutdown_sender: Mutex::new(None),
            worker: Mutex::new(None),
            request_counter: AtomicU64::new(1),
        }
    }
}

impl McpRuntimeState {
    fn snapshot(&self) -> Result<McpServerSnapshot, String> {
        Ok(McpServerSnapshot {
            status: *lock(&self.status)?,
            port: *lock(&self.port)?,
        })
    }

    fn set_status(&self, status: McpServerStatus) -> Result<(), String> {
        *lock(&self.status)? = status;
        Ok(())
    }

    fn set_port(&self, port: Option<u16>) -> Result<(), String> {
        *lock(&self.port)? = port;
        Ok(())
    }

    fn set_shutdown_sender(&self, sender: Option<mpsc::Sender<()>>) -> Result<(), String> {
        *lock(&self.shutdown_sender)? = sender;
        Ok(())
    }

    fn take_shutdown_sender(&self) -> Result<Option<mpsc::Sender<()>>, String> {
        Ok(lock(&self.shutdown_sender)?.take())
    }

    fn set_worker(&self, worker: Option<JoinHandle<()>>) -> Result<(), String> {
        *lock(&self.worker)? = worker;
        Ok(())
    }

    fn take_worker(&self) -> Result<Option<JoinHandle<()>>, String> {
        Ok(lock(&self.worker)?.take())
    }

    fn register_pending_request(
        &self,
        request_id: String,
        sender: mpsc::Sender<PendingHttpResponse>,
    ) -> Result<(), String> {
        lock(&self.pending_requests)?.insert(request_id, sender);
        Ok(())
    }

    fn take_pending_request(
        &self,
        request_id: &str,
    ) -> Result<Option<mpsc::Sender<PendingHttpResponse>>, String> {
        Ok(lock(&self.pending_requests)?.remove(request_id))
    }

    fn drain_pending_requests(&self) -> Result<Vec<mpsc::Sender<PendingHttpResponse>>, String> {
        Ok(lock(&self.pending_requests)?
            .drain()
            .map(|(_, sender)| sender)
            .collect())
    }

    fn next_request_id(&self) -> String {
        format!(
            "mcp-http-request-{}",
            self.request_counter.fetch_add(1, Ordering::Relaxed)
        )
    }
}

#[tauri::command]
pub fn mcp_get_server_state(
    state: State<'_, Arc<McpRuntimeState>>,
) -> Result<McpServerSnapshot, String> {
    state.snapshot()
}

#[tauri::command]
pub fn mcp_start_server(
    app: AppHandle,
    state: State<'_, Arc<McpRuntimeState>>,
    port: u16,
) -> Result<McpServerSnapshot, String> {
    if port == 0 {
        return Err("端口号必须大于 0。".to_string());
    }

    let current_status = *lock(&state.status)?;
    if matches!(
        current_status,
        McpServerStatus::Running | McpServerStatus::Starting | McpServerStatus::Stopping
    ) {
        return Err("MCP 服务已在运行中。".to_string());
    }

    if let Some(worker) = state.take_worker()? {
        let _ = worker.join();
    }

    state.set_status(McpServerStatus::Starting)?;
    state.set_port(Some(port))?;

    let listener = TcpListener::bind((MCP_DEFAULT_HOST, port)).map_err(|error| {
        let _ = state.set_status(McpServerStatus::Stopped);
        format!("启动 MCP 服务失败：{error}")
    })?;
    listener.set_nonblocking(true).map_err(|error| {
        let _ = state.set_status(McpServerStatus::Stopped);
        format!("配置 MCP 服务监听器失败：{error}")
    })?;

    let (shutdown_sender, shutdown_receiver) = mpsc::channel();
    state.set_shutdown_sender(Some(shutdown_sender))?;

    let runtime_state = state.inner().clone();
    let app_handle = app.clone();
    let worker = thread::spawn(move || {
        run_server(listener, shutdown_receiver, app_handle, runtime_state);
    });

    state.set_worker(Some(worker))?;
    state.set_status(McpServerStatus::Running)?;
    emit_status_changed(&app, state.inner());
    state.snapshot()
}

#[tauri::command]
pub fn mcp_stop_server(
    app: AppHandle,
    state: State<'_, Arc<McpRuntimeState>>,
) -> Result<McpServerSnapshot, String> {
    let current_status = *lock(&state.status)?;
    if matches!(current_status, McpServerStatus::Stopped) {
        return state.snapshot();
    }

    state.set_status(McpServerStatus::Stopping)?;

    if let Some(sender) = state.take_shutdown_sender()? {
        let _ = sender.send(());
    }

    for pending in state.drain_pending_requests()? {
        let _ = pending.send(PendingHttpResponse {
            status_code: 503,
            body: Some(json!({ "error": "MCP 服务已停止。" }).to_string()),
        });
    }

    if let Some(worker) = state.take_worker()? {
        let _ = worker.join();
    }

    state.set_status(McpServerStatus::Stopped)?;
    emit_status_changed(&app, state.inner());
    state.snapshot()
}

#[tauri::command]
pub fn mcp_complete_request(
    state: State<'_, Arc<McpRuntimeState>>,
    request_id: String,
    status_code: u16,
    body: Option<String>,
) -> Result<(), String> {
    let sender = state
        .take_pending_request(&request_id)?
        .ok_or_else(|| format!("未找到待处理的 MCP 请求：{request_id}"))?;

    sender
        .send(PendingHttpResponse { status_code, body })
        .map_err(|error| format!("写回 MCP 响应失败：{error}"))
}

fn run_server(
    listener: TcpListener,
    shutdown_receiver: mpsc::Receiver<()>,
    app: AppHandle,
    state: Arc<McpRuntimeState>,
) {
    loop {
        if shutdown_receiver.try_recv().is_ok() {
            break;
        }

        match listener.accept() {
            Ok((stream, _)) => {
                let app_handle = app.clone();
                let runtime_state = state.clone();
                thread::spawn(move || {
                    if let Err(error) = handle_connection(stream, app_handle, runtime_state) {
                        eprintln!("MCP HTTP 连接处理失败：{error}");
                    }
                });
            }
            Err(error) if error.kind() == ErrorKind::WouldBlock => {
                thread::sleep(ACCEPT_LOOP_DELAY);
            }
            Err(error) => {
                eprintln!("MCP 服务监听失败：{error}");
                break;
            }
        }
    }

    let _ = state.set_shutdown_sender(None);
    let _ = state.set_status(McpServerStatus::Stopped);
    emit_status_changed(&app, &state);
}

fn handle_connection(
    mut stream: TcpStream,
    app: AppHandle,
    state: Arc<McpRuntimeState>,
) -> Result<(), String> {
    stream
        .set_read_timeout(Some(READ_TIMEOUT))
        .map_err(|error| format!("设置读取超时失败：{error}"))?;
    stream
        .set_write_timeout(Some(READ_TIMEOUT))
        .map_err(|error| format!("设置写入超时失败：{error}"))?;

    let request = match read_http_request(&mut stream) {
        Ok(request) => request,
        Err(error) => {
            return write_json_response(
                &mut stream,
                400,
                Some(json!({ "error": error }).to_string()),
            );
        }
    };

    if request.method.eq_ignore_ascii_case("OPTIONS") {
        return write_empty_response(&mut stream, 204);
    }

    if request.path != "/mcp" {
        return write_json_response(
            &mut stream,
            404,
            Some(json!({ "error": "未找到 MCP 路径。" }).to_string()),
        );
    }

    if request.method.eq_ignore_ascii_case("GET") {
        let snapshot = state.snapshot()?;
        let body = json!({
            "name": "gloss-mod-manager",
            "status": snapshot.status,
            "port": snapshot.port,
            "endpoint": snapshot
                .port
                .map(|port| format!("http://{MCP_DEFAULT_HOST}:{port}/mcp")),
        })
        .to_string();

        return write_json_response(&mut stream, 200, Some(body));
    }

    if !request.method.eq_ignore_ascii_case("POST") {
        return write_json_response(
            &mut stream,
            405,
            Some(json!({ "error": "仅支持 GET、POST 和 OPTIONS 请求。" }).to_string()),
        );
    }

    let request_id = state.next_request_id();
    let (response_sender, response_receiver) = mpsc::channel();
    state.register_pending_request(request_id.clone(), response_sender)?;

    let emit_result = app.emit(
        MCP_EVENT_NAME,
        McpHttpRequestEvent {
            request_id: request_id.clone(),
            body: request.body,
        },
    );

    if let Err(error) = emit_result {
        let _ = state.take_pending_request(&request_id);
        return write_json_response(
            &mut stream,
            500,
            Some(
                json!({
                    "error": format!("分发 MCP 请求到前端失败：{error}"),
                })
                .to_string(),
            ),
        );
    }

    match response_receiver.recv_timeout(REQUEST_TIMEOUT) {
        Ok(response) => write_json_response(&mut stream, response.status_code, response.body),
        Err(mpsc::RecvTimeoutError::Timeout) => {
            let _ = state.take_pending_request(&request_id);
            write_json_response(
                &mut stream,
                504,
                Some(json!({ "error": "等待前端处理 MCP 请求超时。" }).to_string()),
            )
        }
        Err(mpsc::RecvTimeoutError::Disconnected) => {
            let _ = state.take_pending_request(&request_id);
            write_json_response(
                &mut stream,
                500,
                Some(json!({ "error": "前端 MCP 响应通道已断开。" }).to_string()),
            )
        }
    }
}

fn read_http_request(stream: &mut TcpStream) -> Result<ParsedHttpRequest, String> {
    let mut buffer = Vec::<u8>::new();
    let mut chunk = [0_u8; 4096];
    let mut header_end = None;

    while header_end.is_none() {
        let read_count = stream
            .read(&mut chunk)
            .map_err(|error| format!("读取 HTTP 请求失败：{error}"))?;

        if read_count == 0 {
            return Err("客户端在发送完整请求前已断开连接。".to_string());
        }

        buffer.extend_from_slice(&chunk[..read_count]);

        if buffer.len() > MAX_HEADER_BYTES {
            return Err("HTTP 请求头过大。".to_string());
        }

        header_end = find_header_end(&buffer);
    }

    let header_end = header_end.ok_or_else(|| "HTTP 请求头不完整。".to_string())?;
    let header_text = String::from_utf8_lossy(&buffer[..header_end]).into_owned();
    let mut lines = header_text.split("\r\n").filter(|line| !line.is_empty());

    let request_line = lines
        .next()
        .ok_or_else(|| "HTTP 请求行为空。".to_string())?;
    let mut request_line_parts = request_line.split_whitespace();
    let method = request_line_parts
        .next()
        .ok_or_else(|| "HTTP 请求方法缺失。".to_string())?
        .to_string();
    let raw_path = request_line_parts
        .next()
        .ok_or_else(|| "HTTP 请求路径缺失。".to_string())?;
    let path = raw_path.split('?').next().unwrap_or(raw_path).to_string();

    let mut headers = HashMap::<String, String>::new();
    for line in lines {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        headers.insert(name.trim().to_ascii_lowercase(), value.trim().to_string());
    }

    let content_length = headers
        .get("content-length")
        .map(|value| {
            value
                .parse::<usize>()
                .map_err(|error| format!("无效的 Content-Length：{error}"))
        })
        .transpose()?
        .unwrap_or(0);

    if content_length > MAX_BODY_BYTES {
        return Err("HTTP 请求体过大。".to_string());
    }

    while buffer.len() < header_end + content_length {
        let read_count = stream
            .read(&mut chunk)
            .map_err(|error| format!("读取 HTTP 请求体失败：{error}"))?;

        if read_count == 0 {
            return Err("HTTP 请求体长度不足。".to_string());
        }

        buffer.extend_from_slice(&chunk[..read_count]);
    }

    let body_bytes = &buffer[header_end..header_end + content_length];
    let body = String::from_utf8(body_bytes.to_vec())
        .map_err(|error| format!("HTTP 请求体不是有效的 UTF-8：{error}"))?;

    Ok(ParsedHttpRequest { method, path, body })
}

fn find_header_end(buffer: &[u8]) -> Option<usize> {
    buffer
        .windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|index| index + 4)
}

fn write_empty_response(stream: &mut TcpStream, status_code: u16) -> Result<(), String> {
    write_response(stream, status_code, None)
}

fn write_json_response(
    stream: &mut TcpStream,
    status_code: u16,
    body: Option<String>,
) -> Result<(), String> {
    write_response(stream, status_code, body)
}

fn write_response(
    stream: &mut TcpStream,
    status_code: u16,
    body: Option<String>,
) -> Result<(), String> {
    let body_string = body.unwrap_or_default();
    let mut response = format!(
        "HTTP/1.1 {} {}\r\n\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Headers: content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id\r\n\
Access-Control-Expose-Headers: content-type, mcp-session-id, www-authenticate\r\n\
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS\r\n\
Cache-Control: no-store\r\n\
Connection: close\r\n\
Content-Length: {}\r\n",
        status_code,
        status_text(status_code),
        body_string.as_bytes().len(),
    );

    if status_code != 204 {
        response.push_str("Content-Type: application/json; charset=utf-8\r\n");
    }

    response.push_str("\r\n");

    stream
        .write_all(response.as_bytes())
        .map_err(|error| format!("写入 HTTP 响应头失败：{error}"))?;

    if !body_string.is_empty() {
        stream
            .write_all(body_string.as_bytes())
            .map_err(|error| format!("写入 HTTP 响应体失败：{error}"))?;
    }

    stream
        .flush()
        .map_err(|error| format!("刷新 HTTP 响应失败：{error}"))
}

fn status_text(status_code: u16) -> &'static str {
    match status_code {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Internal Server Error",
        503 => "Service Unavailable",
        504 => "Gateway Timeout",
        _ => "OK",
    }
}

fn emit_status_changed(app: &AppHandle, state: &Arc<McpRuntimeState>) {
    if let Ok(snapshot) = state.snapshot() {
        let _ = app.emit(MCP_STATUS_EVENT_NAME, snapshot);
    }
}

fn lock<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>, String> {
    mutex
        .lock()
        .map_err(|_| "MCP 服务内部状态锁定失败。".to_string())
}
