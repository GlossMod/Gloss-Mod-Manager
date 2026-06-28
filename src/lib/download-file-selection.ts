import {
    isGlossCloudDriveResource,
    queueGlossModDownload,
    type IQueueGlossDownloadOptions,
    type IQueueGlossDownloadResult,
} from "@/lib/gloss-download-queue";
import { fetchGlossModDetail } from "@/lib/gloss-mod-api";
import {
    queueThirdPartyModDownload,
    type IQueueThirdPartyDownloadOptions,
    type IQueueThirdPartyDownloadResult,
} from "@/lib/third-party-download-queue";
import {
    getThirdPartyProviderLabel,
    type IThirdPartyModDetail,
    type IThirdPartyModFile,
    type IThirdPartyModItem,
} from "@/lib/third-party-mod-api";
import {
    type IDownloadFilePickerItem,
    useDownloadFilePickerStore,
} from "@/stores/download-picker";

type IGlossSelectionMod = NonNullable<IQueueGlossDownloadOptions["mod"]>;

const pickerDateFormatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
});

function formatThirdPartyBytes(size?: number) {
    const normalized = Number(size ?? 0);

    if (!Number.isFinite(normalized) || normalized <= 0) {
        return "未知大小";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    let current = normalized;
    let unitIndex = 0;

    while (current >= 1024 && unitIndex < units.length - 1) {
        current /= 1024;
        unitIndex += 1;
    }

    return `${current.toFixed(current >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatThirdPartyDate(value?: string) {
    if (!value) {
        return "未知时间";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return pickerDateFormatter.format(parsed);
}

function hasGlossMultipleResources(mod?: Pick<IMod, "mods_resource"> | null) {
    return (mod?.mods_resource.length ?? 0) > 1;
}

function hasThirdPartyMultipleFiles(
    mod?:
        | Pick<IThirdPartyModItem, "filesCount">
        | Pick<IThirdPartyModDetail, "files">
        | null,
) {
    if (!mod) {
        return false;
    }

    if ("files" in mod) {
        return mod.files.length > 1;
    }

    return mod.filesCount > 1;
}

function buildGlossPickerItems(
    mod: IGlossSelectionMod,
): IDownloadFilePickerItem[] {
    return mod.mods_resource.map((resource) => {
        const badges = [] as string[];

        if (resource.mods_resource_latest_version) {
            badges.push("最新");
        }

        if (resource.mods_resource_formart) {
            badges.push(resource.mods_resource_formart);
        }

        if (isGlossCloudDriveResource(resource)) {
            badges.push("网盘");
        }

        const lines = [
            [
                `大小：${resource.mods_resource_size || "未知"}`,
                `版本：${resource.mods_resource_version || mod.mods_version || "未知"}`,
            ].join(" · "),
        ];

        if (resource.mods_resource_desc?.trim()) {
            lines.push(resource.mods_resource_desc.trim());
        }

        if (isGlossCloudDriveResource(resource)) {
            lines.push("选择后会打开外部网盘链接。");
        }

        return {
            id: String(resource.id),
            title: resource.mods_resource_name || `资源 ${resource.id}`,
            description: lines.join("\n"),
            badges,
        };
    });
}

function buildThirdPartyPickerItems(
    providerLabel: string,
    mod: IThirdPartyModDetail,
): IDownloadFilePickerItem[] {
    return mod.files.map((file) => {
        const badges = [] as string[];

        if (mod.primaryFile?.id === file.id) {
            badges.push("默认");
        }

        if (file.categoryName) {
            badges.push(
                file.categoryName === "MAIN"
                    ? "主文件"
                    : file.categoryName === "OPTIONAL"
                      ? "可选文件"
                      : file.categoryName,
            );
        }

        const lines = [
            [
                `版本：${file.version || "未标注"}`,
                `大小：${formatThirdPartyBytes(file.size)}`,
                `时间：${formatThirdPartyDate(file.createdAt)}`,
            ].join(" · "),
        ];

        if (file.detailsUrl) {
            lines.push(`来源：${providerLabel} 文件详情页可查看更多说明。`);
        }

        return {
            id: file.id,
            title: file.name || `${mod.title} 文件 ${file.id}`,
            description: lines.join("\n"),
            badges,
        };
    });
}

async function promptSelection(options: {
    title: string;
    description: string;
    note?: string;
    items: IDownloadFilePickerItem[];
    initialItemId?: string;
    initialItemIds?: string[];
    multiple?: boolean;
    confirmLabel?: string;
}) {
    const picker = useDownloadFilePickerStore();

    return picker.promptSelection({
        title: options.title,
        description: options.description,
        note: options.note,
        items: options.items,
        initialItemId: options.initialItemId,
        initialItemIds: options.initialItemIds,
        multiple: options.multiple,
        confirmLabel: options.confirmLabel,
    });
}

async function resolveGlossSelection(
    options: IQueueGlossDownloadOptions,
): Promise<{ mod: IGlossSelectionMod; resource: IResource } | null> {
    const mod = options.mod ?? (await fetchGlossModDetail(options.modId ?? ""));

    if (!Array.isArray(mod.mods_resource) || mod.mods_resource.length === 0) {
        throw new Error("未找到可下载的资源。");
    }

    if (options.resourceId !== undefined && options.resourceId !== "latest") {
        const matchedResource =
            mod.mods_resource.find(
                (item) => String(item.id) === String(options.resourceId),
            ) ?? null;

        if (!matchedResource?.mods_resource_url) {
            throw new Error("未找到可下载的资源。");
        }

        return {
            mod,
            resource: matchedResource,
        };
    }

    if (!hasGlossMultipleResources(mod)) {
        return {
            mod,
            resource:
                mod.mods_resource.find(
                    (resource) => resource.mods_resource_latest_version,
                ) ?? mod.mods_resource[0],
        };
    }

    const selectedResourceId = await promptSelection({
        title: "选择 3DM 下载资源",
        description: `${mod.mods_title} 提供多个下载资源，请选择这次要使用的文件。`,
        note: "已经明确点选某个资源的按钮时，不会再次弹出该窗口。",
        items: buildGlossPickerItems(mod),
        initialItemId: String(
            mod.mods_resource.find(
                (resource) => resource.mods_resource_latest_version,
            )?.id ?? mod.mods_resource[0]?.id,
        ),
        confirmLabel: "下载选中资源",
    });

    if (!selectedResourceId) {
        return null;
    }

    const selectedResource =
        mod.mods_resource.find(
            (item) => String(item.id) === selectedResourceId,
        ) ?? null;

    if (!selectedResource?.mods_resource_url) {
        throw new Error("未找到可下载的资源。");
    }

    return {
        mod,
        resource: selectedResource,
    };
}

async function resolveThirdPartySelection(
    options: IQueueThirdPartyDownloadOptions,
): Promise<{ mod: IThirdPartyModDetail; file: IThirdPartyModFile } | null> {
    const explicitFileId = options.fileId?.trim();

    if (explicitFileId) {
        const matchedFile =
            options.mod.files.find((item) => item.id === explicitFileId) ??
            null;

        if (!matchedFile) {
            throw new Error("未找到可下载的文件。");
        }

        return {
            mod: options.mod,
            file: matchedFile,
        };
    }

    if (!Array.isArray(options.mod.files) || options.mod.files.length === 0) {
        const fallbackFile = options.mod.primaryFile;

        if (!fallbackFile) {
            throw new Error("当前没有可下载的文件。");
        }

        return {
            mod: options.mod,
            file: fallbackFile,
        };
    }

    if (!hasThirdPartyMultipleFiles(options.mod)) {
        return {
            mod: options.mod,
            file: options.mod.primaryFile ?? options.mod.files[0],
        };
    }

    const providerLabel = getThirdPartyProviderLabel(options.provider);
    const selection = await promptSelection({
        title: `选择 ${providerLabel} 下载文件`,
        description: `${options.mod.title} 提供多个可下载文件，请选择这次要下载的文件。`,
        note: "已经明确点选某个文件行的下载按钮时，不会再次弹出该窗口。",
        items: buildThirdPartyPickerItems(providerLabel, options.mod),
        initialItemId: options.mod.primaryFile?.id ?? options.mod.files[0]?.id,
        confirmLabel: "下载选中文件",
    });

    if (!selection) {
        return null;
    }

    const selectedFile =
        options.mod.files.find((item) => item.id === selection) ?? null;

    if (!selectedFile) {
        throw new Error("未找到可下载的文件。");
    }

    return {
        mod: options.mod,
        file: selectedFile,
    };
}

async function resolveThirdPartySelections(
    options: IQueueThirdPartyDownloadOptions,
): Promise<{ mod: IThirdPartyModDetail; files: IThirdPartyModFile[] } | null> {
    const explicitFileId = options.fileId?.trim();

    if (explicitFileId) {
        const selection = await resolveThirdPartySelection(options);

        return selection
            ? {
                  mod: selection.mod,
                  files: [selection.file],
              }
            : null;
    }

    if (!Array.isArray(options.mod.files) || options.mod.files.length === 0) {
        const fallbackFile = options.mod.primaryFile;

        if (!fallbackFile) {
            throw new Error("当前没有可下载的文件。");
        }

        return {
            mod: options.mod,
            files: [fallbackFile],
        };
    }

    if (!hasThirdPartyMultipleFiles(options.mod)) {
        return {
            mod: options.mod,
            files: [options.mod.primaryFile ?? options.mod.files[0]],
        };
    }

    const providerLabel = getThirdPartyProviderLabel(options.provider);
    const selection = await promptSelection({
        title: `选择 ${providerLabel} 下载文件`,
        description: `${options.mod.title} 提供多个可下载文件，可同时选择主文件和补丁文件。`,
        note: "已经明确点选某个文件行的下载按钮时，不会再次弹出该窗口。",
        items: buildThirdPartyPickerItems(providerLabel, options.mod),
        initialItemIds: [options.mod.primaryFile?.id ?? ""].filter(Boolean),
        multiple: true,
        confirmLabel: "下载选中文件",
    });

    if (!selection) {
        return null;
    }

    const selectedFileIds = Array.isArray(selection) ? selection : [selection];
    const selectedFiles = selectedFileIds
        .map(
            (fileId) =>
                options.mod.files.find((item) => item.id === fileId) ?? null,
        )
        .filter((file): file is IThirdPartyModFile => Boolean(file));

    if (selectedFiles.length === 0) {
        throw new Error("未找到可下载的文件。");
    }

    return {
        mod: options.mod,
        files: selectedFiles,
    };
}

export async function queueGlossModDownloadWithSelection(
    options: IQueueGlossDownloadOptions,
): Promise<IQueueGlossDownloadResult | null> {
    const selection = await resolveGlossSelection(options);

    if (!selection) {
        return null;
    }

    return queueGlossModDownload({
        ...options,
        mod: selection.mod,
        modId: selection.mod.id,
        resourceId: selection.resource.id,
    });
}

export async function queueThirdPartyModDownloadWithSelection(
    options: IQueueThirdPartyDownloadOptions,
): Promise<IQueueThirdPartyDownloadResult | null> {
    const selection = await resolveThirdPartySelection(options);

    if (!selection) {
        return null;
    }

    return queueThirdPartyModDownload({
        ...options,
        mod: selection.mod,
        fileId: selection.file.id,
    });
}

export async function queueThirdPartyModDownloadsWithSelection(
    options: IQueueThirdPartyDownloadOptions,
): Promise<IQueueThirdPartyDownloadResult[] | null> {
    const selection = await resolveThirdPartySelections(options);

    if (!selection) {
        return null;
    }

    const results: IQueueThirdPartyDownloadResult[] = [];

    for (const file of selection.files) {
        results.push(
            await queueThirdPartyModDownload({
                ...options,
                mod: selection.mod,
                fileId: file.id,
            }),
        );
    }

    return results;
}

export { hasGlossMultipleResources, hasThirdPartyMultipleFiles };
