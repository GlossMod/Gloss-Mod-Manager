import { Chat } from "@ai-sdk/vue";
import { DirectChatTransport, type InferUITools, type UIMessage } from "ai";
import { storeToRefs } from "pinia";
import { computed, ref, shallowRef } from "vue";
import {
    AiChat,
    type AiChatMcpServerId,
    type IAiChatMcpServerSnapshot,
    type IAiChatModel,
    type IAiChatSession,
    DEFAULT_AI_CHAT_SYSTEM_PROMPT,
} from "@/lib/AiChat";
import { McpService } from "@/lib/mcp-service";
import { PersistentStore } from "@/lib/persistent-store";
import { useSettings } from "@/stores/settings";

export interface IAiChatMessageMetadata {
    createdAt?: number;
    finishReason?: string;
    modelId?: string;
    totalTokens?: number;
}

type IAiChatUIMessage = UIMessage<IAiChatMessageMetadata>;
type IAiChatTransportMessage = UIMessage<unknown, never, InferUITools<{}>>;

function toErrorMessage(error: unknown, fallbackMessage: string) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === "string" && error.trim()) {
        return error;
    }

    if (
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof error.message === "string" &&
        error.message.trim()
    ) {
        return error.message;
    }

    return fallbackMessage;
}

export const useAiChatStore = defineStore("AiChat", () => {
    const settings = useSettings();
    const { apiKey, baseUrl } = storeToRefs(settings);

    const selectedModelId = PersistentStore.useValue<string>(
        "aiChatSelectedModelId",
        "",
    );
    const systemPrompt = PersistentStore.useValue<string>(
        "aiChatSystemPrompt",
        DEFAULT_AI_CHAT_SYSTEM_PROMPT,
    );
    const mcpServerEnabledMap = PersistentStore.useValue<
        Record<AiChatMcpServerId, boolean>
    >("aiChatMcpServerEnabledMap", {
        "gloss-mod-manager": true,
        "gloss-mod": false,
    });

    const modelList = ref<IAiChatModel[]>([]);
    const serverSnapshots = ref<IAiChatMcpServerSnapshot[]>([]);
    const modelLoadError = ref("");
    const sessionError = ref("");
    const initialized = ref(false);
    const loadingModels = ref(false);
    const refreshingServers = ref(false);
    const rebuildingSession = ref(false);

    const chat = shallowRef<Chat<IAiChatTransportMessage> | null>(null);
    const session = shallowRef<IAiChatSession | null>(null);

    const localServerEndpoint = McpService.endpoint;
    const localServerStatus = McpService.serverStatus;
    const localServerBusy = McpService.isBusy;

    const hasConfiguration = computed(() => {
        return Boolean(baseUrl.value.trim());
    });

    const messages = computed<IAiChatUIMessage[]>(() => {
        return (chat.value?.messages ?? []) as IAiChatUIMessage[];
    });

    const status = computed(() => {
        return chat.value?.status ?? "ready";
    });

    const chatError = computed(() => {
        return chat.value?.error;
    });

    const hasActiveSession = computed(() => {
        return Boolean(session.value && chat.value);
    });

    const busy = computed(() => {
        return (
            loadingModels.value ||
            refreshingServers.value ||
            rebuildingSession.value
        );
    });

    function createService() {
        return new AiChat(baseUrl.value, apiKey.value);
    }

    async function refreshModels() {
        if (!hasConfiguration.value) {
            modelList.value = [];
            modelLoadError.value = "";
            return;
        }

        loadingModels.value = true;

        try {
            const service = createService();
            const models = await service.getModels();

            modelList.value = models;
            modelLoadError.value = "";

            if (!selectedModelId.value.trim() && models.length > 0) {
                selectedModelId.value = models[0].id;
            }
        } catch (error) {
            modelList.value = [];
            modelLoadError.value = toErrorMessage(error, "获取模型列表失败。");
        } finally {
            loadingModels.value = false;
        }
    }

    async function refreshServers() {
        refreshingServers.value = true;

        try {
            const service = createService();

            serverSnapshots.value = await service.inspectServers(
                mcpServerEnabledMap.value,
            );
        } catch (error) {
            sessionError.value = toErrorMessage(
                error,
                "读取 MCP 服务状态失败。",
            );
        } finally {
            refreshingServers.value = false;
        }
    }

    async function rebuildSession(preserveMessages: boolean = true) {
        if (!hasConfiguration.value) {
            sessionError.value = "请先在设置页配置 AI Base URL。";
            return false;
        }

        const modelId = selectedModelId.value.trim();

        if (!modelId) {
            sessionError.value = "请先选择或填写模型 ID。";
            return false;
        }

        rebuildingSession.value = true;
        const previousChat = chat.value;
        const previousSession = session.value;
        const preservedMessages = (
            preserveMessages ? (previousChat?.messages ?? []) : []
        ) as IAiChatTransportMessage[];

        try {
            if (
                previousChat &&
                (previousChat.status === "submitted" ||
                    previousChat.status === "streaming")
            ) {
                await previousChat.stop().catch(() => undefined);
            }

            const nextSession = await createService().createSession({
                modelId,
                systemPrompt: systemPrompt.value,
                enabledServers: mcpServerEnabledMap.value,
            });
            const nextChat = new Chat<IAiChatTransportMessage>({
                messages: preservedMessages,
                transport: new DirectChatTransport({
                    agent: nextSession.agent,
                    sendReasoning: true,
                    onError: (error) => {
                        return toErrorMessage(error, "AI 对话失败。");
                    },
                    messageMetadata: ({ part }) => {
                        if (part.type === "start") {
                            return {
                                createdAt: Date.now(),
                                modelId,
                            } satisfies IAiChatMessageMetadata;
                        }

                        if (part.type === "finish") {
                            return {
                                finishReason: part.finishReason,
                                totalTokens: part.totalUsage.totalTokens,
                            } satisfies IAiChatMessageMetadata;
                        }

                        return undefined;
                    },
                }),
                onError: (error) => {
                    sessionError.value = toErrorMessage(error, "AI 对话失败。");
                },
            });

            chat.value = nextChat;
            session.value = nextSession;
            serverSnapshots.value = nextSession.servers;
            sessionError.value = "";

            if (previousSession) {
                await previousSession.dispose().catch(() => undefined);
            }

            return true;
        } catch (error) {
            sessionError.value = toErrorMessage(error, "创建 AI 会话失败。");
            return false;
        } finally {
            rebuildingSession.value = false;
        }
    }

    async function initialize() {
        await refreshModels();
        await refreshServers();

        if (hasConfiguration.value && selectedModelId.value.trim()) {
            await rebuildSession(false);
        }

        initialized.value = true;
    }

    async function applySessionConfig(options: {
        modelId: string;
        systemPrompt: string;
        preserveMessages?: boolean;
    }) {
        selectedModelId.value = options.modelId.trim();
        systemPrompt.value = options.systemPrompt;

        return rebuildSession(options.preserveMessages ?? true);
    }

    async function setMcpServerEnabled(
        serverId: AiChatMcpServerId,
        enabled: boolean,
    ) {
        mcpServerEnabledMap.value = {
            ...mcpServerEnabledMap.value,
            [serverId]: enabled,
        };

        await refreshServers();

        if (hasConfiguration.value && selectedModelId.value.trim()) {
            await rebuildSession(true);
        }
    }

    async function startLocalServer() {
        await McpService.start();
        await refreshServers();

        if (mcpServerEnabledMap.value["gloss-mod-manager"]) {
            await rebuildSession(true);
        }
    }

    async function stopLocalServer() {
        await McpService.stop();
        await refreshServers();

        if (mcpServerEnabledMap.value["gloss-mod-manager"]) {
            await rebuildSession(true);
        }
    }

    async function sendText(text: string) {
        const normalizedText = text.trim();

        if (!normalizedText) {
            return;
        }

        if (!chat.value) {
            const ready = await rebuildSession(true);

            if (!ready || !chat.value) {
                throw new Error(sessionError.value || "AI 会话尚未就绪。");
            }
        }

        await chat.value.sendMessage({
            text: normalizedText,
        });
    }

    async function stopGeneration() {
        await chat.value?.stop().catch(() => undefined);
    }

    function clearMessages() {
        if (!chat.value) {
            return;
        }

        chat.value.messages = [];
        sessionError.value = "";
    }

    async function disposeSession() {
        await chat.value?.stop().catch(() => undefined);
        await session.value?.dispose().catch(() => undefined);
        chat.value = null;
        session.value = null;
    }

    return {
        busy,
        chat,
        chatError,
        clearMessages,
        disposeSession,
        hasActiveSession,
        hasConfiguration,
        initialize,
        initialized,
        loadingModels,
        localServerBusy,
        localServerEndpoint,
        localServerStatus,
        mcpServerEnabledMap,
        messages,
        modelList,
        modelLoadError,
        rebuildingSession,
        refreshModels,
        refreshingServers,
        refreshServers,
        selectedModelId,
        sendText,
        serverSnapshots,
        session,
        sessionError,
        setMcpServerEnabled,
        startLocalServer,
        status,
        stopGeneration,
        stopLocalServer,
        systemPrompt,
        applySessionConfig,
    };
});
