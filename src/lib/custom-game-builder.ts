import { basename, join } from "@tauri-apps/api/path";
import { FileHandler } from "@/lib/FileHandler";

/**
 * 自定义游戏适配的“一句话新增”支撑模块。
 *
 * 这里只做两件事：
 * 1. 探测游戏目录，把引擎类型、主程序、Unreal 项目目录等线索整理成结构化结果，
 *    让 AI 不必自己逐层翻目录就能推断出配置；
 * 2. 校验 AI 生成的 JSON，避免把明显不可用的配置写进 Expands 目录。
 */

const IGNORED_EXE_KEYWORDS = [
    "unins",
    "uninstall",
    "crashreport",
    "crashhandler",
    "vcredist",
    "dxsetup",
    "directx",
    "dotnet",
    "setup",
    "launcher_installer",
    "ue4prereqsetup",
    "ueprereqsetup",
    "epicgameslauncher",
    "easyanticheat",
    "battleye",
    "redist",
    "benchmark",
];

const UNITY_MARKER_FILES = [
    "UnityPlayer.dll",
    "UnityCrashHandler64.exe",
    "UnityCrashHandler32.exe",
];

export type TDetectedEngine =
    | "Unity"
    | "UnityIL2CPP"
    | "UnrealEngine"
    | "Unknown";

export interface IGameExeCandidate {
    /** 相对游戏根目录的路径，例如 `bin/x64/Game.exe` */
    relativePath: string;
    fileName: string;
    /** 从 exe 所在目录回到游戏根目录的相对路径，例如 `../..` */
    rootPath: string;
    /** 文件大小，字节。体积通常能区分主程序和附带小工具 */
    size: number;
    /** 是否位于游戏根目录 */
    inRoot: boolean;
}

export interface IGameDirectoryInspection {
    gamePath: string;
    exists: boolean;
    /** 目录名，通常可作为 installdir 的参考 */
    folderName: string;
    engine: TDetectedEngine;
    /** 推荐填入 gameExe 的候选，按可能性排序 */
    exeCandidates: IGameExeCandidate[];
    /** 根目录下的一级目录名 */
    topLevelFolders: string[];
    /** 根目录下的一级文件名 */
    topLevelFiles: string[];
    unity?: {
        /** 形如 `Game_Data` 的资源目录名 */
        dataFolder: string;
        /** 存在 GameAssembly.dll 时为 IL2CPP 打包 */
        isIL2CPP: boolean;
        hasBepInEx: boolean;
        hasMelonLoader: boolean;
    };
    unrealEngine?: {
        /**
         * Unreal 项目目录名，对应 unrealEngineData.bassPath。
         * pak 安装路径由 `<bassPath>/Content/Paks` 推导。
         */
        bassPath: string;
        /** 是否已安装 UE4SS（影响 pak 默认安装子目录） */
        useUE4SS: boolean;
        pakPath: string;
    };
    /** 供 AI 参考的推断说明 */
    notes: string[];
}

function normalizeText(value: string) {
    return value.trim().toLowerCase();
}

function toRelativePath(gamePath: string, absolutePath: string) {
    const normalizedRoot = FileHandler.normalizePath(gamePath).replace(
        /\/+$/u,
        "",
    );
    const normalizedTarget = FileHandler.normalizePath(absolutePath);

    if (normalizedTarget.toLowerCase().startsWith(`${normalizedRoot.toLowerCase()}/`)) {
        return normalizedTarget.slice(normalizedRoot.length + 1);
    }

    return normalizedTarget;
}

/**
 * 根据 exe 的相对深度算出回到游戏根目录的相对路径。
 * 根目录下的 exe 返回空字符串，`bin/x64/Game.exe` 返回 `../..`。
 */
function resolveRootPath(relativePath: string) {
    const depth = relativePath.split("/").filter(Boolean).length - 1;

    if (depth <= 0) {
        return "";
    }

    return Array.from({ length: depth }, () => "..").join("/");
}

function isIgnoredExe(fileName: string) {
    const normalized = normalizeText(fileName);

    return IGNORED_EXE_KEYWORDS.some((keyword) => {
        return normalized.includes(keyword);
    });
}

/**
 * 收集候选主程序。只扫描根目录和常见的两层子目录，避免在大型游戏目录里递归过久。
 */
async function collectExeCandidates(gamePath: string) {
    const candidates: IGameExeCandidate[] = [];
    const visitedFolders = new Set<string>();

    const scanFolder = async (folderPath: string) => {
        const normalized = normalizeText(folderPath);

        if (visitedFolders.has(normalized)) {
            return;
        }
        visitedFolders.add(normalized);

        const files = await FileHandler.getAllFilesInFolder(
            folderPath,
            true,
            false,
        );

        for (const filePath of files) {
            const fileName = await basename(filePath);

            if (normalizeText(fileName).endsWith(".exe") === false) {
                continue;
            }

            if (isIgnoredExe(fileName)) {
                continue;
            }

            const relativePath = toRelativePath(gamePath, filePath);
            let size = 0;

            try {
                size = await FileHandler.getFileSize(filePath);
            } catch {
                size = 0;
            }

            candidates.push({
                relativePath,
                fileName,
                rootPath: resolveRootPath(relativePath),
                size,
                inRoot: !relativePath.includes("/"),
            });
        }
    };

    await scanFolder(gamePath);

    // Unreal / 部分游戏把主程序放在 Binaries/Win64 或 bin/x64 这类子目录里。
    const nestedCandidates = [
        ["Binaries", "Win64"],
        ["Binaries", "Win32"],
        ["bin", "x64"],
        ["bin"],
        ["Win64"],
        ["x64"],
    ];
    const topFolders = await FileHandler.getAllFolderInFolder(gamePath, false);

    for (const parts of nestedCandidates) {
        await scanFolder(await join(gamePath, ...parts));
    }

    // Unreal 的项目目录名不固定，这里对一级目录再探一层 Binaries/Win64。
    for (const folderPath of topFolders) {
        await scanFolder(await join(folderPath, "Binaries", "Win64"));
    }

    // 根目录优先，其次按体积从大到小，主程序通常是最大的那个。
    return candidates.sort((left, right) => {
        if (left.inRoot !== right.inRoot) {
            return left.inRoot ? -1 : 1;
        }

        return right.size - left.size;
    });
}

async function detectUnity(gamePath: string, topLevelFolders: string[]) {
    const dataFolder = topLevelFolders.find((folderName) => {
        return folderName.toLowerCase().endsWith("_data");
    });

    if (!dataFolder) {
        return null;
    }

    const hasMarker = await Promise.all(
        UNITY_MARKER_FILES.map((fileName) => {
            return join(gamePath, fileName).then((filePath) => {
                return FileHandler.fileExists(filePath);
            });
        }),
    );
    const isIL2CPP = await FileHandler.fileExists(
        await join(gamePath, "GameAssembly.dll"),
    );

    if (!hasMarker.includes(true) && !isIL2CPP) {
        return null;
    }

    return {
        dataFolder,
        isIL2CPP,
        hasBepInEx: await FileHandler.fileExists(
            await join(gamePath, "BepInEx"),
        ),
        hasMelonLoader: await FileHandler.fileExists(
            await join(gamePath, "MelonLoader"),
        ),
    };
}

/**
 * Unreal 的判定依据是根目录同时存在 Engine 和一个包含 Content/Paks 的项目目录。
 */
async function detectUnrealEngine(gamePath: string, topLevelFolders: string[]) {
    for (const folderName of topLevelFolders) {
        if (normalizeText(folderName) === "engine") {
            continue;
        }

        const pakPath = await join(gamePath, folderName, "Content", "Paks");

        if (!(await FileHandler.fileExists(pakPath))) {
            continue;
        }

        const win64Path = await join(gamePath, folderName, "Binaries", "Win64");
        const win64Files = await FileHandler.getAllFilesInFolder(
            win64Path,
            false,
            false,
        );
        const useUE4SS = win64Files.some((fileName) => {
            const normalized = normalizeText(fileName);

            return (
                normalized === "ue4ss.dll" ||
                normalized === "dwmapi.dll" ||
                normalized === "ue4ss-settings.ini"
            );
        });

        return {
            bassPath: folderName,
            useUE4SS,
            pakPath: `${folderName}/Content/Paks`,
        };
    }

    return null;
}

/**
 * 探测游戏目录，返回结构化线索。
 *
 * 这是“一句话新增游戏”的第一步：AI 拿到用户给的目录后先调用它，
 * 再结合返回的引擎类型决定使用哪套 modType 模板。
 */
export async function inspectGameDirectory(
    gamePath: string,
): Promise<IGameDirectoryInspection> {
    const normalizedPath = FileHandler.normalizePath(gamePath);
    const notes: string[] = [];

    if (!(await FileHandler.fileExists(normalizedPath))) {
        return {
            gamePath: normalizedPath,
            exists: false,
            folderName: "",
            engine: "Unknown",
            exeCandidates: [],
            topLevelFolders: [],
            topLevelFiles: [],
            notes: ["目录不存在，请确认用户提供的是游戏安装根目录。"],
        };
    }

    const folderName = await basename(normalizedPath);
    const topLevelFolderPaths = await FileHandler.getAllFolderInFolder(
        normalizedPath,
        false,
    );
    const topLevelFolders = await Promise.all(
        topLevelFolderPaths.map((item) => basename(item)),
    );
    const topLevelFiles = await FileHandler.getAllFilesInFolder(
        normalizedPath,
        false,
        false,
    );
    const exeCandidates = await collectExeCandidates(normalizedPath);
    const unity = await detectUnity(normalizedPath, topLevelFolders);
    const unrealEngine = unity
        ? null
        : await detectUnrealEngine(normalizedPath, topLevelFolders);

    let engine: TDetectedEngine = "Unknown";

    if (unity) {
        engine = unity.isIL2CPP ? "UnityIL2CPP" : "Unity";
        notes.push(
            unity.isIL2CPP
                ? "检测到 GameAssembly.dll，属于 IL2CPP 打包，modType 建议使用 UnityGameILCPP2.modType。"
                : "检测到 Unity Mono 打包，modType 建议使用 UnityGame.modType。",
        );

        if (unity.hasBepInEx) {
            notes.push("目录中已存在 BepInEx，说明玩家已装过 Unity 插件框架。");
        }
        if (unity.hasMelonLoader) {
            notes.push("目录中已存在 MelonLoader。");
        }
    } else if (unrealEngine) {
        engine = "UnrealEngine";
        notes.push(
            `检测到 Unreal Engine 项目目录 ${unrealEngine.bassPath}，modType 建议使用 UnrealEngine.modType，并把 unrealEngineData.bassPath 设为 ${unrealEngine.bassPath}。`,
        );

        if (unrealEngine.useUE4SS) {
            notes.push(
                "目录中检测到 UE4SS 相关文件，unrealEngineData.useUE4SS 建议设为 true。",
            );
        }
    } else {
        notes.push(
            "未识别出 Unity 或 Unreal 特征，需要按游戏实际的 Mod 结构自定义 modType 与 checkModType。",
        );
    }

    if (exeCandidates.length === 0) {
        notes.push("没有找到候选 exe，请向用户确认目录是否为游戏根目录。");
    } else {
        notes.push(
            `推荐的 gameExe 为 ${exeCandidates[0].fileName}${
                exeCandidates[0].inRoot
                    ? ""
                    : `（位于 ${exeCandidates[0].relativePath}，需要配合 rootPath 使用）`
            }。`,
        );
    }

    return {
        gamePath: normalizedPath,
        exists: true,
        folderName,
        engine,
        exeCandidates,
        topLevelFolders,
        topLevelFiles,
        ...(unity ? { unity } : {}),
        ...(unrealEngine ? { unrealEngine } : {}),
        notes,
    };
}

const VALID_INSTALL_USE_FUNCTIONS: InstallUseFunction[] = [
    "generalInstall",
    "generalUninstall",
    "installByFolder",
    "installByFile",
    "installByFileSibling",
    "installByFolderParent",
    "Unknown",
];

const VALID_MOD_TYPE_TEMPLATES = [
    "UnityGame.modType",
    "UnityGameILCPP2.modType",
    "UnrealEngine.modType",
    "Custom",
];

const VALID_CHECK_MOD_TYPE_TEMPLATES = [
    "UnityGame.checkModType",
    "UnityGameILCPP2.checkModType",
    "UnrealEngine.checkModType",
    "Custom",
];

const VALID_CHECK_RULE_FUNCTIONS = ["extname", "basename", "inPath"];

export interface IDefinitionValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

function validateTypeInstall(
    value: unknown,
    label: string,
    errors: string[],
) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${label} 必须是对象。`);
        return;
    }

    const config = value as Record<string, unknown>;
    const useFunction = config.UseFunction;

    if (
        typeof useFunction !== "string" ||
        !VALID_INSTALL_USE_FUNCTIONS.includes(
            useFunction as InstallUseFunction,
        )
    ) {
        errors.push(
            `${label}.UseFunction 必须是 ${VALID_INSTALL_USE_FUNCTIONS.join(" / ")} 之一。`,
        );
    }

    if (typeof config.inGameStorage !== "boolean") {
        errors.push(`${label}.inGameStorage 必须是布尔值。`);
    }

    if (
        (useFunction === "installByFile" ||
            useFunction === "installByFileSibling") &&
        !String(config.fileName ?? "").trim()
    ) {
        errors.push(`${label} 使用 ${useFunction} 时必须提供 fileName。`);
    }

    if (
        (useFunction === "installByFolder" ||
            useFunction === "installByFolderParent") &&
        !String(config.folderName ?? "").trim()
    ) {
        errors.push(`${label} 使用 ${useFunction} 时必须提供 folderName。`);
    }
}

function validateCheckRule(
    value: unknown,
    label: string,
    errors: string[],
) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push(`${label} 必须是对象。`);
        return;
    }

    const rule = value as Record<string, unknown>;

    if (
        typeof rule.UseFunction !== "string" ||
        !VALID_CHECK_RULE_FUNCTIONS.includes(rule.UseFunction)
    ) {
        errors.push(
            `${label}.UseFunction 必须是 ${VALID_CHECK_RULE_FUNCTIONS.join(" / ")} 之一。`,
        );
    }

    if (
        !Array.isArray(rule.Keyword) ||
        rule.Keyword.length === 0 ||
        rule.Keyword.some((item) => typeof item !== "string" || !item.trim())
    ) {
        errors.push(`${label}.Keyword 必须是非空字符串数组。`);
    }
}

/**
 * 校验 AI 生成的自定义游戏 JSON。
 *
 * 只拦明确错误（缺必填、类型不对、枚举值非法），可疑但能跑的情况走 warnings，
 * 避免把还能用的配置直接拒掉。
 */
export function validateCustomGameDefinition(
    value: unknown,
): IDefinitionValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        return {
            valid: false,
            errors: ["配置必须是 JSON 对象。"],
            warnings,
        };
    }

    const data = value as Record<string, unknown>;

    const gameName = String(data.gameName ?? "").trim();

    if (!gameName) {
        errors.push("gameName 必填，且作为配置文件名与游戏唯一标识。");
    } else if (/[\\/:*?"<>|]/u.test(gameName) || gameName.includes("..")) {
        // gameName 会直接拼成文件名，必须挡掉路径分隔符和上跳，
        // 否则可以写到 Expands 目录之外。
        errors.push(
            'gameName 不能包含路径分隔符或 \\ / : * ? " < > | 等字符，也不能包含 ".."。',
        );
    } else if (/[一-龥]/u.test(gameName)) {
        warnings.push(
            "gameName 建议使用英文，中文名称请通过语言包配置 gameShowName。",
        );
    }

    if (typeof data.GlossGameId !== "number") {
        errors.push("GlossGameId 必须是数字，未知时填 0。");
    }

    if (typeof data.steamAppID !== "number") {
        errors.push("steamAppID 必须是数字，非 Steam 游戏填 0。");
    }

    const gameExe = data.gameExe;
    if (typeof gameExe === "string") {
        if (!gameExe.trim()) {
            errors.push("gameExe 不能为空字符串。");
        }
    } else if (Array.isArray(gameExe)) {
        if (gameExe.length === 0) {
            errors.push("gameExe 数组不能为空。");
        }

        gameExe.forEach((item, index) => {
            if (
                typeof item !== "object" ||
                item === null ||
                !String((item as Record<string, unknown>).name ?? "").trim()
            ) {
                errors.push(`gameExe[${index}].name 必填。`);
            }
        });
    } else {
        errors.push("gameExe 必须是字符串或 { name, rootPath } 数组。");
    }

    const modType = data.modType;
    if (typeof modType === "string") {
        if (!VALID_MOD_TYPE_TEMPLATES.includes(modType)) {
            errors.push(
                `modType 为字符串时必须是 ${VALID_MOD_TYPE_TEMPLATES.join(" / ")} 之一。`,
            );
        }

        if (
            modType === "UnrealEngine.modType" &&
            typeof data.unrealEngineData !== "object"
        ) {
            errors.push(
                "modType 为 UnrealEngine.modType 时必须提供 unrealEngineData.bassPath。",
            );
        }
    } else if (Array.isArray(modType)) {
        if (modType.length === 0) {
            errors.push("modType 数组不能为空。");
        }

        const seenIds = new Set<string>();

        modType.forEach((item, index) => {
            if (typeof item !== "object" || item === null) {
                errors.push(`modType[${index}] 必须是对象。`);
                return;
            }

            const type = item as Record<string, unknown>;
            const typeId = type.id;

            if (typeof typeId !== "number" && typeof typeId !== "string") {
                errors.push(`modType[${index}].id 必须是数字或字符串。`);
            } else if (seenIds.has(String(typeId))) {
                errors.push(`modType[${index}].id 重复：${String(typeId)}。`);
            } else {
                seenIds.add(String(typeId));
            }

            if (!String(type.name ?? "").trim()) {
                errors.push(`modType[${index}].name 必填。`);
            }

            validateTypeInstall(
                type.install,
                `modType[${index}].install`,
                errors,
            );
            validateTypeInstall(
                type.uninstall,
                `modType[${index}].uninstall`,
                errors,
            );
        });

        if (
            !modType.some((item) => {
                return String((item as Record<string, unknown>)?.id ?? "") === "99";
            })
        ) {
            warnings.push(
                "建议保留一个 id 为 99 的“未知”类型作为兜底，避免无法归类的 Mod 无处安放。",
            );
        }
    } else {
        errors.push("modType 必须是数组或内置模板字符串。");
    }

    const checkModType = data.checkModType;
    if (typeof checkModType === "string") {
        if (!VALID_CHECK_MOD_TYPE_TEMPLATES.includes(checkModType)) {
            errors.push(
                `checkModType 为字符串时必须是 ${VALID_CHECK_MOD_TYPE_TEMPLATES.join(" / ")} 之一。`,
            );
        }
    } else if (Array.isArray(checkModType)) {
        checkModType.forEach((item, index) => {
            validateCheckRule(item, `checkModType[${index}]`, errors);
        });

        if (Array.isArray(modType)) {
            const typeIds = new Set(
                modType.map((item) => {
                    return String((item as Record<string, unknown>)?.id ?? "");
                }),
            );

            checkModType.forEach((item, index) => {
                const rule = item as Record<string, unknown>;
                const typeId = rule?.TypeId;

                if (typeId === undefined) {
                    warnings.push(
                        `checkModType[${index}] 未指定 TypeId，匹配后会落到 99。`,
                    );
                    return;
                }

                if (!typeIds.has(String(typeId))) {
                    errors.push(
                        `checkModType[${index}].TypeId 为 ${String(typeId)}，但 modType 中没有这个 id。`,
                    );
                }
            });
        }
    } else {
        errors.push("checkModType 必须是数组或内置模板字符串。");
    }

    if (data.GlossGameId === 0) {
        warnings.push(
            "GlossGameId 为 0 时无法使用 Mod 站的一键安装和在线浏览功能。",
        );
    }

    if (!String(data.gameCoverImg ?? "").trim()) {
        warnings.push("未设置 gameCoverImg，游戏选择界面将没有封面图。");
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
    };
}
