import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appLogDir } from "@tauri-apps/api/path";
import { platform } from "@tauri-apps/plugin-os";
import type { Pinia } from "pinia";
import { computed } from "vue";
import { ref } from "vue";
import packageInfo from "../../package.json";
import {
    inspectGameDirectory,
    validateCustomGameDefinition,
} from "@/lib/custom-game-builder";
import { fetchAllGlossGames, fetchGlossGamePlugins } from "@/lib/gloss-mod-api";
import { FileHandler } from "@/lib/FileHandler";
import {
    deleteLegacyCustomGameDefinition,
    findLegacyCustomGameDefinition,
    listLegacyCustomGameDefinitions,
    saveLegacyCustomGameDefinition,
} from "@/lib/legacy-custom-data";
import { queueGlossModDownload } from "@/lib/gloss-download-queue";
import { Log } from "@/lib/log";
import { Manager } from "@/lib/Manager";
import { PersistentStore } from "@/lib/persistent-store";
import { ScanGame } from "@/lib/scan-game";
import i18n from "@/lang";
import router from "@/routes";
import { useManager } from "@/stores/manager";
import { useSettings } from "@/stores/settings";

const DEFAULT_MCP_PORT = 36412;
const MCP_SERVER_ENABLED_KEY = "mcpServerEnabled";
const JSON_RPC_VERSION = "2.0";
const DEFAULT_PROTOCOL_VERSION = "2025-03-26";
const SUPPORTED_PROTOCOL_VERSIONS = new Set(["2025-03-26", "2024-11-05"]);
const MCP_TRANSPORT_EVENT = "mcp-http-request";
const MCP_STATUS_EVENT = "mcp-server-status-changed";
const APP_VERSION = packageInfo.version;
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

type McpServerStatus = "stopped" | "starting" | "running" | "stopping";
type JsonRpcId = string | number | null;

interface IMcpServerSnapshot {
    status: McpServerStatus;
    port: number | null;
    authToken: string | null;
}

interface IMcpTransportEventPayload {
    requestId: string;
    body: string;
}

interface IMcpJsonRpcRequest {
    id?: JsonRpcId;
    jsonrpc?: string;
    method: string;
    params?: Record<string, unknown> | null;
}

interface IMcpJsonRpcResponse {
    id: JsonRpcId;
    jsonrpc: typeof JSON_RPC_VERSION;
    error?: {
        code: number;
        data?: unknown;
        message: string;
    };
    result?: unknown;
}

interface IMcpToolDefinition {
    annotations?: {
        openWorldHint?: boolean;
        readOnlyHint?: boolean;
    };
    description: string;
    inputSchema: Record<string, unknown>;
    name: string;
    title: string;
}

interface IMcpToolCallResult {
    content: Array<{
        text: string;
        type: "text";
    }>;
    isError?: boolean;
    structuredContent?: unknown;
}

interface IMcpResourceDefinition {
    description: string;
    mimeType: string;
    name: string;
    title: string;
    uri: string;
}

interface IMcpPromptDefinition {
    arguments?: Array<{
        description: string;
        name: string;
        required?: boolean;
    }>;
    description: string;
    name: string;
    title: string;
}

interface IMcpPromptMessage {
    content: {
        text: string;
        type: "text";
    };
    role: "assistant" | "user";
}

function createObjectSchema(
    properties: Record<string, unknown> = {},
    required: string[] = [],
) {
    return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
        additionalProperties: false,
    };
}

const emptyObjectSchema = createObjectSchema();

export const mcpToolDefinitions: readonly IMcpToolDefinition[] = [
    {
        name: "get-supported-games-list",
        title: "获取支持游戏列表",
        description: "返回当前 Gloss Mod Manager 支持的全部游戏。",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true },
    },
    {
        name: "get-manager-games-list",
        title: "获取管理器游戏列表",
        description: "返回已经添加到管理器中的游戏列表。",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true },
    },
    {
        name: "get-current-managed-game",
        title: "获取当前管理游戏",
        description: "返回当前正在管理的游戏信息。",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true },
    },
    {
        name: "translate-game-name",
        title: "翻译游戏名称",
        description: "将游戏名称翻译为当前界面语言。",
        inputSchema: createObjectSchema(
            {
                gameName: {
                    type: "string",
                    description: "游戏原始名称。",
                },
            },
            ["gameName"],
        ),
        annotations: { readOnlyHint: true },
    },
    {
        name: "fetch-steam-installed-games",
        title: "扫描 Steam 已安装游戏",
        description: "扫描当前设备中可识别的 Steam 游戏安装路径。",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true },
    },
    {
        name: "add-game-to-manager",
        title: "添加游戏到管理器",
        description: "将指定游戏和安装目录写入管理器，并切换为当前管理游戏。",
        inputSchema: createObjectSchema(
            {
                GlossGameId: {
                    type: "number",
                    description: "Gloss 游戏 ID。",
                },
                gamePath: {
                    type: "string",
                    description: "游戏安装目录。",
                },
            },
            ["GlossGameId", "gamePath"],
        ),
    },
    {
        name: "switch-managed-game",
        title: "切换当前管理游戏",
        description: "根据 Gloss 游戏 ID 切换到已有的管理游戏。",
        inputSchema: createObjectSchema(
            {
                GlossGameId: {
                    type: "number",
                    description: "Gloss 游戏 ID。",
                },
            },
            ["GlossGameId"],
        ),
    },
    {
        name: "remove-game-from-manager",
        title: "从管理器移除游戏",
        description: "从管理列表中移除指定的游戏记录。",
        inputSchema: createObjectSchema(
            {
                GlossGameId: {
                    type: "number",
                    description: "Gloss 游戏 ID。",
                },
            },
            ["GlossGameId"],
        ),
    },
    {
        name: "get-current-mod-list",
        title: "获取当前 Mod 列表",
        description: "返回当前管理游戏的本地 Mod 列表。",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true },
    },
    {
        name: "install-mod-by-id",
        title: "安装或卸载 Mod",
        description: "按本地 Mod ID 安装或卸载当前游戏中的 Mod。",
        inputSchema: createObjectSchema(
            {
                modId: {
                    type: "number",
                    description: "本地 Mod ID。",
                },
                isInstall: {
                    type: "boolean",
                    description: "true 表示安装，false 表示卸载。",
                },
            },
            ["modId", "isInstall"],
        ),
    },
    {
        name: "remove-mod-by-id",
        title: "移除 Mod",
        description: "删除本地 Mod 缓存目录并移除管理记录。",
        inputSchema: createObjectSchema(
            {
                modId: {
                    type: "number",
                    description: "本地 Mod ID。",
                },
            },
            ["modId"],
        ),
    },
    {
        name: "get-mod-dependencies",
        title: "获取前置依赖",
        description: "获取目标游戏在 Gloss Mod 平台上的前置依赖插件。",
        inputSchema: createObjectSchema({
            GlossGameId: {
                type: "number",
                description: "可选。未传入时使用当前管理游戏。",
            },
        }),
        annotations: { readOnlyHint: true },
    },
    {
        name: "queue-gloss-mod-download",
        title: "添加内部下载任务",
        description:
            "按 Gloss Mod ID 将内部下载资源加入下载队列。未传 resourceId 时默认使用最新资源。",
        inputSchema: createObjectSchema(
            {
                modId: {
                    type: "number",
                    description: "Gloss 平台上的 Mod ID。",
                },
                resourceId: {
                    anyOf: [{ type: "number" }, { type: "string" }],
                    description: "可选。指定资源 ID；未传时自动使用最新资源。",
                },
                replaceLocalModId: {
                    type: "number",
                    description:
                        "可选。传入后，下载完成自动导入时会尝试覆盖该本地 Mod。",
                },
            },
            ["modId"],
        ),
    },
    {
        name: "add-tag-to-mod",
        title: "为 Mod 添加标签",
        description: "向指定 Mod 添加一个标签，并同步到标签列表。",
        inputSchema: createObjectSchema(
            {
                modId: {
                    type: "number",
                    description: "本地 Mod ID。",
                },
                tag: createObjectSchema(
                    {
                        name: {
                            type: "string",
                            description: "标签名称。",
                        },
                        color: {
                            type: "string",
                            description: "标签颜色，支持任意 CSS 颜色值。",
                        },
                    },
                    ["name"],
                ),
            },
            ["modId", "tag"],
        ),
    },
    {
        name: "remove-tag-from-mod",
        title: "移除 Mod 标签",
        description: "从指定 Mod 中移除一个标签名称。",
        inputSchema: createObjectSchema(
            {
                modId: {
                    type: "number",
                    description: "本地 Mod ID。",
                },
                tagName: {
                    type: "string",
                    description: "需要移除的标签名称。",
                },
            },
            ["modId", "tagName"],
        ),
    },
    {
        name: "rename-mod",
        title: "重命名 Mod",
        description: "修改本地 Mod 的显示名称。",
        inputSchema: createObjectSchema(
            {
                modId: {
                    type: "number",
                    description: "本地 Mod ID。",
                },
                modName: {
                    type: "string",
                    description: "新的 Mod 名称。",
                },
            },
            ["modId", "modName"],
        ),
    },
    {
        name: "sort-mods",
        title: "重排 Mod 顺序",
        description: "按传入的 Mod ID 顺序重排当前列表，并自动补全未传入条目。",
        inputSchema: createObjectSchema(
            {
                modIds: {
                    type: "array",
                    items: { type: "number" },
                    description: "目标排序中的 Mod ID 列表。",
                },
            },
            ["modIds"],
        ),
    },
    {
        name: "get-mod-storage-path",
        title: "获取 Mod 存储路径",
        description: "获取当前游戏的 Mod 根目录，或指定 Mod 的缓存目录。",
        inputSchema: createObjectSchema({
            modId: {
                type: "number",
                description: "可选。传入后返回该 Mod 的目录。",
            },
        }),
        annotations: { readOnlyHint: true },
    },
    {
        name: "get-directory-contents",
        title: "获取目录下的文件夹",
        description:
            "返回目录下的全部文件夹路径。仅允许访问 mod 存储目录、当前游戏目录与日志目录。",
        inputSchema: createObjectSchema(
            {
                path: {
                    type: "string",
                    description: "目标目录。",
                },
                recursive: {
                    type: "boolean",
                    description: "是否递归子目录。",
                },
            },
            ["path"],
        ),
        annotations: { readOnlyHint: true },
    },
    {
        name: "get-files-in-directory",
        title: "获取目录下的文件",
        description:
            "返回目录下的全部文件路径。仅允许访问 mod 存储目录、当前游戏目录与日志目录。",
        inputSchema: createObjectSchema(
            {
                path: {
                    type: "string",
                    description: "目标目录。",
                },
                recursive: {
                    type: "boolean",
                    description: "是否递归子目录。",
                },
            },
            ["path"],
        ),
        annotations: { readOnlyHint: true },
    },
    {
        name: "copy-file-to-location",
        title: "复制文件",
        description:
            "将一个文件复制到目标位置。源路径与目标路径均需位于 mod 存储目录、当前游戏目录或日志目录内。",
        inputSchema: createObjectSchema(
            {
                sourcePath: {
                    type: "string",
                    description: "源文件路径。",
                },
                targetPath: {
                    type: "string",
                    description: "目标文件路径。",
                },
            },
            ["sourcePath", "targetPath"],
        ),
    },
    {
        name: "copy-folder-to-location",
        title: "复制文件夹",
        description:
            "将一个文件夹复制到目标位置。源路径与目标路径均需位于 mod 存储目录、当前游戏目录或日志目录内。",
        inputSchema: createObjectSchema(
            {
                sourcePath: {
                    type: "string",
                    description: "源目录路径。",
                },
                targetPath: {
                    type: "string",
                    description: "目标目录路径。",
                },
            },
            ["sourcePath", "targetPath"],
        ),
    },
    {
        name: "read-file-contents",
        title: "读取文件内容",
        description:
            "读取文本文件内容，可选最大返回长度。仅允许访问 mod 存储目录、当前游戏目录与日志目录。",
        inputSchema: createObjectSchema(
            {
                path: {
                    type: "string",
                    description: "目标文件路径。",
                },
                maxLength: {
                    type: "number",
                    description: "可选，默认 20000。",
                },
            },
            ["path"],
        ),
        annotations: { readOnlyHint: true },
    },
    {
        name: "inspect-game-directory",
        title: "探测游戏目录特征",
        description:
            "分析游戏安装目录，返回引擎类型（Unity / IL2CPP / Unreal）、候选主程序、Unreal 项目目录与目录结构，用于推断自定义游戏适配配置。",
        inputSchema: createObjectSchema(
            {
                gamePath: {
                    type: "string",
                    description: "游戏安装根目录的绝对路径。",
                },
            },
            ["gamePath"],
        ),
        annotations: { readOnlyHint: true },
    },
    {
        name: "search-gloss-game",
        title: "搜索 Gloss 游戏 ID",
        description:
            "按名称关键字在 Gloss Mod 站的游戏列表中搜索，返回匹配的 GlossGameId 与官方 Mod 分类，用于填写自定义游戏配置。",
        inputSchema: createObjectSchema(
            {
                keyword: {
                    type: "string",
                    description: "游戏名称关键字，支持中英文部分匹配。",
                },
                limit: {
                    type: "number",
                    description: "可选，返回条数上限，默认 10。",
                },
            },
            ["keyword"],
        ),
        annotations: { readOnlyHint: true, openWorldHint: true },
    },
    {
        name: "list-custom-games",
        title: "列出自定义游戏适配",
        description:
            "列出本地 Expands 目录中所有用户自定义的游戏适配 JSON，包含文件路径与配置内容。",
        inputSchema: emptyObjectSchema,
        annotations: { readOnlyHint: true },
    },
    {
        name: "read-custom-game",
        title: "读取自定义游戏适配",
        description: "按游戏名称读取单个自定义游戏适配 JSON 的完整内容。",
        inputSchema: createObjectSchema(
            {
                gameName: {
                    type: "string",
                    description: "自定义游戏配置中的 gameName。",
                },
            },
            ["gameName"],
        ),
        annotations: { readOnlyHint: true },
    },
    {
        name: "validate-custom-game",
        title: "校验自定义游戏适配",
        description:
            "在写入前校验自定义游戏适配 JSON 是否合法，返回错误与警告列表。不会写入任何文件。",
        inputSchema: createObjectSchema(
            {
                definition: {
                    type: "object",
                    description:
                        "完整的自定义游戏配置对象，字段与 Expands JSON 一致。",
                },
            },
            ["definition"],
        ),
        annotations: { readOnlyHint: true },
    },
    {
        name: "save-custom-game",
        title: "保存自定义游戏适配",
        description:
            "校验并写入自定义游戏适配 JSON 到 Expands 目录，然后刷新支持游戏列表。同名配置会被覆盖，可用于新建与编辑。",
        inputSchema: createObjectSchema(
            {
                definition: {
                    type: "object",
                    description:
                        "完整的自定义游戏配置对象。必填 gameName、GlossGameId、steamAppID、gameExe、modType、checkModType。",
                },
                overwrite: {
                    type: "boolean",
                    description:
                        "可选，默认 false。已存在同名配置时必须显式传 true 才会覆盖。",
                },
            },
            ["definition"],
        ),
    },
    {
        name: "delete-custom-game",
        title: "删除自定义游戏适配",
        description:
            "删除指定名称的自定义游戏适配 JSON，并同时移除该游戏的自定义类型文件，然后刷新支持游戏列表。",
        inputSchema: createObjectSchema(
            {
                gameName: {
                    type: "string",
                    description: "要删除的自定义游戏 gameName。",
                },
            },
            ["gameName"],
        ),
    },
] as const;

export const mcpResourceDefinitions: readonly IMcpResourceDefinition[] = [
    {
        name: "supported-games-list",
        uri: "games://supported-games-list",
        title: "支持的游戏列表",
        description: "所有已加载的支持游戏列表。",
        mimeType: "application/json",
    },
    {
        name: "mod-list",
        uri: "mods://mod-list",
        title: "当前 Mod 列表",
        description: "当前管理游戏的 Mod 列表。",
        mimeType: "application/json",
    },
    {
        name: "mod-dependencies",
        uri: "mods://mod-dependencies",
        title: "当前游戏前置依赖",
        description: "当前游戏在平台上的前置依赖数据。",
        mimeType: "application/json",
    },
    {
        name: "mod-storage-path",
        uri: "paths://mod-storage-path",
        title: "Mod 存储路径",
        description: "当前管理游戏的 Mod 根目录。",
        mimeType: "application/json",
    },
    {
        name: "game-storage-path",
        uri: "paths://game-storage-path",
        title: "游戏目录路径",
        description: "当前管理游戏的安装目录。",
        mimeType: "application/json",
    },
    {
        name: "latest-log",
        uri: "logs://latest-log",
        title: "最新应用日志",
        description: "当前会话对应的 latest.log 文本内容。",
        mimeType: "text/plain",
    },
] as const;

export const mcpPromptDefinitions: readonly IMcpPromptDefinition[] = [
    {
        name: "get-all-games-list",
        title: "列出全部支持游戏",
        description: "帮助模型先读取支持游戏列表，再执行后续操作。",
    },
    {
        name: "organize-mods",
        title: "整理当前 Mod",
        description: "帮助模型先读取当前 Mod 列表，再给出整理建议。",
        arguments: [
            {
                name: "goal",
                description:
                    "可选。补充这次整理的目标，例如提升稳定性或精简数量。",
            },
        ],
    },
    {
        name: "prepare-manager-switch",
        title: "切换管理游戏",
        description: "帮助模型先读取管理器游戏列表，再决定是否切换目标游戏。",
    },
] as const;

const mcpPort = PersistentStore.useValue<number>("mcpPort", DEFAULT_MCP_PORT);
const serverStatus = ref<McpServerStatus>("stopped");
const isInitialized = ref(false);
// 令牌由 Rust 端每次启动时生成，不做持久化，仅用于展示和拼接客户端配置。
const authToken = ref<string>("");
const endpoint = computed(() => `http://127.0.0.1:${mcpPort.value}/mcp`);
const isRunning = computed(() => serverStatus.value === "running");
const isBusy = computed(() => {
    return (
        serverStatus.value === "starting" || serverStatus.value === "stopping"
    );
});

let activePinia: Pinia | null = null;
let initPromise: Promise<void> | null = null;
let autoStartPromise: Promise<void> | null = null;

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sleep(duration: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, duration);
    });
}

function toSerializable<T>(value: T): T {
    if (value === undefined) {
        return value;
    }

    return JSON.parse(JSON.stringify(value)) as T;
}

function createJsonRpcResult(
    id: JsonRpcId,
    result: unknown,
): IMcpJsonRpcResponse {
    return {
        id,
        jsonrpc: JSON_RPC_VERSION,
        result,
    };
}

function createJsonRpcError(
    id: JsonRpcId,
    code: number,
    message: string,
    data?: unknown,
): IMcpJsonRpcResponse {
    return {
        id,
        jsonrpc: JSON_RPC_VERSION,
        error: {
            code,
            message,
            ...(data === undefined ? {} : { data }),
        },
    };
}

function formatStructuredText(value: unknown) {
    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value, null, 2);
}

function createToolResult(
    structuredContent: unknown,
    text?: string,
): IMcpToolCallResult {
    const normalizedContent = toSerializable(structuredContent);

    return {
        content: [
            {
                type: "text",
                text: text ?? formatStructuredText(normalizedContent),
            },
        ],
        structuredContent: normalizedContent,
    };
}

function createToolErrorResult(message: string): IMcpToolCallResult {
    return {
        content: [
            {
                type: "text",
                text: message,
            },
        ],
        isError: true,
    };
}

function resolveProtocolVersion(value: unknown) {
    if (typeof value === "string" && SUPPORTED_PROTOCOL_VERSIONS.has(value)) {
        return value;
    }

    return DEFAULT_PROTOCOL_VERSION;
}

function toRequiredString(value: unknown, fieldName: string) {
    if (typeof value !== "string" || !value.trim()) {
        throw new Error(`${fieldName} 必须是非空字符串。`);
    }

    return value.trim();
}

function toOptionalBoolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
}

/**
 * 统一为正斜杠并去掉尾部分隔符，便于做前缀包含关系判断。
 */
function normalizePathForCompare(value: string) {
    const normalized = value.replace(/\\/gu, "/").replace(/\/+$/u, "");

    return platform() === "windows" ? normalized.toLowerCase() : normalized;
}

/**
 * 收集当前允许 MCP 文件类工具访问的根目录：
 * mod 存储目录、当前管理游戏目录以及应用日志目录。
 */
async function collectAllowedFileRoots() {
    const { manager } = getStores();
    const roots: string[] = [];

    if (manager.managerRoot) {
        roots.push(manager.managerRoot);
    }

    const gamePath = manager.managerGame?.gamePath ?? "";
    if (gamePath) {
        roots.push(gamePath);
    }

    try {
        roots.push(await appLogDir());
    } catch (error: unknown) {
        console.error("获取日志目录失败");
        console.error(error);
    }

    return roots.filter(Boolean).map(normalizePathForCompare);
}

/**
 * 校验路径是否落在允许的根目录内。
 *
 * MCP 服务虽然只监听回环地址并且已做令牌鉴权，但文件类工具仍不应具备
 * 全盘读写能力，否则一旦令牌泄露即等于任意文件读写。
 */
async function assertPathWithinAllowedRoots(
    targetPath: string,
    fieldName: string,
) {
    const allowedRoots = await collectAllowedFileRoots();

    if (allowedRoots.length === 0) {
        throw new Error(
            "当前未配置 mod 存储目录，无法确定允许访问的路径范围。",
        );
    }

    const normalizedTarget = normalizePathForCompare(targetPath);

    if (!normalizedTarget) {
        throw new Error(`${fieldName} 不是有效路径。`);
    }

    // 显式拒绘 .. 片段，避免通过相对路径穿越到根目录之外。
    if (normalizedTarget.split("/").includes("..")) {
        throw new Error(`${fieldName} 不允许包含上级目录片段。`);
    }

    const isWithinAllowedRoots = allowedRoots.some((root) => {
        return (
            normalizedTarget === root ||
            normalizedTarget.startsWith(`${root}/`)
        );
    });

    if (!isWithinAllowedRoots) {
        throw new Error(
            `${fieldName} 超出允许访问范围，仅允许访问 mod 存储目录、当前游戏目录与日志目录。`,
        );
    }

    return targetPath;
}

function toRequiredNumber(value: unknown, fieldName: string) {
    const resolved = typeof value === "number" ? value : Number(value);

    if (!Number.isFinite(resolved)) {
        throw new Error(`${fieldName} 必须是有效数字。`);
    }

    return resolved;
}

function toOptionalNumber(value: unknown, fallback: number) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return toRequiredNumber(value, "数值参数");
}

function toNumberArray(value: unknown, fieldName: string) {
    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} 必须是数组。`);
    }

    return value.map((item) => toRequiredNumber(item, fieldName));
}

function createTagColor(tagName: string) {
    let hash = 0;

    for (const char of tagName) {
        hash = (hash * 31 + char.charCodeAt(0)) % 360;
    }

    return `hsl(${Math.abs(hash)} 68% 46%)`;
}

function normalizeTag(tag: Partial<ITag>) {
    const name = toRequiredString(tag.name, "tag.name");

    return {
        name,
        color:
            typeof tag.color === "string" && tag.color.trim()
                ? tag.color.trim()
                : createTagColor(name),
    } satisfies ITag;
}

async function syncServerState() {
    const snapshot = await invoke<IMcpServerSnapshot>("mcp_get_server_state");

    if (typeof snapshot.port === "number" && snapshot.port > 0) {
        mcpPort.value = snapshot.port;
    }

    authToken.value = snapshot.authToken ?? "";
    serverStatus.value = snapshot.status;
}

async function getStoredServerEnabledState() {
    return Boolean(
        await PersistentStore.get<boolean>(MCP_SERVER_ENABLED_KEY, false),
    );
}

async function persistServerEnabledState(enabled: boolean) {
    try {
        await PersistentStore.set(MCP_SERVER_ENABLED_KEY, enabled);
    } catch (error: unknown) {
        console.error("写入 MCP 服务启用状态失败");
        console.error(error);
    }
}

function getStores() {
    if (!activePinia) {
        throw new Error("MCP 服务尚未初始化。");
    }

    return {
        manager: useManager(),
        settings: useSettings(),
    };
}

function getMcpFeatureFlags() {
    const { settings } = getStores();

    return {
        promptsEnabled: settings.mcpPromptsEnabled,
        promptItemEnabledMap: settings.mcpPromptItemEnabledMap,
        resourcesEnabled: settings.mcpResourcesEnabled,
        resourceItemEnabledMap: settings.mcpResourceItemEnabledMap,
        toolsEnabled: settings.mcpToolsEnabled,
        toolItemEnabledMap: settings.mcpToolItemEnabledMap,
    };
}

function isMcpItemEnabled(
    feature: "tool" | "resource" | "prompt",
    key: string,
) {
    const featureFlags = getMcpFeatureFlags();

    switch (feature) {
        case "tool":
            return featureFlags.toolItemEnabledMap[key] !== false;
        case "resource":
            return featureFlags.resourceItemEnabledMap[key] !== false;
        default:
            return featureFlags.promptItemEnabledMap[key] !== false;
    }
}

function getEnabledToolDefinitions() {
    return mcpToolDefinitions.filter((item) => {
        return isMcpItemEnabled("tool", item.name);
    });
}

function getEnabledResourceDefinitions() {
    return mcpResourceDefinitions.filter((item) => {
        return isMcpItemEnabled("resource", item.uri);
    });
}

function getEnabledPromptDefinitions() {
    return mcpPromptDefinitions.filter((item) => {
        return isMcpItemEnabled("prompt", item.name);
    });
}

function getInitializeCapabilities() {
    const { promptsEnabled, resourcesEnabled, toolsEnabled } =
        getMcpFeatureFlags();

    return {
        ...(promptsEnabled && getEnabledPromptDefinitions().length > 0
            ? {
                  prompts: {
                      listChanged: true,
                  },
              }
            : {}),
        ...(resourcesEnabled && getEnabledResourceDefinitions().length > 0
            ? {
                  resources: {
                      listChanged: true,
                  },
              }
            : {}),
        ...(toolsEnabled && getEnabledToolDefinitions().length > 0
            ? {
                  tools: {
                      listChanged: true,
                  },
              }
            : {}),
    };
}

function createFeatureDisabledError(featureName: string) {
    return `${featureName} 功能已关闭。请先在 MCP 页面中重新启用后再试。`;
}

function createFeatureItemDisabledError(featureName: string, itemName: string) {
    return `${featureName}「${itemName}」已关闭。请先在 MCP 页面中重新启用后再试。`;
}

async function ensureSupportedGamesLoaded() {
    const manager = useManager();

    if (manager.supportedGames.length > 0) {
        return;
    }

    for (let count = 0; count < 40; count += 1) {
        await sleep(100);

        if (manager.supportedGames.length > 0) {
            return;
        }
    }
}

async function ensureManagerRuntimeLoaded() {
    const { manager, settings } = getStores();

    await ensureSupportedGamesLoaded();
    await manager.refreshRuntimeData({
        storagePath: settings.storagePath,
        closeSoftLinks: settings.closeSoftLinks,
    });

    return { manager, settings };
}

function getTypeDefinition(mod: IModInfo) {
    const manager = useManager();

    return manager.managerGame?.modType.find((item) => {
        return String(item.id) === String(mod.modType ?? "");
    });
}

async function executeTypeInstall(
    type: IType,
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

function isOperationSuccessful(result: IState[] | boolean) {
    if (typeof result === "boolean") {
        return result;
    }

    return result.every((item) => item.state);
}

async function toggleModInstall(mod: IModInfo, install: boolean) {
    const manager = useManager();
    const type = getTypeDefinition(mod);

    if (!type) {
        throw new Error("当前 Mod 没有可用的类型定义，请先检查类型设置。");
    }

    const handler = install ? type.install : type.uninstall;
    const result =
        typeof handler === "function"
            ? await handler.call(type, mod)
            : await executeTypeInstall(type, handler, mod, install);

    if (!isOperationSuccessful(result)) {
        throw new Error(
            install
                ? `安装 ${mod.modName} 失败，请检查游戏路径和文件权限。`
                : `卸载 ${mod.modName} 失败，请检查目标文件是否被占用。`,
        );
    }

    mod.isInstalled = install;
    mod.isUpdate = false;
    await manager.saveManagerData();
}

async function handleToolCall(
    name: string,
    args: Record<string, unknown>,
): Promise<IMcpToolCallResult> {
    try {
        switch (name) {
            case "get-supported-games-list": {
                const { manager } = getStores();
                await ensureSupportedGamesLoaded();
                const games = toSerializable(manager.supportedGames);
                return createToolResult({
                    games,
                    count: games.length,
                });
            }
            case "get-manager-games-list": {
                const { manager } = getStores();
                const games = toSerializable(manager.managerGameList);
                return createToolResult({
                    games,
                    count: games.length,
                });
            }
            case "get-current-managed-game": {
                const { manager } = await ensureManagerRuntimeLoaded();
                return createToolResult({
                    game: toSerializable(manager.managerGame),
                });
            }
            case "translate-game-name": {
                const gameName = toRequiredString(args.gameName, "gameName");
                const translatedName = String(i18n.global.t(gameName));
                return createToolResult({ translatedName });
            }
            case "fetch-steam-installed-games": {
                const { manager } = getStores();
                await ensureSupportedGamesLoaded();
                const resolvedGames = await Promise.all(
                    manager.supportedGames.map(async (game) => {
                        const gamePath = await ScanGame.getSteamGamePath(
                            game.steamAppID,
                            game.installdir,
                        );

                        if (!gamePath) {
                            return null;
                        }

                        return {
                            GlossGameId: game.GlossGameId,
                            steamAppID: game.steamAppID,
                            gameName: game.gameName,
                            path: gamePath,
                        };
                    }),
                );
                const games = resolvedGames.filter(Boolean);
                return createToolResult({
                    games,
                    count: games.length,
                });
            }
            case "add-game-to-manager": {
                const GlossGameId = toRequiredNumber(
                    args.GlossGameId,
                    "GlossGameId",
                );
                const gamePath = toRequiredString(args.gamePath, "gamePath");
                const { manager, settings } = getStores();

                await ensureSupportedGamesLoaded();
                const targetGame = manager.supportedGames.find((item) => {
                    return item.GlossGameId === GlossGameId;
                });

                if (!targetGame) {
                    throw new Error(`未找到 ID 为 ${GlossGameId} 的游戏。`);
                }

                const nextGame = {
                    ...targetGame,
                    gamePath,
                } satisfies ISupportedGames;
                const existingIndex = manager.managerGameList.findIndex(
                    (game) => {
                        return game.GlossGameId === GlossGameId;
                    },
                );

                manager.managerGame = nextGame;
                if (existingIndex >= 0) {
                    manager.managerGameList = manager.managerGameList.map(
                        (game) => {
                            return game.GlossGameId === GlossGameId
                                ? nextGame
                                : game;
                        },
                    );
                } else {
                    manager.managerGameList = [
                        ...manager.managerGameList,
                        nextGame,
                    ];
                }

                await manager.refreshRuntimeData({
                    storagePath: settings.storagePath,
                    closeSoftLinks: settings.closeSoftLinks,
                });
                await router.push("/manager");

                return createToolResult({
                    state: true,
                    message: `已将 ${targetGame.gameName} 添加到管理器并切换为当前游戏。`,
                });
            }
            case "switch-managed-game": {
                const GlossGameId = toRequiredNumber(
                    args.GlossGameId,
                    "GlossGameId",
                );
                const { manager, settings } = getStores();

                await ensureSupportedGamesLoaded();
                const supportedGame = manager.supportedGames.find((item) => {
                    return item.GlossGameId === GlossGameId;
                });
                const managedGame = manager.managerGameList.find((item) => {
                    return item.GlossGameId === GlossGameId;
                });

                if (!supportedGame || !managedGame) {
                    throw new Error(
                        `未找到 ID 为 ${GlossGameId} 的已管理游戏，请先添加到管理器。`,
                    );
                }

                manager.managerGame = {
                    ...supportedGame,
                    ...managedGame,
                };
                await manager.refreshRuntimeData({
                    storagePath: settings.storagePath,
                    closeSoftLinks: settings.closeSoftLinks,
                });
                await router.push("/manager");

                return createToolResult({
                    state: true,
                    message: `已切换到 ${managedGame.gameName}。`,
                });
            }
            case "remove-game-from-manager": {
                const GlossGameId = toRequiredNumber(
                    args.GlossGameId,
                    "GlossGameId",
                );
                const { manager, settings } = getStores();
                const nextGameList = manager.managerGameList.filter((game) => {
                    return game.GlossGameId !== GlossGameId;
                });

                if (nextGameList.length === manager.managerGameList.length) {
                    throw new Error(`未找到 ID 为 ${GlossGameId} 的管理游戏。`);
                }

                manager.managerGameList = nextGameList;
                if (manager.managerGame?.GlossGameId === GlossGameId) {
                    manager.managerGame = null;
                }

                await manager.refreshRuntimeData({
                    storagePath: settings.storagePath,
                    closeSoftLinks: settings.closeSoftLinks,
                });

                return createToolResult({
                    state: true,
                    message: `已从管理器移除游戏 ${GlossGameId}。`,
                });
            }
            case "get-current-mod-list": {
                const { manager } = await ensureManagerRuntimeLoaded();
                const mods = toSerializable(manager.managerModList);
                return createToolResult({
                    mods,
                    count: mods.length,
                });
            }
            case "install-mod-by-id": {
                const modId = toRequiredNumber(args.modId, "modId");
                const isInstall =
                    typeof args.isInstall === "boolean"
                        ? args.isInstall
                        : (() => {
                              throw new Error("isInstall 必须是布尔值。");
                          })();
                const { manager } = await ensureManagerRuntimeLoaded();
                const targetMod = manager.managerModList.find((item) => {
                    return item.id === modId;
                });

                if (!targetMod) {
                    throw new Error(`未找到 ID 为 ${modId} 的 Mod。`);
                }

                await toggleModInstall(targetMod, isInstall);
                await router.push("/manager");

                return createToolResult({
                    state: true,
                    message: `${isInstall ? "已安装" : "已卸载"} ${targetMod.modName}。`,
                });
            }
            case "remove-mod-by-id": {
                const modId = toRequiredNumber(args.modId, "modId");
                const { manager } = await ensureManagerRuntimeLoaded();
                const targetMod = await manager.removeModRecord(modId);

                return createToolResult({
                    state: true,
                    message: `已移除 ${targetMod.modName}。`,
                });
            }
            case "get-mod-dependencies": {
                const { manager } = await ensureManagerRuntimeLoaded();
                const requestedGlossGameId =
                    args.GlossGameId === undefined
                        ? manager.managerGame?.GlossGameId
                        : toRequiredNumber(args.GlossGameId, "GlossGameId");

                if (!requestedGlossGameId) {
                    throw new Error("当前没有管理中的游戏，无法查询前置依赖。");
                }

                const dependencies = (await fetchGlossGamePlugins()).filter(
                    (item) => {
                        return item.game_id.includes(requestedGlossGameId);
                    },
                );
                return createToolResult({
                    dependencies: toSerializable(dependencies),
                    count: dependencies.length,
                });
            }
            case "queue-gloss-mod-download": {
                const modId = toRequiredNumber(args.modId, "modId");
                const resourceId =
                    args.resourceId === undefined || args.resourceId === null
                        ? undefined
                        : typeof args.resourceId === "string"
                          ? toRequiredString(args.resourceId, "resourceId")
                          : toRequiredNumber(args.resourceId, "resourceId");
                const replaceLocalModId =
                    args.replaceLocalModId === undefined ||
                    args.replaceLocalModId === null
                        ? undefined
                        : toRequiredNumber(
                              args.replaceLocalModId,
                              "replaceLocalModId",
                          );
                const { manager } = getStores();
                await ensureSupportedGamesLoaded();

                const result = await queueGlossModDownload({
                    modId,
                    resourceId,
                    replaceLocalModId,
                    managerModList: manager.managerModList,
                });

                if (
                    result.status === "created" ||
                    result.status === "resumed" ||
                    result.status === "retried" ||
                    result.status === "exists"
                ) {
                    await router.push("/download");
                }

                return createToolResult({
                    state: true,
                    status: result.status,
                    gid: result.gid,
                    message: result.message,
                    mod: toSerializable(result.mod),
                    resource: toSerializable(result.resource),
                });
            }
            case "add-tag-to-mod": {
                const modId = toRequiredNumber(args.modId, "modId");

                if (!isPlainObject(args.tag)) {
                    throw new Error("tag 必须是对象。");
                }

                const { manager } = await ensureManagerRuntimeLoaded();
                const targetMod = manager.managerModList.find((item) => {
                    return item.id === modId;
                });

                if (!targetMod) {
                    throw new Error(`未找到 ID 为 ${modId} 的 Mod。`);
                }

                const tag = normalizeTag(args.tag);

                await manager.upsertTag({
                    name: tag.name,
                    color: tag.color,
                    previousName: tag.name,
                });

                if (
                    !(targetMod.tags ?? []).some(
                        (item) => item.name === tag.name,
                    )
                ) {
                    await manager.toggleTagOnMod(modId, tag.name);
                }

                return createToolResult({
                    state: true,
                    message: `已为 ${targetMod.modName} 添加标签 ${tag.name}。`,
                });
            }
            case "remove-tag-from-mod": {
                const modId = toRequiredNumber(args.modId, "modId");
                const tagName = toRequiredString(args.tagName, "tagName");
                const { manager } = await ensureManagerRuntimeLoaded();
                const targetMod = manager.managerModList.find((item) => {
                    return item.id === modId;
                });

                if (!targetMod) {
                    throw new Error(`未找到 ID 为 ${modId} 的 Mod。`);
                }

                if (
                    (targetMod.tags ?? []).some((tag) => tag.name === tagName)
                ) {
                    await manager.toggleTagOnMod(modId, tagName);
                }

                return createToolResult({
                    state: true,
                    message: `已从 ${targetMod.modName} 移除标签 ${tagName}。`,
                });
            }
            case "rename-mod": {
                const modId = toRequiredNumber(args.modId, "modId");
                const modName = toRequiredString(args.modName, "modName");
                const { manager } = await ensureManagerRuntimeLoaded();
                const targetMod = manager.managerModList.find((item) => {
                    return item.id === modId;
                });

                if (!targetMod) {
                    throw new Error(`未找到 ID 为 ${modId} 的 Mod。`);
                }

                targetMod.modName = modName;
                await manager.saveManagerData();

                return createToolResult({
                    state: true,
                    message: `已将 Mod 重命名为 ${modName}。`,
                });
            }
            case "sort-mods": {
                const modIds = [
                    ...new Set(toNumberArray(args.modIds, "modIds")),
                ];
                const { manager } = await ensureManagerRuntimeLoaded();
                const currentMods = [...manager.managerModList].sort(
                    (left, right) => {
                        return (left.weight ?? 0) - (right.weight ?? 0);
                    },
                );
                const modMap = new Map(
                    currentMods.map((item) => {
                        return [item.id, item] as const;
                    }),
                );
                const orderedMods = modIds
                    .map((modId) => modMap.get(modId))
                    .filter((item): item is IModInfo => Boolean(item));
                const orderedIds = new Set(orderedMods.map((item) => item.id));
                const remainingMods = currentMods.filter((item) => {
                    return !orderedIds.has(item.id);
                });

                manager.managerModList = [...orderedMods, ...remainingMods].map(
                    (item, index) => {
                        return {
                            ...item,
                            weight: index + 1,
                        };
                    },
                );
                await manager.saveManagerData();

                return createToolResult({
                    state: true,
                    order: manager.managerModList.map((item) => item.id),
                    count: manager.managerModList.length,
                });
            }
            case "get-mod-storage-path": {
                const { manager } = await ensureManagerRuntimeLoaded();
                const modId =
                    args.modId === undefined
                        ? undefined
                        : toRequiredNumber(args.modId, "modId");
                const modStoragePath =
                    modId === undefined
                        ? manager.managerRoot
                        : await Manager.getModStoragePath(modId);

                return createToolResult({
                    rootPath: manager.managerRoot,
                    modStoragePath,
                });
            }
            case "get-directory-contents": {
                const path = toRequiredString(args.path, "path");
                const recursive = toOptionalBoolean(args.recursive, false);

                await assertPathWithinAllowedRoots(path, "path");

                if (!(await FileHandler.isDir(path))) {
                    throw new Error("path 不是有效目录。");
                }

                const directories = await FileHandler.getAllFolderInFolder(
                    path,
                    recursive,
                );
                return createToolResult({
                    directories,
                    count: directories.length,
                });
            }
            case "get-files-in-directory": {
                const path = toRequiredString(args.path, "path");
                const recursive = toOptionalBoolean(args.recursive, false);

                await assertPathWithinAllowedRoots(path, "path");

                if (!(await FileHandler.isDir(path))) {
                    throw new Error("path 不是有效目录。");
                }

                const files = await FileHandler.getAllFilesInFolder(
                    path,
                    true,
                    recursive,
                );
                return createToolResult({
                    files,
                    count: files.length,
                });
            }
            case "copy-file-to-location": {
                const sourcePath = toRequiredString(
                    args.sourcePath,
                    "sourcePath",
                );
                const targetPath = toRequiredString(
                    args.targetPath,
                    "targetPath",
                );

                await assertPathWithinAllowedRoots(sourcePath, "sourcePath");
                await assertPathWithinAllowedRoots(targetPath, "targetPath");

                if (!(await FileHandler.fileExists(sourcePath))) {
                    throw new Error("sourcePath 不存在。");
                }

                if (!(await FileHandler.copyFile(sourcePath, targetPath))) {
                    throw new Error("复制文件失败。");
                }

                return createToolResult({
                    state: true,
                    message: "文件复制成功。",
                    sourcePath,
                    targetPath,
                });
            }
            case "copy-folder-to-location": {
                const sourcePath = toRequiredString(
                    args.sourcePath,
                    "sourcePath",
                );
                const targetPath = toRequiredString(
                    args.targetPath,
                    "targetPath",
                );

                await assertPathWithinAllowedRoots(sourcePath, "sourcePath");
                await assertPathWithinAllowedRoots(targetPath, "targetPath");

                if (!(await FileHandler.isDir(sourcePath))) {
                    throw new Error("sourcePath 不是有效目录。");
                }

                if (!(await FileHandler.copyFolder(sourcePath, targetPath))) {
                    throw new Error("复制文件夹失败。");
                }

                return createToolResult({
                    state: true,
                    message: "文件夹复制成功。",
                    sourcePath,
                    targetPath,
                });
            }
            case "read-file-contents": {
                const path = toRequiredString(args.path, "path");
                const maxLength = Math.max(
                    1,
                    Math.floor(toOptionalNumber(args.maxLength, 20000)),
                );

                await assertPathWithinAllowedRoots(path, "path");

                if (!(await FileHandler.fileExists(path))) {
                    throw new Error("目标文件不存在。");
                }

                const fileContent = await FileHandler.readFile(path);
                const truncated = fileContent.length > maxLength;
                const contents = truncated
                    ? fileContent.slice(0, maxLength)
                    : fileContent;

                return createToolResult({
                    path,
                    contents,
                    truncated,
                    totalLength: fileContent.length,
                });
            }
            case "inspect-game-directory": {
                const gamePath = toRequiredString(args.gamePath, "gamePath");
                const inspection = await inspectGameDirectory(gamePath);

                if (!inspection.exists) {
                    throw new Error(
                        `目录不存在：${gamePath}。请确认用户提供的是游戏安装根目录。`,
                    );
                }

                return createToolResult(inspection);
            }
            case "search-gloss-game": {
                const keyword = toRequiredString(args.keyword, "keyword");
                const limit = Math.max(
                    1,
                    Math.floor(toOptionalNumber(args.limit, 10)),
                );
                const normalizedKeyword = keyword.toLowerCase();
                const allGames = await fetchAllGlossGames();
                const matched = allGames
                    .filter((item) => {
                        return (item.game_name ?? "")
                            .toLowerCase()
                            .includes(normalizedKeyword);
                    })
                    .slice(0, limit)
                    .map((item) => {
                        return {
                            GlossGameId: item.id,
                            gameName: item.game_name ?? "",
                            modTypes: (item.game_mod_types ?? []).map((type) => {
                                return {
                                    id: type.id,
                                    name: type.mods_type_name,
                                };
                            }),
                        };
                    });

                return createToolResult({
                    keyword,
                    games: matched,
                    count: matched.length,
                });
            }
            case "list-custom-games": {
                const entries = await listLegacyCustomGameDefinitions();

                return createToolResult({
                    games: entries.map((item) => {
                        return {
                            gameName: item.gameName,
                            filePath: item.filePath,
                            GlossGameId: item.definition.GlossGameId,
                            steamAppID: item.definition.steamAppID,
                            modType: item.definition.modType,
                        };
                    }),
                    count: entries.length,
                });
            }
            case "read-custom-game": {
                const gameName = toRequiredString(args.gameName, "gameName");
                const entry = await findLegacyCustomGameDefinition(gameName);

                if (!entry) {
                    throw new Error(`未找到名为 ${gameName} 的自定义游戏配置。`);
                }

                return createToolResult({
                    gameName: entry.gameName,
                    filePath: entry.filePath,
                    definition: entry.definition,
                });
            }
            case "validate-custom-game": {
                if (!isPlainObject(args.definition)) {
                    throw new Error("definition 必须是配置对象。");
                }

                return createToolResult(
                    validateCustomGameDefinition(args.definition),
                );
            }
            case "save-custom-game": {
                if (!isPlainObject(args.definition)) {
                    throw new Error("definition 必须是配置对象。");
                }

                const definition = args.definition;
                const validation = validateCustomGameDefinition(definition);

                if (!validation.valid) {
                    throw new Error(
                        `配置校验未通过：${validation.errors.join(" ")}`,
                    );
                }

                const gameName = toRequiredString(
                    definition.gameName,
                    "definition.gameName",
                );
                const overwrite = toOptionalBoolean(args.overwrite, false);
                const existing =
                    await findLegacyCustomGameDefinition(gameName);

                // 覆盖是不可逆的，必须由调用方显式确认，避免误删用户已经调好的配置。
                if (existing && !overwrite) {
                    throw new Error(
                        `已存在名为 ${gameName} 的自定义游戏配置（${existing.filePath}）。如需覆盖请传 overwrite 为 true。`,
                    );
                }

                const { manager } = getStores();

                await saveLegacyCustomGameDefinition(
                    definition as unknown as IExpandsSupportedGames,
                );
                await manager.reloadSupportedGames();

                return createToolResult({
                    state: true,
                    gameName,
                    overwritten: Boolean(existing),
                    warnings: validation.warnings,
                    message: `已${existing ? "更新" : "创建"}自定义游戏配置 ${gameName}，支持游戏列表已刷新。`,
                });
            }
            case "delete-custom-game": {
                const gameName = toRequiredString(args.gameName, "gameName");
                const { manager } = getStores();
                const removed =
                    await deleteLegacyCustomGameDefinition(gameName);

                if (!removed) {
                    throw new Error(`未找到名为 ${gameName} 的自定义游戏配置。`);
                }

                await manager.reloadSupportedGames();

                return createToolResult({
                    state: true,
                    gameName,
                    message: `已删除自定义游戏配置 ${gameName}，支持游戏列表已刷新。`,
                });
            }
            default:
                return createToolErrorResult(`未找到工具：${name}`);
        }
    } catch (error: unknown) {
        return createToolErrorResult(getErrorMessage(error));
    }
}

async function handleResourceRead(uri: string) {
    if (uri === "logs://latest-log") {
        return await Log.readLatestLog();
    }

    const { manager } = await ensureManagerRuntimeLoaded();

    switch (uri) {
        case "games://supported-games-list":
            await ensureSupportedGamesLoaded();
            return {
                games: toSerializable(manager.supportedGames),
                count: manager.supportedGames.length,
            };
        case "mods://mod-list":
            return {
                mods: toSerializable(manager.managerModList),
                count: manager.managerModList.length,
            };
        case "mods://mod-dependencies": {
            const currentGlossGameId = manager.managerGame?.GlossGameId;

            if (!currentGlossGameId) {
                throw new Error("当前没有管理中的游戏，无法读取前置依赖。");
            }

            const dependencies = (await fetchGlossGamePlugins()).filter(
                (item) => {
                    return item.game_id.includes(currentGlossGameId);
                },
            );

            return {
                dependencies: toSerializable(dependencies),
                count: dependencies.length,
            };
        }
        case "paths://mod-storage-path":
            return {
                path: manager.managerRoot,
            };
        case "paths://game-storage-path":
            return {
                path: manager.managerGame?.gamePath ?? "",
            };
        default:
            throw new Error(`未找到资源：${uri}`);
    }
}

async function handlePromptGet(
    name: string,
    args: Record<string, unknown>,
): Promise<IMcpPromptMessage[]> {
    switch (name) {
        case "get-all-games-list":
            return [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "请先调用 get-supported-games-list 获取完整游戏列表，再根据游戏名或 GlossGameId 继续后续操作。",
                    },
                },
            ];
        case "organize-mods": {
            const goal =
                typeof args.goal === "string" && args.goal.trim()
                    ? `\n整理目标：${args.goal.trim()}`
                    : "";
            return [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: `请先调用 get-current-managed-game 和 get-current-mod-list 了解当前游戏与 Mod 状态，再给出整理建议或排序方案。${goal}`,
                    },
                },
            ];
        }
        case "prepare-manager-switch":
            return [
                {
                    role: "user",
                    content: {
                        type: "text",
                        text: "请先调用 get-manager-games-list 查看已管理游戏，再决定是否需要调用 switch-managed-game。",
                    },
                },
            ];
        default:
            throw new Error(`未找到提示：${name}`);
    }
}

async function dispatchRequest(
    request: unknown,
): Promise<IMcpJsonRpcResponse | null> {
    if (!isPlainObject(request) || typeof request.method !== "string") {
        return createJsonRpcError(
            null,
            INVALID_REQUEST,
            "无效的 JSON-RPC 请求。",
        );
    }

    const normalizedRequest = request as unknown as IMcpJsonRpcRequest;
    const requestId = normalizedRequest.id ?? null;
    const params = isPlainObject(normalizedRequest.params)
        ? normalizedRequest.params
        : {};

    switch (normalizedRequest.method) {
        case "initialize":
            return createJsonRpcResult(requestId, {
                protocolVersion: resolveProtocolVersion(params.protocolVersion),
                capabilities: getInitializeCapabilities(),
                serverInfo: {
                    name: "gloss-mod-manager",
                    version: APP_VERSION,
                },
                instructions:
                    "请优先先读取当前游戏、Mod 列表等只读信息，再执行会修改本地文件或管理状态的工具。",
            });
        case "notifications/initialized":
        case "notifications/cancelled":
            return null;
        case "ping":
            return normalizedRequest.id === undefined
                ? null
                : createJsonRpcResult(requestId, {});
        case "tools/list":
            if (!getMcpFeatureFlags().toolsEnabled) {
                return normalizedRequest.id === undefined
                    ? null
                    : createJsonRpcResult(requestId, {
                          tools: [],
                      });
            }

            return normalizedRequest.id === undefined
                ? null
                : createJsonRpcResult(requestId, {
                      tools: getEnabledToolDefinitions(),
                  });
        case "tools/call": {
            if (normalizedRequest.id === undefined) {
                return null;
            }

            if (!getMcpFeatureFlags().toolsEnabled) {
                return createJsonRpcError(
                    requestId,
                    METHOD_NOT_FOUND,
                    createFeatureDisabledError("MCP Tools"),
                );
            }

            const toolName = params.name;
            if (typeof toolName !== "string" || !toolName) {
                return createJsonRpcError(
                    requestId,
                    INVALID_PARAMS,
                    "tools/call 缺少有效的工具名称。",
                );
            }

            const toolDefinition = mcpToolDefinitions.find((item) => {
                return item.name === toolName;
            });
            if (
                toolDefinition &&
                !isMcpItemEnabled("tool", toolDefinition.name)
            ) {
                return createJsonRpcError(
                    requestId,
                    METHOD_NOT_FOUND,
                    createFeatureItemDisabledError("MCP Tool", toolName),
                );
            }

            const argumentsValue = isPlainObject(params.arguments)
                ? params.arguments
                : {};
            return createJsonRpcResult(
                requestId,
                await handleToolCall(toolName, argumentsValue),
            );
        }
        case "resources/list":
            if (!getMcpFeatureFlags().resourcesEnabled) {
                return normalizedRequest.id === undefined
                    ? null
                    : createJsonRpcResult(requestId, {
                          resources: [],
                      });
            }

            return normalizedRequest.id === undefined
                ? null
                : createJsonRpcResult(requestId, {
                      resources: getEnabledResourceDefinitions(),
                  });
        case "resources/read": {
            if (normalizedRequest.id === undefined) {
                return null;
            }

            if (!getMcpFeatureFlags().resourcesEnabled) {
                return createJsonRpcError(
                    requestId,
                    METHOD_NOT_FOUND,
                    createFeatureDisabledError("MCP Resources"),
                );
            }

            const uri = params.uri;
            if (typeof uri !== "string" || !uri) {
                return createJsonRpcError(
                    requestId,
                    INVALID_PARAMS,
                    "resources/read 缺少有效的 uri。",
                );
            }

            const resourceDefinition = mcpResourceDefinitions.find((item) => {
                return item.uri === uri;
            });
            if (
                resourceDefinition &&
                !isMcpItemEnabled("resource", resourceDefinition.uri)
            ) {
                return createJsonRpcError(
                    requestId,
                    METHOD_NOT_FOUND,
                    createFeatureItemDisabledError("MCP Resource", uri),
                );
            }

            try {
                const data = await handleResourceRead(uri);
                const mimeType =
                    resourceDefinition?.mimeType ?? "application/json";
                return createJsonRpcResult(requestId, {
                    contents: [
                        {
                            uri,
                            mimeType,
                            text:
                                mimeType === "application/json"
                                    ? JSON.stringify(data, null, 2)
                                    : formatStructuredText(data),
                        },
                    ],
                });
            } catch (error: unknown) {
                return createJsonRpcError(
                    requestId,
                    INTERNAL_ERROR,
                    getErrorMessage(error),
                );
            }
        }
        case "prompts/list":
            if (!getMcpFeatureFlags().promptsEnabled) {
                return normalizedRequest.id === undefined
                    ? null
                    : createJsonRpcResult(requestId, {
                          prompts: [],
                      });
            }

            return normalizedRequest.id === undefined
                ? null
                : createJsonRpcResult(requestId, {
                      prompts: getEnabledPromptDefinitions(),
                  });
        case "prompts/get": {
            if (normalizedRequest.id === undefined) {
                return null;
            }

            if (!getMcpFeatureFlags().promptsEnabled) {
                return createJsonRpcError(
                    requestId,
                    METHOD_NOT_FOUND,
                    createFeatureDisabledError("MCP Prompts"),
                );
            }

            const promptName = params.name;
            if (typeof promptName !== "string" || !promptName) {
                return createJsonRpcError(
                    requestId,
                    INVALID_PARAMS,
                    "prompts/get 缺少有效的提示名称。",
                );
            }

            const promptDefinition = mcpPromptDefinitions.find((item) => {
                return item.name === promptName;
            });
            if (
                promptDefinition &&
                !isMcpItemEnabled("prompt", promptDefinition.name)
            ) {
                return createJsonRpcError(
                    requestId,
                    METHOD_NOT_FOUND,
                    createFeatureItemDisabledError("MCP Prompt", promptName),
                );
            }

            const promptArgs = isPlainObject(params.arguments)
                ? params.arguments
                : {};

            try {
                const messages = await handlePromptGet(promptName, promptArgs);
                return createJsonRpcResult(requestId, {
                    messages,
                });
            } catch (error: unknown) {
                return createJsonRpcError(
                    requestId,
                    INTERNAL_ERROR,
                    getErrorMessage(error),
                );
            }
        }
        default:
            return normalizedRequest.id === undefined
                ? null
                : createJsonRpcError(
                      requestId,
                      METHOD_NOT_FOUND,
                      `不支持的方法：${normalizedRequest.method}`,
                  );
    }
}

async function dispatchPayload(
    payload: unknown,
): Promise<IMcpJsonRpcResponse | IMcpJsonRpcResponse[] | null> {
    if (Array.isArray(payload)) {
        if (payload.length === 0) {
            return createJsonRpcError(
                null,
                INVALID_REQUEST,
                "JSON-RPC 批量请求不能为空。",
            );
        }

        const responses = (
            await Promise.all(
                payload.map(async (item) => {
                    return dispatchRequest(item);
                }),
            )
        ).filter((item): item is IMcpJsonRpcResponse => item !== null);

        return responses.length > 0 ? responses : null;
    }

    return dispatchRequest(payload);
}

async function replyTransportRequest(
    payload: IMcpTransportEventPayload,
    statusCode: number,
    body?: string,
) {
    await invoke("mcp_complete_request", {
        requestId: payload.requestId,
        statusCode,
        body: body ?? null,
    });
}

async function handleTransportRequest(payload: IMcpTransportEventPayload) {
    try {
        const parsedPayload = JSON.parse(payload.body) as unknown;
        const response = await dispatchPayload(parsedPayload);

        if (response === null) {
            await replyTransportRequest(payload, 204);
            return;
        }

        await replyTransportRequest(payload, 200, JSON.stringify(response));
    } catch (error: unknown) {
        const response = createJsonRpcError(
            null,
            PARSE_ERROR,
            getErrorMessage(error),
        );
        try {
            await replyTransportRequest(payload, 200, JSON.stringify(response));
        } catch (invokeError: unknown) {
            console.error("写回 MCP 解析错误失败");
            console.error(invokeError);
        }
    }
}

async function initialize(pinia?: Pinia) {
    if (pinia) {
        activePinia = pinia;
    }

    if (isInitialized.value) {
        await syncServerState();
        return;
    }

    if (initPromise) {
        await initPromise;
        return;
    }

    initPromise = (async () => {
        await syncServerState();
        await listen<IMcpTransportEventPayload>(
            MCP_TRANSPORT_EVENT,
            (event) => {
                void handleTransportRequest(event.payload);
            },
        );
        await listen<IMcpServerSnapshot>(MCP_STATUS_EVENT, (event) => {
            if (
                typeof event.payload.port === "number" &&
                event.payload.port > 0
            ) {
                mcpPort.value = event.payload.port;
            }

            authToken.value = event.payload.authToken ?? "";
            serverStatus.value = event.payload.status;
        });
        isInitialized.value = true;
    })().finally(() => {
        initPromise = null;
    });

    await initPromise;
}

async function autoStartFromSettings() {
    await initialize();

    if (autoStartPromise) {
        await autoStartPromise;
        return;
    }

    autoStartPromise = (async () => {
        if (isBusy.value || serverStatus.value !== "stopped") {
            return;
        }

        // 单独持久化服务启停意图，应用重启后按上次状态恢复。
        if (!(await getStoredServerEnabledState())) {
            return;
        }

        try {
            await start(mcpPort.value);
        } catch (error: unknown) {
            console.error("自动启动 MCP 服务失败");
            console.error(error);
        }
    })().finally(() => {
        autoStartPromise = null;
    });

    await autoStartPromise;
}

async function start(portValue: number = mcpPort.value) {
    await initialize();

    if (serverStatus.value === "running") {
        await persistServerEnabledState(true);
        return;
    }

    if (isBusy.value) {
        throw new Error("MCP 服务正在切换状态，请稍后再试。");
    }

    const normalizedPort = Math.floor(toRequiredNumber(portValue, "port"));
    if (normalizedPort <= 0 || normalizedPort > 65535) {
        throw new Error("端口号必须在 1 到 65535 之间。");
    }

    serverStatus.value = "starting";
    mcpPort.value = normalizedPort;

    try {
        const snapshot = await invoke<IMcpServerSnapshot>("mcp_start_server", {
            port: normalizedPort,
        });
        serverStatus.value = snapshot.status;
        if (typeof snapshot.port === "number" && snapshot.port > 0) {
            mcpPort.value = snapshot.port;
        }
        authToken.value = snapshot.authToken ?? "";
        await persistServerEnabledState(true);
    } catch (error: unknown) {
        serverStatus.value = "stopped";
        authToken.value = "";
        throw new Error(getErrorMessage(error));
    }
}

async function stop() {
    await initialize();

    if (isBusy.value) {
        throw new Error("MCP 服务正在切换状态，请稍后再试。");
    }

    if (serverStatus.value === "stopped") {
        await persistServerEnabledState(false);
        return;
    }

    serverStatus.value = "stopping";

    try {
        const snapshot = await invoke<IMcpServerSnapshot>("mcp_stop_server");
        serverStatus.value = snapshot.status;
        authToken.value = snapshot.authToken ?? "";
        await persistServerEnabledState(false);
    } catch (error: unknown) {
        serverStatus.value = "running";
        throw new Error(getErrorMessage(error));
    }
}

function setPort(value: number) {
    const normalizedPort = Math.floor(value);

    if (!Number.isFinite(normalizedPort) || normalizedPort <= 0) {
        throw new Error("端口号必须是大于 0 的整数。");
    }

    mcpPort.value = normalizedPort;
}

export const McpService = {
    authToken,
    autoStartFromSettings,
    endpoint,
    initialize,
    isBusy,
    isRunning,
    port: mcpPort,
    serverStatus,
    setPort,
    start,
    stop,
};
