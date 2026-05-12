import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { stepCountIs, tool, ToolLoopAgent, type ToolSet } from "ai";
import { z } from "zod";
import packageInfo from "../../package.json";
import { McpService } from "@/lib/mcp-service";
import { PersistentStore } from "@/lib/persistent-store";
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

function runtimeFetch(...args: Parameters<typeof fetch>) {
    return globalThis.fetch(...args);
}

export class AiChat {
    private baseURL: string;
    private apiKey: string;
    private providerBaseURL: string;
    private provider?: ReturnType<typeof createOpenAICompatible>;

    constructor(baseURL: string, apiKey: string) {
        this.baseURL = baseURL;
        this.apiKey = apiKey.trim();
        this.providerBaseURL = this.normalizeProviderBaseUrl(baseURL);
    }

    public get Agent() {
        return this.getProvider();
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

        const { connections, snapshots } = await this.loadServerConnections(
            options.enabledServers ?? {},
        );

        const tools = this.createBuiltinTools(connections);
        const registeredToolNames = new Set(Object.keys(tools));

        for (const connection of connections.values()) {
            const mcpTools = connection.client.toolsFromDefinitions(
                connection.toolDefinitions,
            );

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
            stopWhen: stepCountIs(10),
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
        const glossModKey =
            (await PersistentStore.get<string>("glossModKey", ""))?.trim() ??
            "";

        return [
            {
                id: "gloss-mod-manager",
                label: "Gloss Mod Manager MCP",
                description: "本地 MCP 服务，提供当前管理器和游戏上下文能力。",
                endpoint: McpService.endpoint.value,
                enabled: enabledServers["gloss-mod-manager"] ?? true,
                warnings: [],
                transport: {
                    type: "http",
                    url: McpService.endpoint.value,
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
                    "列出当前已启用 MCP 服务器暴露的资源。读取资源内容前应先调用它。",
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
                    "读取指定 MCP 资源的内容。仅在已知 serverId 和资源 URI 时调用。",
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
                    "列出当前已启用 MCP 服务器暴露的 Prompt 模板。读取 Prompt 内容前应先调用它。",
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
                    "获取指定 MCP Prompt 模板的完整内容，可用于理解服务器提供的工作流或文案模板。",
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
        const serverLines = snapshots
            .filter((snapshot) => snapshot.enabled)
            .map((snapshot) => {
                if (snapshot.status === "ready") {
                    return `- ${snapshot.label}: Tools ${snapshot.tools.length} 项，Resources ${snapshot.resources.length} 项，Prompts ${snapshot.prompts.length} 项。`;
                }

                return `- ${snapshot.label}: 当前不可用，原因：${snapshot.error || "unknown error"}`;
            })
            .join("\n");

        return [
            systemPrompt?.trim() || DEFAULT_AI_CHAT_SYSTEM_PROMPT,
            `当前应用版本：${packageInfo.version}。`,
            snapshots.some((snapshot) => snapshot.enabled)
                ? `当前已接入的 MCP 服务：\n${serverLines}`
                : "当前没有启用任何 MCP 服务。",
            "当问题涉及当前应用状态、当前游戏、Mod 管理或站点上下文时，优先调用工具。",
            "如果需要 MCP 资源或 Prompt，请先调用 list-mcp-resources / list-mcp-prompts，再读取目标项。",
        ].join("\n\n");
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
