import { join } from "@tauri-apps/api/path";
import { getAllExpands } from "@/Expands";
import { FileHandler } from "@/lib/FileHandler";
import { Manager } from "@/lib/Manager";
import { PersistentStore } from "@/lib/persistent-store";
import { ref } from "vue";

interface ISyncManagerContextOptions {
    storagePath: string;
    closeSoftLinks: boolean;
}

interface ISaveEditedModOptions {
    modId: number;
    modName: string;
    modVersion: string;
    modAuthor: string;
    modWebsite: string;
    modType: number | string;
    modDesc: string;
    tagsText: string;
}

interface IApplyBatchEditOptions {
    modIds: number[];
    modAuthor: string;
    modType: number | string | "";
    modVersion: string;
    modWebsite: string;
    tagsText: string;
}

interface IUpsertTagOptions {
    name: string;
    color: string;
    previousName?: string;
}

type ModRelativePosition = "before" | "after";

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

    return fileName.slice(index).toLowerCase();
}

function createTagColor(tagName: string) {
    let hash = 0;

    for (const char of tagName) {
        hash = (hash * 31 + char.charCodeAt(0)) % 360;
    }

    return `hsl(${Math.abs(hash)} 68% 46%)`;
}

function cloneJsonValue<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
}

function isSameJsonValue<T>(left: T, right: T) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function dedupeTags(
    list: Array<ITag | string | undefined>,
    textCollator: Intl.Collator,
    existingTags: ITag[] = [],
    sort = true,
) {
    const existingTagMap = new Map(
        existingTags.map((tag) => [tag.name.trim(), tag]),
    );
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
                color: existingTagMap.get(name)?.color ?? createTagColor(name),
            });
            continue;
        }

        const name = item.name.trim();

        if (!name) {
            continue;
        }

        tagMap.set(name, {
            name,
            color:
                item.color ||
                existingTagMap.get(name)?.color ||
                createTagColor(name),
        });
    }

    const result = [...tagMap.values()];

    if (!sort) {
        return result;
    }

    return result.sort((left, right) => {
        return textCollator.compare(left.name, right.name);
    });
}

function mergeTagCatalog(
    baseTags: ITag[],
    incoming: Array<ITag | string | undefined>,
    textCollator: Intl.Collator,
) {
    const normalizedBase = dedupeTags(baseTags, textCollator, baseTags, false);
    const incomingTags = dedupeTags(
        incoming,
        textCollator,
        normalizedBase,
        false,
    );
    const incomingMap = new Map(
        incomingTags.map((tag) => [tag.name, tag] as const),
    );
    const mergedTags: ITag[] = [];

    for (const tag of normalizedBase) {
        mergedTags.push(incomingMap.get(tag.name) ?? tag);
        incomingMap.delete(tag.name);
    }

    return [
        ...mergedTags,
        ...[...incomingMap.values()].sort((left, right) => {
            return textCollator.compare(left.name, right.name);
        }),
    ];
}

export const useManager = defineStore("Manager", () => {
    const supportedGames = ref<ISupportedGames[]>([]);
    const managerModList = ref<IModInfo[]>([]);
    const search = ref("");
    const textCollator = new Intl.Collator("zh-CN", {
        numeric: true,
        sensitivity: "base",
    });

    const persistedManagerGame =
        PersistentStore.useValue<IPersistedManagerGame | null>(
            "managerGame",
            null,
        );

    const persistedManagerGameList = PersistentStore.useValue<
        IPersistedManagerGame[]
    >("managerGameList", []);

    const managerGame = ref<ISupportedGames | null>(null);
    const managerGameList = ref<ISupportedGames[]>([]);

    const selectedType = ref<number | string | 0>(0);
    const selectedTag = ref("全部");
    const tags = ref<ITag[]>([]);
    const managerRoot = ref("");
    const selectionMode = ref(false);
    const selectionIds = ref<number[]>([]);
    const runtimeLoading = ref(false);
    const loadError = ref("");

    let latestLoadId = 0;
    let syncingPersistedManagerGames = false;

    function createPersistedManagerGame(
        game: ISupportedGames,
    ): IPersistedManagerGame {
        // 运行时扩展对象包含函数，持久化时只保留游戏基础信息和用户路径配置。
        return cloneJsonValue({
            GlossGameId: game.GlossGameId,
            steamAppID: game.steamAppID,
            SteamWorkshop: game.SteamWorkshop,
            installdir: game.installdir,
            gameName: game.gameName,
            gameShowName: game.gameShowName,
            gameExe: game.gameExe,
            startExe: game.startExe,
            gamePath: game.gamePath,
            gameVersion: game.gameVersion,
            gameCoverImg: game.gameCoverImg,
            nexusMods: game.nexusMods,
            Thunderstore: game.Thunderstore,
            mod_io: game.mod_io,
            gamebanana: game.gamebanana,
            curseforge: game.curseforge,
            archivePath: game.archivePath,
            from: game.from,
        });
    }

    function createFallbackRuntimeGame(
        game: IPersistedManagerGame,
    ): ISupportedGames {
        return {
            ...game,
            modType: [],
            checkModType: [],
        };
    }

    function findSupportedGame(game: IPersistedManagerGame) {
        const normalizedGameName = game.gameName?.trim().toLowerCase();
        const sameGameName = (item: ISupportedGames) => {
            return (
                item.gameName.trim().toLowerCase() === normalizedGameName
            );
        };

        return (
            supportedGames.value.find((item) => {
                return (
                    Number(item.GlossGameId) === Number(game.GlossGameId) &&
                    sameGameName(item)
                );
            }) ??
            supportedGames.value.find(sameGameName) ??
            supportedGames.value.find((item) => {
                return Number(item.GlossGameId) === Number(game.GlossGameId);
            })
        );
    }

    function resolveRuntimeManagerGame(
        game: IPersistedManagerGame,
    ): ISupportedGames {
        const persistedGame = createPersistedManagerGame(
            createFallbackRuntimeGame(game),
        );
        const supportedGame = findSupportedGame(persistedGame);

        if (!supportedGame) {
            return createFallbackRuntimeGame(persistedGame);
        }

        return {
            ...supportedGame,
            gamePath: persistedGame.gamePath ?? supportedGame.gamePath,
            gameVersion: persistedGame.gameVersion ?? supportedGame.gameVersion,
            archivePath: persistedGame.archivePath ?? supportedGame.archivePath,
            from: supportedGame.from ?? persistedGame.from,
        };
    }

    function syncManagerGamesFromPersisted() {
        syncingPersistedManagerGames = true;

        try {
            managerGame.value = persistedManagerGame.value
                ? resolveRuntimeManagerGame(persistedManagerGame.value)
                : null;
            managerGameList.value = persistedManagerGameList.value
                .filter((game) => Boolean(game?.gameName))
                .map((game) => {
                    return resolveRuntimeManagerGame(game);
                });
        } finally {
            syncingPersistedManagerGames = false;
        }
    }

    function syncPersistedManagerGame(game: ISupportedGames | null) {
        const nextGame = game ? createPersistedManagerGame(game) : null;

        if (isSameJsonValue(nextGame, persistedManagerGame.value)) {
            return;
        }

        persistedManagerGame.value = nextGame;
    }

    function syncPersistedManagerGameList(list: ISupportedGames[]) {
        const nextList = list.map((game) => {
            return createPersistedManagerGame(game);
        });

        if (isSameJsonValue(nextList, persistedManagerGameList.value)) {
            return;
        }

        persistedManagerGameList.value = nextList;
    }

    function sortModsByWeight(list: IModInfo[]) {
        return list
            .map((mod, index) => ({
                mod,
                index,
            }))
            .sort((left, right) => {
                const leftWeight = Number.isFinite(left.mod.weight)
                    ? left.mod.weight
                    : 0;
                const rightWeight = Number.isFinite(right.mod.weight)
                    ? right.mod.weight
                    : 0;
                const weightDiff = leftWeight - rightWeight;

                if (weightDiff !== 0) {
                    return weightDiff;
                }

                return left.index - right.index;
            })
            .map(({ mod }) => mod);
    }

    const filteredMods = computed<IModInfo[]>(() => {
        const keyword = search.value.trim().toLowerCase();

        return sortModsByWeight(managerModList.value)
            .filter((mod) => {
                if (selectedType.value === 0) {
                    return true;
                }

                return String(mod.modType ?? "") === String(selectedType.value);
            })
            .filter((mod) => {
                if (selectedTag.value === "全部") {
                    return true;
                }

                return (mod.tags ?? []).some((tag) => {
                    return tag.name === selectedTag.value;
                });
            })
            .filter((mod) => {
                if (!keyword) {
                    return true;
                }

                const joinedTags = (mod.tags ?? [])
                    .map((tag) => tag.name)
                    .join(" ");
                const joinedText = [
                    mod.modName,
                    mod.modAuthor ?? "",
                    mod.modVersion,
                    mod.fileName,
                    mod.modDesc ?? "",
                    joinedTags,
                    getTypeName(mod.modType),
                ]
                    .join(" ")
                    .toLowerCase();

                return joinedText.includes(keyword);
            });
    });

    const availableTypes = computed(() => managerGame.value?.modType ?? []);
    const orderedMods = computed<IModInfo[]>(() => {
        return sortModsByWeight(managerModList.value);
    });
    const selectedMods = computed<IModInfo[]>(() => {
        const selectedIdSet = new Set(selectionIds.value);

        return sortModsByWeight(managerModList.value).filter((mod) => {
            return selectedIdSet.has(mod.id);
        });
    });

    function setSelection(ids: number[]) {
        const existingIdSet = new Set(
            managerModList.value.map((mod) => mod.id),
        );
        selectionIds.value = [...new Set(ids)].filter((id) => {
            return existingIdSet.has(id);
        });
    }

    function clearSelection() {
        selectionIds.value = [];
    }

    function toggleSelection(modId: number, selected?: boolean) {
        const selectedIdSet = new Set(selectionIds.value);
        const shouldSelect = selected ?? !selectedIdSet.has(modId);

        if (shouldSelect) {
            selectedIdSet.add(modId);
        } else {
            selectedIdSet.delete(modId);
        }

        setSelection([...selectedIdSet]);
    }

    function selectAllVisible() {
        setSelection(filteredMods.value.map((mod) => mod.id));
    }

    function invertVisibleSelection() {
        const selectedIdSet = new Set(selectionIds.value);
        const nextIds = filteredMods.value
            .filter((mod) => !selectedIdSet.has(mod.id))
            .map((mod) => mod.id);

        setSelection(nextIds);
    }

    function retainVisibleSelection() {
        const visibleIdSet = new Set(filteredMods.value.map((mod) => mod.id));

        selectionIds.value = selectionIds.value.filter((id) => {
            return visibleIdSet.has(id);
        });
    }

    function getTypeName(typeId: IModInfo["modType"]) {
        const type = availableTypes.value.find((item) => {
            return String(item.id) === String(typeId ?? "");
        });

        return type?.name ?? "未分类";
    }

    function parseTagsText(tagText: string) {
        return dedupeTags(
            tagText
                .split(/[,，]/u)
                .map((item) => item.trim())
                .filter(Boolean),
            textCollator,
            tags.value,
        );
    }

    function collectModTags(modList: IModInfo[]) {
        return dedupeTags(
            modList.flatMap((mod) => mod.tags ?? []),
            textCollator,
            tags.value,
        );
    }

    function normalizeMod(mod: Partial<IModInfo>): IModInfo {
        return {
            id: Number(mod.id ?? Date.now()),
            modName: mod.modName || mod.fileName || `Mod ${mod.id ?? ""}`,
            fileName:
                mod.fileName || mod.modName || `mod-${mod.id ?? Date.now()}`,
            md5: mod.md5 || "",
            modVersion: mod.modVersion || "1.0.0",
            isUpdate: Boolean(mod.isUpdate),
            isInstalled: Boolean(mod.isInstalled),
            weight: typeof mod.weight === "number" ? mod.weight : 0,
            modFiles: Array.isArray(mod.modFiles) ? mod.modFiles : [],
            tags: dedupeTags(mod.tags ?? [], textCollator, tags.value),
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

    async function detectModType(mod: IModInfo) {
        const game = managerGame.value;

        if (!game) {
            return 99;
        }

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
                                getBaseName(normalizedFile) ===
                                normalizedKeyword
                            );
                        }

                        return [
                            normalizedKeyword,
                            `.${normalizedKeyword}`,
                        ].includes(getFileExtension(normalizedFile));
                    });
                });

                if (matched) {
                    return rule.TypeId ?? 99;
                }
            }
        } catch (error: unknown) {
            console.error("识别 Mod 类型失败");
            console.error(error);
        }

        return (
            availableTypes.value.find((item) => String(item.id) === "99")?.id ??
            availableTypes.value[0]?.id ??
            99
        );
    }

    function syncTagsFromMods(
        extraTags: Array<ITag | string | undefined> = [],
    ) {
        tags.value = mergeTagCatalog(
            tags.value,
            [...extraTags, ...collectModTags(managerModList.value)],
            textCollator,
        );
    }

    function ensureActiveFilters() {
        if (
            selectedType.value !== 0 &&
            !availableTypes.value.some((item) => {
                return String(item.id) === String(selectedType.value);
            })
        ) {
            selectedType.value = 0;
        }

        if (
            selectedTag.value !== "全部" &&
            !tags.value.some((tag) => tag.name === selectedTag.value)
        ) {
            selectedTag.value = "全部";
        }
    }

    async function syncManagerContext(options: ISyncManagerContextOptions) {
        if (!managerGame.value || !options.storagePath) {
            managerRoot.value = "";
            Manager.configureContext({
                modStorage: "",
                gameStorage: managerGame.value?.gamePath ?? "",
                closeSoftLinks: options.closeSoftLinks,
            });

            return "";
        }

        managerRoot.value = await join(
            options.storagePath,
            "mods",
            managerGame.value.gameName ?? "",
        );
        Manager.configureContext({
            modStorage: managerRoot.value,
            gameStorage: managerGame.value?.gamePath ?? "",
            closeSoftLinks: options.closeSoftLinks,
        });

        return managerRoot.value;
    }

    async function loadManagerData(options: { resetSelection?: boolean } = {}) {
        latestLoadId += 1;
        const currentLoadId = latestLoadId;

        loadError.value = "";

        if (options.resetSelection !== false) {
            clearSelection();
        }

        if (!managerGame.value || !managerRoot.value) {
            managerModList.value = [];
            tags.value = [];
            return;
        }

        runtimeLoading.value = true;

        try {
            const storedMods = (await Manager.getModInfo(
                managerRoot.value,
            )) as IModInfo[];
            const storedTags = (await Manager.getModInfo(
                managerRoot.value,
                "tags.json",
            )) as ITag[];
            const normalizedStoredTags = dedupeTags(
                Array.isArray(storedTags) ? storedTags : [],
                textCollator,
                [],
                false,
            );
            const normalizedMods = await Promise.all(
                (Array.isArray(storedMods) ? storedMods : []).map(
                    async (item) => {
                        const mod = normalizeMod(item);

                        if (
                            item.modType === undefined ||
                            item.modType === null ||
                            item.modType === ""
                        ) {
                            mod.modType = await detectModType(mod);
                        }

                        return mod;
                    },
                ),
            );

            if (currentLoadId !== latestLoadId) {
                return;
            }

            managerModList.value = normalizedMods;
            tags.value = mergeTagCatalog(
                normalizedStoredTags,
                collectModTags(normalizedMods),
                textCollator,
            );
            ensureActiveFilters();
        } catch (error: unknown) {
            managerModList.value = [];
            tags.value = [];
            loadError.value = "读取本地 Mod 数据失败，请检查储存路径权限。";
            console.error("读取管理页数据失败");
            console.error(error);
        } finally {
            if (currentLoadId === latestLoadId) {
                runtimeLoading.value = false;
            }
        }
    }

    async function refreshRuntimeData(options: ISyncManagerContextOptions) {
        await syncManagerContext(options);
        await loadManagerData();
    }

    async function saveManagerData() {
        if (!managerRoot.value) {
            return;
        }

        const normalizedMods = sortModsByWeight(managerModList.value).map(
            (mod, index) => ({
                ...mod,
                weight: index + 1,
            }),
        );

        managerModList.value = normalizedMods;
        await Manager.saveModInfo(normalizedMods, managerRoot.value);
        await Manager.saveModInfo(tags.value, managerRoot.value, "tags.json");
    }

    async function saveEditedMod(options: ISaveEditedModOptions) {
        const modName = options.modName.trim();
        const modVersion = options.modVersion.trim();

        if (!modName) {
            throw new Error("Mod 名称不能为空。");
        }

        if (!modVersion) {
            throw new Error("版本号不能为空。");
        }

        const parsedTags = parseTagsText(options.tagsText);
        let found = false;

        managerModList.value = managerModList.value.map((item) => {
            if (item.id !== options.modId) {
                return item;
            }

            found = true;

            return normalizeMod({
                ...item,
                modName,
                modVersion,
                modAuthor: options.modAuthor.trim(),
                modWebsite: options.modWebsite.trim(),
                modType: options.modType,
                modDesc: options.modDesc.trim(),
                tags: parsedTags,
            });
        });

        if (!found) {
            throw new Error("未找到需要编辑的 Mod。");
        }

        syncTagsFromMods(parsedTags);
        await saveManagerData();
    }

    async function applyBatchEdit(options: IApplyBatchEditOptions) {
        const modIdSet = new Set(options.modIds);
        const parsedTags = parseTagsText(options.tagsText);

        managerModList.value = managerModList.value.map((mod) => {
            if (!modIdSet.has(mod.id)) {
                return mod;
            }

            return normalizeMod({
                ...mod,
                modAuthor: options.modAuthor || mod.modAuthor,
                modType: options.modType === "" ? mod.modType : options.modType,
                modVersion: options.modVersion || mod.modVersion,
                modWebsite: options.modWebsite || mod.modWebsite,
                tags: parsedTags.length > 0 ? parsedTags : mod.tags,
            });
        });

        syncTagsFromMods(parsedTags);
        await saveManagerData();
    }

    async function upsertTag(options: IUpsertTagOptions) {
        const name = options.name.trim();
        const previousName = options.previousName?.trim() ?? "";

        if (!name) {
            throw new Error("标签名称不能为空。");
        }

        if (
            tags.value.some((tag) => {
                return tag.name === name && tag.name !== previousName;
            })
        ) {
            throw new Error("标签已存在。");
        }

        if (previousName) {
            tags.value = tags.value.map((tag) => {
                if (tag.name !== previousName) {
                    return tag;
                }

                return {
                    name,
                    color: options.color,
                };
            });
            managerModList.value = managerModList.value.map((mod) => ({
                ...mod,
                tags: (mod.tags ?? []).map((tag) => {
                    if (tag.name !== previousName) {
                        return tag;
                    }

                    return {
                        name,
                        color: options.color,
                    };
                }),
            }));

            if (selectedTag.value === previousName) {
                selectedTag.value = name;
            }
        } else {
            tags.value = [
                ...tags.value,
                {
                    name,
                    color: options.color,
                },
            ];
        }

        await saveManagerData();
    }

    async function deleteTag(tagName: string) {
        tags.value = tags.value.filter((item) => item.name !== tagName);
        managerModList.value = managerModList.value.map((mod) => ({
            ...mod,
            tags: (mod.tags ?? []).filter((item) => item.name !== tagName),
        }));

        if (selectedTag.value === tagName) {
            selectedTag.value = "全部";
        }

        await saveManagerData();
    }

    async function reorderTags(draggedName: string, targetName: string) {
        const sourceIndex = tags.value.findIndex((item) => {
            return item.name === draggedName;
        });
        const targetIndex = tags.value.findIndex((item) => {
            return item.name === targetName;
        });

        if (sourceIndex === -1 || targetIndex === -1) {
            return false;
        }

        const reorderedTags = [...tags.value];
        const [draggedTag] = reorderedTags.splice(sourceIndex, 1);

        reorderedTags.splice(targetIndex, 0, draggedTag);
        tags.value = reorderedTags;
        await saveManagerData();

        return true;
    }

    async function moveModRelativeToTarget(
        movingModId: number,
        targetModId: number,
        position: ModRelativePosition,
        scopeIds?: number[],
    ) {
        if (movingModId === targetModId) {
            return false;
        }

        const orderedAllMods = sortModsByWeight(managerModList.value);
        const resolvedScopeIds = scopeIds
            ? [...new Set(scopeIds)]
            : orderedAllMods.map((item) => item.id);
        const scopeIdSet = new Set(resolvedScopeIds);

        if (!scopeIdSet.has(movingModId) || !scopeIdSet.has(targetModId)) {
            throw new Error("排序目标不在当前可调整范围内。");
        }

        const scopedMods = orderedAllMods.filter((item) => {
            return scopeIdSet.has(item.id);
        });
        const sourceIndex = scopedMods.findIndex((item) => {
            return item.id === movingModId;
        });
        const targetIndex = scopedMods.findIndex((item) => {
            return item.id === targetModId;
        });

        if (sourceIndex === -1 || targetIndex === -1) {
            throw new Error("未找到要排序的 Mod。请刷新列表后重试。");
        }

        const reorderedScopedMods = [...scopedMods];
        const [movingMod] = reorderedScopedMods.splice(sourceIndex, 1);
        let insertIndex = targetIndex;

        if (sourceIndex < targetIndex) {
            insertIndex -= 1;
        }

        if (position === "after") {
            insertIndex += 1;
        }

        reorderedScopedMods.splice(insertIndex, 0, movingMod);

        let scopedIndex = 0;
        managerModList.value = orderedAllMods.map((item, index) => {
            const nextItem = scopeIdSet.has(item.id)
                ? reorderedScopedMods[scopedIndex++]
                : item;

            return {
                ...nextItem,
                weight: index + 1,
            };
        });

        await saveManagerData();
        return true;
    }

    async function getModStoragePath(modId: number) {
        if (!managerRoot.value) {
            return "";
        }

        return await join(managerRoot.value, String(modId));
    }

    async function removeModRecord(modId: number) {
        const targetMod = managerModList.value.find((mod) => mod.id === modId);

        if (!targetMod) {
            throw new Error("未找到需要删除的 Mod。");
        }

        const modPath = await getModStoragePath(modId);

        if (modPath) {
            const deleted = await FileHandler.deleteFolder(modPath);

            if (!deleted) {
                throw new Error(
                    "删除 Mod 目录失败，请检查文件占用或权限设置。",
                );
            }
        }

        managerModList.value = managerModList.value.filter((mod) => {
            return mod.id !== modId;
        });

        if (
            selectedTag.value !== "全部" &&
            !managerModList.value.some((mod) => {
                return (mod.tags ?? []).some((tag) => {
                    return tag.name === selectedTag.value;
                });
            })
        ) {
            selectedTag.value = "全部";
        }

        await saveManagerData();
        return targetMod;
    }

    async function updateModType(
        modId: number,
        nextType: number | string | bigint,
    ) {
        const normalizedType =
            typeof nextType === "bigint" ? nextType.toString() : nextType;
        let targetModName = "";
        let found = false;

        managerModList.value = managerModList.value.map((item) => {
            if (item.id !== modId) {
                return item;
            }

            found = true;
            targetModName = item.modName;
            return {
                ...item,
                modType: normalizedType,
            };
        });

        if (!found) {
            throw new Error("未找到需要更新类型的 Mod。");
        }

        await saveManagerData();
        return targetModName;
    }

    async function toggleTagOnMod(modId: number, tagName: string) {
        const matchedTag = tags.value.find((tag) => tag.name === tagName);

        if (!matchedTag) {
            throw new Error(`未找到标签：${tagName}`);
        }

        let toggledOn = false;
        let targetModName = "";
        let found = false;

        managerModList.value = managerModList.value.map((item) => {
            if (item.id !== modId) {
                return item;
            }

            found = true;
            targetModName = item.modName;

            const hasTag = (item.tags ?? []).some(
                (tag) => tag.name === tagName,
            );
            toggledOn = !hasTag;

            return {
                ...item,
                tags: hasTag
                    ? (item.tags ?? []).filter((tag) => tag.name !== tagName)
                    : dedupeTags(
                          [...(item.tags ?? []), matchedTag],
                          textCollator,
                          tags.value,
                      ),
            };
        });

        if (!found) {
            throw new Error("未找到需要更新标签的 Mod。");
        }

        await saveManagerData();

        return {
            toggledOn,
            modName: targetModName,
        };
    }

    async function reloadSupportedGames() {
        const games = await getAllExpands();
        supportedGames.value = games;
        syncManagerGamesFromPersisted();
    }

    syncManagerGamesFromPersisted();

    watch(
        [persistedManagerGame, persistedManagerGameList, supportedGames],
        () => {
            syncManagerGamesFromPersisted();
        },
        { deep: true, flush: "sync" },
    );

    watch(
        managerGame,
        (game) => {
            if (syncingPersistedManagerGames) {
                return;
            }

            syncPersistedManagerGame(game);
        },
        { deep: true, flush: "sync" },
    );

    watch(
        managerGameList,
        (list) => {
            if (syncingPersistedManagerGames) {
                return;
            }

            syncPersistedManagerGameList(list);
        },
        { deep: true, flush: "sync" },
    );

    void reloadSupportedGames().catch((error: unknown) => {
        console.error("加载游戏扩展失败");
        console.error(error);
    });

    watch(selectionMode, (enabled) => {
        if (!enabled) {
            clearSelection();
        }
    });

    watch(managerModList, () => {
        setSelection(selectionIds.value);
    });

    return {
        supportedGames,
        managerModList,
        managerGame,
        managerGameList,
        filteredMods,
        orderedMods,
        search,
        selectedType,
        selectedTag,
        tags,
        textCollator,
        availableTypes,
        runtimeLoading,
        loadError,
        getTypeName,
        parseTagsText,
        collectModTags,
        normalizeMod,
        syncTagsFromMods,
        syncManagerContext,
        loadManagerData,
        refreshRuntimeData,
        saveEditedMod,
        applyBatchEdit,
        upsertTag,
        deleteTag,
        reorderTags,
        moveModRelativeToTarget,
        getModStoragePath,
        removeModRecord,
        updateModType,
        toggleTagOnMod,
        managerRoot,
        selectionMode,
        selectionIds,
        selectedMods,
        setSelection,
        clearSelection,
        toggleSelection,
        selectAllVisible,
        invertVisibleSelection,
        retainVisibleSelection,
        saveManagerData,
        reloadSupportedGames,
    };
});
