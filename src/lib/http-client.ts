import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

/**
 * 各 mod 平台接口此前直接调用 plugin-http 的 fetch，既没有连接超时也没有整体超时，
 * 一旦对端无响应就会永久挂起且无法取消；同时缺少重试，偶发抖动会直接冒泡成硬错误。
 * 这里统一收敛超时、取消与退避重试策略。
 */

const DEFAULT_CONNECT_TIMEOUT = 10_000;
const DEFAULT_REQUEST_TIMEOUT = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_DELAY = 500;
// 这些状态码通常是短时故障或限流，值得重试。
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface IRequestOptions extends RequestInit {
    /** 连接阶段超时，默认 10 秒。 */
    connectTimeout?: number;
    /** 单次请求整体超时，默认 30 秒。 */
    requestTimeout?: number;
    /** 失败重试次数（不含首次请求），默认 2。 */
    maxRetries?: number;
}

function sleep(duration: number) {
    return new Promise<void>((resolve) => {
        globalThis.setTimeout(resolve, duration);
    });
}

function isAbortError(error: unknown) {
    return error instanceof Error && error.name === "AbortError";
}

/**
 * 带超时与退避重试的 HTTP 请求。
 *
 * 超时由 AbortSignal 控制整体耗时，connectTimeout 仅约束连接建立阶段。
 * 仅对网络异常与可重试状态码进行重试，4xx 业务错误直接返回给调用方处理。
 */
export async function requestWithRetry(
    url: string,
    options: IRequestOptions = {},
): Promise<Response> {
    const {
        connectTimeout = DEFAULT_CONNECT_TIMEOUT,
        requestTimeout = DEFAULT_REQUEST_TIMEOUT,
        maxRetries = DEFAULT_MAX_RETRIES,
        signal: callerSignal,
        ...requestInit
    } = options;

    let lastError: unknown = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        const timeoutController = new AbortController();
        const timeoutId = globalThis.setTimeout(() => {
            timeoutController.abort();
        }, requestTimeout);

        // 调用方自带的取消信号需要和超时信号一起生效。
        const abortListener = () => timeoutController.abort();
        callerSignal?.addEventListener("abort", abortListener, { once: true });

        try {
            const response = await tauriFetch(url, {
                ...requestInit,
                signal: timeoutController.signal,
                connectTimeout,
            });

            if (
                RETRYABLE_STATUS_CODES.has(response.status) &&
                attempt < maxRetries
            ) {
                lastError = new Error(`请求失败，状态码 ${response.status}`);
                await sleep(DEFAULT_RETRY_BASE_DELAY * 2 ** attempt);
                continue;
            }

            return response;
        } catch (error: unknown) {
            lastError = error;

            // 调用方主动取消时不再重试。
            if (callerSignal?.aborted) {
                throw error;
            }

            if (isAbortError(error)) {
                lastError = new Error(
                    `请求超时（${requestTimeout}ms）：${url}`,
                );
            }

            if (attempt >= maxRetries) {
                break;
            }

            await sleep(DEFAULT_RETRY_BASE_DELAY * 2 ** attempt);
        } finally {
            globalThis.clearTimeout(timeoutId);
            callerSignal?.removeEventListener("abort", abortListener);
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(String(lastError ?? "请求失败。"));
}
