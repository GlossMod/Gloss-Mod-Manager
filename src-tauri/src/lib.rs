mod mcp_server;

use std::io;
use std::path::PathBuf;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_log::{Target, TargetKind, TimezoneStrategy};
use time::format_description::well_known::Rfc3339;
use time::macros::format_description;
use time::OffsetDateTime;

const APP_LAUNCH_FILES_EVENT_NAME: &str = "app-launch-files";

#[derive(Default)]
struct AppLaunchState {
    pending_files: Mutex<Vec<String>>,
}

impl AppLaunchState {
    fn push_files(&self, files: Vec<String>) {
        if let Ok(mut pending_files) = self.pending_files.lock() {
            pending_files.extend(files);
        }
    }

    fn take_pending_files(&self) -> Vec<String> {
        if let Ok(mut pending_files) = self.pending_files.lock() {
            return std::mem::take(&mut *pending_files);
        }

        Vec::new()
    }
}

#[derive(Clone, serde::Serialize)]
struct AppLaunchFilesEvent {
    paths: Vec<String>,
}

#[tauri::command]
fn app_take_pending_launch_files(state: tauri::State<AppLaunchState>) -> Vec<String> {
    state.take_pending_files()
}

#[tauri::command]
fn app_process_id() -> u32 {
    std::process::id()
}

/// 探测本地端口是否已有进程监听。
///
/// aria2 未启动时若直接用 fetch 试探 RPC 端口，WebKit 会把每次失败都当成
/// 网络错误打到控制台（且无法从 JS 侧捕获静音），所以放到 Rust 里做 TCP 连接判断。
#[tauri::command]
fn app_is_local_port_open(port: u16, timeout_ms: Option<u64>) -> bool {
    use std::net::{Ipv4Addr, SocketAddr, TcpStream};

    if port == 0 {
        return false;
    }

    let timeout = std::time::Duration::from_millis(timeout_ms.unwrap_or(300).clamp(50, 5_000));
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));

    TcpStream::connect_timeout(&address, timeout).is_ok()
}

fn normalize_file_launch_arg(value: &str) -> Option<String> {
    let trimmed = value.trim().trim_matches('"');

    if trimmed.is_empty()
        || trimmed.starts_with("--")
        || trimmed.starts_with("gmm://")
        || trimmed.starts_with("nxm://")
    {
        return None;
    }

    let normalized = if let Some(file_url) = trimmed.strip_prefix("file://") {
        // 仅 Windows 分支会重新赋值去掉前导斜杠，其他平台下不需要可变。
        #[cfg_attr(not(target_os = "windows"), allow(unused_mut))]
        let mut path = file_url;

        #[cfg(target_os = "windows")]
        {
            if path.starts_with('/') && path.chars().nth(2) == Some(':') {
                path = &path[1..];
            }

            return if path.to_ascii_lowercase().ends_with(".gmm") {
                Some(path.replace('/', "\\"))
            } else {
                None
            };
        }

        #[cfg(not(target_os = "windows"))]
        {
            path.to_string()
        }
    } else {
        trimmed.to_string()
    };

    if normalized.to_ascii_lowercase().ends_with(".gmm") {
        return Some(normalized);
    }

    None
}

fn collect_launch_files<I>(args: I) -> Vec<String>
where
    I: IntoIterator<Item = String>,
{
    args.into_iter()
        .skip(1)
        .filter_map(|value| normalize_file_launch_arg(&value))
        .collect()
}

fn format_local_timestamp() -> String {
    OffsetDateTime::now_local()
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

fn build_session_log_file_name() -> String {
    let file_name_format = format_description!("[year]-[month]-[day]_[hour]-[minute]-[second]");

    OffsetDateTime::now_local()
        .unwrap_or_else(|_| OffsetDateTime::now_utc())
        .format(&file_name_format)
        .unwrap_or_else(|_| "session".to_string())
}

fn resolve_app_log_directory(bundle_identifier: &str) -> io::Result<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home_directory = std::env::var_os("HOME").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "HOME environment variable is missing",
            )
        })?;

        return Ok(PathBuf::from(home_directory)
            .join("Library")
            .join("Logs")
            .join(bundle_identifier));
    }

    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var_os("LOCALAPPDATA").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "LOCALAPPDATA environment variable is missing",
            )
        })?;

        return Ok(PathBuf::from(local_app_data)
            .join(bundle_identifier)
            .join("logs"));
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        if let Some(data_home) = std::env::var_os("XDG_DATA_HOME") {
            return Ok(PathBuf::from(data_home)
                .join(bundle_identifier)
                .join("logs"));
        }

        let home_directory = std::env::var_os("HOME").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::NotFound,
                "HOME environment variable is missing",
            )
        })?;

        return Ok(PathBuf::from(home_directory)
            .join(".local")
            .join("share")
            .join(bundle_identifier)
            .join("logs"));
    }
}

fn prepare_log_directory(bundle_identifier: &str) -> io::Result<PathBuf> {
    let log_directory = resolve_app_log_directory(bundle_identifier)?;
    std::fs::create_dir_all(&log_directory)?;

    let latest_log_path = log_directory.join("latest.log");
    if latest_log_path.exists() {
        if let Err(error) = std::fs::remove_file(&latest_log_path) {
            if error.kind() != io::ErrorKind::PermissionDenied
                && error.kind() != io::ErrorKind::NotFound
            {
                return Err(error);
            }
        }
    }

    Ok(log_directory)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let log_directory = prepare_log_directory(&context.config().identifier)
        .expect("could not prepare log directory");
    let session_log_file_name = build_session_log_file_name();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }

            let launch_files = collect_launch_files(args);

            if launch_files.is_empty() {
                return;
            }

            if let Some(state) = app.try_state::<AppLaunchState>() {
                state.push_files(launch_files.clone());
            }

            let _ = app.emit(
                APP_LAUNCH_FILES_EVENT_NAME,
                AppLaunchFilesEvent {
                    paths: launch_files,
                },
            );
        }));
    }

    builder = builder
        .manage(AppLaunchState::default())
        .manage(Arc::new(mcp_server::McpRuntimeState::default()))
        .invoke_handler(tauri::generate_handler![
            app_take_pending_launch_files,
            app_process_id,
            app_is_local_port_open,
            mcp_server::mcp_get_server_state,
            mcp_server::mcp_start_server,
            mcp_server::mcp_stop_server,
            mcp_server::mcp_complete_request
        ])
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::Folder {
                        path: log_directory.clone(),
                        file_name: Some(session_log_file_name),
                    }),
                    Target::new(TargetKind::Folder {
                        path: log_directory,
                        file_name: Some("latest".to_string()),
                    }),
                ])
                .timezone_strategy(TimezoneStrategy::UseLocal)
                .format(|out, message, record| {
                    out.finish(format_args!(
                        "{} [{}] [{}] {}",
                        format_local_timestamp(),
                        record.level(),
                        record.target(),
                        message
                    ))
                })
                .build(),
        )
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_deep_link::init());

    builder
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("stronghold-salt.txt");

            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;

            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                app.handle().plugin(tauri_plugin_cli::init())?;
                app.handle().plugin(tauri_plugin_positioner::init())?;
                app.handle()
                    .plugin(tauri_plugin_autostart::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_persisted_scope::init())?;
                app.handle()
                    .plugin(tauri_plugin_window_state::Builder::default().build())?;
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;

                #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
                {
                    use tauri_plugin_deep_link::DeepLinkExt;
                    app.deep_link().register_all()?;
                }
            }

            let launch_files = collect_launch_files(std::env::args());

            if !launch_files.is_empty() {
                app.state::<AppLaunchState>().push_files(launch_files);
            }

            log::info!(target: "gmm::startup", "日志系统初始化完成。");
            Ok(())
        })
        .run(context)
        .expect("error while running tauri application");
}
