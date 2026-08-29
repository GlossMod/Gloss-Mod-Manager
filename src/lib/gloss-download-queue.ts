import { Aria2Rpc } from "@/lib/aria2-rpc";
import { FileHandler } from "@/lib/FileHandler";
import { getUrlFileName, sanitizeFileName } from "@/lib/file-name-utils";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
    findGlossDuplicateLocalMods,
    findGlossDuplicateTasks,
    type IGlossDownloadTaskMeta,
} from "@/lib/gloss-download";
import {
    GLOSS_MOD_WEB_BASE_URL,
    fetchGlossModDetail,
    resolveGlossAssetUrl,
} from "@/lib/gloss-mod-api";
import {
    ARCHIVE_EXTENSIONS,
    resolveLocalModImportSourceType,
    type LocalModImportSourceType,
} from "@/lib/local-mod-import";
import {
    mergeAria2TaskSnapshots,
    removeAria2TaskSnapshot,
} from "@/lib/aria2-task-cache";
import { PersistentStore } from "@/lib/persistent-store";

export type GlossQueueDownloadStatus =
    | "created"
    | "resumed"
    | "retried"
    | "exists"
    | "external"
    | "imported";

type IGlossDownloadModSource = Pick<
    IMod,
    | "id"
    | "mods_author"
    | "mods_content"
    | "mods_image_url"
    | "mods_resource"
    | "mods_title"
    | "mods_version"
    | "game_name"
>;

export interface IQueueGlossDownloadOptions {
    mod?: IGlossDownloadModSource | null;
    modId?: number | string;
    resourceId?: number | string | "latest";
    managerModList?: IModInfo[];
    replaceLocalModId?: number;
}

export interface IQueueGlossDownloadResult {
    status: GlossQueueDownloadStatus;
    gid: string | null;
    mod: IGlossDownloadModSource;
    resource: IResource;
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
const GLOSS_DOWNLOAD_USER_AGENT =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const ARCHIVE_EXTENSION_PATTERN =
    /\.(tar\.(?:gz|xz|bz2)|zip|7z|rar|tar|gz|xz|bz2)$/iu;
const RESOURCE_FORMAT_ALIAS_MAP: Record<string, string> = {
    "7zip": "7z",
    "tar-gz": "tar.gz",
    tgz: "tar.gz",
    txz: "tar.xz",
    tbz2: "tar.bz2",
};

export function isGlossCloudDriveUrl(url?: string) {
    const normalizedUrl = (url ?? "").trim();

    if (!normalizedUrl) {
        return false;
    }

    return !normalizedUrl.includes("mod.3dmgame.com");
}

export function isGlossCloudDriveResource(resource?: IResource | null) {
    return isGlossCloudDriveUrl(resource?.mods_resource_url);
}

function getUrlExtension(url: string) {
    try {
        const parsed = new URL(url);
        const fileName = decodeURIComponent(
            parsed.pathname.split("/").pop() || "",
        );
        return (
            ARCHIVE_EXTENSION_PATTERN.exec(fileName)?.[0] ??
            /\.[A-Za-z0-9]{1,16}$/u.exec(fileName)?.[0] ??
            ""
        );
    } catch {
        return "";
    }
}

function getFileNameExtension(fileName: string) {
    return (
        ARCHIVE_EXTENSION_PATTERN.exec(fileName)?.[0] ??
        /\.[A-Za-z0-9]{1,16}$/u.exec(fileName)?.[0] ??
        ""
    );
}

function hasExtension(fileName: string) {
    return Boolean(getFileNameExtension(fileName));
}

function normalizeResourceFormat(value?: string) {
    const normalized = (value ?? "")
        .trim()
        .toLowerCase()
        .replace(/^[*.\s]+/u, "")
        .replace(/[()\[\]]/gu, " ");

    if (!normalized) {
        return "";
    }

    const direct = RESOURCE_FORMAT_ALIAS_MAP[normalized] ?? normalized;

    if (/^[a-z0-9]+(?:\.[a-z0-9]+)?$/u.test(direct)) {
        return direct;
    }

    const matched =
        normalized.match(
            /(tar\.(?:gz|xz|bz2)|7z|zip|rar|tar|gz|xz|bz2|exe|dll|pak|bin)\b/u,
        )?.[1] ?? "";

    return RESOURCE_FORMAT_ALIAS_MAP[matched] ?? matched;
}

function hasArchiveSuffix(value?: string) {
    if (!value) {
        return false;
    }

    const normalizedExtension = /^https?:\/\//iu.test(value)
        ? getUrlExtension(value)
        : getFileNameExtension(value);

    return ARCHIVE_EXTENSION_PATTERN.test(normalizedExtension.toLowerCase());
}

async function resolveTaskResourceFormat(metadata?: IGlossDownloadTaskMeta) {
    const directFormat = normalizeResourceFormat(metadata?.resourceFormat);

    if (directFormat) {
        return directFormat;
    }

    if (!metadata?.modId || !metadata?.resourceId) {
        return "";
    }

    try {
        const mod = await fetchGlossModDetail(metadata.modId);
        const resource = mod.mods_resource.find(
            (item) => String(item.id) === String(metadata.resourceId),
        );

        return normalizeResourceFormat(resource?.mods_resource_formart);
    } catch {
        return "";
    }
}

export function buildGlossOutputFileName(resource: IResource) {
    const resourceName = sanitizeFileName(resource.mods_resource_name || "");
    const urlExtension = getUrlExtension(resource.mods_resource_url);
    const formatExtension = normalizeResourceFormat(
        resource.mods_resource_formart,
    )
        ? `.${normalizeResourceFormat(resource.mods_resource_formart)}`
        : "";
    const preferredExtension = urlExtension || formatExtension;

    if (!resourceName) {
        return getUrlFileName(resource.mods_resource_url);
    }

    if (!preferredExtension && hasExtension(resourceName)) {
        return resourceName;
    }

    if (!preferredExtension) {
        return resourceName || getUrlFileName(resource.mods_resource_url);
    }

    const currentExtension = getFileNameExtension(resourceName);

    if (
        currentExtension &&
        currentExtension.toLowerCase() === preferredExtension.toLowerCase()
    ) {
        return resourceName;
    }

    return `${resourceName}${preferredExtension}`;
}

export async function resolveGlossDownloadImportSourceType(
    filePath: string,
    metadata?: IGlossDownloadTaskMeta,
): Promise<LocalModImportSourceType> {
    const directSourceType = resolveLocalModImportSourceType(filePath);

    if (directSourceType === "archive") {
        return directSourceType;
    }

    if (
        hasArchiveSuffix(metadata?.fileName) ||
        hasArchiveSuffix(metadata?.resourceName) ||
        hasArchiveSuffix(metadata?.downloadUrl)
    ) {
        return "archive";
    }

    if (metadata?.sourceType && metadata.sourceType !== "GlossMod") {
        return directSourceType;
    }

    const resourceFormat = await resolveTaskResourceFormat(metadata);

    if (
        ARCHIVE_EXTENSIONS.includes(
            resourceFormat.replace(
                /^.*\./u,
                "",
            ) as (typeof ARCHIVE_EXTENSIONS)[number],
        )
    ) {
        return "archive";
    }

    return directSourceType;
}

function getLatestResource(mod?: IGlossDownloadModSource | null) {
    return (
        mod?.mods_resource.find(
            (resource) => resource.mods_resource_latest_version,
        ) ??
        mod?.mods_resource[0] ??
        null
    );
}

function getDuplicateCriteria(
    mod: IGlossDownloadModSource,
    resource: IResource,
    outputFileName: string,
) {
    return {
        modId: mod.id,
        resourceId: resource.id,
        downloadUrl: resource.mods_resource_url,
        fileName: outputFileName,
        modTitle: mod.mods_title,
    };
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
    mod: IMod,
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
        referer: `${GLOSS_MOD_WEB_BASE_URL}/mod/${mod.id}`,
        "user-agent": GLOSS_DOWNLOAD_USER_AGENT,
    };

    if (runtime.proxy) {
        options["all-proxy"] = runtime.proxy;
    }

    return options;
}

async function createGlossDownloadTask(
    runtime: IQueueRuntimeContext,
    mod: IGlossDownloadModSource,
    resource: IResource,
    outputFileName: string,
    replaceLocalModId?: number,
) {
    const gid = await Aria2Rpc.addUri(
        [resource.mods_resource_url],
        buildAria2Options(runtime, mod as IMod, outputFileName),
    );
    const now = new Date().toISOString();

    const taskMeta: IGlossDownloadTaskMeta = {
        sourceType: "GlossMod",
        externalId: mod.id,
        modId: mod.id,
        resourceId: resource.id,
        replaceLocalModId,
        resourceFormat: resource.mods_resource_formart,
        modTitle: mod.mods_title,
        gameName: mod.game_name,
        resourceName: resource.mods_resource_name,
        fileName: outputFileName,
        author: mod.mods_author,
        version: resource.mods_resource_version || mod.mods_version,
        cover: resolveGlossAssetUrl(mod.mods_image_url),
        content: mod.mods_content,
        sourceUrl: `${GLOSS_MOD_WEB_BASE_URL}/mod/${mod.id}`,
        downloadUrl: resource.mods_resource_url,
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

function getExistingTaskMessage(task: IAria2RpcTask, resource: IResource) {
    if (task.status === "complete") {
        return `${resource.mods_resource_name} 已下载完成，可前往下载页查看。`;
    }

    return `${resource.mods_resource_name} 已在下载队列中。`;
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

export async function queueGlossModDownload(
    options: IQueueGlossDownloadOptions,
): Promise<IQueueGlossDownloadResult> {
    const mod = options.mod ?? (await fetchGlossModDetail(options.modId ?? ""));
    const resource =
        options.resourceId === undefined || options.resourceId === "latest"
            ? getLatestResource(mod)
            : (mod.mods_resource.find(
                  (item) => String(item.id) === String(options.resourceId),
              ) ?? null);

    if (!resource?.mods_resource_url) {
        throw new Error("未找到可下载的资源。");
    }

    if (isGlossCloudDriveResource(resource)) {
        await openUrl(resource.mods_resource_url);

        return {
            status: "external",
            gid: null,
            mod,
            resource,
            message: `已打开 ${resource.mods_resource_name} 的网盘链接，请在浏览器中手动下载。`,
        };
    }

    const outputFileName = buildGlossOutputFileName(resource);
    const duplicateCriteria = getDuplicateCriteria(
        mod,
        resource,
        outputFileName,
    );
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
            mod,
            resource,
            message: `${mod.mods_title} 已在本地管理列表中。`,
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

            const gid = await createGlossDownloadTask(
                runtime,
                mod,
                resource,
                outputFileName,
                options.replaceLocalModId,
            );

            return {
                status: "retried",
                gid,
                mod,
                resource,
                message: `已重新下载：${resource.mods_resource_name}`,
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
                mod,
                resource,
                message: `已继续下载任务：${resource.mods_resource_name}`,
            };
        }

        if (currentTask.status === "error") {
            const gid = await createGlossDownloadTask(
                runtime,
                mod,
                resource,
                outputFileName,
                options.replaceLocalModId,
            );

            return {
                status: "retried",
                gid,
                mod,
                resource,
                message: `已重新加入下载队列：${resource.mods_resource_name}`,
            };
        }

        await saveTaskMetaMap(nextTaskMetaMap);

        return {
            status: "exists",
            gid: currentTask.gid,
            mod,
            resource,
            message: getExistingTaskMessage(currentTask, resource),
        };
    }

    const gid = await createGlossDownloadTask(
        runtime,
        mod,
        resource,
        outputFileName,
        options.replaceLocalModId,
    );

    return {
        status: "created",
        gid,
        mod,
        resource,
        message: `已添加 ${resource.mods_resource_name} 到下载队列。`,
    };
}
