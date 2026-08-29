import { Chat } from "@ai-sdk/vue";
import {
    type ChatTransport,
    DirectChatTransport,
    type FileUIPart,
    type InferUITools,
    type UIMessage,
} from "ai";
import { storeToRefs } from "pinia";
import { computed, isProxy, ref, shallowRef, toRaw, watch } from "vue";
import {
    AiChat,
    type AiChatMcpServerId,
    type IAiChatMcpServerSnapshot,
    type IAiChatModel,
    type IAiChatSession,
    DEFAULT_AI_CHAT_SYSTEM_PROMPT,
} from "@/lib/AiChat";
import { buildAiChatAttachmentPromptText } from "../lib/ai-chat-attachments";
import { McpService } from "@/lib/mcp-service";
import { PersistentStore } from "@/lib/persistent-store";
import { useSettings } from "@/stores/settings";

const AI_CHAT_CONVERSATION_LIST_KEY = "aiChatConversationList";
const AI_CHAT_ACTIVE_CONVERSATION_ID_KEY = "aiChatActiveConversationId";
const STREAMING_CONVERSATION_SYNC_INTERVAL = 1000;

export interface IAiChatMessageMetadata {
    createdAt?: number;
    finishReason?: string;
    modelId?: string;
    reasoningMs?: number;
    totalTokens?: number;
}

export type IAiChatUIMessage = UIMessage<IAiChatMessageMetadata>;
type IAiChatTransportMessage = UIMessage<
    IAiChatMessageMetadata,
    never,
    InferUITools<{}>
>;

export interface IAiChatConversation {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    modelId?: string;
    messages: IAiChatUIMessage[];
}

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

function createConversationId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function unwrapReactiveValue<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((item) => unwrapReactiveValue(item)) as T;
    }

    if (!value || typeof value !== "object") {
        return value;
    }

    const source = isProxy(value) ? toRaw(value) : value;

    if (
        source instanceof Date ||
        source instanceof Blob ||
        source instanceof File ||
        source instanceof ArrayBuffer ||
        ArrayBuffer.isView(source)
    ) {
        return source as T;
    }

    if (source instanceof Map) {
        return new Map(
            Array.from(source.entries(), ([key, item]) => [
                unwrapReactiveValue(key),
                unwrapReactiveValue(item),
            ]),
        ) as T;
    }

    if (source instanceof Set) {
        return new Set(
            Array.from(source, (item) => unwrapReactiveValue(item)),
        ) as T;
    }

    if (Array.isArray(source)) {
        return source.map((item) => unwrapReactiveValue(item)) as T;
    }

    const prototype = Object.getPrototypeOf(source);

    if (prototype !== Object.prototype && prototype !== null) {
        return source as T;
    }

    return Object.fromEntries(
        Object.entries(source).map(([key, item]) => [
            key,
            unwrapReactiveValue(item),
        ]),
    ) as T;
}

function getMessageParts(
    message: IAiChatUIMessage | null | undefined,
): IAiChatUIMessage["parts"] {
    if (!message || !Array.isArray(message.parts)) {
        return [];
    }

    return message.parts;
}

function hasValidMessageParts(
    message: IAiChatUIMessage | null | undefined,
): message is IAiChatUIMessage {
    return getMessageParts(message).length > 0;
}

function hasInvalidMessages(messages: IAiChatUIMessage[]) {
    if (!Array.isArray(messages)) {
        return true;
    }

    return messages.some((message) => {
        return !hasValidMessageParts(message);
    });
}

function cloneValidMessages(messages: IAiChatUIMessage[]): IAiChatUIMessage[] {
    if (!Array.isArray(messages)) {
        return [];
    }

    const normalizedMessages = unwrapReactiveValue(messages);
    const clonedMessages = structuredClone(
        normalizedMessages,
    ) as IAiChatUIMessage[];

    return clonedMessages.filter(hasValidMessageParts);
}

function cloneMessages(
    messages: IAiChatUIMessage[],
): IAiChatTransportMessage[] {
    return cloneValidMessages(messages) as IAiChatTransportMessage[];
}

function isFilePart(
    part: IAiChatUIMessage["parts"][number],
): part is FileUIPart {
    return part.type === "file";
}

function getMessageText(message: IAiChatUIMessage | undefined) {
    if (!message) {
        return "";
    }

    return getMessageParts(message)
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim();
}

function createConversationTitle(text: string, files: FileUIPart[] = []) {
    const firstLine = text
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .find(Boolean);
    const sourceTitle = firstLine || files[0]?.filename || "附件对话";
    const normalizedTitle = sourceTitle.replace(/\s+/gu, " ").trim();

    if (normalizedTitle.length <= 24) {
        return normalizedTitle;
    }

    return `${normalizedTitle.slice(0, 24)}...`;
}

function createEmptyConversation(modelId?: string): IAiChatConversation {
    const now = Date.now();

    return {
        id: createConversationId(),
        title: "新会话",
        createdAt: now,
        updatedAt: now,
        modelId,
        messages: [],
    };
}

function transformMessageForModel(
    message: IAiChatTransportMessage,
): IAiChatTransportMessage {
    if (message.role !== "user") {
        return message;
    }

    const messageParts = message.parts.filter((part) => {
        return part.type !== "file";
    });
    const attachmentParts = message.parts.filter(isFilePart).map((part) => {
        return {
            type: "text",
            text: buildAiChatAttachmentPromptText(part),
        } satisfies IAiChatTransportMessage["parts"][number];
    });

    if (attachmentParts.length === 0) {
        return message;
    }

    return {
        ...message,
        // 仅在发送给模型时把附件转换成文本上下文，UI 和本地历史仍保留原始附件。
        parts: [...messageParts, ...attachmentParts],
    };
}

function createAttachmentCompatibleTransport(
    transport: ChatTransport<IAiChatTransportMessage>,
): ChatTransport<IAiChatTransportMessage> {
    return {
        sendMessages: async (options) => {
            return await transport.sendMessages({
                ...options,
                messages: options.messages.map(transformMessageForModel),
            });
        },
        reconnectToStream: async (options) => {
            return await transport.reconnectToStream(options);
        },
    };
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
    const conversationList = PersistentStore.useValue<IAiChatConversation[]>(
        AI_CHAT_CONVERSATION_LIST_KEY,
        [],
    );
    const activeConversationId = PersistentStore.useValue<string>(
        AI_CHAT_ACTIVE_CONVERSATION_ID_KEY,
        "",
    );

    const modelList = ref<IAiChatModel[]>([]);
    const serverSnapshots = ref<IAiChatMcpServerSnapshot[]>([]);
    const modelLoadError = ref("");
    const sessionError = ref("");
    const initialized = ref(false);
    const aiConfigurationHydrated = ref(false);
    const conversationStateHydrated = ref(false);
    const loadingModels = ref(false);
    const refreshingServers = ref(false);
    const rebuildingSession = ref(false);
    const hasDeferredConversationSync = ref(false);
    let streamingConversationSyncTimer: ReturnType<typeof setTimeout> | null =
        null;

    const chat = shallowRef<Chat<IAiChatTransportMessage> | null>(null);
    const session = shallowRef<IAiChatSession | null>(null);

    const localServerEndpoint = McpService.endpoint;
    const localServerStatus = McpService.serverStatus;
    const localServerBusy = McpService.isBusy;

    const hasConfiguration = computed(() => {
        return !configurationErrorMessage.value;
    });

    const configurationErrorMessage = computed(() => {
        const missingItems: string[] = [];

        if (!baseUrl.value.trim()) {
            missingItems.push("AI Base URL");
        }

        if (!apiKey.value.trim()) {
            missingItems.push("API Key");
        }

        if (missingItems.length === 0) {
            return "";
        }

        return `请先在设置页配置${missingItems.join(" 和 ")}。`;
    });

    const messages = computed<IAiChatUIMessage[]>(() => {
        return (chat.value?.messages ??
            activeConversation.value?.messages ??
            []) as IAiChatUIMessage[];
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

    const activeConversation = computed(() => {
        return (
            conversationList.value.find((item) => {
                return item.id === activeConversationId.value;
            }) ?? null
        );
    });

    const busy = computed(() => {
        return (
            loadingModels.value ||
            refreshingServers.value ||
            rebuildingSession.value
        );
    });

    async function syncConversationPersistence(flushToDisk: boolean = false) {
        await Promise.all([
            PersistentStore.set(
                AI_CHAT_CONVERSATION_LIST_KEY,
                conversationList.value,
                flushToDisk,
            ),
            PersistentStore.set(
                AI_CHAT_ACTIVE_CONVERSATION_ID_KEY,
                activeConversationId.value,
                flushToDisk,
            ),
        ]);
    }

    function flushConversationPersistence(reason: string) {
        // 关闭窗口时应用会转为隐藏，因此关键变更需要显式写盘。
        void syncConversationPersistence(true).catch((error: unknown) => {
            console.error(`持久化 AI 会话失败：${reason}`);
            console.error(error);
        });
    }

    function clearStreamingConversationSyncTimer() {
        if (!streamingConversationSyncTimer) {
            return;
        }

        clearTimeout(streamingConversationSyncTimer);
        streamingConversationSyncTimer = null;
    }

    function scheduleStreamingConversationSync() {
        hasDeferredConversationSync.value = true;

        if (streamingConversationSyncTimer) {
            return;
        }

        // 流式阶段按固定间隔同步快照，既保留中途保存能力，也避免每个 chunk 都全量克隆。
        streamingConversationSyncTimer = globalThis.setTimeout(() => {
            streamingConversationSyncTimer = null;

            if (
                status.value !== "streaming" ||
                !hasDeferredConversationSync.value
            ) {
                return;
            }

            persistActiveConversation(messages.value);
            hasDeferredConversationSync.value = false;
        }, STREAMING_CONVERSATION_SYNC_INTERVAL);
    }

    function createService() {
        return new AiChat(baseUrl.value, apiKey.value);
    }

    function normalizeConversationList(list: IAiChatConversation[]) {
        return [...list]
            .map((conversation) => {
                return {
                    ...conversation,
                    messages: cloneValidMessages(conversation.messages),
                } satisfies IAiChatConversation;
            })
            .sort((left, right) => {
                return right.updatedAt - left.updatedAt;
            });
    }

    function hasInvalidConversationMessages(list: IAiChatConversation[]) {
        return list.some((conversation) => {
            return hasInvalidMessages(conversation.messages);
        });
    }

    function sanitizeActiveChatMessages(): IAiChatTransportMessage[] {
        if (!chat.value) {
            return [];
        }

        const sanitizedMessages = cloneMessages(
            chat.value.messages as IAiChatUIMessage[],
        );

        if (sanitizedMessages.length !== chat.value.messages.length) {
            chat.value.messages = sanitizedMessages;
        }

        return sanitizedMessages;
    }

    async function hydrateAiConfiguration() {
        if (aiConfigurationHydrated.value) {
            return;
        }

        // apiKey 已迁移到加密存储，由 settings store 的 SecretStore.useValue 负责水合；
        // 这里再从明文 store 读一次只会拿到被清空的旧键，反而可能覆盖真实凭据。
        const savedBaseUrl = await PersistentStore.get<string>(
            "agentbaseUrl",
            "",
        );

        if (!baseUrl.value.trim() && savedBaseUrl?.trim()) {
            baseUrl.value = savedBaseUrl.trim();
        }

        // 必须等加密凭据读完，否则下游会把“尚未读到 apiKey”误判为“未配置”，
        // 导致会话不被创建，后续编辑/重生成报“AI 会话尚未就绪”。
        await settings.waitForCredentials();

        aiConfigurationHydrated.value = true;
    }

    async function hydrateConversationState() {
        if (conversationStateHydrated.value) {
            return;
        }

        const [savedConversationList, savedActiveConversationId] =
            await Promise.all([
                PersistentStore.get<IAiChatConversation[]>(
                    AI_CHAT_CONVERSATION_LIST_KEY,
                    [],
                ),
                PersistentStore.get<string>(
                    AI_CHAT_ACTIVE_CONVERSATION_ID_KEY,
                    "",
                ),
            ]);

        const normalizedConversationList = normalizeConversationList(
            savedConversationList ?? [],
        );
        const normalizedActiveConversationId =
            savedActiveConversationId?.trim() ?? "";
        const shouldFlushSanitizedConversationList =
            hasInvalidConversationMessages(savedConversationList ?? []);

        conversationList.value = normalizedConversationList;
        activeConversationId.value = normalizedActiveConversationId;

        if (
            normalizedActiveConversationId &&
            !normalizedConversationList.some((item) => {
                return item.id === normalizedActiveConversationId;
            })
        ) {
            activeConversationId.value = "";
        }

        conversationStateHydrated.value = true;

        if (shouldFlushSanitizedConversationList) {
            flushConversationPersistence("清理无效 AI 消息");
        }
    }

    function getBootstrapMessages(
        previousChat: Chat<IAiChatTransportMessage> | null,
        preserveMessages: boolean,
    ) {
        if (preserveMessages && previousChat?.messages.length) {
            return cloneMessages(
                previousChat.messages as IAiChatUIMessage[],
            ) as IAiChatTransportMessage[];
        }

        const currentConversationMessages = activeConversation.value?.messages;

        if (currentConversationMessages?.length) {
            return cloneMessages(currentConversationMessages);
        }

        return [] as IAiChatTransportMessage[];
    }

    function upsertConversation(
        conversation: IAiChatConversation,
    ): IAiChatConversation {
        const nextList = conversationList.value.filter((item) => {
            return item.id !== conversation.id;
        });

        conversationList.value = normalizeConversationList([
            conversation,
            ...nextList,
        ]);

        return conversation;
    }

    function ensureActiveConversation(files: FileUIPart[] = []) {
        const existingConversation = activeConversation.value;

        if (existingConversation) {
            return existingConversation;
        }

        const nextConversation = createEmptyConversation(
            selectedModelId.value.trim() || undefined,
        );
        const firstUserMessage = messages.value.find((message) => {
            return message.role === "user";
        });
        const firstText = getMessageText(firstUserMessage);

        nextConversation.title =
            firstText || files.length > 0
                ? createConversationTitle(firstText, files)
                : "新会话";
        activeConversationId.value = nextConversation.id;
        const conversation = upsertConversation(nextConversation);

        flushConversationPersistence("创建会话");

        return conversation;
    }

    function persistActiveConversation(
        nextMessages = messages.value,
        options: {
            flushToDisk?: boolean;
        } = {},
    ) {
        const existingConversation = activeConversation.value;

        if (!existingConversation) {
            return;
        }

        const persistedMessages = cloneValidMessages(nextMessages);
        const firstUserMessage = persistedMessages.find((message) => {
            return message.role === "user";
        });
        const firstText = getMessageText(firstUserMessage);
        const firstFiles = getMessageParts(firstUserMessage).filter(isFilePart);
        const shouldGenerateTitle =
            existingConversation.title === "新会话" ||
            !existingConversation.title.trim();

        upsertConversation({
            ...existingConversation,
            title:
                shouldGenerateTitle && (firstText || firstFiles.length > 0)
                    ? createConversationTitle(firstText, firstFiles)
                    : existingConversation.title,
            updatedAt: Date.now(),
            modelId:
                selectedModelId.value.trim() || existingConversation.modelId,
            messages: persistedMessages,
        });

        if (options.flushToDisk) {
            flushConversationPersistence("更新消息历史");
        }
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

            // 选中的模型 ID 是持久化的，换服务商或服务端下线模型后会失效，
            // 继续拿它发请求会被上游报 "Model not exist."，这里回落到第一个可用模型。
            const currentModelId = selectedModelId.value.trim();
            const currentModelAvailable = models.some((model) => {
                return model.id === currentModelId;
            });

            if (!currentModelAvailable && models.length > 0) {
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
            sessionError.value = configurationErrorMessage.value;
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
        const preservedMessages = getBootstrapMessages(
            previousChat,
            preserveMessages,
        );

        // 思考计时只在单次流式响应内有效，随会话重建重置。
        let reasoningStartedAt = 0;

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
                transport: createAttachmentCompatibleTransport(
                    new DirectChatTransport({
                        agent: nextSession.agent,
                        sendReasoning: true,
                        onError: (error) => {
                            return toErrorMessage(error, "AI 对话失败。");
                        },
                        messageMetadata: ({ part }) => {
                            if (part.type === "start") {
                                reasoningStartedAt = 0;

                                return {
                                    createdAt: Date.now(),
                                    modelId,
                                } satisfies IAiChatMessageMetadata;
                            }

                            // 记录思考开始时间，配合 reasoning-end 算出耗时用于展示。
                            if (part.type === "reasoning-start") {
                                reasoningStartedAt = Date.now();

                                return undefined;
                            }

                            if (part.type === "reasoning-end") {
                                if (!reasoningStartedAt) {
                                    return undefined;
                                }

                                const reasoningMs =
                                    Date.now() - reasoningStartedAt;
                                reasoningStartedAt = 0;

                                return {
                                    reasoningMs,
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
                ),
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
        await hydrateConversationState();
        await hydrateAiConfiguration();
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

        const rebuilt = await rebuildSession(options.preserveMessages ?? true);

        if (rebuilt) {
            persistActiveConversation(messages.value, {
                flushToDisk: true,
            });
        }

        return rebuilt;
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

    function getFileCount(files?: FileList | FileUIPart[]) {
        if (!files) {
            return 0;
        }

        return files.length;
    }

    async function sendMessage(text: string, files?: FileList | FileUIPart[]) {
        const normalizedText = text.trim();

        if (!normalizedText && getFileCount(files) === 0) {
            return false;
        }

        if (!chat.value) {
            const ready = await rebuildSession(true);

            if (!ready || !chat.value) {
                throw new Error(sessionError.value || "AI 会话尚未就绪。");
            }
        }

        const fileParts = Array.isArray(files) ? files : [];
        ensureActiveConversation(fileParts);
        sanitizeActiveChatMessages();

        await chat.value.sendMessage({
            text: normalizedText,
            ...(files && getFileCount(files) > 0
                ? {
                      files,
                  }
                : {}),
            metadata: {
                createdAt: Date.now(),
                modelId: selectedModelId.value.trim() || undefined,
            },
        });
        persistActiveConversation();

        return true;
    }

    async function sendText(text: string) {
        await sendMessage(text);
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
        persistActiveConversation([], {
            flushToDisk: true,
        });
    }

    async function createNewConversation() {
        await stopGeneration();

        const nextConversation = upsertConversation(
            createEmptyConversation(selectedModelId.value.trim() || undefined),
        );

        activeConversationId.value = nextConversation.id;

        if (
            !chat.value &&
            hasConfiguration.value &&
            selectedModelId.value.trim()
        ) {
            await rebuildSession(false);
        }

        if (chat.value) {
            chat.value.messages = [];
        }

        sessionError.value = "";
        flushConversationPersistence("创建新会话");

        return nextConversation.id;
    }

    async function switchConversation(conversationId: string) {
        const targetConversation = conversationList.value.find((item) => {
            return item.id === conversationId;
        });

        if (!targetConversation) {
            throw new Error("未找到指定历史会话。");
        }

        await stopGeneration();
        activeConversationId.value = targetConversation.id;

        if (!chat.value) {
            const ready = await rebuildSession(false);

            if (!ready || !chat.value) {
                throw new Error(sessionError.value || "AI 会话尚未就绪。");
            }
        }

        chat.value.messages = cloneMessages(targetConversation.messages);
        sessionError.value = "";
        flushConversationPersistence("切换当前会话");
    }

    async function deleteConversation(conversationId: string) {
        const deletingActive = conversationId === activeConversationId.value;

        if (deletingActive) {
            await stopGeneration();
        }

        conversationList.value = conversationList.value.filter((item) => {
            return item.id !== conversationId;
        });

        if (!deletingActive) {
            return;
        }

        activeConversationId.value = "";

        if (chat.value) {
            chat.value.messages = [];
        }

        flushConversationPersistence("删除会话");
    }

    async function editUserMessage(messageId: string, text: string) {
        const normalizedText = text.trim();

        if (!normalizedText) {
            throw new Error("消息内容不能为空。");
        }

        if (!chat.value) {
            throw new Error("AI 会话尚未就绪。");
        }

        sanitizeActiveChatMessages();

        const targetMessage = messages.value.find((message) => {
            return message.id === messageId;
        });

        if (!targetMessage || targetMessage.role !== "user") {
            throw new Error("只能编辑用户消息。");
        }

        const fileParts = getMessageParts(targetMessage).filter(isFilePart);

        ensureActiveConversation(fileParts);

        await chat.value.sendMessage({
            text: normalizedText,
            files: fileParts,
            messageId,
            metadata: {
                createdAt: Date.now(),
                modelId: selectedModelId.value.trim() || undefined,
            },
        });
        persistActiveConversation();
    }

    async function regenerateMessage(messageId?: string) {
        if (!chat.value) {
            throw new Error("AI 会话尚未就绪。");
        }

        ensureActiveConversation();
        sanitizeActiveChatMessages();
        await chat.value.regenerate({ messageId });
        persistActiveConversation();
    }

    async function disposeSession() {
        clearStreamingConversationSyncTimer();
        await chat.value?.stop().catch(() => undefined);
        await session.value?.dispose().catch(() => undefined);
        chat.value = null;
        session.value = null;
    }

    watch(
        messages,
        (nextMessages) => {
            if (!chat.value) {
                return;
            }

            if (status.value === "streaming") {
                scheduleStreamingConversationSync();
                return;
            }

            persistActiveConversation(nextMessages);
            hasDeferredConversationSync.value = false;
        },
        {
            deep: true,
        },
    );

    // 凭据/地址在设置页改动后，会话需要重建；否则从未配置变为已配置时
    // chat 仍为 null，编辑/重生成会一直报“AI 会话尚未就绪”。
    watch([apiKey, baseUrl], async () => {
        if (!initialized.value) {
            return;
        }

        if (!hasConfiguration.value) {
            await disposeSession();
            sessionError.value = configurationErrorMessage.value;
            return;
        }

        // 换了地址/凭据后旧模型列表和选中项都可能失效，先重新拉取再重建会话。
        await refreshModels();

        if (!selectedModelId.value.trim()) {
            return;
        }

        await rebuildSession(true);
    });

    watch(status, (nextStatus, previousStatus) => {
        if (!chat.value) {
            return;
        }

        if (nextStatus === previousStatus) {
            return;
        }

        if (previousStatus === "streaming") {
            clearStreamingConversationSyncTimer();
        }

        const nextMessagesToPersist =
            nextStatus === "ready" || nextStatus === "error"
                ? sanitizeActiveChatMessages()
                : messages.value;

        if (
            previousStatus === "streaming" &&
            hasDeferredConversationSync.value
        ) {
            persistActiveConversation(nextMessagesToPersist, {
                flushToDisk: true,
            });
            hasDeferredConversationSync.value = false;

            return;
        }

        if (
            nextStatus === "submitted" ||
            nextStatus === "ready" ||
            nextStatus === "error"
        ) {
            persistActiveConversation(nextMessagesToPersist, {
                flushToDisk: true,
            });
        }
    });

    return {
        activeConversation,
        activeConversationId,
        busy,
        chat,
        chatError,
        clearMessages,
        configurationErrorMessage,
        conversationList,
        createNewConversation,
        deleteConversation,
        disposeSession,
        editUserMessage,
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
        sendMessage,
        sendText,
        serverSnapshots,
        session,
        sessionError,
        setMcpServerEnabled,
        startLocalServer,
        status,
        regenerateMessage,
        stopGeneration,
        switchConversation,
        stopLocalServer,
        systemPrompt,
        applySessionConfig,
    };
});
