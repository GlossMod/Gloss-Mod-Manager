import {
    Aria2Rpc,
    type IAria2RpcTask,
    type IAria2RuntimeSettings,
} from "@/lib/aria2-rpc";
import { FileHandler } from "@/lib/FileHandler";
import { getUrlFileName, sanitizeFileName } from "@/lib/file-name-utils";
import {
    findGlossDuplicateTasks,
    type IGlossDownloadTaskMeta,
} from "@/lib/gloss-download";
import { mergeAria2TaskSnapshots } from "@/lib/aria2-task-cache";
import { PersistentStore } from "@/lib/persistent-store";

export type CustomQueueDownloadStatus =
    | "created"
    | "exists"
    | "resumed"
    | "retried";

export interface IQueueCustomDownloadOptions {
    downloadUrl: string;
    fileName?: string;
    title?: string;
}

export interface IQueueCustomDownloadResult {
    status: CustomQueueDownloadStatus;
    gid: string;
    message: string;
}

interface IQueueRuntimeContext {
    outputDirectory: string;
    proxy: string;
    settings: IAria2RuntimeSettings;
    taskMetaMap: Record<string, IGlossDownloadTaskMeta>;
    allTasks: IAria2RpcTask[];
}

const ARIA2_TASK_META_KEY = "aria2TaskMetaMap";
const CUSTOM_DOWNLOAD_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

function buildOutputFileName(options: IQueueCustomDownloadOptions) {
    const preferredName = sanitizeFileName(
        options.fileName ||
            options.title ||
            getUrlFileName(options.downloadUrl),
    );

    return preferredName || "download.bin";
}

async function getQueueRuntimeContext(): Promise<IQueueRuntimeContext> {
    const outputDirectory = await Aria2Rpc.resolveDownloadDirectory();
    await FileHandler.createDirectory(outputDirectory);
    await Aria2Rpc.ensureServer({ outputDirectory });

    const settings = await Aria2Rpc.getStoredSettings();
    const proxy = (
        (await PersistentStore.get<string>("downloadProxy", "")) ?? ""
    ).trim();
    const taskMetaMap =
        (await PersistentStore.get<Record<string, IGlossDownloadTaskMeta>>(
            ARIA2_TASK_META_KEY,
            {},
        )) ?? {};
    const [activeTasks, waitingTasks, stoppedTasks] = await Promise.all([
        Aria2Rpc.tellActive(),
        Aria2Rpc.tellWaiting(0, 100),
        Aria2Rpc.tellStopped(0, 100),
    ]);

    return {
        outputDirectory,
        proxy,
        settings,
        taskMetaMap,
        allTasks: [...activeTasks, ...waitingTasks, ...stoppedTasks],
    };
}

async function saveTaskMetaMap(
    taskMetaMap: Record<string, IGlossDownloadTaskMeta>,
) {
    await PersistentStore.set(ARIA2_TASK_META_KEY, taskMetaMap);
}

function buildAria2Options(runtime: IQueueRuntimeContext, fileName: string) {
    const options: Record<string, string> = {
        dir: runtime.outputDirectory,
        out: fileName,
        continue: "true",
        "allow-overwrite": "true",
        split: String(runtime.settings.split),
        "max-connection-per-server": String(
            runtime.settings.maxConnectionPerServer,
        ),
        "min-split-size": runtime.settings.minSplitSize,
        "user-agent": CUSTOM_DOWNLOAD_USER_AGENT,
    };

    if (runtime.proxy) {
        options["all-proxy"] = runtime.proxy;
    }

    return options;
}

function resolveExistingTaskStatus(task?: IAria2RpcTask | null) {
    switch (task?.status) {
        case "error":
            return "retried" as const;
        case "paused":
            return "resumed" as const;
        case "waiting":
        case "active":
        case "complete":
        default:
            return "exists" as const;
    }
}

function resolveExistingTaskMessage(status: CustomQueueDownloadStatus) {
    switch (status) {
        case "resumed":
            return "自定义下载任务已恢复。";
        case "retried":
            return "自定义下载任务已重试。";
        default:
            return "该自定义下载已在队列中。";
    }
}

export async function queueCustomDownload(
    options: IQueueCustomDownloadOptions,
): Promise<IQueueCustomDownloadResult> {
    const downloadUrl = options.downloadUrl.trim();

    if (!/^https?:\/\//iu.test(downloadUrl)) {
        throw new Error("自定义下载地址必须是 http 或 https 链接。");
    }

    const outputFileName = buildOutputFileName(options);
    const duplicateCriteria = {
        sourceType: "Customize" as const,
        externalId: downloadUrl,
        downloadUrl,
        fileName: outputFileName,
        modTitle: (options.title || outputFileName).trim(),
    };
    const runtime = await getQueueRuntimeContext();
    const duplicateTasks = findGlossDuplicateTasks(
        runtime.taskMetaMap,
        duplicateCriteria,
    );
    const matchedTask = duplicateTasks[0];

    if (matchedTask) {
        const targetTask = runtime.allTasks.find((task) => {
            return task.gid === matchedTask.gid;
        });
        const status = resolveExistingTaskStatus(targetTask);

        if (status === "resumed") {
            await Aria2Rpc.unpause(matchedTask.gid);
        }

        if (status === "retried") {
            await Aria2Rpc.changeOption(
                matchedTask.gid,
                buildAria2Options(runtime, outputFileName),
            );
            await Aria2Rpc.unpause(matchedTask.gid);
        }

        return {
            status,
            gid: matchedTask.gid,
            message: resolveExistingTaskMessage(status),
        };
    }

    const gid = await Aria2Rpc.addUri(
        [downloadUrl],
        buildAria2Options(runtime, outputFileName),
    );
    const now = new Date().toISOString();
    const nextTaskMetaMap = {
        ...runtime.taskMetaMap,
        [gid]: {
            sourceType: "Customize",
            externalId: downloadUrl,
            modTitle: (options.title || outputFileName).trim(),
            resourceName: outputFileName,
            fileName: outputFileName,
            sourceUrl: downloadUrl,
            downloadUrl,
            createdAt: now,
            taskStatus: "waiting",
            updatedAt: now,
        } satisfies IGlossDownloadTaskMeta,
    };

    await saveTaskMetaMap(nextTaskMetaMap);
    const createdTask = await Aria2Rpc.tellStatus(gid);
    await mergeAria2TaskSnapshots(
        [...runtime.allTasks, createdTask],
        nextTaskMetaMap,
        runtime.outputDirectory,
    );

    return {
        status: "created",
        gid,
        message: "已添加自定义下载任务。",
    };
}
