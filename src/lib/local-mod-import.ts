import { basename, join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";
import { SevenZip } from "@/lib/sevenZip";
import { SidecarExecutionError } from "@/lib/sidecar";
import { useManager } from "@/stores/manager";

export const ARCHIVE_EXTENSIONS = [
    "zip",
    "7z",
    "rar",
    "tar",
    "gz",
    "xz",
    "bz2",
] as const;

export type LocalModImportSourceType = "archive" | "folder" | "file";
export type LocalModImportDuplicateStrategy = "create" | "overwrite";

export interface ILocalModImportSource {
    path: string;
    sourceType: LocalModImportSourceType;
    metadata?: Partial<IModInfo>;
    duplicateStrategy?: LocalModImportDuplicateStrategy;
    targetMod?: IModInfo;
}

interface ILocalModImportResult {
    importedCount: number;
    importedMods: IModInfo[];
}

function normalizeSlashes(filePath: string) {
    return filePath.replace(/\\+/gu, "/");
}

function getBaseName(filePath: string) {
    const normalized = normalizeSlashes(filePath);
    return normalized.split("/").pop() ?? filePath;
}

function getFileExtension(filePath: string) {
    const fileName = getBaseName(filePath);
    const index = fileName.lastIndexOf(".");

    if (index === -1) {
        return "";
    }

    return fileName.slice(index + 1).toLowerCase();
}

function stripArchiveExtension(fileName: string) {
    return fileName.replace(/\.(zip|7z|rar|tar|gz|xz|bz2)$/iu, "");
}

function stripLastExtension(fileName: string) {
    return fileName.replace(/\.[^.]+$/u, "");
}

function createTagColor(tagName: string) {
    let hash = 0;

    for (const char of tagName) {
        hash = (hash * 31 + char.charCodeAt(0)) % 360;
    }

    return `hsl(${Math.abs(hash)} 68% 46%)`;
}

function dedupeTags(
    list: Array<ITag | string | undefined>,
    textCollator: Intl.Collator,
) {
    const tagMap = new Map<string, ITag>();

    for (const item of list) {
        if (!item) {
            continue;
        }

        if (typeof item === "string") {
            const name = item.trim();

            if (!name) {
                continue;
            }

            tagMap.set(name, {
                name,
                color: createTagColor(name),
            });
            continue;
        }

        const name = item.name.trim();

        if (!name) {
            continue;
        }

        tagMap.set(name, {
            name,
            color: item.color || createTagColor(name),
        });
    }

    return [...tagMap.values()].sort((left, right) =>
        textCollator.compare(left.name, right.name),
    );
}

function collectModTags(modList: IModInfo[], textCollator: Intl.Collator) {
    return dedupeTags(
        modList.flatMap((mod) => mod.tags ?? []),
        textCollator,
    );
}

async function detectModType(mod: IModInfo) {
    const manager = useManager();
    const game = manager.managerGame;
    if (!game) {
        return 99;
    }

    console.log({ game });

    try {
        if (typeof game.checkModType === "function") {
            return await game.checkModType(mod);
        }

        for (const rule of game.checkModType) {
            const matched = mod.modFiles.some((file) => {
                const normalizedFile = normalizeSlashes(file).toLowerCase();

                return rule.Keyword.some((keyword) => {
                    const normalizedKeyword = keyword.toLowerCase();

                    if (rule.UseFunction === "inPath") {
                        return normalizedFile.includes(normalizedKeyword);
                    }

                    if (rule.UseFunction === "basename") {
                        return (
                            getBaseName(normalizedFile) === normalizedKeyword
                        );
                    }

                    return [
                        normalizedKeyword,
                        `.${normalizedKeyword}`,
                    ].includes(`.${getFileExtension(normalizedFile)}`);
                });
            });

            if (matched) {
                return rule.TypeId ?? 99;
            }
        }
    } catch (error: unknown) {
        console.error("识别导入 Mod 类型失败");
        console.error(error);
    }

    return (
        manager.availableTypes.find((item) => String(item.id) === "99")?.id ??
        manager.availableTypes[0]?.id ??
        99
    );
}

function normalizeMod(
    mod: Partial<IModInfo>,
    textCollator: Intl.Collator,
): IModInfo {
    return {
        id: Number(mod.id ?? Date.now()),
        modName: mod.modName || mod.fileName || `Mod ${mod.id ?? ""}`,
        fileName: mod.fileName || mod.modName || `mod-${mod.id ?? Date.now()}`,
        md5: mod.md5 || "",
        modVersion: mod.modVersion || "1.0.0",
        isUpdate: Boolean(mod.isUpdate),
        isInstalled: Boolean(mod.isInstalled),
        weight: typeof mod.weight === "number" ? mod.weight : 0,
        modFiles: Array.isArray(mod.modFiles) ? mod.modFiles : [],
        tags: dedupeTags(mod.tags ?? [], textCollator),
        modAuthor: mod.modAuthor ?? "",
        modWebsite: mod.modWebsite ?? "",
        modType: mod.modType ?? 99,
        modDesc: mod.modDesc ?? "",
        other: mod.other ?? {},
        from: mod.from,
        webId: mod.webId,
        cover: mod.cover,
        advanced: mod.advanced,
        key: mod.key,
        gameID: mod.gameID,
    };
}

async function materializeImportSource(
    source: ILocalModImportSource,
    targetFolder: string,
) {
    if (source.sourceType === "folder") {
        return FileHandler.copyFolder(source.path, targetFolder);
    }

    if (source.sourceType === "archive") {
        await SevenZip.extractArchive({
            archivePath: source.path,
            outputDirectory: targetFolder,
        });
        return true;
    }

    const fileName = await basename(source.path);
    return FileHandler.copyFile(
        source.path,
        await join(targetFolder, fileName),
    );
}

async function collectRelativeModFiles(targetFolder: string) {
    const absoluteFiles = await FileHandler.getAllFilesInFolder(
        targetFolder,
        true,
        true,
    );

    if (absoluteFiles.length === 0) {
        return [] as string[];
    }

    return Promise.all(
        absoluteFiles.map(
            async (filePath) =>
                await FileHandler.relativePath(targetFolder, filePath),
        ),
    );
}

async function buildImportedMod(
    source: ILocalModImportSource,
    importedMods: IModInfo[],
    modId: number,
    originalName: string,
    modRoot: string,
    modFiles: string[],
) {
    const manager = useManager();
    const metadata = source.metadata ?? {};
    const targetMod = source.targetMod;
    const cover = await resolveImportedCoverPath(
        modRoot,
        modFiles,
        metadata.cover ?? targetMod?.cover,
    );

    return normalizeMod(
        {
            ...targetMod,
            id: modId,
            modName:
                metadata.modName ||
                targetMod?.modName ||
                getDefaultModName(source, originalName),
            fileName: metadata.fileName || targetMod?.fileName || originalName,
            modFiles,
            modVersion: metadata.modVersion || targetMod?.modVersion || "1.0.0",
            modAuthor: metadata.modAuthor ?? targetMod?.modAuthor ?? "",
            modWebsite: metadata.modWebsite ?? targetMod?.modWebsite ?? "",
            modDesc: metadata.modDesc ?? targetMod?.modDesc ?? "",
            cover,
            weight:
                targetMod?.weight ??
                manager.managerModList.length + importedMods.length + 1,
            isInstalled: targetMod?.isInstalled ?? false,
            from: metadata.from ?? targetMod?.from ?? "Customize",
            webId: metadata.webId ?? targetMod?.webId,
            gameID: metadata.gameID ?? targetMod?.gameID,
            tags: metadata.tags ?? targetMod?.tags,
            other: {
                ...(targetMod?.other ?? {}),
                ...(metadata.other ?? {}),
            },
            advanced: metadata.advanced ?? targetMod?.advanced,
            key: metadata.key ?? targetMod?.key,
            modType: metadata.modType ?? targetMod?.modType ?? 99,
        },
        manager.textCollator,
    );
}

async function replaceImportedFolder(
    targetFolder: string,
    stagingFolder: string,
) {
    const backupFolder = `${targetFolder}.gmmback-${Date.now()}`;
    const hasExistingFolder = await FileHandler.fileExists(targetFolder);

    if (hasExistingFolder) {
        const moved = await FileHandler.moveFolder(targetFolder, backupFolder);

        if (!moved) {
            throw new Error("备份现有 Mod 目录失败。");
        }
    }

    const replaced = await FileHandler.moveFolder(stagingFolder, targetFolder);

    if (replaced) {
        if (hasExistingFolder) {
            await FileHandler.deleteFolder(backupFolder);
        }

        return;
    }

    await FileHandler.deleteFolder(targetFolder);

    if (hasExistingFolder && (await FileHandler.fileExists(backupFolder))) {
        await FileHandler.moveFolder(backupFolder, targetFolder);
    }

    throw new Error("替换现有 Mod 目录失败。");
}

function getDefaultModName(
    source: ILocalModImportSource,
    originalName: string,
) {
    if (source.sourceType === "folder") {
        return originalName;
    }

    if (source.sourceType === "archive") {
        return stripArchiveExtension(originalName);
    }

    return stripLastExtension(originalName) || originalName;
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return "未知错误";
}

function pickImportedCoverFile(modFiles: string[]) {
    const normalizedFiles = modFiles.map((filePath) => {
        return {
            original: filePath,
            normalized: normalizeSlashes(filePath).toLowerCase(),
        };
    });

    const keywordMatched = normalizedFiles.find(({ normalized }) => {
        return ["image", "cover", "logo", "icon"].some((keyword) => {
            return normalized.includes(keyword);
        });
    });

    if (keywordMatched) {
        return keywordMatched.original;
    }

    return normalizedFiles.find(({ normalized }) => {
        return [".jpg", ".png", ".jpeg", ".webp"].some((extension) => {
            return normalized.endsWith(extension);
        });
    })?.original;
}

async function resolveImportedCoverPath(
    modRoot: string,
    modFiles: string[],
    cover?: string,
) {
    if (cover?.trim()) {
        return cover;
    }

    const coverFile = pickImportedCoverFile(modFiles);

    if (!coverFile) {
        return cover;
    }

    // 本地导入的封面文件位于当前 Mod 根目录下，直接持久化绝对路径即可供界面显示。
    return await join(modRoot, coverFile);
}

function getSevenZipErrorText(error: SidecarExecutionError) {
    return [error.result.stderr, error.result.stdout, error.message]
        .join("\n")
        .toLowerCase();
}

function getArchiveImportErrorMessage(error: unknown) {
    if (!(error instanceof SidecarExecutionError)) {
        return getErrorMessage(error);
    }

    const detail = getSevenZipErrorText(error);

    if (
        detail.includes("cannot open the file as archive") ||
        detail.includes("can not open the file as archive")
    ) {
        return "下载文件不是有效压缩包，可能下载源返回了网页/错误内容，或文件已损坏。请删除该下载任务和文件后重新下载；如果仍失败，请在浏览器手动下载正确压缩包后导入。";
    }

    if (detail.includes("wrong password") || detail.includes("encrypted")) {
        return "压缩包已加密或需要密码，无法自动导入。请先手动解压，再以文件夹方式导入。";
    }

    if (detail.includes("cannot find archive")) {
        return "未找到压缩包内容，请确认下载文件完整后再导入。";
    }

    return getMaterializeFailureMessage("archive");
}

function getImportSourceErrorMessage(
    error: unknown,
    sourceType: LocalModImportSourceType,
) {
    if (sourceType === "archive") {
        return getArchiveImportErrorMessage(error);
    }

    return getErrorMessage(error);
}

function getMaterializeFailureMessage(sourceType: LocalModImportSourceType) {
    if (sourceType === "archive") {
        return "解压压缩包失败，请确认文件不是空包、损坏包或加密压缩包。";
    }

    if (sourceType === "folder") {
        return "复制文件夹失败，请确认目录权限和文件是否被占用。";
    }

    return "复制文件失败，请确认文件权限和文件是否被占用。";
}

async function saveImportedManagerData() {
    const manager = useManager();

    manager.tags = dedupeTags(
        [
            ...manager.tags,
            ...collectModTags(manager.managerModList, manager.textCollator),
        ],
        manager.textCollator,
    );
    await manager.saveManagerData();
}

export function resolveLocalModImportSourceType(filePath: string) {
    return ARCHIVE_EXTENSIONS.includes(
        getFileExtension(filePath) as (typeof ARCHIVE_EXTENSIONS)[number],
    )
        ? "archive"
        : "file";
}

/**
 * 将文件夹、压缩包或单文件导入到本地管理器目录，并同步更新 store。
 */
export async function importLocalModSources(
    sources: ILocalModImportSource[],
): Promise<ILocalModImportResult> {
    const manager = useManager();

    if (!manager.managerGame || !manager.managerRoot) {
        throw new Error("请先选择游戏并配置储存路径。");
    }

    let nextId =
        manager.managerModList.reduce(
            (currentMax, mod) => Math.max(currentMax, Number(mod.id) || 0),
            0,
        ) + 1;
    const importedMods: IModInfo[] = [];

    for (const source of sources) {
        const shouldOverwrite =
            source.duplicateStrategy === "overwrite" &&
            Boolean(source.targetMod);
        const modId = shouldOverwrite ? Number(source.targetMod?.id) : nextId;
        const targetFolder = await join(manager.managerRoot, String(modId));
        const stagingFolder = shouldOverwrite
            ? await join(
                  manager.managerRoot,
                  `.gmm-import-${modId}-${Date.now()}`,
              )
            : targetFolder;

        if (!shouldOverwrite) {
            nextId += 1;
        }

        try {
            const cleaned = await FileHandler.deleteFolder(stagingFolder);

            if (!cleaned) {
                throw new Error("清理临时导入目录失败。");
            }

            await FileHandler.createDirectory(stagingFolder);

            const imported = await materializeImportSource(
                source,
                stagingFolder,
            );

            if (!imported) {
                throw new Error(
                    getMaterializeFailureMessage(source.sourceType),
                );
            }

            const modFiles = await collectRelativeModFiles(stagingFolder);

            if (modFiles.length === 0) {
                throw new Error("源文件中没有可导入的文件。");
            }

            if (shouldOverwrite) {
                await replaceImportedFolder(targetFolder, stagingFolder);
            }

            const originalName = await basename(source.path);
            const mod = await buildImportedMod(
                source,
                importedMods,
                modId,
                originalName,
                targetFolder,
                modFiles,
            );

            mod.modType =
                source.metadata?.modType ??
                source.targetMod?.modType ??
                (await detectModType(mod));

            manager.managerModList = shouldOverwrite
                ? manager.managerModList.map((item) =>
                      item.id === modId ? mod : item,
                  )
                : [...manager.managerModList, mod];
            importedMods.push(mod);
        } catch (error: unknown) {
            const originalName = await basename(source.path);
            const message = getImportSourceErrorMessage(
                error,
                source.sourceType,
            );

            console.error(`导入本地 Mod 源失败：${source.path}`);
            console.error(error);
            await Manager.deleteMod(stagingFolder);

            if (importedMods.length > 0) {
                await saveImportedManagerData();
            }

            throw new Error(`导入 ${originalName} 失败：${message}`);
        }
    }

    await saveImportedManagerData();

    return {
        importedCount: importedMods.length,
        importedMods,
    };
}
