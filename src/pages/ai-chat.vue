<script setup lang="ts">
import { ElMessage } from "element-plus-message";
import {
    Bot,
    BrainCircuit,
    CheckCircle2,
    ChevronDown,
    Copy,
    FileUp,
    History,
    ImagePlus,
    LoaderCircle,
    Paperclip,
    Pencil,
    Plus,
    RefreshCcw,
    Send,
    Sparkles,
    Square,
    Trash2,
    Wrench,
    X,
} from "lucide-vue-next";
import MarkdownIt from "markdown-it";
import type { FileUIPart } from "ai";
import { storeToRefs } from "pinia";
import {
    type AiChatMcpServerId,
    type IAiChatMcpServerSnapshot,
} from "@/lib/AiChat";
import {
    getBundledAiChatSkills,
    type IAiChatBundledSkill,
} from "@/lib/ai-chat-skills";
import { resolveAiChatAttachmentMediaType } from "../lib/ai-chat-attachments";
import { cn } from "@/lib/utils";
import { useAiChatStore, type IAiChatUIMessage } from "@/stores/ai-chat";

interface IAiChatPendingFile {
    id: string;
    name: string;
    mediaType: string;
    size: number;
    url: string;
}

type IAiChatMessagePart = IAiChatUIMessage["parts"][number];

const store = useAiChatStore();
const router = useRouter();
const {
    activeConversationId,
    busy,
    chatError,
    configurationErrorMessage,
    conversationList,
    hasConfiguration,
    initialized,
    loadingModels,
    localServerBusy,
    localServerEndpoint,
    localServerStatus,
    mcpServerEnabledMap,
    messages,
    modelList,
    modelLoadError,
    refreshingServers,
    selectedModelId,
    serverSnapshots,
    sessionError,
    status,
    systemPrompt,
} = storeToRefs(store);

const markdown = new MarkdownIt({
    breaks: true,
    html: false,
    linkify: true,
    typographer: true,
    highlight: (code, language) => {
        const normalizedLanguage = escapeHtml(language.trim() || "text");

        return `<pre class="ai-code-block" data-language="${normalizedLanguage}"><code class="language-${normalizedLanguage}">${escapeHtml(code)}</code></pre>`;
    },
});

markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
    tokens[index].attrSet("target", "_blank");
    tokens[index].attrSet("rel", "noreferrer");

    return self.renderToken(tokens, index, options);
};

const skillList = getBundledAiChatSkills();

const draft = ref("");
const pendingFiles = ref<IAiChatPendingFile[]>([]);
const imageInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const messagesViewport = ref<HTMLElement | null>(null);
const showToolsDialog = ref(false);
const showSkillsDialog = ref(false);
const editingMessageId = ref("");
const editingText = ref("");

const isGenerating = computed(() => {
    return status.value === "submitted" || status.value === "streaming";
});

const canSend = computed(() => {
    return Boolean(draft.value.trim() || pendingFiles.value.length > 0);
});

const visibleErrorMessage = computed(() => {
    return (
        configurationErrorMessage.value ||
        sessionError.value ||
        modelLoadError.value ||
        chatError.value?.message ||
        ""
    );
});

const modelSelectValue = computed<string>({
    get: () => {
        return selectedModelId.value;
    },
    set: (value) => {
        void applyModel(value);
    },
});

const activeConversation = computed(() => {
    return conversationList.value.find((item) => {
        return item.id === activeConversationId.value;
    });
});

const localServerStatusMeta = computed(() => {
    switch (localServerStatus.value) {
        case "running":
            return {
                icon: CheckCircle2,
                label: "本地 MCP 运行中",
                iconClass: "text-emerald-500",
            };
        case "starting":
        case "stopping":
            return {
                icon: LoaderCircle,
                label: "本地 MCP 切换中",
                iconClass: "text-amber-500 animate-spin",
            };
        default:
            return {
                icon: Square,
                label: "本地 MCP 已停止",
                iconClass: "text-muted-foreground",
            };
    }
});

onMounted(async () => {
    try {
        if (!initialized.value) {
            await store.initialize();
        }

        if (
            activeConversationId.value &&
            messages.value.length === 0 &&
            conversationList.value.some((item) => {
                return item.id === activeConversationId.value;
            })
        ) {
            await store.switchConversation(activeConversationId.value);
        }
    } catch (error: unknown) {
        console.error("初始化 AI 对话失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "初始化 AI 对话失败。"));
    } finally {
        await scrollToBottom();
    }
});

watch(
    () => [messages.value.length, status.value],
    () => {
        void scrollToBottom();
    },
);

async function scrollToBottom() {
    await nextTick();
    const viewport = messagesViewport.value;

    if (!viewport) {
        return;
    }

    viewport.scrollTop = viewport.scrollHeight;
}

function escapeHtml(value: string) {
    return value
        .replace(/&/gu, "&amp;")
        .replace(/</gu, "&lt;")
        .replace(/>/gu, "&gt;")
        .replace(/"/gu, "&quot;")
        .replace(/'/gu, "&#039;");
}

function renderMarkdown(text: string) {
    return markdown.render(text);
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    if (typeof error === "string" && error.trim()) {
        return error;
    }

    return fallbackMessage;
}

function formatFileSize(size: number) {
    if (size < 1024) {
        return `${size} B`;
    }

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(time?: number) {
    if (!time) {
        return "";
    }

    return new Intl.DateTimeFormat("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
    }).format(time);
}

function formatJson(value: unknown) {
    if (value === undefined) {
        return "暂无";
    }

    if (typeof value === "string") {
        return value;
    }

    return JSON.stringify(value, null, 2);
}

async function openAiSettings() {
    await router.push({
        path: "/settings",
        hash: "#ai-config",
    });
}

function isTextPart(part: IAiChatMessagePart) {
    return part.type === "text";
}

function isReasoningPart(part: IAiChatMessagePart) {
    return part.type === "reasoning";
}

function isFilePart(part: IAiChatMessagePart): part is FileUIPart {
    return part.type === "file";
}

function isToolPart(part: IAiChatMessagePart) {
    return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function isImageFilePart(part: IAiChatMessagePart) {
    return isFilePart(part) && part.mediaType.startsWith("image/");
}

function getPartText(part: IAiChatMessagePart) {
    return isTextPart(part) || isReasoningPart(part) ? part.text : "";
}

function getToolName(part: IAiChatMessagePart) {
    if (part.type === "dynamic-tool") {
        return part.toolName;
    }

    return part.type.startsWith("tool-")
        ? part.type.replace(/^tool-/u, "")
        : "";
}

function getToolState(part: IAiChatMessagePart) {
    return "state" in part ? part.state : "unknown";
}

function getToolInput(part: IAiChatMessagePart) {
    return "input" in part ? part.input : undefined;
}

function getToolOutput(part: IAiChatMessagePart) {
    if ("output" in part && part.output !== undefined) {
        return part.output;
    }

    if ("errorText" in part && part.errorText) {
        return part.errorText;
    }

    return undefined;
}

function getMessageMarkdown(message: IAiChatUIMessage) {
    return message.parts
        .filter(isTextPart)
        .map((part) => part.text)
        .join("\n\n")
        .trim();
}

function getMessagePlainText(message: IAiChatUIMessage) {
    return getMessageMarkdown(message);
}

function getMessageFiles(message: IAiChatUIMessage) {
    return message.parts.filter(isFilePart);
}

function resolveModelLabel(modelId?: string) {
    if (!modelId) {
        return "";
    }

    const matchedModel = modelList.value.find((model) => {
        return model.id === modelId;
    });

    return matchedModel?.name || modelId;
}

function getMessageSessionModelLabel(message: IAiChatUIMessage) {
    // 优先展示消息自身记录的模型，其次回退到当前会话保存的模型。
    const modelId =
        message.metadata?.modelId ||
        activeConversation.value?.modelId ||
        selectedModelId.value.trim() ||
        undefined;

    return resolveModelLabel(modelId);
}

function getMessageBubbleClass(message: IAiChatUIMessage) {
    return cn(
        "group max-w-[86%] rounded-2xl border px-4 py-3 shadow-sm transition-colors",
        message.role === "user"
            ? "bg-primary/10 border-primary/20"
            : "bg-card border-border/70",
    );
}

function getServerStatusMeta(server: IAiChatMcpServerSnapshot) {
    switch (server.status) {
        case "ready":
            return {
                label: "可用",
                variant: "default" as const,
            };
        case "error":
            return {
                label: "异常",
                variant: "destructive" as const,
            };
        default:
            return {
                label: "关闭",
                variant: "secondary" as const,
            };
    }
}

async function copyMessage(message: IAiChatUIMessage) {
    try {
        await navigator.clipboard.writeText(getMessageMarkdown(message));
        ElMessage.success("已复制 Markdown 内容。");
    } catch (error: unknown) {
        console.error("复制消息失败");
        console.error(error);
        ElMessage.error("复制消息失败。");
    }
}

function startEditMessage(message: IAiChatUIMessage) {
    editingMessageId.value = message.id;
    editingText.value = getMessagePlainText(message);
}

function cancelEditMessage() {
    editingMessageId.value = "";
    editingText.value = "";
}

async function submitEditMessage(messageId: string) {
    try {
        await store.editUserMessage(messageId, editingText.value);
        cancelEditMessage();
    } catch (error: unknown) {
        console.error("编辑消息失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "编辑消息失败。"));
    }
}

async function regenerateMessage(messageId?: string) {
    try {
        await store.regenerateMessage(messageId);
    } catch (error: unknown) {
        console.error("重新生成失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "重新生成失败。"));
    }
}

async function applyModel(modelId: string) {
    const normalizedModelId = modelId.trim();

    if (!normalizedModelId || normalizedModelId === selectedModelId.value) {
        return;
    }

    try {
        const applied = await store.applySessionConfig({
            modelId: normalizedModelId,
            systemPrompt: systemPrompt.value,
            preserveMessages: true,
        });

        if (applied) {
            ElMessage.success(`已切换模型：${normalizedModelId}`);
        }
    } catch (error: unknown) {
        console.error("切换模型失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "切换模型失败。"));
    }
}

async function refreshModels() {
    try {
        await store.refreshModels();
    } catch (error: unknown) {
        console.error("刷新模型列表失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "刷新模型列表失败。"));
    }
}

async function createNewConversation() {
    try {
        await store.createNewConversation();
        draft.value = "";
        pendingFiles.value = [];
    } catch (error: unknown) {
        console.error("创建新会话失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "创建新会话失败。"));
    }
}

async function switchConversation(conversationId: string) {
    try {
        await store.switchConversation(conversationId);
        await scrollToBottom();
    } catch (error: unknown) {
        console.error("切换历史会话失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "切换历史会话失败。"));
    }
}

async function deleteConversation(conversationId: string) {
    const deletingActive = activeConversationId.value === conversationId;

    try {
        await store.deleteConversation(conversationId);

        if (deletingActive) {
            draft.value = "";
            pendingFiles.value = [];
        }
    } catch (error: unknown) {
        console.error("删除历史会话失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "删除历史会话失败。"));
    }
}

async function readFileAsDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => {
            resolve(String(reader.result ?? ""));
        };
        reader.onerror = () => {
            reject(reader.error ?? new Error("读取文件失败。"));
        };
        reader.readAsDataURL(file);
    });
}

async function addPendingFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
        return;
    }

    try {
        const nextFiles = await Promise.all(
            Array.from(fileList).map(async (file) => {
                return {
                    id: `${Date.now()}-${file.name}-${Math.random()
                        .toString(36)
                        .slice(2, 8)}`,
                    name: file.name,
                    mediaType: resolveAiChatAttachmentMediaType(
                        file.type,
                        file.name,
                    ),
                    size: file.size,
                    url: await readFileAsDataUrl(file),
                } satisfies IAiChatPendingFile;
            }),
        );

        pendingFiles.value = [...pendingFiles.value, ...nextFiles];
    } catch (error: unknown) {
        console.error("读取上传文件失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "读取上传文件失败。"));
    }
}

function removePendingFile(fileId: string) {
    pendingFiles.value = pendingFiles.value.filter((file) => {
        return file.id !== fileId;
    });
}

function triggerImageUpload() {
    imageInput.value?.click();
}

function triggerFileUpload() {
    fileInput.value?.click();
}

function handleFileInput(event: Event) {
    const input = event.target as HTMLInputElement;

    void addPendingFiles(input.files);
    input.value = "";
}

function toFileParts(files: IAiChatPendingFile[]): FileUIPart[] {
    return files.map((file) => {
        return {
            type: "file",
            mediaType: file.mediaType,
            filename: file.name,
            url: file.url,
        };
    });
}

async function submitDraft() {
    if (isGenerating.value) {
        await store.stopGeneration();
        return;
    }

    if (!canSend.value) {
        return;
    }

    try {
        const sent = store.sendMessage(
            draft.value,
            toFileParts(pendingFiles.value),
        );

        if (!sent) {
            return;
        }

        draft.value = "";
        pendingFiles.value = [];
        await scrollToBottom();
    } catch (error: unknown) {
        console.error("发送消息失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "发送消息失败。"));
    }
}

function handleComposerKeydown(event: KeyboardEvent) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        void submitDraft();
    }
}

function applySkill(skill: IAiChatBundledSkill) {
    const skillTriggerText = [`使用「${skill.name}」skill ,`]
        .filter(Boolean)
        .join("\n");

    draft.value = draft.value.trim()
        ? `${draft.value.trim()}\n\n${skillTriggerText}`
        : skillTriggerText;
    showSkillsDialog.value = false;
}

async function setMcpServerEnabled(
    serverId: AiChatMcpServerId,
    enabled: boolean,
) {
    try {
        await store.setMcpServerEnabled(serverId, enabled);
    } catch (error: unknown) {
        console.error("切换 MCP 服务失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "切换 MCP 服务失败。"));
    }
}

async function refreshServers() {
    try {
        await store.refreshServers();
    } catch (error: unknown) {
        console.error("刷新 MCP 服务失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "刷新 MCP 服务失败。"));
    }
}

async function startLocalServer() {
    try {
        await store.startLocalServer();
        ElMessage.success("本地 MCP 服务已启动。");
    } catch (error: unknown) {
        console.error("启动本地 MCP 服务失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "启动本地 MCP 服务失败。"));
    }
}

async function stopLocalServer() {
    try {
        await store.stopLocalServer();
        ElMessage.success("本地 MCP 服务已停止。");
    } catch (error: unknown) {
        console.error("停止本地 MCP 服务失败");
        console.error(error);
        ElMessage.error(getErrorMessage(error, "停止本地 MCP 服务失败。"));
    }
}
</script>

<template>
    <div class="flex h-[calc(100vh-3rem)] min-h-0 flex-col gap-4">
        <Card class="border-border/70 shadow-sm">
            <CardHeader
                class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
            >
                <div class="space-y-2">
                    <CardTitle class="flex items-center gap-2">
                        <Bot class="h-5 w-5" />
                        <span>AI对话</span>
                    </CardTitle>
                    <CardDescription class="flex flex-wrap items-center gap-2">
                        <Button
                            variant="secondary"
                            :disabled="busy || isGenerating"
                            @click="createNewConversation"
                        >
                            <Plus class="h-4 w-4" />
                            新的会话
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger as-child>
                                <Button variant="outline">
                                    <History class="h-4 w-4" />
                                    历史会话
                                    <ChevronDown class="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent class="w-80">
                                <DropdownMenuLabel>历史会话</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <div
                                    v-if="conversationList.length === 0"
                                    class="px-2 py-3 text-sm text-muted-foreground"
                                >
                                    暂无历史会话
                                </div>
                                <DropdownMenuItem
                                    v-for="conversation in conversationList"
                                    :key="conversation.id"
                                    class="flex cursor-pointer items-start justify-between gap-3"
                                    @click="switchConversation(conversation.id)"
                                >
                                    <div class="min-w-0">
                                        <div class="truncate font-medium">
                                            {{ conversation.title }}
                                        </div>
                                        <div
                                            class="truncate text-xs text-muted-foreground"
                                        >
                                            {{ conversation.messages.length }}
                                            条消息 ·
                                            {{
                                                formatTime(
                                                    conversation.updatedAt,
                                                )
                                            }}
                                        </div>
                                    </div>
                                    <div
                                        class="flex shrink-0 items-center gap-2"
                                    >
                                        <Badge
                                            v-if="
                                                conversation.id ===
                                                activeConversationId
                                            "
                                            variant="secondary"
                                        >
                                            当前
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            class="h-7 w-7 text-muted-foreground hover:text-destructive"
                                            aria-label="删除会话"
                                            title="删除会话"
                                            @pointerdown.stop
                                            @click.stop.prevent="
                                                deleteConversation(
                                                    conversation.id,
                                                )
                                            "
                                        >
                                            <Trash2 class="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Button
                            variant="outline"
                            :disabled="loadingModels"
                            @click="refreshModels"
                        >
                            <RefreshCcw
                                :class="
                                    cn(
                                        'h-4 w-4',
                                        loadingModels && 'animate-spin',
                                    )
                                "
                            />
                            刷新模型
                        </Button>

                        <Button
                            variant="outline"
                            @click="showToolsDialog = true"
                        >
                            <Wrench class="h-4 w-4" />
                            启用工具
                        </Button>

                        <Button
                            variant="outline"
                            @click="showSkillsDialog = true"
                        >
                            <Sparkles class="h-4 w-4" />
                            skills
                        </Button>
                    </CardDescription>
                </div>
            </CardHeader>
        </Card>

        <Card class="flex min-h-0 flex-1 flex-col border-border/70 shadow-sm">
            <div
                ref="messagesViewport"
                class="min-h-0 flex-1 space-y-5 overflow-y-auto bg-muted/20 p-4"
            >
                <div
                    v-if="messages.length === 0"
                    class="flex h-full items-center justify-center"
                >
                    <div class="max-w-lg rounded-2xl p-6 text-center shadow-sm">
                        <Bot class="mx-auto h-10 w-10 text-primary" />
                        <h2 class="mt-4 text-lg font-semibold">
                            开始一次 AI 对话
                        </h2>
                        <p class="mt-2 text-sm leading-6 text-muted-foreground">
                            你可以发送文本、图片或文件；文本类附件会作为上下文发送，
                            图片与二进制附件会附带附件说明，避免模型通道报错。
                        </p>
                        <div class="mt-4 flex flex-wrap justify-center gap-2">
                            <Button
                                v-for="skill in skillList.slice(0, 3)"
                                :key="skill.id"
                                variant="outline"
                                size="sm"
                                @click="applySkill(skill)"
                            >
                                <Sparkles class="h-4 w-4" />
                                {{ skill.name }}
                            </Button>
                        </div>
                    </div>
                </div>

                <div
                    v-for="message in messages"
                    :key="message.id"
                    :class="
                        cn(
                            'flex gap-3',
                            message.role === 'user'
                                ? 'justify-end'
                                : 'justify-start',
                        )
                    "
                >
                    <div
                        v-if="message.role !== 'user'"
                        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm"
                    >
                        <Bot class="h-4 w-4 text-primary" />
                    </div>

                    <div :class="getMessageBubbleClass(message)">
                        <div class="mb-2 flex flex-wrap items-center gap-2">
                            <Badge
                                :variant="
                                    message.role === 'user'
                                        ? 'secondary'
                                        : 'outline'
                                "
                            >
                                {{ message.role === "user" ? "你" : "AI" }}
                            </Badge>
                        </div>

                        <div
                            v-if="editingMessageId === message.id"
                            class="space-y-3"
                        >
                            <Textarea
                                v-model="editingText"
                                class="min-h-28 bg-background"
                            />
                            <div class="flex justify-end gap-2">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    @click="cancelEditMessage"
                                >
                                    取消
                                </Button>
                                <Button
                                    size="sm"
                                    :disabled="isGenerating"
                                    @click="submitEditMessage(message.id)"
                                >
                                    保存并重新生成
                                </Button>
                            </div>
                        </div>

                        <div v-else class="space-y-3">
                            <template
                                v-for="(part, index) in message.parts"
                                :key="`${message.id}-${index}`"
                            >
                                <div
                                    v-if="isTextPart(part)"
                                    class="ai-markdown"
                                    v-html="renderMarkdown(getPartText(part))"
                                ></div>

                                <Accordion
                                    v-else-if="isReasoningPart(part)"
                                    type="single"
                                    collapsible
                                    class="rounded-xl border bg-muted/35 px-3"
                                >
                                    <AccordionItem
                                        :value="`reasoning-${message.id}-${index}`"
                                        class="border-0"
                                    >
                                        <AccordionTrigger class="py-2 text-sm">
                                            <span
                                                class="flex items-center gap-2"
                                            >
                                                <BrainCircuit
                                                    class="h-4 w-4 text-primary"
                                                />
                                                深度思考
                                            </span>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div
                                                class="ai-markdown pb-3 text-muted-foreground"
                                                v-html="
                                                    renderMarkdown(
                                                        getPartText(part),
                                                    )
                                                "
                                            ></div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>

                                <div
                                    v-else-if="isToolPart(part)"
                                    class="rounded-xl border border-dashed bg-muted/35 p-3"
                                >
                                    <div
                                        class="flex flex-wrap items-center gap-2"
                                    >
                                        <Badge variant="outline">
                                            <Wrench class="h-3 w-3" />
                                            工具调用
                                        </Badge>
                                        <span class="font-mono text-xs">
                                            {{ getToolName(part) }}
                                        </span>
                                        <Badge variant="secondary">
                                            {{ getToolState(part) }}
                                        </Badge>
                                    </div>

                                    <Accordion
                                        type="single"
                                        collapsible
                                        class="mt-2"
                                    >
                                        <AccordionItem
                                            :value="`tool-${message.id}-${index}`"
                                        >
                                            <AccordionTrigger
                                                class="py-2 text-sm"
                                            >
                                                查看参数与结果
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div
                                                    class="grid gap-3 text-xs md:grid-cols-2"
                                                >
                                                    <div>
                                                        <div
                                                            class="mb-1 text-muted-foreground"
                                                        >
                                                            参数
                                                        </div>
                                                        <pre
                                                            class="overflow-auto rounded-lg bg-background p-3"
                                                            >{{
                                                                formatJson(
                                                                    getToolInput(
                                                                        part,
                                                                    ),
                                                                )
                                                            }}</pre
                                                        >
                                                    </div>
                                                    <div>
                                                        <div
                                                            class="mb-1 text-muted-foreground"
                                                        >
                                                            结果
                                                        </div>
                                                        <pre
                                                            class="overflow-auto rounded-lg bg-background p-3"
                                                            >{{
                                                                formatJson(
                                                                    getToolOutput(
                                                                        part,
                                                                    ),
                                                                )
                                                            }}</pre
                                                        >
                                                    </div>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                </div>

                                <div
                                    v-else-if="isFilePart(part)"
                                    class="rounded-xl border bg-muted/30 p-3"
                                >
                                    <img
                                        v-if="isImageFilePart(part)"
                                        :src="part.url"
                                        :alt="part.filename || 'image'"
                                        class="max-h-72 rounded-lg border object-contain"
                                    />
                                    <div
                                        class="mt-2 flex items-center gap-2 text-sm"
                                    >
                                        <Paperclip
                                            class="h-4 w-4 text-muted-foreground"
                                        />
                                        <span class="truncate">
                                            {{ part.filename || "附件" }}
                                        </span>
                                        <Badge variant="outline">
                                            {{ part.mediaType }}
                                        </Badge>
                                    </div>
                                </div>
                            </template>

                            <div
                                v-if="getMessageFiles(message).length > 0"
                                class="flex flex-wrap gap-2 pt-1"
                            >
                                <Badge
                                    v-for="file in getMessageFiles(message)"
                                    :key="file.url"
                                    variant="secondary"
                                >
                                    <Paperclip class="h-3 w-3" />
                                    {{ file.filename || "附件" }}
                                </Badge>
                            </div>

                            <div
                                class="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3"
                            >
                                <div
                                    class="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                >
                                    <span v-if="message.metadata?.createdAt">
                                        {{
                                            formatTime(
                                                message.metadata?.createdAt,
                                            )
                                        }}
                                    </span>
                                    <span v-if="message.metadata?.totalTokens">
                                        {{ message.metadata.totalTokens }}
                                        tokens
                                    </span>
                                    <template
                                        v-if="
                                            message.role !== 'user' &&
                                            getMessageSessionModelLabel(message)
                                        "
                                    >
                                        <span>本次会话模型</span>
                                        <span
                                            class="max-w-full rounded-full border bg-muted/35 px-2 py-1 text-foreground"
                                        >
                                            {{
                                                getMessageSessionModelLabel(
                                                    message,
                                                )
                                            }}
                                        </span>
                                    </template>
                                </div>

                                <div
                                    :class="
                                        cn(
                                            'flex flex-wrap items-center gap-1',
                                            message.role === 'user' &&
                                                'ml-auto',
                                        )
                                    "
                                >
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 px-2 text-xs"
                                        @click="copyMessage(message)"
                                    >
                                        <Copy class="h-3.5 w-3.5" />
                                        复制
                                    </Button>
                                    <Button
                                        v-if="message.role === 'user'"
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 px-2 text-xs"
                                        :disabled="isGenerating"
                                        @click="startEditMessage(message)"
                                    >
                                        <Pencil class="h-3.5 w-3.5" />
                                        编辑
                                    </Button>
                                    <Button
                                        v-else
                                        variant="ghost"
                                        size="sm"
                                        class="h-8 px-2 text-xs"
                                        :disabled="isGenerating"
                                        @click="regenerateMessage(message.id)"
                                    >
                                        <RefreshCcw class="h-3.5 w-3.5" />
                                        重试
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <Separator />

            <div class="space-y-3 p-4">
                <div
                    v-if="visibleErrorMessage"
                    class="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive md:flex-row md:items-center md:justify-between"
                >
                    <span>{{ visibleErrorMessage || "AI 对话异常。" }}</span>
                    <Button
                        v-if="configurationErrorMessage"
                        variant="outline"
                        size="sm"
                        class="shrink-0 border-destructive/30 bg-background/80 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        @click="openAiSettings"
                    >
                        去配置
                    </Button>
                </div>

                <div
                    v-if="pendingFiles.length > 0"
                    class="flex flex-wrap gap-2"
                >
                    <div
                        v-for="file in pendingFiles"
                        :key="file.id"
                        class="flex max-w-72 items-center gap-2 rounded-full border bg-muted/35 px-3 py-1.5 text-xs"
                    >
                        <ImagePlus
                            v-if="file.mediaType.startsWith('image/')"
                            class="h-3.5 w-3.5"
                        />
                        <FileUp v-else class="h-3.5 w-3.5" />
                        <span class="truncate">{{ file.name }}</span>
                        <span class="text-muted-foreground">
                            {{ formatFileSize(file.size) }}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon"
                            class="h-5 w-5"
                            @click="removePendingFile(file.id)"
                        >
                            <X class="h-3 w-3" />
                        </Button>
                    </div>
                </div>

                <p
                    v-if="pendingFiles.length > 0"
                    class="text-xs text-muted-foreground"
                >
                    文本类附件会读取内容；图片和二进制文件会以附件说明形式随消息发送。
                </p>

                <InputGroup class="overflow-hidden">
                    <InputGroupTextarea
                        v-model="draft"
                        class="min-h-24"
                        placeholder="输入消息，支持 Markdown。Ctrl + Enter 发送。"
                        :disabled="!hasConfiguration"
                        @keydown="handleComposerKeydown"
                    />
                    <InputGroupAddon
                        data-align="block-end"
                        class="flex w-full flex-wrap items-center justify-between gap-2 border-t px-3 py-2"
                    >
                        <div class="flex flex-wrap items-center gap-1">
                            <input
                                ref="imageInput"
                                type="file"
                                accept="image/*"
                                multiple
                                class="hidden"
                                @change="handleFileInput"
                            />
                            <input
                                ref="fileInput"
                                type="file"
                                multiple
                                class="hidden"
                                @change="handleFileInput"
                            />
                            <Button
                                variant="ghost"
                                size="sm"
                                :disabled="!hasConfiguration"
                                @click="triggerImageUpload"
                            >
                                <ImagePlus class="h-4 w-4" />
                                图片
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                :disabled="!hasConfiguration"
                                @click="triggerFileUpload"
                            >
                                <FileUp class="h-4 w-4" />
                                文件
                            </Button>
                            <Select v-model="modelSelectValue">
                                <SelectTrigger class="h-8 w-44">
                                    <SelectValue placeholder="切换模型" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="model in modelList"
                                        :key="model.id"
                                        :value="model.id"
                                    >
                                        {{ model.name }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            :variant="isGenerating ? 'secondary' : 'default'"
                            :disabled="
                                !hasConfiguration || (!isGenerating && !canSend)
                            "
                            @click="submitDraft"
                        >
                            <LoaderCircle
                                v-if="isGenerating"
                                class="h-4 w-4 animate-spin"
                            />
                            <Send v-else class="h-4 w-4" />
                            {{ isGenerating ? "停止" : "发送" }}
                        </Button>
                    </InputGroupAddon>
                </InputGroup>
            </div>
        </Card>

        <Dialog v-model:open="showToolsDialog" modal>
            <DialogScrollContent class="sm:max-w-5xl">
                <DialogHeader>
                    <DialogTitle class="flex items-center gap-2">
                        <Wrench class="h-5 w-5" />
                        启用工具
                    </DialogTitle>
                    <DialogDescription>
                        管理 AI 会话可访问的 MCP 服务、工具、资源和
                        Prompt。修改后会自动重建当前会话。
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-4">
                    <div
                        class="flex flex-col gap-3 rounded-xl border bg-muted/35 p-4 md:flex-row md:items-center md:justify-between"
                    >
                        <div class="space-y-1">
                            <div class="flex items-center gap-2 font-medium">
                                <component
                                    :is="localServerStatusMeta.icon"
                                    :class="
                                        cn(
                                            'h-4 w-4',
                                            localServerStatusMeta.iconClass,
                                        )
                                    "
                                />
                                {{ localServerStatusMeta.label }}
                            </div>
                            <div
                                class="break-all text-sm text-muted-foreground"
                            >
                                {{ localServerEndpoint }}
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                :disabled="refreshingServers"
                                @click="refreshServers"
                            >
                                <RefreshCcw
                                    :class="
                                        cn(
                                            'h-4 w-4',
                                            refreshingServers && 'animate-spin',
                                        )
                                    "
                                />
                                刷新
                            </Button>
                            <Button
                                v-if="localServerStatus !== 'running'"
                                :disabled="localServerBusy"
                                @click="startLocalServer"
                            >
                                启动本地 MCP
                            </Button>
                            <Button
                                v-else
                                variant="secondary"
                                :disabled="localServerBusy"
                                @click="stopLocalServer"
                            >
                                停止本地 MCP
                            </Button>
                        </div>
                    </div>

                    <Accordion type="multiple" class="grid gap-3">
                        <AccordionItem
                            v-for="server in serverSnapshots"
                            :key="server.id"
                            :value="`server-${server.id}`"
                            class="overflow-hidden rounded-xl border"
                        >
                            <div
                                class="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between"
                            >
                                <AccordionTrigger
                                    class="min-w-0 flex-1 py-0 text-left hover:no-underline"
                                >
                                    <div class="min-w-0 space-y-2">
                                        <div
                                            class="flex flex-wrap items-center gap-2"
                                        >
                                            <h3 class="font-medium">
                                                {{ server.label }}
                                            </h3>
                                            <Badge
                                                :variant="
                                                    getServerStatusMeta(server)
                                                        .variant
                                                "
                                            >
                                                {{
                                                    getServerStatusMeta(server)
                                                        .label
                                                }}
                                            </Badge>
                                        </div>

                                        <p
                                            class="break-all font-mono text-xs text-muted-foreground"
                                        >
                                            {{ server.endpoint }}
                                        </p>
                                    </div>
                                </AccordionTrigger>

                                <div class="flex items-center gap-2 md:pl-4">
                                    <Label :for="`server-${server.id}`">
                                        启用
                                    </Label>
                                    <Switch
                                        :id="`server-${server.id}`"
                                        :model-value="
                                            mcpServerEnabledMap[server.id]
                                        "
                                        :disabled="busy"
                                        @update:model-value="
                                            setMcpServerEnabled(
                                                server.id,
                                                $event,
                                            )
                                        "
                                    />
                                </div>
                            </div>

                            <AccordionContent class="px-4 pb-4">
                                <div
                                    v-if="server.error"
                                    class="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                                >
                                    {{ server.error }}
                                </div>

                                <div
                                    v-if="server.warnings.length > 0"
                                    class="mt-3 space-y-1 rounded-lg border bg-muted/35 px-3 py-2 text-sm text-muted-foreground"
                                >
                                    <div
                                        v-for="warning in server.warnings"
                                        :key="warning"
                                    >
                                        {{ warning }}
                                    </div>
                                </div>

                                <Accordion
                                    type="multiple"
                                    class="mt-4 flex flex-col gap-4"
                                >
                                    <AccordionItem
                                        :value="`server-${server.id}-tools`"
                                        class="rounded-lg border bg-muted/20 px-3"
                                    >
                                        <AccordionTrigger
                                            class="py-3 font-medium hover:no-underline"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span>Tools</span>
                                                <Badge variant="secondary">
                                                    {{ server.tools.length }}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div
                                                class="max-h-36 space-y-2 overflow-auto pb-3 text-sm"
                                            >
                                                <div
                                                    v-for="tool in server.tools"
                                                    :key="tool.name"
                                                    class="rounded-md bg-background px-2 py-1"
                                                >
                                                    <div
                                                        class="font-mono text-xs"
                                                    >
                                                        {{ tool.name }}
                                                    </div>
                                                    <div
                                                        v-if="tool.description"
                                                        class="mt-1 line-clamp-2 text-xs text-muted-foreground"
                                                    >
                                                        {{ tool.description }}
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="
                                                        server.tools.length ===
                                                        0
                                                    "
                                                    class="text-muted-foreground"
                                                >
                                                    暂无
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>

                                    <AccordionItem
                                        :value="`server-${server.id}-resources`"
                                        class="rounded-lg border bg-muted/20 px-3"
                                    >
                                        <AccordionTrigger
                                            class="py-3 font-medium hover:no-underline"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span>Resources</span>
                                                <Badge variant="secondary">
                                                    {{
                                                        server.resources.length
                                                    }}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div
                                                class="max-h-36 space-y-2 overflow-auto pb-3 text-sm"
                                            >
                                                <div
                                                    v-for="resource in server.resources"
                                                    :key="resource.uri"
                                                    class="rounded-md bg-background px-2 py-1"
                                                >
                                                    <div
                                                        class="truncate text-xs"
                                                    >
                                                        {{
                                                            resource.title ||
                                                            resource.name
                                                        }}
                                                    </div>
                                                    <div
                                                        class="truncate font-mono text-xs text-muted-foreground"
                                                    >
                                                        {{ resource.uri }}
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="
                                                        server.resources
                                                            .length === 0
                                                    "
                                                    class="text-muted-foreground"
                                                >
                                                    暂无
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>

                                    <AccordionItem
                                        :value="`server-${server.id}-prompts`"
                                        class="rounded-lg border bg-muted/20 px-3"
                                    >
                                        <AccordionTrigger
                                            class="py-3 font-medium hover:no-underline"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span>Prompts</span>
                                                <Badge variant="secondary">
                                                    {{ server.prompts.length }}
                                                </Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <div
                                                class="max-h-36 space-y-2 overflow-auto pb-3 text-sm"
                                            >
                                                <div
                                                    v-for="prompt in server.prompts"
                                                    :key="prompt.name"
                                                    class="rounded-md bg-background px-2 py-1"
                                                >
                                                    <div
                                                        class="font-mono text-xs"
                                                    >
                                                        {{ prompt.name }}
                                                    </div>
                                                    <div
                                                        v-if="
                                                            prompt.description
                                                        "
                                                        class="mt-1 line-clamp-2 text-xs text-muted-foreground"
                                                    >
                                                        {{ prompt.description }}
                                                    </div>
                                                </div>
                                                <div
                                                    v-if="
                                                        server.prompts
                                                            .length === 0
                                                    "
                                                    class="text-muted-foreground"
                                                >
                                                    暂无
                                                </div>
                                            </div>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
            </DialogScrollContent>
        </Dialog>

        <Dialog v-model:open="showSkillsDialog" modal>
            <DialogScrollContent class="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle class="flex items-center gap-2">
                        <Sparkles class="h-5 w-5" />
                        Skills
                    </DialogTitle>
                    <DialogDescription>
                        这里是 Gloss Mod Manager 提供的内置 skills.
                    </DialogDescription>
                </DialogHeader>

                <div v-if="skillList.length > 0" class="flex flex-wrap gap-3">
                    <div
                        v-for="skill in skillList"
                        :key="skill.id"
                        class="rounded-xl border p-4 text-left transition-colors hover:bg-muted/50"
                        @click="applySkill(skill)"
                    >
                        <div class="flex items-center gap-2 font-medium">
                            <Sparkles class="h-4 w-4 text-primary" />
                            {{ skill.name }}
                        </div>
                        <p class="mt-2 text-sm leading-6 text-muted-foreground">
                            {{ skill.description }}
                        </p>
                        <p
                            v-if="skill.argumentHint"
                            class="mt-2 text-xs leading-5 text-muted-foreground"
                        >
                            建议补充：{{ skill.argumentHint }}
                        </p>
                    </div>
                </div>
                <div
                    v-else
                    class="rounded-xl border border-dashed p-6 text-sm text-muted-foreground"
                >
                    当前未发现可用 skills。
                </div>
            </DialogScrollContent>
        </Dialog>
    </div>
</template>

<style scoped>
.ai-markdown {
    overflow-wrap: anywhere;
}

:deep(.ai-markdown > :first-child) {
    margin-top: 0;
}

:deep(.ai-markdown > :last-child) {
    margin-bottom: 0;
}

:deep(.ai-markdown p) {
    margin: 0.55rem 0;
    line-height: 1.75;
}

:deep(.ai-markdown ul),
:deep(.ai-markdown ol) {
    margin: 0.6rem 0;
    padding-left: 1.25rem;
}

:deep(.ai-markdown li) {
    margin: 0.25rem 0;
}

:deep(.ai-markdown blockquote) {
    margin: 0.75rem 0;
    border-left: 3px solid hsl(var(--border));
    padding-left: 0.75rem;
    color: hsl(var(--muted-foreground));
}

:deep(.ai-markdown table) {
    display: block;
    width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    font-size: 0.875rem;
}

:deep(.ai-markdown th),
:deep(.ai-markdown td) {
    border: 1px solid hsl(var(--border));
    padding: 0.45rem 0.65rem;
}

:deep(.ai-markdown th) {
    background: hsl(var(--muted) / 0.55);
    font-weight: 600;
}

:deep(.ai-markdown :not(pre) > code) {
    border-radius: 0.35rem;
    background: hsl(var(--muted));
    padding: 0.1rem 0.35rem;
    font-size: 0.85em;
}

:deep(.ai-code-block) {
    position: relative;
    margin: 0.85rem 0;
    overflow-x: auto;
    border-radius: 0.75rem;
    background: #0f172a;
    padding: 2.25rem 1rem 1rem;
    color: #e2e8f0;
    font-size: 0.83rem;
    line-height: 1.65;
}

:deep(.ai-code-block::before) {
    content: attr(data-language);
    position: absolute;
    left: 0.75rem;
    top: 0.55rem;
    color: #94a3b8;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 0.75rem;
}

:deep(.ai-code-block code) {
    background: transparent;
    color: inherit;
}
</style>
