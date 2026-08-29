import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("@tauri-apps/plugin-http", () => ({
    fetch: (...args: unknown[]) => fetchMock(...args),
}));

const { requestWithRetry } = await import("./http-client");

function jsonResponse(status: number) {
    return new Response("{}", { status });
}

afterEach(() => {
    fetchMock.mockReset();
});

describe("requestWithRetry", () => {
    it("成功时直接返回响应且只请求一次", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200));

        const response = await requestWithRetry("https://example.test");

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("默认带上连接超时与取消信号", async () => {
        fetchMock.mockResolvedValue(jsonResponse(200));

        await requestWithRetry("https://example.test");

        const options = fetchMock.mock.calls[0][1] as Record<string, unknown>;
        expect(options.connectTimeout).toBe(10_000);
        expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it("对 503 等可重试状态码进行重试", async () => {
        fetchMock
            .mockResolvedValueOnce(jsonResponse(503))
            .mockResolvedValueOnce(jsonResponse(200));

        const response = await requestWithRetry("https://example.test", {
            maxRetries: 1,
        });

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("对 404 等业务错误不重试，直接返回", async () => {
        fetchMock.mockResolvedValue(jsonResponse(404));

        const response = await requestWithRetry("https://example.test", {
            maxRetries: 2,
        });

        expect(response.status).toBe(404);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("网络异常时重试，超过次数后抛出", async () => {
        fetchMock.mockRejectedValue(new Error("network down"));

        await expect(
            requestWithRetry("https://example.test", { maxRetries: 2 }),
        ).rejects.toThrow("network down");
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("网络异常后恢复则返回成功响应", async () => {
        fetchMock
            .mockRejectedValueOnce(new Error("network down"))
            .mockResolvedValueOnce(jsonResponse(200));

        const response = await requestWithRetry("https://example.test", {
            maxRetries: 2,
        });

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("超时会抛出带 url 的超时错误且不无限挂起", async () => {
        // 模拟对端永不响应，仅在收到取消信号时结束。
        fetchMock.mockImplementation((_url: string, options: RequestInit) => {
            return new Promise((_resolve, reject) => {
                options.signal?.addEventListener("abort", () => {
                    const abortError = new Error("aborted");
                    abortError.name = "AbortError";
                    reject(abortError);
                });
            });
        });

        await expect(
            requestWithRetry("https://example.test", {
                requestTimeout: 20,
                maxRetries: 0,
            }),
        ).rejects.toThrow(/请求超时/u);
    });

    it("调用方主动取消时立即抛出且不重试", async () => {
        const controller = new AbortController();

        fetchMock.mockImplementation((_url: string, options: RequestInit) => {
            return new Promise((_resolve, reject) => {
                options.signal?.addEventListener("abort", () => {
                    const abortError = new Error("aborted");
                    abortError.name = "AbortError";
                    reject(abortError);
                });
            });
        });

        const pending = requestWithRetry("https://example.test", {
            signal: controller.signal,
            maxRetries: 3,
        });
        controller.abort();

        await expect(pending).rejects.toThrow();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
