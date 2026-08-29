import { invoke } from "@tauri-apps/api/core";
import { appLocalDataDir, documentDir, join } from "@tauri-apps/api/path";
import { Aria2 } from "@/lib/aria2";
import { FileHandler } from "@/lib/FileHandler";
import { PersistentStore } from "@/lib/persistent-store";
import type { SpawnedSidecarProcess } from "@/lib/sidecar";

const DEFAULT_RPC_PORT = 6800;
const DEFAULT_RPC_SECRET = "gloss-mod-manager";
const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 5;
const FIXED_MAX_CONCURRENT_DOWNLOADS = 5;
const DEFAULT_SPLIT = 8;
const DEFAULT_MAX_CONNECTION_PER_SERVER = 8;
const DEFAULT_MIN_SPLIT_SIZE = "1M";
const RPC_REQUEST_TIMEOUT_MS = 2500;
const RPC_START_TIMEOUT_MS = 8000;
const RPC_SHUTDOWN_TIMEOUT_MS = 2500;
const RPC_TASK_KEYS = [
    "gid",
    "status",
    "totalLength",
    "completedLength",
    "uploadLength",
    "downloadSpeed",
    "uploadSpeed",
    "connections",
    "numSeeders",
    "dir",
    "files",
    "bittorrent",
    "errorCode",
    "errorMessage",
    "followedBy",
    "belongsTo",
] as const;

export interface IAria2RpcTaskUri {
    status: string;
    uri: string;
}

export interface IAria2RpcTaskFile {
    index?: string;
    path?: string;
    length?: string;
    completedLength?: string;
    selected?: string;
    uris?: IAria2RpcTaskUri[];
}

export interface IAria2RpcTask {
    gid: string;
    status: string;
    totalLength?: string;
    completedLength?: string;
    uploadLength?: string;
    downloadSpeed?: string;
    uploadSpeed?: string;
    connections?: string;
    numSeeders?: string;
    dir?: string;
    files: IAria2RpcTaskFile[];
    bittorrent?: {
        info?: {
            name?: string;
        };
    };
    errorCode?: string;
    errorMessage?: string;
    followedBy?: string[];
    belongsTo?: string;
}

export interface IAria2GlobalStat {
    downloadSpeed: string;
    uploadSpeed: string;
    numActive: string;
    numWaiting: string;
    numStopped: string;
}

export interface IAria2RpcEnsureOptions {
    outputDirectory?: string;
    listenPort?: number;
    secret?: string;
    maxConcurrentDownloads?: number;
    split?: number;
    maxConnectionPerServer?: number;
    minSplitSize?: string;
}

export interface IAria2RuntimeSettings {
    autoStart: boolean;
    rpcPort: number;
    rpcSecret: string;
    maxConcurrentDownloads: number;
    split: number;
    maxConnectionPerServer: number;
    minSplitSize: string;
}

interface IAria2RpcEnvelope<T> {
    id?: string;
    jsonrpc: string;
    result?: T;
    error?: {
        code?: number;
        message?: string;
        data?: unknown;
    };
}

interface IResolvedRpcOptions {
    outputDirectory: string;
    listenPort: number;
    secret: string;
    maxConcurrentDownloads: number;
    split: number;
    maxConnectionPerServer: number;
    minSplitSize: string;
}

export class Aria2Rpc {
    private static rpcProcess: SpawnedSidecarProcess | null = null;
    private static ensureServerPromise: Promise<void> | null = null;
    private static appProcessIdPromise: Promise<number | null> | null = null;
    private static currentOptions: IResolvedRpcOptions = {
        outputDirectory: "",
        listenPort: DEFAULT_RPC_PORT,
        secret: DEFAULT_RPC_SECRET,
        maxConcurrentDownloads: DEFAULT_MAX_CONCURRENT_DOWNLOADS,
        split: DEFAULT_SPLIT,
        maxConnectionPerServer: DEFAULT_MAX_CONNECTION_PER_SERVER,
        minSplitSize: DEFAULT_MIN_SPLIT_SIZE,
    };

    public static getDefaultSettings(): IAria2RuntimeSettings {
        return {
            autoStart: true,
            rpcPort: DEFAULT_RPC_PORT,
            rpcSecret: DEFAULT_RPC_SECRET,
            maxConcurrentDownloads: DEFAULT_MAX_CONCURRENT_DOWNLOADS,
            split: DEFAULT_SPLIT,
            maxConnectionPerServer: DEFAULT_MAX_CONNECTION_PER_SERVER,
            minSplitSize: DEFAULT_MIN_SPLIT_SIZE,
        };
    }

    public static normalizeSettings(
        settings: Partial<IAria2RuntimeSettings> = {},
    ): IAria2RuntimeSettings {
        const defaults = Aria2Rpc.getDefaultSettings();

        return {
            autoStart: settings.autoStart ?? defaults.autoStart,
            rpcPort: Math.max(
                1,
                Math.round(settings.rpcPort ?? defaults.rpcPort),
            ),
            rpcSecret:
                (settings.rpcSecret ?? defaults.rpcSecret).trim() ||
                defaults.rpcSecret,
            // 3DM 源站容易在批量同时下载时返回 503，这里将并发任务固定为 5。
            maxConcurrentDownloads: FIXED_MAX_CONCURRENT_DOWNLOADS,
            split: Math.max(1, Math.round(settings.split ?? defaults.split)),
            maxConnectionPerServer: Math.max(
                1,
                Math.round(
                    settings.maxConnectionPerServer ??
                        defaults.maxConnectionPerServer,
                ),
            ),
            minSplitSize:
                (settings.minSplitSize ?? defaults.minSplitSize).trim() ||
                defaults.minSplitSize,
        };
    }

    public static async getStoredSettings() {
        const settings = await PersistentStore.get<
            Partial<IAria2RuntimeSettings>
        >("aria2Settings", Aria2Rpc.getDefaultSettings());

        return Aria2Rpc.normalizeSettings(settings ?? undefined);
    }

    public static async resolveDownloadDirectory() {
        const explicitDirectory = (
            await PersistentStore.get<string>("downloadDirectory", "")
        )?.trim();

        if (explicitDirectory) {
            return explicitDirectory;
        }

        const storagePath = (
            await PersistentStore.get<string>("storagePath", "")
        )?.trim();
        const baseDirectory =
            storagePath ||
            (await join(await documentDir(), "Gloss Mod Manager"));

        return await join(baseDirectory, "downloads", "mods");
    }

    private static async resolveOptions(
        options: IAria2RpcEnsureOptions = {},
    ): Promise<IResolvedRpcOptions> {
        const storedSettings = await Aria2Rpc.getStoredSettings();

        return {
            outputDirectory:
                options.outputDirectory ||
                Aria2Rpc.currentOptions.outputDirectory ||
                (await Aria2Rpc.resolveDownloadDirectory()),
            listenPort:
                options.listenPort ??
                Aria2Rpc.currentOptions.listenPort ??
                storedSettings.rpcPort,
            secret:
                options.secret ??
                Aria2Rpc.currentOptions.secret ??
                storedSettings.rpcSecret,
            maxConcurrentDownloads:
                options.maxConcurrentDownloads ??
                Aria2Rpc.currentOptions.maxConcurrentDownloads ??
                storedSettings.maxConcurrentDownloads,
            split:
                options.split ??
                Aria2Rpc.currentOptions.split ??
                storedSettings.split,
            maxConnectionPerServer:
                options.maxConnectionPerServer ??
                Aria2Rpc.currentOptions.maxConnectionPerServer ??
                storedSettings.maxConnectionPerServer,
            minSplitSize:
                options.minSplitSize ??
                Aria2Rpc.currentOptions.minSplitSize ??
                storedSettings.minSplitSize,
        };
    }

    private static getRpcEndpoint(options: IResolvedRpcOptions) {
        return `http://127.0.0.1:${options.listenPort}/jsonrpc`;
    }

    private static createRequestId() {
        if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
            return crypto.randomUUID();
        }

        return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    private static async sleep(duration: number) {
        await new Promise((resolve) =>
            globalThis.setTimeout(resolve, duration),
        );
    }

    private static async resolveAppProcessId() {
        if (!Aria2Rpc.appProcessIdPromise) {
            Aria2Rpc.appProcessIdPromise = invoke<number>("app_process_id")
                .then((processId) => {
                    if (!Number.isFinite(processId) || processId <= 0) {
                        return null;
                    }

                    return Math.round(processId);
                })
                .catch((error) => {
                    console.warn(
                        "获取应用进程 ID 失败，aria2 将跳过父进程监听。",
                        error,
                    );
                    return null;
                });
        }

        return Aria2Rpc.appProcessIdPromise;
    }

    private static async buildRpcLifecycleArgs() {
        const args = [
            "--no-conf=true",
            "--save-session-interval=0",
            "--console-log-level=warn",
            "--summary-interval=0",
            "--download-result=default",
            "--enable-dht=false",
            "--enable-dht6=false",
            "--enable-peer-exchange=false",
            "--bt-enable-lpd=false",
            "--seed-time=0",
        ];
        const appProcessId = await Aria2Rpc.resolveAppProcessId();

        if (appProcessId) {
            // aria2 自己监听父进程，主程序被强制关闭时也能及时退出。
            args.push(`--stop-with-process=${appProcessId}`);
        }

        return args;
    }

    private static buildParams(
        options: IResolvedRpcOptions,
        params: unknown[],
    ) {
        if (!options.secret) {
            return params;
        }

        return [`token:${options.secret}`, ...params];
    }

    private static async request<T>(
        method: string,
        params: unknown[] = [],
        options: IResolvedRpcOptions = Aria2Rpc.currentOptions,
        timeoutMs: number = RPC_REQUEST_TIMEOUT_MS,
    ) {
        const controller = new AbortController();
        const timer = globalThis.setTimeout(
            () => controller.abort(),
            timeoutMs,
        );

        try {
            const response = await fetch(Aria2Rpc.getRpcEndpoint(options), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: Aria2Rpc.createRequestId(),
                    method: `aria2.${method}`,
                    params: Aria2Rpc.buildParams(options, params),
                }),
                signal: controller.signal,
            });
            const payload = (await response.json()) as IAria2RpcEnvelope<T>;

            if (!response.ok) {
                throw new Error(`aria2 RPC 请求失败 (${response.status})`);
            }

            if (payload.error) {
                throw new Error(
                    payload.error.message ||
                        `aria2 RPC 错误 (${payload.error.code ?? "unknown"})`,
                );
            }

            if (payload.result === undefined) {
                throw new Error("aria2 RPC 返回结果为空");
            }

            return payload.result;
        } finally {
            globalThis.clearTimeout(timer);
        }
    }

    private static async ensureSessionFile() {
        const baseDirectory = await join(await appLocalDataDir(), "aria2");
        const sessionFilePath = await join(baseDirectory, "session.txt");

        await FileHandler.createDirectory(baseDirectory);

        if (!(await FileHandler.fileExists(sessionFilePath))) {
            await FileHandler.writeFile(sessionFilePath, "");
        }

        return sessionFilePath;
    }

    private static bindProcessEvents(process: SpawnedSidecarProcess) {
        process.command.on("close", () => {
            if (Aria2Rpc.rpcProcess?.child.pid === process.child.pid) {
                Aria2Rpc.rpcProcess = null;
            }
        });

        process.command.on("error", (error) => {
            console.error("aria2 RPC 进程错误");
            console.error(error);
        });
    }

    private static async waitUntilReady(options: IResolvedRpcOptions) {
        const deadline = Date.now() + RPC_START_TIMEOUT_MS;
        let lastError: unknown = null;

        while (Date.now() < deadline) {
            // 端口还没起来时不发 fetch，避免控制台被连接失败刷屏。
            if (!(await Aria2Rpc.isRpcPortOpen(options, 250))) {
                await Aria2Rpc.sleep(250);
                continue;
            }

            try {
                await Aria2Rpc.request("getVersion", [], options, 1000);
                return;
            } catch (error: unknown) {
                lastError = error;
                await Aria2Rpc.sleep(250);
            }
        }

        throw lastError instanceof Error
            ? lastError
            : new Error("aria2 RPC 启动超时");
    }

    /**
     * 先在 Rust 侧做一次 TCP 探测，确认端口有人监听再发 RPC。
     * WebKit 会把 fetch 的连接失败直接打到控制台且无法从 JS 静音，
     * aria2 未启动时的轮询会刷出大量 "Could not connect to the server."。
     */
    private static async isRpcPortOpen(
        options: IResolvedRpcOptions,
        timeoutMs: number,
    ) {
        try {
            return await invoke<boolean>("app_is_local_port_open", {
                port: options.listenPort,
                timeoutMs: Math.min(timeoutMs, 1000),
            });
        } catch {
            // 命令不可用时退回直接请求，行为与探测前一致。
            return true;
        }
    }

    private static async ping(
        options: IResolvedRpcOptions,
        timeoutMs: number = 1000,
    ) {
        if (!(await Aria2Rpc.isRpcPortOpen(options, timeoutMs))) {
            return false;
        }

        try {
            await Aria2Rpc.request("getVersion", [], options, timeoutMs);
            return true;
        } catch {
            return false;
        }
    }

    private static async shutdownServerByRpc(options: IResolvedRpcOptions) {
        try {
            await Aria2Rpc.request("saveSession", [], options, 1000);
        } catch {
            // 服务已退出或不可达时，后续 kill 兜底即可。
        }

        try {
            await Aria2Rpc.request("forceShutdown", [], options, 1000);
        } catch {
            return false;
        }

        const deadline = Date.now() + RPC_SHUTDOWN_TIMEOUT_MS;

        while (Date.now() < deadline) {
            if (!(await Aria2Rpc.ping(options, 400))) {
                return true;
            }

            await Aria2Rpc.sleep(100);
        }

        return !(await Aria2Rpc.ping(options, 400));
    }

    private static async saveSessionBestEffort() {
        try {
            await Aria2Rpc.request("saveSession", [], Aria2Rpc.currentOptions);
        } catch (error) {
            console.error("保存 aria2 下载会话失败");
            console.error(error);
        }
    }

    private static async isServerManagedByCurrentProcess(
        options: IResolvedRpcOptions,
    ) {
        const appProcessId = await Aria2Rpc.resolveAppProcessId();

        if (!appProcessId) {
            return true;
        }

        try {
            const globalOptions = await Aria2Rpc.request<
                Record<string, string>
            >("getGlobalOption", [], options, 1000);

            return globalOptions["stop-with-process"] === String(appProcessId);
        } catch {
            return true;
        }
    }

    public static async ensureServer(options: IAria2RpcEnsureOptions = {}) {
        const resolvedOptions = await Aria2Rpc.resolveOptions(options);
        Aria2Rpc.currentOptions = resolvedOptions;

        if (await Aria2Rpc.ping(resolvedOptions)) {
            if (
                Aria2Rpc.rpcProcess ||
                (await Aria2Rpc.isServerManagedByCurrentProcess(
                    resolvedOptions,
                ))
            ) {
                return;
            }

            const stoppedExistingServer =
                await Aria2Rpc.shutdownServerByRpc(resolvedOptions);

            if (!stoppedExistingServer) {
                console.warn(
                    "检测到未绑定当前进程的 aria2 服务，但无法自动重启。",
                );
                return;
            }
        }

        if (Aria2Rpc.ensureServerPromise) {
            return Aria2Rpc.ensureServerPromise;
        }

        Aria2Rpc.ensureServerPromise = (async () => {
            const sessionFilePath = await Aria2Rpc.ensureSessionFile();
            const lifecycleArgs = await Aria2Rpc.buildRpcLifecycleArgs();

            if (Aria2Rpc.rpcProcess) {
                try {
                    await Aria2Rpc.rpcProcess.stop();
                } catch {
                    // 忽略旧进程的清理失败，继续重新拉起。
                }
                Aria2Rpc.rpcProcess = null;
            }

            const rpcProcess = await Aria2.startRpcServer({
                outputDirectory: resolvedOptions.outputDirectory,
                listenPort: resolvedOptions.listenPort,
                secret: resolvedOptions.secret,
                continueDownload: true,
                extraArgs: [
                    "--rpc-allow-origin-all=true",
                    "--rpc-save-upload-metadata=false",
                    "--rpc-max-request-size=8M",
                    ...lifecycleArgs,
                    `--input-file=${sessionFilePath}`,
                    `--save-session=${sessionFilePath}`,
                    `--max-concurrent-downloads=${resolvedOptions.maxConcurrentDownloads}`,
                    `--split=${resolvedOptions.split}`,
                    `--max-connection-per-server=${resolvedOptions.maxConnectionPerServer}`,
                    `--min-split-size=${resolvedOptions.minSplitSize}`,
                    "--auto-file-renaming=false",
                    "--allow-overwrite=true",
                    "--always-resume=true",
                ],
            });

            Aria2Rpc.rpcProcess = rpcProcess;
            Aria2Rpc.bindProcessEvents(rpcProcess);

            try {
                await Aria2Rpc.waitUntilReady(resolvedOptions);
            } catch (error) {
                try {
                    await rpcProcess.stop();
                } catch {
                    // 进程已经退出时无需额外处理。
                }
                Aria2Rpc.rpcProcess = null;
                throw error;
            }
        })().finally(() => {
            Aria2Rpc.ensureServerPromise = null;
        });

        return Aria2Rpc.ensureServerPromise;
    }

    public static async getVersion(ensureServer: boolean = true) {
        if (ensureServer) {
            await Aria2Rpc.ensureServer();
        }

        return Aria2Rpc.request<{
            version: string;
            enabledFeatures: string[];
        }>("getVersion");
    }

    public static async getGlobalStat() {
        await Aria2Rpc.ensureServer();
        return Aria2Rpc.request<IAria2GlobalStat>("getGlobalStat");
    }

    public static async tellActive() {
        await Aria2Rpc.ensureServer();
        return Aria2Rpc.request<IAria2RpcTask[]>("tellActive", [
            [...RPC_TASK_KEYS],
        ]);
    }

    public static async tellWaiting(offset: number = 0, count: number = 100) {
        await Aria2Rpc.ensureServer();
        return Aria2Rpc.request<IAria2RpcTask[]>("tellWaiting", [
            offset,
            count,
            [...RPC_TASK_KEYS],
        ]);
    }

    public static async tellStopped(offset: number = 0, count: number = 100) {
        await Aria2Rpc.ensureServer();
        return Aria2Rpc.request<IAria2RpcTask[]>("tellStopped", [
            offset,
            count,
            [...RPC_TASK_KEYS],
        ]);
    }

    public static async tellStatus(gid: string) {
        await Aria2Rpc.ensureServer();
        return Aria2Rpc.request<IAria2RpcTask>("tellStatus", [
            gid,
            [...RPC_TASK_KEYS],
        ]);
    }

    public static async addUri(
        uris: string[],
        options: Record<string, string> = {},
    ) {
        await Aria2Rpc.ensureServer();
        const gid = await Aria2Rpc.request<string>("addUri", [uris, options]);
        await Aria2Rpc.saveSessionBestEffort();

        return gid;
    }

    public static async pause(gid: string, force: boolean = false) {
        await Aria2Rpc.ensureServer();
        const result = await Aria2Rpc.request<string>(
            force ? "forcePause" : "pause",
            [gid],
        );
        await Aria2Rpc.saveSessionBestEffort();

        return result;
    }

    public static async unpause(gid: string) {
        await Aria2Rpc.ensureServer();
        const result = await Aria2Rpc.request<string>("unpause", [gid]);
        await Aria2Rpc.saveSessionBestEffort();

        return result;
    }

    public static async remove(gid: string, force: boolean = false) {
        await Aria2Rpc.ensureServer();
        const result = await Aria2Rpc.request<string>(
            force ? "forceRemove" : "remove",
            [gid],
        );
        await Aria2Rpc.saveSessionBestEffort();

        return result;
    }

    public static async removeDownloadResult(gid: string) {
        await Aria2Rpc.ensureServer();
        const result = await Aria2Rpc.request<string>("removeDownloadResult", [
            gid,
        ]);
        await Aria2Rpc.saveSessionBestEffort();

        return result;
    }

    public static async purgeDownloadResult() {
        await Aria2Rpc.ensureServer();
        const result = await Aria2Rpc.request<string>("purgeDownloadResult");
        await Aria2Rpc.saveSessionBestEffort();

        return result;
    }

    public static async changeOption(
        gid: string,
        options: Record<string, string>,
    ) {
        await Aria2Rpc.ensureServer();
        const result = await Aria2Rpc.request<string>("changeOption", [
            gid,
            options,
        ]);
        await Aria2Rpc.saveSessionBestEffort();

        return result;
    }

    public static async stopServer() {
        if (!Aria2Rpc.rpcProcess) {
            if (await Aria2Rpc.ping(Aria2Rpc.currentOptions, 500)) {
                await Aria2Rpc.shutdownServerByRpc(Aria2Rpc.currentOptions);
            }

            return;
        }

        const rpcProcess = Aria2Rpc.rpcProcess;
        const stoppedByRpc = await Aria2Rpc.shutdownServerByRpc(
            Aria2Rpc.currentOptions,
        );

        try {
            if (!stoppedByRpc) {
                await rpcProcess.stop();
            }
        } finally {
            if (Aria2Rpc.rpcProcess?.child.pid === rpcProcess.child.pid) {
                Aria2Rpc.rpcProcess = null;
            }
        }
    }

    public static async restartServer(options: IAria2RpcEnsureOptions = {}) {
        await Aria2Rpc.stopServer();
        await Aria2Rpc.ensureServer(options);
    }

    public static async autoStartFromSettings() {
        const settings = await Aria2Rpc.getStoredSettings();

        if (!settings.autoStart) {
            return;
        }

        try {
            await Aria2Rpc.ensureServer({
                outputDirectory: await Aria2Rpc.resolveDownloadDirectory(),
                listenPort: settings.rpcPort,
                secret: settings.rpcSecret,
                maxConcurrentDownloads: settings.maxConcurrentDownloads,
                split: settings.split,
                maxConnectionPerServer: settings.maxConnectionPerServer,
                minSplitSize: settings.minSplitSize,
            });
        } catch (error) {
            console.error("自动启动 aria2 服务失败");
            console.error(error);
        }
    }
}
