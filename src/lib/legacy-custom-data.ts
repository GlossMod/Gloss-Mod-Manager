import { basename, documentDir, join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";
import { UnityGame, UnityGameILCPP2 } from "@/lib/UnityGame";
import { UnrealEngine } from "@/lib/UnrealEngine";

interface ILegacyResolvedType {
    runtimeType: IType;
    rule?: ICheckModType;
}

let legacyConfigRootsPromise: Promise<string[]> | null = null;
const legacyJsonFilePromiseMap: Partial<
    Record<"Expands" | "Types", Promise<string[]>>
> = {};
const legacyCustomTypePromiseMap = new Map<
    string,
    Promise<ILegacyResolvedType[]>
>();

function normalizeCompareText(value: string) {
    return value.trim().toLowerCase();
}

function normalizeExtname(value: string) {
    return normalizeCompareText(value).replace(/^\./u, "");
}

function createLegacyTypeId(name: string) {
    return `ex-${name}`;
}

async function evaluateRuleMatch(
    mod: IModInfo,
    rule: ICheckModType,
): Promise<boolean> {
    const normalizedKeywords = rule.Keyword.map((item) =>
        normalizeCompareText(item),
    );

    for (const filePath of mod.modFiles) {
        const normalizedFilePath = FileHandler.normalizePath(filePath);

        switch (rule.UseFunction) {
            case "basename": {
                const fileName = normalizeCompareText(await basename(filePath));
                if (normalizedKeywords.includes(fileName)) {
                    return true;
                }
                break;
            }
            case "inPath": {
                const pathParts = FileHandler.pathToArray(
                    normalizedFilePath,
                ).map((item) => normalizeCompareText(item));

                if (
                    normalizedKeywords.every((keyword) =>
                        pathParts.includes(keyword),
                    )
                ) {
                    return true;
                }
                break;
            }
            default: {
                const fileExtname = normalizeExtname(await FileHandler.getFileExtension(filePath));
                if (
                    normalizedKeywords.some((keyword) => {
                        return normalizeExtname(keyword) === fileExtname;
                    })
                ) {
                    return true;
                }
                break;
            }
        }
    }

    return false;
}

async function evaluateCheckModType(
    mod: IModInfo,
    checkModType: ISupportedGames["checkModType"],
): Promise<number | string | undefined> {
    if (typeof checkModType === "function") {
        return checkModType(mod);
    }

    for (const rule of checkModType) {
        if (await evaluateRuleMatch(mod, rule)) {
            return rule.TypeId ?? 99;
        }
    }

    return undefined;
}

async function executeLegacyTypeInstall(
    type: Pick<IType, "installPath">,
    installConfig: ITypeInstall,
    mod: IModInfo,
    isInstall: boolean,
) {
    const resolvedIsInstall = installConfig.isInstall ?? isInstall;

    switch (installConfig.UseFunction) {
        case "generalInstall":
            return Manager.generalInstall(
                mod,
                type.installPath,
                installConfig.keepPath,
                installConfig.inGameStorage,
            );
        case "generalUninstall":
            return Manager.generalUninstall(
                mod,
                type.installPath,
                installConfig.keepPath,
                installConfig.inGameStorage,
            );
        case "installByFolder":
            return Manager.installByFolder(
                mod,
                type.installPath,
                installConfig.folderName ?? "",
                resolvedIsInstall,
                installConfig.include,
                installConfig.spare,
            );
        case "installByFile":
            return Manager.installByFile(
                mod,
                type.installPath,
                installConfig.fileName ?? "",
                resolvedIsInstall,
                installConfig.isExtname,
                installConfig.inGameStorage,
            );
        case "installByFileSibling":
            return Manager.installByFileSibling(
                mod,
                type.installPath,
                installConfig.fileName ?? "",
                resolvedIsInstall,
                installConfig.isExtname,
                installConfig.inGameStorage,
                installConfig.pass,
            );
        case "installByFolderParent":
            return Manager.installByFolderParent(
                mod,
                type.installPath,
                installConfig.folderName ?? "",
                resolvedIsInstall,
                installConfig.inGameStorage,
            );
        default:
            return false;
    }
}

function createRuntimeType(
    type: Omit<IType, "install" | "uninstall"> & {
        install: install;
        uninstall: install;
    },
) {
    const runtimeType: IType = {
        id: type.id,
        name: type.name,
        installPath: type.installPath,
        advanced: type.advanced,
        local: type.local,
        install: async (_mod: IModInfo) => false,
        uninstall: async (_mod: IModInfo) => true,
    };

    const installValue = type.install;
    const uninstallValue = type.uninstall;

    runtimeType.install =
        typeof installValue === "function"
            ? installValue
            : async (mod: IModInfo) => {
                  return executeLegacyTypeInstall(
                      runtimeType,
                      installValue,
                      mod,
                      true,
                  );
              };
    runtimeType.uninstall =
        typeof uninstallValue === "function"
            ? uninstallValue
            : async (mod: IModInfo) => {
                  return executeLegacyTypeInstall(
                      runtimeType,
                      uninstallValue,
                      mod,
                      false,
                  );
              };

    return runtimeType;
}

function mergeRuntimeTypes(baseTypes: IType[], extraTypes: IType[]) {
    const typeMap = new Map<string, IType>();

    for (const item of [...baseTypes, ...extraTypes]) {
        typeMap.set(String(item.id), item);
    }

    return [...typeMap.values()];
}

export async function getLegacyConfigRoots() {
    if (legacyConfigRootsPromise) {
        return legacyConfigRootsPromise;
    }

    legacyConfigRootsPromise = (async () => {
        const roots = [
            await join(await documentDir(), "Gloss Mod Manager"),
            "C:\\Gloss Mod Manager",
        ];
        const uniqueRoots = [...new Set(roots)];
        const existingRoots: string[] = [];

        for (const root of uniqueRoots) {
            if (await FileHandler.fileExists(root)) {
                existingRoots.push(root);
            }
        }

        return existingRoots;
    })();

    return legacyConfigRootsPromise;
}

async function loadLegacyJsonFiles(folderName: "Expands" | "Types") {
    const cachedPromise = legacyJsonFilePromiseMap[folderName];

    if (cachedPromise) {
        return cachedPromise;
    }

    legacyJsonFilePromiseMap[folderName] = (async () => {
        const roots = await getLegacyConfigRoots();
        const fileList: string[] = [];

        for (const root of roots) {
            const targetFolder = await join(root, folderName);
            const files = await FileHandler.getAllFilesInFolder(
                targetFolder,
                true,
                false,
            );

            for (const filePath of files) {
                if (!filePath.toLowerCase().endsWith(".json")) {
                    continue;
                }

                fileList.push(filePath);
            }
        }

        return fileList;
    })();

    return legacyJsonFilePromiseMap[folderName] as Promise<string[]>;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
        return JSON.parse(await FileHandler.readFile(filePath)) as T;
    } catch (error: unknown) {
        console.error(`读取旧版自定义配置失败：${filePath}`);
        console.error(error);
        return null;
    }
}

async function readLegacyTypeFile(gameName: string) {
    const files = await loadLegacyJsonFiles("Types");
    const targetName = `${normalizeCompareText(gameName)}.json`;

    for (const filePath of files) {
        const fileName = normalizeCompareText(await basename(filePath));
        if (fileName === targetName) {
            return filePath;
        }
    }

    return "";
}

async function resolveWritableLegacyConfigRoot() {
    const roots = await getLegacyConfigRoots();
    const documentRoot = await join(await documentDir(), "Gloss Mod Manager");

    if (roots.includes(documentRoot)) {
        return documentRoot;
    }

    return roots[0] ?? documentRoot;
}

async function resolveWritableLegacyFilePath(
    folderName: "Expands" | "Types",
    fileName: string,
) {
    const root = await resolveWritableLegacyConfigRoot();
    const folder = await join(root, folderName);
    await FileHandler.createDirectory(folder);
    return await join(folder, `${fileName}.json`);
}

function invalidateLegacyCache(
    folderName?: "Expands" | "Types",
    gameName?: string,
) {
    if (!folderName || folderName === "Expands") {
        delete legacyJsonFilePromiseMap.Expands;
    }

    if (!folderName || folderName === "Types") {
        delete legacyJsonFilePromiseMap.Types;
        if (gameName) {
            legacyCustomTypePromiseMap.delete(normalizeCompareText(gameName));
        } else {
            legacyCustomTypePromiseMap.clear();
        }
    }
}

async function resolveLegacyGameModTypes(
    game: IExpandsSupportedGames,
): Promise<IType[]> {
    if (Array.isArray(game.modType)) {
        return game.modType.map((item) => {
            return createRuntimeType({
                ...item,
                install: item.install,
                uninstall: item.uninstall,
            });
        });
    }

    switch (game.modType) {
        case "UnityGame.modType":
            return UnityGame.modType();
        case "UnityGameILCPP2.modType":
            return UnityGameILCPP2.modType;
        case "UnrealEngine.modType":
            return UnrealEngine.modType(
                game.unrealEngineData?.bassPath,
                game.unrealEngineData?.useUE4SS,
            );
        default:
            return [];
    }
}

async function resolveLegacyGameCheckModType(
    game: IExpandsSupportedGames,
): Promise<ISupportedGames["checkModType"]> {
    if (
        Array.isArray(game.checkModType) ||
        typeof game.checkModType === "function"
    ) {
        return game.checkModType;
    }

    switch (game.checkModType) {
        case "UnityGame.checkModType":
            return UnityGame.checkModType;
        case "UnityGameILCPP2.checkModType":
            return UnityGameILCPP2.checkModType;
        case "UnrealEngine.checkModType":
            return UnrealEngine.checkModType;
        default:
            return [];
    }
}

async function loadLegacyCustomTypes(gameName: string) {
    const cacheKey = normalizeCompareText(gameName);
    const cachedPromise = legacyCustomTypePromiseMap.get(cacheKey);

    if (cachedPromise) {
        return cachedPromise;
    }

    const loadPromise = (async () => {
        const files = await loadLegacyJsonFiles("Types");
        let matchedFile = "";

        for (const filePath of files) {
            const fileName = normalizeCompareText(await basename(filePath));
            if (fileName === `${cacheKey}.json`) {
                matchedFile = filePath;
                break;
            }
        }

        if (!matchedFile) {
            return [] as ILegacyResolvedType[];
        }

        const typeList = await readJsonFile<IExpandsType[]>(matchedFile);

        if (!Array.isArray(typeList)) {
            return [] as ILegacyResolvedType[];
        }

        return typeList
            .filter((item) => item.name.trim())
            .map((item) => {
                const runtimeType = createRuntimeType({
                    id: createLegacyTypeId(item.name),
                    name: item.name,
                    installPath: item.installPath,
                    local: true,
                    install: item.install,
                    uninstall: item.uninstall,
                });

                return {
                    runtimeType,
                    rule: item.checkModType,
                } satisfies ILegacyResolvedType;
            });
    })();

    legacyCustomTypePromiseMap.set(cacheKey, loadPromise);
    return loadPromise;
}

export interface ILegacyCustomGameEntry {
    gameName: string;
    filePath: string;
    definition: IExpandsSupportedGames;
}

/**
 * 列出磁盘上所有自定义游戏 JSON（Expands 目录），带原始定义与文件路径。
 *
 * 与 loadLegacyCustomGames 不同：这里不做运行时解析（不把字符串模板换成真实
 * 函数），返回的是可直接回写的原始 JSON，供编辑和删除使用。
 */
export async function listLegacyCustomGameDefinitions() {
    const files = await loadLegacyJsonFiles("Expands");
    const entries: ILegacyCustomGameEntry[] = [];

    for (const filePath of files) {
        const definition = await readJsonFile<IExpandsSupportedGames>(filePath);

        if (!definition?.gameName?.trim()) {
            continue;
        }

        entries.push({
            gameName: definition.gameName,
            filePath,
            definition,
        });
    }

    return entries;
}

export async function findLegacyCustomGameDefinition(gameName: string) {
    const target = normalizeCompareText(gameName);
    const entries = await listLegacyCustomGameDefinitions();

    return (
        entries.find((item) => {
            return normalizeCompareText(item.gameName) === target;
        }) ?? null
    );
}

/**
 * 删除自定义游戏 JSON，同时清掉同名的 Types 文件（如果存在）。
 */
export async function deleteLegacyCustomGameDefinition(gameName: string) {
    const entry = await findLegacyCustomGameDefinition(gameName);

    if (!entry) {
        return false;
    }

    if (!(await FileHandler.deleteFile(entry.filePath))) {
        throw new Error("删除自定义游戏配置失败。");
    }

    invalidateLegacyCache("Expands");

    const typeFile = await readLegacyTypeFile(gameName);
    if (typeFile) {
        await FileHandler.deleteFile(typeFile);
        invalidateLegacyCache("Types", gameName);
    }

    return true;
}

export async function listLegacyCustomTypeDefinitions(gameName: string) {
    const filePath = await readLegacyTypeFile(gameName);

    if (!filePath) {
        return [] as IExpandsType[];
    }

    return (
        (await readJsonFile<IExpandsType[]>(filePath))?.filter(Boolean) ?? []
    );
}

/**
 * 按名称删除某个游戏下的单个自定义 Mod 类型。
 */
export async function deleteLegacyCustomTypeDefinition(
    gameName: string,
    typeName: string,
) {
    const filePath = await readLegacyTypeFile(gameName);

    if (!filePath) {
        return false;
    }

    const currentList =
        (await readJsonFile<IExpandsType[]>(filePath))?.filter(Boolean) ?? [];
    const target = normalizeCompareText(typeName);
    const nextList = currentList.filter((item) => {
        return normalizeCompareText(item.name) !== target;
    });

    if (nextList.length === currentList.length) {
        return false;
    }

    const saved = await FileHandler.writeFile(
        filePath,
        JSON.stringify(nextList, null, 4),
    );

    if (!saved) {
        throw new Error("写入自定义类型配置失败。");
    }

    invalidateLegacyCache("Types", gameName);

    return true;
}

export async function saveLegacyCustomGameDefinition(
    data: IExpandsSupportedGames,
) {
    const filePath = await resolveWritableLegacyFilePath(
        "Expands",
        data.gameName,
    );
    const saved = await FileHandler.writeFile(
        filePath,
        JSON.stringify(data, null, 4),
    );

    if (!saved) {
        throw new Error("写入自定义游戏配置失败。");
    }

    invalidateLegacyCache("Expands");
}

export async function saveLegacyCustomTypeDefinition(
    gameName: string,
    data: IExpandsType,
) {
    const existingFile = await readLegacyTypeFile(gameName);
    const filePath =
        existingFile ||
        (await resolveWritableLegacyFilePath("Types", gameName));
    const currentList =
        (await readJsonFile<IExpandsType[]>(filePath))?.filter(Boolean) ?? [];
    const matchedIndex = currentList.findIndex((item) => {
        return item.name.trim() === data.name.trim();
    });
    const nextList = [...currentList];

    if (matchedIndex >= 0) {
        nextList[matchedIndex] = data;
    } else {
        nextList.push(data);
    }

    const saved = await FileHandler.writeFile(
        filePath,
        JSON.stringify(nextList, null, 4),
    );

    if (!saved) {
        throw new Error("写入自定义类型配置失败。");
    }

    invalidateLegacyCache("Types", gameName);
}

async function resolveLegacyCustomTypeId(
    mod: IModInfo,
    customTypes: ILegacyResolvedType[],
) {
    for (const item of customTypes) {
        if (!item.rule) {
            continue;
        }

        if (await evaluateRuleMatch(mod, item.rule)) {
            return item.runtimeType.id;
        }
    }

    return undefined;
}

export async function mergeLegacyCustomTypesIntoGame(
    game: ISupportedGames,
): Promise<ISupportedGames> {
    const customTypes = await loadLegacyCustomTypes(game.gameName);

    if (customTypes.length === 0) {
        return game;
    }

    const mergedTypes = mergeRuntimeTypes(
        game.modType,
        customTypes.map((item) => item.runtimeType),
    );
    const baseCheckModType = game.checkModType;

    return {
        ...game,
        modType: mergedTypes,
        checkModType: async (mod: IModInfo) => {
            const baseTypeId = await evaluateCheckModType(
                mod,
                baseCheckModType,
            );

            if (
                baseTypeId !== undefined &&
                String(baseTypeId) !== "99" &&
                String(baseTypeId) !== ""
            ) {
                return baseTypeId;
            }

            const customTypeId = await resolveLegacyCustomTypeId(
                mod,
                customTypes,
            );
            if (customTypeId !== undefined) {
                return customTypeId;
            }

            return baseTypeId ?? 99;
        },
    } satisfies ISupportedGames;
}

export async function loadLegacyCustomGames() {
    const files = await loadLegacyJsonFiles("Expands");
    const gameMap = new Map<string, ISupportedGames>();

    for (const filePath of files) {
        const gameData = await readJsonFile<IExpandsSupportedGames>(filePath);

        if (!gameData?.gameName?.trim()) {
            continue;
        }

        const resolvedGame = await mergeLegacyCustomTypesIntoGame({
            ...gameData,
            modType: await resolveLegacyGameModTypes(gameData),
            checkModType: await resolveLegacyGameCheckModType(gameData),
            from: "Local",
        });

        gameMap.set(normalizeCompareText(gameData.gameName), resolvedGame);
    }

    return [...gameMap.values()];
}
