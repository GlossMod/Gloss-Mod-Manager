import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
    isStepCount,
    pruneMessages,
    tool,
    ToolLoopAgent,
    type ToolSet,
} from "ai";
import { z } from "zod";
import packageInfo from "../../package.json";
import { buildBundledAiChatSkillsPrompt } from "@/lib/ai-chat-skills";
import {
    buildMcpToolDriftWarnings,
    checkMcpToolDrift,
} from "@/lib/mcp-tool-drift";
import { McpService } from "@/lib/mcp-service";
import { SecretStore } from "@/lib/secret-store";
import { useManager } from "@/stores/manager";

interface IOpenAICompatibleModelItem {
    id?: string;
    created?: number;
    owned_by?: string;
    [key: string]: unknown;
}

interface IOpenAICompatibleModelListResponse {
    data?: IOpenAICompatibleModelItem[];
    message?: string;
    error?: {
        message?: string;
    };
}

export interface IAiChatModel {
    id: string;
    name: string;
    created?: number;
    ownedBy?: string;
    raw: IOpenAICompatibleModelItem;
}

export const DEFAULT_AI_CHAT_SYSTEM_PROMPT = `你是 Gloss Mod Manager 内置的 AI 助手。

工作要求：
1. 优先使用中文回答；如果用户明确使用其他语言，跟随用户语言。
2. 当问题涉及当前应用状态、当前管理游戏、已管理游戏、MCP 数据或可执行操作时，优先调用工具，不要猜测。
3. 回答保持清晰、直接、可执行；如果工具调用失败，明确说明失败原因和下一步建议。
4. 如果需要 MCP 资源或 Prompt，先列出可用项，再读取目标项。`;

export type AiChatMcpServerId = "gloss-mod-manager" | "gloss-mod";

export type AiChatMcpServerStatus = "disabled" | "ready" | "error";

export interface IAiChatMcpToolInfo {
    name: string;
    title?: string;
    description?: string;
}

export interface IAiChatMcpResourceInfo {
    uri: string;
    name: string;
    title?: string;
    description?: string;
    mimeType?: string;
}

export interface IAiChatMcpPromptInfo {
    name: string;
    title?: string;
    description?: string;
    arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
    }>;
}

export interface IAiChatMcpServerSnapshot {
    id: AiChatMcpServerId;
    label: string;
    description: string;
    endpoint: string;
    enabled: boolean;
    status: AiChatMcpServerStatus;
    error?: string;
    warnings: string[];
    tools: IAiChatMcpToolInfo[];
    resources: IAiChatMcpResourceInfo[];
    prompts: IAiChatMcpPromptInfo[];
}

export interface IAiChatSession {
    agent: ToolLoopAgent;
    servers: IAiChatMcpServerSnapshot[];
    dispose: () => Promise<void>;
}

interface IAiChatServerConfig {
    id: AiChatMcpServerId;
    label: string;
    description: string;
    endpoint: string;
    enabled: boolean;
    warnings: string[];
    transport: {
        type: "http";
        url: string;
        headers?: Record<string, string>;
    };
}

interface IAiChatMcpConnection {
    client: MCPClient;
    snapshot: IAiChatMcpServerSnapshot;
    toolDefinitions: Awaited<ReturnType<MCPClient["listTools"]>>;
}

interface IAiChatCreateSessionOptions {
    modelId: string;
    systemPrompt?: string;
    enabledServers?: Partial<Record<AiChatMcpServerId, boolean>>;
}

// WebKit（macOS/iOS 的 WKWebView）不把 user-agent 当作禁止修改的请求头，
// 而是当成普通自定义头参与 CORS 预检，导致 MCP 请求被
// "Request header field User-Agent is not allowed by Access-Control-Allow-Headers" 拦下。
// @ai-sdk/mcp 的 HTTP transport 每次都会写入该头，这里在出栈前统一剔除。
function stripForbiddenHeaders(init?: RequestInit): RequestInit | undefined {
    if (!init?.headers) {
        return init;
    }

    const headers = new Headers(init.headers);

    if (!headers.has("user-agent")) {
        return init;
    }

    headers.delete("user-agent");

    return { ...init, headers };
}

function runtimeFetch(
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
) {
    return globalThis.fetch(input, stripForbiddenHeaders(init));
}

export class AiChat {
    private baseURL: string;
    private apiKey: string;
    private providerBaseURL: string;
    private provider?: ReturnType<typeof createOpenAICompatible>;
    // 用户填的地址可能省略 /v1，真实可用的 base 需要探测 /models 才能确定。
    // 只有候选地址唯一时才能直接认定已解析。
    private providerBaseUrlResolved: boolean;

    constructor(baseURL: string, apiKey: string) {
        this.baseURL = baseURL;
        this.apiKey = apiKey.trim();
        this.providerBaseURL = this.normalizeProviderBaseUrl(baseURL);
        this.providerBaseUrlResolved =
            this.buildModelRequestUrls().length <= 1;
    }

    public get Agent() {
        return this.getProvider();
    }

    /**
     * 确保 provider 的 base URL 指向真实可用的端点。
     * 直接拿 Agent 发对话请求前必须先 await 一次，否则用户填根地址时
     * 会把请求发到 `<root>/chat/completions`，被网关判成模型不存在。
     */
    public async ensureProviderBaseUrl(): Promise<void> {
        if (this.providerBaseUrlResolved) {
            return;
        }

        try {
            await this.getModels();
        } catch {
            // 探测失败时保持原地址，真实错误留给后续对话请求抛出。
        }

        this.providerBaseUrlResolved = true;
    }

    //#region 获取模型列表
    public async getModels(): Promise<IAiChatModel[]> {
        const requestUrls = this.buildModelRequestUrls();

        if (requestUrls.length === 0) {
            return [];
        }

        const headers: Record<string, string> = {
            Accept: "application/json",
        };
        const normalizedApiKey = this.apiKey.trim();

        if (normalizedApiKey) {
            headers.Authorization = `Bearer ${normalizedApiKey}`;
        }

        let lastError: unknown = null;

        for (let index = 0; index < requestUrls.length; index += 1) {
            const requestUrl = requestUrls[index];

            try {
                // AI 服务地址由用户自定义，不能依赖 Tauri HTTP 插件的静态 scope。
                const response = await fetch(requestUrl, {
                    method: "GET",
                    headers,
                });

                if (!response.ok) {
                    const errorMessage =
                        await this.readModelErrorMessage(response);

                    if (
                        response.status === 404 &&
                        index < requestUrls.length - 1
                    ) {
                        continue;
                    }

                    throw new Error(errorMessage);
                }

                const payload =
                    (await response.json()) as IOpenAICompatibleModelListResponse;

                this.updateProviderBaseUrl(
                    requestUrl.replace(/\/models$/u, ""),
                );
                this.providerBaseUrlResolved = true;

                return this.normalizeModels(payload.data);
            } catch (error) {
                lastError = error;

                if (index < requestUrls.length - 1) {
                    continue;
                }
            }
        }

        console.error("获取模型列表失败", lastError);
        throw this.toError(lastError, "获取模型列表失败。");
    }

    public async inspectServers(
        enabledServers: Partial<Record<AiChatMcpServerId, boolean>> = {},
    ): Promise<IAiChatMcpServerSnapshot[]> {
        const { connections, snapshots } =
            await this.loadServerConnections(enabledServers);

        await this.disposeConnections(connections);

        return snapshots;
    }

    public async createSession(
        options: IAiChatCreateSessionOptions,
    ): Promise<IAiChatSession> {
        const modelId = options.modelId.trim();

        if (!modelId) {
            throw new Error("请先选择或填写模型 ID。");
        }

        await this.ensureProviderBaseUrl();

        const { connections, snapshots } = await this.loadServerConnections(
            options.enabledServers ?? {},
        );

        const tools = this.createBuiltinTools(connections);
        const builtinToolNames = Object.keys(tools);
        const registeredToolNames = new Set(builtinToolNames);

        for (const connection of connections.values()) {
            const mcpTools = connection.client.toolsFromDefinitions(
                connection.toolDefinitions,
            );

            await this.appendToolDriftWarnings(connection, mcpTools);

            for (const [toolName, toolDefinition] of Object.entries(mcpTools)) {
                if (registeredToolNames.has(toolName)) {
                    connection.snapshot.warnings = [
                        ...connection.snapshot.warnings,
                        `工具 ${toolName} 与其他工具重名，已自动跳过。`,
                    ];
                    continue;
                }

                registeredToolNames.add(toolName);
                tools[toolName] = toolDefinition;
            }
        }

        const agent = new ToolLoopAgent({
            model: this.getProvider().chatModel(modelId),
            instructions: this.buildAgentInstructions(
                options.systemPrompt,
                snapshots,
            ),
            tools,
            // 内置工具固定排在最前，保持工具定义顺序稳定以提升服务端缓存命中率。
            toolOrder: builtinToolNames.filter((toolName) => {
                return toolName in tools;
            }),
            // 多步工具调用时，历史步骤的思考内容对后续决策没有价值，裁掉可以降低上下文体积。
            // 工具调用结果不裁剪：Skills 里的工作流常需要引用前面步骤拿到的列表或资源内容。
            prepareStep: ({ messages }) => {
                return {
                    messages: pruneMessages({
                        messages,
                        reasoning: "before-last-message",
                    }),
                };
            },
            stopWhen: isStepCount(10),
        });

        return {
            agent,
            servers: snapshots,
            dispose: async () => {
                await this.disposeConnections(connections);
            },
        };
    }

    private buildModelRequestUrls(): string[] {
        const normalizedBaseUrl = this.normalizeBaseUrl(this.baseURL);

        if (!normalizedBaseUrl) {
            return [];
        }

        if (normalizedBaseUrl.endsWith("/models")) {
            return [normalizedBaseUrl];
        }

        // 兼容直接填写根地址与已包含 /v1 的地址。
        const requestUrls = normalizedBaseUrl.endsWith("/v1")
            ? [`${normalizedBaseUrl}/models`]
            : [`${normalizedBaseUrl}/models`, `${normalizedBaseUrl}/v1/models`];

        return [...new Set(requestUrls)];
    }

    private normalizeModels(
        data?: IOpenAICompatibleModelItem[],
    ): IAiChatModel[] {
        if (!Array.isArray(data)) {
            return [];
        }

        return data.reduce<IAiChatModel[]>((models, item) => {
            const id = typeof item.id === "string" ? item.id.trim() : "";

            if (!id) {
                return models;
            }

            models.push({
                id,
                name: id,
                created:
                    typeof item.created === "number" ? item.created : undefined,
                ownedBy:
                    typeof item.owned_by === "string"
                        ? item.owned_by
                        : undefined,
                raw: item,
            });

            return models;
        }, []);
    }

    private async readModelErrorMessage(response: Response): Promise<string> {
        const fallbackMessage = `获取模型列表失败：${response.status} ${response.statusText}`;

        try {
            const payload =
                (await response.json()) as IOpenAICompatibleModelListResponse;

            return payload.error?.message ?? payload.message ?? fallbackMessage;
        } catch {
            return fallbackMessage;
        }
    }

    //#endregion

    private getProvider() {
        if (!this.provider) {
            const normalizedBaseUrl = this.providerBaseURL.trim();

            if (!normalizedBaseUrl) {
                throw new Error("请先配置可用的 AI Base URL。");
            }

            const headers = this.apiKey
                ? {
                      Authorization: `Bearer ${this.apiKey}`,
                  }
                : undefined;

            this.provider = createOpenAICompatible({
                name: "gloss-agent",
                baseURL: normalizedBaseUrl,
                includeUsage: true,
                ...(headers ? { headers } : {}),
            });
        }

        return this.provider;
    }

    private normalizeBaseUrl(baseURL: string) {
        const trimmedBaseUrl = baseURL.trim().replace(/\/+$/u, "");

        if (!trimmedBaseUrl) {
            return "";
        }

        return trimmedBaseUrl.replace(
            /\/(chat\/completions|completions|responses|embeddings|models)$/u,
            "",
        );
    }

    private normalizeProviderBaseUrl(baseURL: string) {
        return this.normalizeBaseUrl(baseURL);
    }

    private updateProviderBaseUrl(nextBaseUrl: string) {
        const normalizedNextBaseUrl =
            this.normalizeProviderBaseUrl(nextBaseUrl);

        if (normalizedNextBaseUrl === this.providerBaseURL) {
            return;
        }

        this.providerBaseURL = normalizedNextBaseUrl;
        this.provider = undefined;
    }

    private async getServerConfigs(
        enabledServers: Partial<Record<AiChatMcpServerId, boolean>>,
    ): Promise<IAiChatServerConfig[]> {
        const glossModKey = (await SecretStore.getSafe("glossModKey")).trim();
        const localMcpToken = McpService.authToken.value.trim();

        return [
            {
                id: "gloss-mod-manager",
                label: "Gloss Mod Manager MCP",
                description: "本地 MCP 服务，提供当前管理器和游戏上下文能力。",
                endpoint: McpService.endpoint.value,
                enabled: enabledServers["gloss-mod-manager"] ?? true,
                warnings: localMcpToken
                    ? []
                    : ["本地 MCP 服务尚未就绪或未生成访问令牌，请先启动服务。"],
                transport: {
                    type: "http",
                    url: McpService.endpoint.value,
                    // 本地服务每次启动生成一次性令牌，请求必须携带才能通过鉴权。
                    ...(localMcpToken
                        ? {
                              headers: {
                                  authorization: `Bearer ${localMcpToken}`,
                              },
                          }
                        : {}),
                },
            },
            {
                id: "gloss-mod",
                label: "3DM Mods MCP",
                description: "Gloss Mods 站点侧 MCP 服务，提供站点能力。",
                endpoint: "https://mod.3dmgame.com/mcp",
                enabled: enabledServers["gloss-mod"] ?? false,
                warnings: glossModKey
                    ? []
                    : ["未配置 3DM Mods Key，启用后可能返回鉴权失败。"],
                transport: {
                    type: "http",
                    url: "https://mod.3dmgame.com/mcp",
                    ...(glossModKey
                        ? {
                              headers: {
                                  authorization: glossModKey,
                              },
                          }
                        : {}),
                },
            },
        ];
    }

    private async loadServerConnections(
        enabledServers: Partial<Record<AiChatMcpServerId, boolean>>,
    ) {
        const serverConfigs = await this.getServerConfigs(enabledServers);
        const connections = new Map<AiChatMcpServerId, IAiChatMcpConnection>();
        const snapshots: IAiChatMcpServerSnapshot[] = [];

        for (const serverConfig of serverConfigs) {
            if (!serverConfig.enabled) {
                snapshots.push({
                    id: serverConfig.id,
                    label: serverConfig.label,
                    description: serverConfig.description,
                    endpoint: serverConfig.endpoint,
                    enabled: false,
                    status: "disabled",
                    warnings: [...serverConfig.warnings],
                    tools: [],
                    resources: [],
                    prompts: [],
                });
                continue;
            }

            let client: MCPClient | undefined;

            try {
                client = await createMCPClient({
                    transport: {
                        ...serverConfig.transport,
                        fetch: runtimeFetch,
                    },
                });

                const toolDefinitions = await client.listTools();
                const warnings = [...serverConfig.warnings];
                const resources = await this.safeListResources(
                    client,
                    warnings,
                );
                const prompts = await this.safeListPrompts(client, warnings);
                const snapshot: IAiChatMcpServerSnapshot = {
                    id: serverConfig.id,
                    label: serverConfig.label,
                    description: serverConfig.description,
                    endpoint: serverConfig.endpoint,
                    enabled: true,
                    status: "ready",
                    warnings,
                    tools: toolDefinitions.tools.map((item) => ({
                        name: item.name,
                        title: item.title,
                        description: item.description,
                    })),
                    resources,
                    prompts,
                };

                snapshots.push(snapshot);
                connections.set(serverConfig.id, {
                    client,
                    snapshot,
                    toolDefinitions,
                });
            } catch (error) {
                if (client) {
                    await client.close().catch(() => undefined);
                }

                snapshots.push({
                    id: serverConfig.id,
                    label: serverConfig.label,
                    description: serverConfig.description,
                    endpoint: serverConfig.endpoint,
                    enabled: true,
                    status: "error",
                    error: this.toError(error, "连接 MCP 服务失败。").message,
                    warnings: [...serverConfig.warnings],
                    tools: [],
                    resources: [],
                    prompts: [],
                });
            }
        }

        return {
            connections,
            snapshots,
        };
    }

    /**
     * 校验 MCP 工具定义是否相对上次连接发生变化，把结果并入该服务的告警列表。
     * 指纹读写失败不应阻断会话创建，因此这里只记录日志。
     */
    private async appendToolDriftWarnings(
        connection: IAiChatMcpConnection,
        mcpTools: ToolSet,
    ) {
        try {
            const drift = await checkMcpToolDrift(
                connection.snapshot.id,
                mcpTools,
            );

            if (!drift) {
                return;
            }

            connection.snapshot.warnings = [
                ...connection.snapshot.warnings,
                ...buildMcpToolDriftWarnings(drift),
            ];
        } catch (error) {
            console.error("校验 MCP 工具定义变化失败", error);
        }
    }

    private async safeListResources(
        client: MCPClient,
        warnings: string[],
    ): Promise<IAiChatMcpResourceInfo[]> {
        try {
            const result = await client.listResources();

            return result.resources.map((item) => ({
                uri: item.uri,
                name: item.name,
                title: item.title,
                description: item.description,
                mimeType: item.mimeType,
            }));
        } catch (error) {
            warnings.push(
                `Resources 列表读取失败：${this.toError(error, "unknown error").message}`,
            );
            return [];
        }
    }

    private async safeListPrompts(
        client: MCPClient,
        warnings: string[],
    ): Promise<IAiChatMcpPromptInfo[]> {
        try {
            const result = await client.experimental_listPrompts();

            return result.prompts.map((item) => ({
                name: item.name,
                title: item.title,
                description: item.description,
                arguments: item.arguments?.map((argument) => ({
                    name: argument.name,
                    description: argument.description,
                    required: argument.required,
                })),
            }));
        } catch (error) {
            warnings.push(
                `Prompts 列表读取失败：${this.toError(error, "unknown error").message}`,
            );
            return [];
        }
    }

    private createBuiltinTools(
        connections: Map<AiChatMcpServerId, IAiChatMcpConnection>,
    ): ToolSet {
        const enabledServerIds = Array.from(connections.keys());

        return {
            "get-app-overview": tool({
                description:
                    "获取当前 Gloss Mod Manager 应用上下文，包括当前管理游戏、本地 MCP 服务状态和已管理游戏列表。",
                inputSchema: z.object({}),
                execute: async () => {
                    const manager = useManager();
                    const currentGame = manager.managerGame;

                    return {
                        appName: "Gloss Mod Manager",
                        appVersion: packageInfo.version,
                        currentTime: new Date().toISOString(),
                        localMcp: {
                            endpoint: McpService.endpoint.value,
                            status: McpService.serverStatus.value,
                        },
                        currentManagedGame: currentGame
                            ? {
                                  GlossGameId: currentGame.GlossGameId,
                                  gameName:
                                      currentGame.gameShowName ||
                                      currentGame.gameName,
                                  gamePath: currentGame.gamePath,
                              }
                            : null,
                        managedGameCount: manager.managerGameList.length,
                        managedGames: manager.managerGameList.map((game) => ({
                            GlossGameId: game.GlossGameId,
                            gameName: game.gameShowName || game.gameName,
                            gamePath: game.gamePath,
                        })),
                        currentModCount: manager.managerModList.length,
                    };
                },
            }),
            "list-mcp-resources": tool({
                description:
                    "列出当前已启用 MCP 服务器暴露的资源。系统提示词里已有完整清单，仅在怀疑清单已过期时才需要调用。",
                inputSchema: z.object({
                    serverId: z
                        .string()
                        .optional()
                        .describe(
                            `可选，限制为指定服务器。可用值：${
                                enabledServerIds.join(", ") || "无"
                            }。`,
                        ),
                }),
                execute: async ({ serverId }) => {
                    const serverIds = serverId?.trim()
                        ? [this.getValidatedServerId(serverId, connections)]
                        : enabledServerIds;

                    const data = await Promise.all(
                        serverIds.map(async (item) => {
                            const connection = connections.get(item);

                            if (!connection) {
                                return null;
                            }

                            const result =
                                await connection.client.listResources();

                            return {
                                serverId: item,
                                serverName: connection.snapshot.label,
                                resources: result.resources.map((resource) => ({
                                    uri: resource.uri,
                                    name: resource.name,
                                    title: resource.title,
                                    description: resource.description,
                                    mimeType: resource.mimeType,
                                })),
                            };
                        }),
                    );

                    return {
                        servers: data.filter(Boolean),
                    };
                },
            }),
            "read-mcp-resource": tool({
                description:
                    "读取指定 MCP 资源的内容。系统提示词里已列出全部可用资源的 serverId 和 uri，可直接调用。",
                inputSchema: z.object({
                    serverId: z
                        .string()
                        .describe(
                            `资源所在服务器 ID。可用值：${
                                enabledServerIds.join(", ") || "无"
                            }。`,
                        ),
                    uri: z.string().describe("要读取的 MCP 资源 URI。"),
                }),
                execute: async ({ serverId, uri }) => {
                    const resolvedServerId = this.getValidatedServerId(
                        serverId,
                        connections,
                    );
                    const connection = connections.get(resolvedServerId);

                    if (!connection) {
                        throw new Error(
                            `未找到可用的 MCP 服务：${resolvedServerId}`,
                        );
                    }

                    const result = await connection.client.readResource({
                        uri,
                    });

                    return {
                        serverId: resolvedServerId,
                        serverName: connection.snapshot.label,
                        uri,
                        contents: result.contents.map((content) => {
                            if ("text" in content) {
                                return {
                                    uri: content.uri,
                                    name: content.name,
                                    title: content.title,
                                    mimeType: content.mimeType,
                                    text: this.truncateText(
                                        String(content.text ?? ""),
                                    ),
                                };
                            }

                            return {
                                uri: content.uri,
                                name: content.name,
                                title: content.title,
                                mimeType: content.mimeType,
                                blob: "[binary resource omitted]",
                            };
                        }),
                    };
                },
            }),
            "list-mcp-prompts": tool({
                description:
                    "列出当前已启用 MCP 服务器暴露的 Prompt 模板。系统提示词里已有完整清单，仅在怀疑清单已过期时才需要调用。",
                inputSchema: z.object({
                    serverId: z
                        .string()
                        .optional()
                        .describe(
                            `可选，限制为指定服务器。可用值：${
                                enabledServerIds.join(", ") || "无"
                            }。`,
                        ),
                }),
                execute: async ({ serverId }) => {
                    const serverIds = serverId?.trim()
                        ? [this.getValidatedServerId(serverId, connections)]
                        : enabledServerIds;

                    const data = await Promise.all(
                        serverIds.map(async (item) => {
                            const connection = connections.get(item);

                            if (!connection) {
                                return null;
                            }

                            const result =
                                await connection.client.experimental_listPrompts();

                            return {
                                serverId: item,
                                serverName: connection.snapshot.label,
                                prompts: result.prompts.map((promptItem) => ({
                                    name: promptItem.name,
                                    title: promptItem.title,
                                    description: promptItem.description,
                                    arguments: promptItem.arguments?.map(
                                        (argument) => ({
                                            name: argument.name,
                                            description: argument.description,
                                            required: argument.required,
                                        }),
                                    ),
                                })),
                            };
                        }),
                    );

                    return {
                        servers: data.filter(Boolean),
                    };
                },
            }),
            "get-mcp-prompt": tool({
                description:
                    "获取指定 MCP Prompt 模板的完整内容，可用于理解服务器提供的工作流或文案模板。系统提示词里已列出全部可用 Prompt 的 serverId 和 name，可直接调用。",
                inputSchema: z.object({
                    serverId: z
                        .string()
                        .describe(
                            `Prompt 所在服务器 ID。可用值：${
                                enabledServerIds.join(", ") || "无"
                            }。`,
                        ),
                    name: z.string().describe("Prompt 名称。"),
                    argumentsJson: z
                        .string()
                        .optional()
                        .describe(
                            "可选，JSON 对象字符串，用于向 Prompt 传参。",
                        ),
                }),
                execute: async ({ serverId, name, argumentsJson }) => {
                    const resolvedServerId = this.getValidatedServerId(
                        serverId,
                        connections,
                    );
                    const connection = connections.get(resolvedServerId);

                    if (!connection) {
                        throw new Error(
                            `未找到可用的 MCP 服务：${resolvedServerId}`,
                        );
                    }

                    const promptArguments =
                        this.parsePromptArguments(argumentsJson);
                    const result =
                        await connection.client.experimental_getPrompt({
                            name,
                            ...(promptArguments
                                ? {
                                      arguments: promptArguments,
                                  }
                                : {}),
                        });

                    return {
                        serverId: resolvedServerId,
                        serverName: connection.snapshot.label,
                        name,
                        description: result.description,
                        messages: result.messages.map((message) => ({
                            role: message.role,
                            content: this.normalizePromptMessageContent(
                                message.content,
                            ),
                        })),
                    };
                },
            }),
        };
    }

    private getValidatedServerId(
        serverId: string,
        connections: Map<AiChatMcpServerId, IAiChatMcpConnection>,
    ): AiChatMcpServerId {
        const normalizedServerId = serverId.trim() as AiChatMcpServerId;

        if (!connections.has(normalizedServerId)) {
            throw new Error(`当前会话未启用指定 MCP 服务：${serverId.trim()}`);
        }

        return normalizedServerId;
    }

    private parsePromptArguments(argumentsJson?: string) {
        if (!argumentsJson?.trim()) {
            return undefined;
        }

        try {
            const parsed = JSON.parse(argumentsJson) as unknown;

            if (
                typeof parsed !== "object" ||
                parsed === null ||
                Array.isArray(parsed)
            ) {
                throw new Error("Prompt 参数必须是 JSON 对象。");
            }

            return parsed as Record<string, unknown>;
        } catch {
            throw new Error("Prompt 参数必须是合法的 JSON 对象字符串。");
        }
    }

    private normalizePromptMessageContent(content: {
        type: "text" | "image" | "resource" | "resource_link";
        [key: string]: unknown;
    }) {
        switch (content.type) {
            case "text":
                return {
                    type: "text",
                    text: this.truncateText(String(content.text ?? "")),
                };
            case "resource_link":
                return {
                    type: "resource_link",
                    uri: String(content.uri ?? ""),
                    name: String(content.name ?? ""),
                    description:
                        typeof content.description === "string"
                            ? content.description
                            : undefined,
                    mimeType:
                        typeof content.mimeType === "string"
                            ? content.mimeType
                            : undefined,
                };
            case "resource": {
                const resource = content.resource as
                    | {
                          uri: string;
                          name?: string;
                          title?: string;
                          mimeType?: string;
                          text?: string;
                      }
                    | undefined;

                return {
                    type: "resource",
                    uri: resource?.uri ?? "",
                    name: resource?.name,
                    title: resource?.title,
                    mimeType: resource?.mimeType,
                    text: resource?.text
                        ? this.truncateText(resource.text)
                        : "[binary resource omitted]",
                };
            }
            default:
                return {
                    type: "image",
                    mimeType: String(content.mimeType ?? ""),
                    note: "[image content omitted]",
                };
        }
    }

    private buildAgentInstructions(
        systemPrompt: string | undefined,
        snapshots: IAiChatMcpServerSnapshot[],
    ) {
        const skillsPrompt = buildBundledAiChatSkillsPrompt();
        const serverLines = snapshots
            .filter((snapshot) => snapshot.enabled)
            .map((snapshot) => {
                if (snapshot.status !== "ready") {
                    return `- ${snapshot.label}: 当前不可用，原因：${snapshot.error || "unknown error"}`;
                }

                // Tools 的定义会原样交给模型，这里只报数量；
                // Resources / Prompts 不进工具列表，必须把 URI 和名称摊开写，
                // 否则模型只知道有几项、不知道是什么，就不会去读。
                const lines: string[] = [
                    `- ${snapshot.label}（serverId: ${snapshot.id}）: Tools ${snapshot.tools.length} 项，Resources ${snapshot.resources.length} 项，Prompts ${snapshot.prompts.length} 项。`,
                    ...this.buildResourceInventoryLines(snapshot.resources),
                    ...this.buildPromptInventoryLines(snapshot.prompts),
                ];

                return lines.join("\n");
            })
            .join("\n");

        return [
            systemPrompt?.trim() || DEFAULT_AI_CHAT_SYSTEM_PROMPT,
            `当前应用版本：${packageInfo.version}。`,
            snapshots.some((snapshot) => snapshot.enabled)
                ? `当前已接入的 MCP 服务：\n${serverLines}`
                : "当前没有启用任何 MCP 服务。",
            "当问题涉及当前应用状态、当前游戏、Mod 管理或站点上下文时，优先调用工具。",
            "上面已列出全部可用的 MCP 资源与 Prompt，可直接用 read-mcp-resource / get-mcp-prompt 读取目标项，不需要先调用 list-mcp-resources / list-mcp-prompts。",
            skillsPrompt,
        ]
            .filter(Boolean)
            .join("\n\n");
    }

    private buildResourceInventoryLines(
        resources: IAiChatMcpResourceInfo[],
    ): string[] {
        if (resources.length === 0) {
            return [];
        }

        return [
            "  可用 Resources（用 read-mcp-resource 按 uri 读取）：",
            ...resources.map((resource) => {
                const label = resource.title || resource.name;
                const description = this.summarizeText(resource.description);

                return `    - ${resource.uri}${label ? `（${label}）` : ""}${
                    description ? `：${description}` : ""
                }`;
            }),
        ];
    }

    private buildPromptInventoryLines(
        prompts: IAiChatMcpPromptInfo[],
    ): string[] {
        if (prompts.length === 0) {
            return [];
        }

        return [
            "  可用 Prompts（用 get-mcp-prompt 按 name 读取）：",
            ...prompts.map((promptItem) => {
                const label = promptItem.title;
                const description = this.summarizeText(promptItem.description);
                const promptArguments = (promptItem.arguments ?? [])
                    .map((argument) => {
                        return `${argument.name}${argument.required ? "(必填)" : ""}`;
                    })
                    .join(", ");

                return `    - ${promptItem.name}${label ? `（${label}）` : ""}${
                    description ? `：${description}` : ""
                }${promptArguments ? ` 参数：${promptArguments}` : ""}`;
            }),
        ];
    }

    // 清单只用来让模型知道有什么，描述过长会挤占上下文，这里压到一行以内。
    private summarizeText(text?: string, maxLength: number = 120) {
        const normalized = text?.replace(/\s+/gu, " ").trim();

        if (!normalized) {
            return "";
        }

        if (normalized.length <= maxLength) {
            return normalized;
        }

        return `${normalized.slice(0, maxLength)}…`;
    }

    private async disposeConnections(
        connections: Map<AiChatMcpServerId, IAiChatMcpConnection>,
    ) {
        await Promise.all(
            Array.from(connections.values()).map(async (connection) => {
                await connection.client.close().catch(() => undefined);
            }),
        );
    }

    private truncateText(text: string, maxLength: number = 6000) {
        if (text.length <= maxLength) {
            return text;
        }

        return `${text.slice(0, maxLength)}\n\n[内容过长，已截断]`;
    }

    private toError(error: unknown, fallbackMessage: string) {
        if (error instanceof Error && error.message.trim()) {
            return error;
        }

        if (typeof error === "string" && error.trim()) {
            return new Error(error);
        }

        if (
            typeof error === "object" &&
            error !== null &&
            "message" in error &&
            typeof error.message === "string" &&
            error.message.trim()
        ) {
            return new Error(error.message);
        }

        return new Error(fallbackMessage);
    }
}
