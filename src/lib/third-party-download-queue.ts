import { openUrl } from "@tauri-apps/plugin-opener";
import {
    Aria2Rpc,
    type IAria2RpcTask,
    type IAria2RuntimeSettings,
} from "@/lib/aria2-rpc";
import { FileHandler } from "@/lib/FileHandler";
import { getUrlFileName, sanitizeFileName } from "@/lib/file-name-utils";
import {
    findGlossDuplicateLocalMods,
    findGlossDuplicateTasks,
    type IGlossDownloadTaskMeta,
} from "@/lib/gloss-download";
import { PersistentStore } from "@/lib/persistent-store";
import {
    resolveThirdPartyDownloadUrl,
    type IThirdPartyModDetail,
    type IThirdPartyModFile,
    type INexusModsDownloadAuthorization,
    type ThirdPartyProvider,
} from "@/lib/third-party-mod-api";
import {
    mergeAria2TaskSnapshots,
    removeAria2TaskSnapshot,
} from "@/lib/aria2-task-cache";

export type ThirdPartyQueueDownloadStatus =
    | "created"
    | "resumed"
    | "retried"
    | "exists"
    | "external"
    | "imported";

export interface IQueueThirdPartyDownloadOptions {
    provider: ThirdPartyProvider;
    mod: IThirdPartyModDetail;
    fileId?: string;
    gameName?: string;
    managerModList?: IModInfo[];
    nexusUser?: INexusModsUser | null;
    nexusDownloadAuthorization?: INexusModsDownloadAuthorization | null;
    replaceLocalModId?: number;
}

export interface IQueueThirdPartyDownloadResult {
    status: ThirdPartyQueueDownloadStatus;
    gid: string | null;
    mod: IThirdPartyModDetail;
    file: IThirdPartyModFile;
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
const THIRD_PARTY_DOWNLOAD_USER_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";
const FILE_EXTENSION_PATTERN =
    /\.(tar\.(?:gz|xz|bz2)|zip|7z|rar|tar|gz|xz|bz2|exe|dll|pak|bin)$/iu;

function getUrlExtension(url: string) {
    try {
        const parsed = new URL(url);
        const fileName = decodeURIComponent(
            parsed.pathname.split("/").pop() || "",
        );

        return (
            FILE_EXTENSION_PATTERN.exec(fileName)?.[0] ??
            /\.[A-Za-z0-9]{1,16}$/u.exec(fileName)?.[0] ??
            ""
        );
    } catch {
        return "";
    }
}

function getFileNameExtension(fileName: string) {
    return (
        FILE_EXTENSION_PATTERN.exec(fileName)?.[0] ??
        /\.[A-Za-z0-9]{1,16}$/u.exec(fileName)?.[0] ??
        ""
    );
}

function buildOutputFileName(
    mod: IThirdPartyModDetail,
    file: IThirdPartyModFile,
    downloadUrl: string,
) {
    const baseName = sanitizeFileName(
        file.name || `${mod.source}-${mod.id}-${file.id}`,
    );
    const currentExtension = getFileNameExtension(baseName);

    if (currentExtension) {
        return baseName;
    }

    const urlExtension = getUrlExtension(downloadUrl);
    if (urlExtension) {
        return `${baseName}${urlExtension}`;
    }

    const urlFileName = getUrlFileName(downloadUrl);
    return baseName || urlFileName || "download.bin";
}

function shouldOpenExternally(
    provider: ThirdPartyProvider,
    downloadUrl: string,
) {
    if (!/^https?:\/\//iu.test(downloadUrl)) {
        return false;
    }

    if (provider === "NexusMods") {
        return /:\/\/www\.nexusmods\.com\//iu.test(downloadUrl);
    }

    return false;
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

function buildAria2Options(
    runtime: IQueueRuntimeContext,
    mod: IThirdPartyModDetail,
    outputFileName: string,
) {
    const options: Record<string, string> = {
        dir: runtime.outputDirectory,
        out: outputFileName,
        continue: "true",
        "allow-overwrite": "true",
        split: String(runtime.settings.split),
        "max-connection-per-server": String(
            runtime.settings.maxConnectionPerServer,
        ),
        "min-split-size": runtime.settings.minSplitSize,
        referer: mod.website || "https://www.nexusmods.com/",
        "user-agent": THIRD_PARTY_DOWNLOAD_USER_AGENT,
    };

    if (runtime.proxy) {
        options["all-proxy"] = runtime.proxy;
    }

    return options;
}

function getTaskPrimaryFile(task: IAria2RpcTask) {
    return task.files.find((item) => item.path) ?? task.files[0] ?? null;
}

async function removeCompletedDuplicateTask(
    runtime: IQueueRuntimeContext,
    task: IAria2RpcTask,
) {
    const primaryFile = getTaskPrimaryFile(task);

    await Aria2Rpc.removeDownloadResult(task.gid);

    if (primaryFile?.path) {
        const deleted = await FileHandler.deleteFile(primaryFile.path);

        if (!deleted) {
            throw new Error("删除旧下载文件失败，请稍后重试。");
        }
    }

    const nextTaskMetaMap = { ...runtime.taskMetaMap };
    delete nextTaskMetaMap[task.gid];
    await saveTaskMetaMap(nextTaskMetaMap);
    await removeAria2TaskSnapshot(task.gid);
    runtime.taskMetaMap = nextTaskMetaMap;
    runtime.allTasks = runtime.allTasks.filter((item) => item.gid !== task.gid);
}

async function createThirdPartyDownloadTask(
    runtime: IQueueRuntimeContext,
    options: IQueueThirdPartyDownloadOptions,
    file: IThirdPartyModFile,
    downloadUrl: string,
    outputFileName: string,
) {
    const gid = await Aria2Rpc.addUri(
        [downloadUrl],
        buildAria2Options(runtime, options.mod, outputFileName),
    );
    const now = new Date().toISOString();

    const taskMeta: IGlossDownloadTaskMeta = {
        sourceType: options.provider as sourceType,
        externalId: options.mod.id,
        resourceId: file.id,
        replaceLocalModId: options.replaceLocalModId,
        modTitle: options.mod.title,
        gameName: options.gameName || "",
        resourceName: file.name,
        fileName: outputFileName,
        author: options.mod.author,
        version: file.version || options.mod.version,
        cover: options.mod.cover,
        content: options.mod.description || options.mod.summary,
        sourceUrl: options.mod.website,
        downloadUrl,
        createdAt: now,
        taskStatus: "waiting",
        updatedAt: now,
    };

    const nextTaskMetaMap = {
        ...runtime.taskMetaMap,
        [gid]: taskMeta,
    };

    await saveTaskMetaMap(nextTaskMetaMap);
    const createdTask = await Aria2Rpc.tellStatus(gid);
    await mergeAria2TaskSnapshots(
        [...runtime.allTasks, createdTask],
        nextTaskMetaMap,
        runtime.outputDirectory,
    );
    runtime.taskMetaMap = nextTaskMetaMap;
    runtime.allTasks = [...runtime.allTasks, createdTask];

    return gid;
}

function getExistingTaskMessage(task: IAria2RpcTask, file: IThirdPartyModFile) {
    if (task.status === "complete") {
        return `${file.name} 已下载完成，可前往下载页查看。`;
    }

    return `${file.name} 已在下载队列中。`;
}

export async function queueThirdPartyModDownload(
    options: IQueueThirdPartyDownloadOptions,
): Promise<IQueueThirdPartyDownloadResult> {
    const file =
        options.mod.files.find((item) => item.id === options.fileId) ??
        options.mod.primaryFile;

    if (!file) {
        throw new Error("未找到可下载的资源。");
    }

    const downloadUrl = (
        await resolveThirdPartyDownloadUrl(
            options.mod,
            file.id,
            options.nexusUser,
            options.nexusDownloadAuthorization,
        )
    ).trim();

    if (!downloadUrl) {
        throw new Error("当前资源暂时没有可用下载地址。");
    }

    if (shouldOpenExternally(options.provider, downloadUrl)) {
        await openUrl(downloadUrl);

        return {
            status: "external",
            gid: null,
            mod: options.mod,
            file,
            message: `当前资源无法获取直链，已打开 ${options.provider} 网页。`,
        };
    }

    const outputFileName = buildOutputFileName(options.mod, file, downloadUrl);
    const duplicateCriteria = {
        sourceType: options.provider as sourceType,
        externalId: options.mod.id,
        resourceId: file.id,
        downloadUrl,
        fileName: outputFileName,
        modTitle: options.mod.title,
    };
    const duplicateLocalMods = findGlossDuplicateLocalMods(
        options.managerModList ?? [],
        duplicateCriteria,
    );
    const allowReplacingLocalMod =
        Number.isFinite(Number(options.replaceLocalModId)) &&
        Number(options.replaceLocalModId) > 0;

    if (duplicateLocalMods.length > 0 && !allowReplacingLocalMod) {
        return {
            status: "imported",
            gid: null,
            mod: options.mod,
            file,
            message: `${options.mod.title} 已在本地管理列表中。`,
        };
    }

    const runtime = await getQueueRuntimeContext();
    const duplicateTasks = findGlossDuplicateTasks(
        runtime.taskMetaMap,
        duplicateCriteria,
    )
        .map((item) => ({
            task:
                runtime.allTasks.find((task) => task.gid === item.gid) ?? null,
            meta: item.meta,
        }))
        .filter(
            (
                item,
            ): item is { task: IAria2RpcTask; meta: IGlossDownloadTaskMeta } =>
                item.task !== null && item.task.status !== "removed",
        );

    if (duplicateTasks.length > 0) {
        const currentTask = duplicateTasks[0].task;

        if (currentTask.status === "complete") {
            await removeCompletedDuplicateTask(runtime, currentTask);

            const gid = await createThirdPartyDownloadTask(
                runtime,
                options,
                file,
                downloadUrl,
                outputFileName,
            );

            return {
                status: "retried",
                gid,
                mod: options.mod,
                file,
                message: `已重新下载：${file.name}`,
            };
        }

        const nextTaskMetaMap = {
            ...runtime.taskMetaMap,
            [currentTask.gid]: {
                ...runtime.taskMetaMap[currentTask.gid],
                replaceLocalModId:
                    options.replaceLocalModId ??
                    runtime.taskMetaMap[currentTask.gid]?.replaceLocalModId,
                taskStatus: currentTask.status as TaskStatus,
                updatedAt: new Date().toISOString(),
            },
        };

        if (currentTask.status === "paused") {
            await Aria2Rpc.unpause(currentTask.gid);
            nextTaskMetaMap[currentTask.gid].taskStatus = "waiting";
            await saveTaskMetaMap(nextTaskMetaMap);

            return {
                status: "resumed",
                gid: currentTask.gid,
                mod: options.mod,
                file,
                message: `已继续下载任务：${file.name}`,
            };
        }

        if (currentTask.status === "error") {
            const gid = await createThirdPartyDownloadTask(
                runtime,
                options,
                file,
                downloadUrl,
                outputFileName,
            );

            return {
                status: "retried",
                gid,
                mod: options.mod,
                file,
                message: `已重新加入下载队列：${file.name}`,
            };
        }

        await saveTaskMetaMap(nextTaskMetaMap);

        return {
            status: "exists",
            gid: currentTask.gid,
            mod: options.mod,
            file,
            message: getExistingTaskMessage(currentTask, file),
        };
    }

    const gid = await createThirdPartyDownloadTask(
        runtime,
        options,
        file,
        downloadUrl,
        outputFileName,
    );

    return {
        status: "created",
        gid,
        mod: options.mod,
        file,
        message: `已添加 ${file.name} 到下载队列。`,
    };
}
