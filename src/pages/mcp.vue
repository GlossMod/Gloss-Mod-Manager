<script setup lang="ts">
import { storeToRefs } from "pinia";
import { ElMessage } from "element-plus-message";
import {
    Bot,
    CheckCircle2,
    CircleAlert,
    Copy,
    ExternalLink,
    LoaderCircle,
    Square,
} from "lucide-vue-next";
import {
    McpService,
    mcpPromptDefinitions,
    mcpResourceDefinitions,
    mcpToolDefinitions,
} from "@/lib/mcp-service";
import { useSettings } from "@/stores/settings";

void McpService.initialize();

const settings = useSettings();
const {
    mcpPromptsEnabled,
    mcpPromptItemEnabledMap,
    mcpResourcesEnabled,
    mcpResourceItemEnabledMap,
    mcpToolsEnabled,
    mcpToolItemEnabledMap,
} = storeToRefs(settings);

const endpoint = McpService.endpoint;
const authToken = McpService.authToken;
const isBusy = McpService.isBusy;
const serverStatus = McpService.serverStatus;

const showConfigDialog = ref(false);
const showToolsDialog = ref(false);
const showResourcesDialog = ref(false);
const showPromptsDialog = ref(false);

const portModel = computed<number>({
    get: () => McpService.port.value,
    set: (value) => {
        if (!Number.isFinite(value)) {
            return;
        }

        try {
            McpService.setPort(value);
        } catch {
            // 输入过程中的临时无效值不需要额外提示，提交时会再校验。
        }
    },
});

const enabledModel = computed<boolean>({
    get: () => {
        return (
            serverStatus.value === "running" ||
            serverStatus.value === "starting"
        );
    },
    set: async (enabled) => {
        try {
            if (enabled) {
                await McpService.start();
                ElMessage.success("MCP 服务已启动。");
                return;
            }

            await McpService.stop();
            ElMessage.success("MCP 服务已停止。");
        } catch (error: unknown) {
            console.error("切换 MCP 服务失败");
            console.error(error);
            ElMessage.error(
                error instanceof Error ? error.message : "切换 MCP 服务失败。",
            );
        }
    },
});

const statusMeta = computed(() => {
    switch (serverStatus.value) {
        case "running":
            return {
                icon: CheckCircle2,
                iconClass: "text-emerald-500",
                label: "服务器运行中",
            };
        case "starting":
            return {
                icon: LoaderCircle,
                iconClass: "text-amber-500 animate-spin",
                label: "服务器启动中",
            };
        case "stopping":
            return {
                icon: LoaderCircle,
                iconClass: "text-amber-500 animate-spin",
                label: "服务器停止中",
            };
        default:
            return {
                icon: Square,
                iconClass: "text-muted-foreground",
                label: "服务器已停止",
            };
    }
});

function countEnabledItems(
    items: string[],
    enabledMap: Record<string, boolean>,
) {
    return items.filter((item) => enabledMap[item] !== false).length;
}

function isToolItemEnabled(name: string) {
    return mcpToolItemEnabledMap.value[name] !== false;
}

function setToolItemEnabled(name: string, enabled: boolean) {
    mcpToolItemEnabledMap.value = {
        ...mcpToolItemEnabledMap.value,
        [name]: enabled,
    };
}

function isResourceItemEnabled(uri: string) {
    return mcpResourceItemEnabledMap.value[uri] !== false;
}

function setResourceItemEnabled(uri: string, enabled: boolean) {
    mcpResourceItemEnabledMap.value = {
        ...mcpResourceItemEnabledMap.value,
        [uri]: enabled,
    };
}

function isPromptItemEnabled(name: string) {
    return mcpPromptItemEnabledMap.value[name] !== false;
}

function setPromptItemEnabled(name: string, enabled: boolean) {
    mcpPromptItemEnabledMap.value = {
        ...mcpPromptItemEnabledMap.value,
        [name]: enabled,
    };
}

const enabledToolCount = computed(() => {
    return countEnabledItems(
        mcpToolDefinitions.map((item) => item.name),
        mcpToolItemEnabledMap.value,
    );
});

const enabledResourceCount = computed(() => {
    return countEnabledItems(
        mcpResourceDefinitions.map((item) => item.uri),
        mcpResourceItemEnabledMap.value,
    );
});

const enabledPromptCount = computed(() => {
    return countEnabledItems(
        mcpPromptDefinitions.map((item) => item.name),
        mcpPromptItemEnabledMap.value,
    );
});

const toolsSummary = computed(() => {
    return mcpToolsEnabled.value
        ? `已启用 · ${enabledToolCount.value}/${mcpToolDefinitions.length} 项`
        : `总开关已关闭 · 已勾选 ${enabledToolCount.value}/${mcpToolDefinitions.length} 项`;
});

const resourcesSummary = computed(() => {
    return mcpResourcesEnabled.value
        ? `已启用 · ${enabledResourceCount.value}/${mcpResourceDefinitions.length} 项`
        : `总开关已关闭 · 已勾选 ${enabledResourceCount.value}/${mcpResourceDefinitions.length} 项`;
});

const promptsSummary = computed(() => {
    return mcpPromptsEnabled.value
        ? `已启用 · ${enabledPromptCount.value}/${mcpPromptDefinitions.length} 项`
        : `总开关已关闭 · 已勾选 ${enabledPromptCount.value}/${mcpPromptDefinitions.length} 项`;
});

const vscodeConfig = computed(() => {
    return JSON.stringify(
        {
            servers: {
                "gloss-mod-manager": {
                    type: "http",
                    url: endpoint.value,
                    // 令牌每次启动服务时重新生成，重启后需重新复制配置。
                    headers: {
                        Authorization: `Bearer ${authToken.value || "<启动服务后获取令牌>"}`,
                    },
                },
            },
        },
        null,
        4,
    );
});

async function copyAuthToken() {
    if (!authToken.value) {
        ElMessage.warning("请先启动 MCP 服务以生成访问令牌。");
        return;
    }

    try {
        await navigator.clipboard.writeText(authToken.value);
        ElMessage.success("已复制访问令牌。");
    } catch (error: unknown) {
        console.error("复制访问令牌失败");
        console.error(error);
        ElMessage.error("复制访问令牌失败。");
    }
}

async function copyVscodeConfig() {
    try {
        await navigator.clipboard.writeText(vscodeConfig.value);
        ElMessage.success("已复制 VS Code MCP 配置。");
    } catch (error: unknown) {
        console.error("复制 MCP 配置失败");
        console.error(error);
        ElMessage.error("复制 MCP 配置失败。");
    }
}
</script>

<template>
    <div class="flex flex-col gap-6">
        <Card>
            <CardHeader
                class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
            >
                <div class="space-y-2">
                    <CardTitle class="flex items-center gap-2">
                        <Bot class="h-5 w-5" />
                        <span>MCP 服务</span>
                    </CardTitle>
                    <CardDescription class="max-w-3xl leading-6">
                        在本机启动一个 MCP HTTP 端点，让 VS Code、Copilot MCP
                        或其他兼容客户端可以直接读取 Gloss Mod Manager
                        的游戏、Mod 与文件操作能力。
                    </CardDescription>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <Badge
                        variant="outline"
                        class="gap-2 rounded-full px-3 py-1"
                    >
                        <component
                            :is="statusMeta.icon"
                            :class="['h-4 w-4', statusMeta.iconClass]"
                        />
                        {{ statusMeta.label }}
                    </Badge>
                    <div class="flex items-center gap-2">
                        <Label for="mcp-enabled">启用服务</Label>
                        <Switch
                            id="mcp-enabled"
                            v-model="enabledModel"
                            :disabled="isBusy"
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent class="flex flex-col gap-4">
                <div class="flex flex-wrap gap-3">
                    <Button
                        variant="secondary"
                        @click="showConfigDialog = true"
                    >
                        配置
                    </Button>
                    <Button variant="outline" @click="showToolsDialog = true">
                        Tools
                    </Button>
                    <Button
                        variant="outline"
                        @click="showResourcesDialog = true"
                    >
                        Resources
                    </Button>
                    <Button variant="outline" @click="showPromptsDialog = true">
                        Prompts
                    </Button>
                </div>

                <div class="grid gap-3 sm:grid-cols-3">
                    <div class="rounded-xl border p-4">
                        <div class="text-sm text-muted-foreground">Tools</div>
                        <div class="mt-2 text-sm font-medium">
                            {{ toolsSummary }}
                        </div>
                    </div>
                    <div class="rounded-xl border p-4">
                        <div class="text-sm text-muted-foreground">
                            Resources
                        </div>
                        <div class="mt-2 text-sm font-medium">
                            {{ resourcesSummary }}
                        </div>
                    </div>
                    <div class="rounded-xl border p-4">
                        <div class="text-sm text-muted-foreground">Prompts</div>
                        <div class="mt-2 text-sm font-medium">
                            {{ promptsSummary }}
                        </div>
                    </div>
                </div>

                <div
                    class="rounded-xl border bg-muted/35 p-4 text-sm leading-6"
                >
                    <div class="flex items-start gap-3">
                        <CircleAlert
                            class="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
                        />
                        <div class="space-y-1 text-muted-foreground">
                            <p>
                                服务仅监听本机
                                <code
                                    class="rounded bg-background px-1.5 py-0.5"
                                >
                                    127.0.0.1
                                </code>
                                ，运行中无法修改端口。
                            </p>
                            <p>
                                Tools、Resources、Prompts 的开关会立即持久化，
                                后续 MCP 握手和能力列表会按当前设置返回。
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <h2>相关视频</h2>
            </CardHeader>
            <CardContent>
                <div class="w-87 rounded-xl border-rounded-l overflow-hidden">
                    <a
                        href="https://www.bilibili.com/video/BV13K1YBtE6e/"
                        target="_blank"
                    >
                        <img
                            src="https://assets-mod.3dmgame.com/static/upload/mod/202511/MOD690873f6cb561.png@webp"
                            class="video-img"
                        />
                    </a>
                </div>
            </CardContent>
        </Card>

        <Dialog v-model:open="showConfigDialog" modal>
            <DialogContent class="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>配置</DialogTitle>
                    <DialogDescription>
                        管理本地 MCP 端口、连接地址和客户端接入配置。
                    </DialogDescription>
                </DialogHeader>

                <div class="grid gap-6">
                    <div class="grid gap-4 md:grid-cols-2">
                        <div class="space-y-2">
                            <Label for="mcp-port">端口号</Label>
                            <Input
                                id="mcp-port"
                                v-model.number="portModel"
                                type="number"
                                min="1"
                                max="65535"
                                :disabled="enabledModel || isBusy"
                            />
                        </div>
                        <div class="space-y-2">
                            <Label for="mcp-endpoint">MCP 地址</Label>
                            <Input
                                id="mcp-endpoint"
                                :model-value="endpoint"
                                readonly
                            />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <Label for="mcp-auth-token">访问令牌</Label>
                        <div class="flex gap-2">
                            <Input
                                id="mcp-auth-token"
                                :model-value="
                                    authToken || '启动服务后自动生成'
                                "
                                readonly
                            />
                            <Button
                                variant="outline"
                                :disabled="!authToken"
                                @click="copyAuthToken"
                            >
                                <Copy class="h-4 w-4" />
                                复制
                            </Button>
                        </div>
                        <p class="text-xs text-muted-foreground">
                            MCP 服务仅监听本机，并要求请求携带此令牌（Authorization:
                            Bearer）。令牌在每次启动服务时重新生成，请勿外泄。
                        </p>
                    </div>

                    <div class="flex flex-wrap gap-3">
                        <Button as-child variant="secondary">
                            <a
                                href="https://gmm.aoe.top/MCP.html"
                                target="_blank"
                                rel="noreferrer"
                            >
                                配置教程
                                <ExternalLink class="h-4 w-4" />
                            </a>
                        </Button>
                        <Button as-child variant="outline">
                            <a
                                href="https://www.bilibili.com/video/BV13K1YBtE6e/"
                                target="_blank"
                                rel="noreferrer"
                            >
                                相关视频
                                <ExternalLink class="h-4 w-4" />
                            </a>
                        </Button>
                        <Button variant="outline" @click="copyVscodeConfig">
                            <Copy class="h-4 w-4" />
                            复制 VS Code 配置
                        </Button>
                    </div>

                    <div class="space-y-2">
                        <Label>VS Code MCP 配置</Label>
                        <pre
                            class="overflow-x-auto rounded-xl border bg-muted/35 p-4 text-xs leading-6"
                        ><code>{{ vscodeConfig }}</code></pre>
                    </div>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog v-model:open="showToolsDialog" modal>
            <DialogScrollContent class="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>可用 Tools</DialogTitle>
                    <DialogDescription>
                        总开关控制整个 Tool 能力，下面的单项开关用于精确控制每个
                        Tool。
                    </DialogDescription>
                </DialogHeader>

                <div
                    class="flex items-center justify-between rounded-xl border bg-muted/35 px-4 py-3"
                >
                    <div>
                        <div class="font-medium">Tools 开关</div>
                        <div class="text-sm text-muted-foreground">
                            {{ toolsSummary }}
                        </div>
                    </div>
                    <Switch v-model="mcpToolsEnabled" />
                </div>

                <div class="grid gap-3 pt-4">
                    <div
                        v-for="item in mcpToolDefinitions"
                        :key="item.name"
                        class="rounded-xl border p-3"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0 space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-medium">{{
                                        item.name
                                    }}</span>
                                    <Badge variant="secondary">{{
                                        item.title
                                    }}</Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">
                                    {{
                                        isToolItemEnabled(item.name)
                                            ? "已启用"
                                            : "已关闭"
                                    }}
                                </p>
                            </div>
                            <Switch
                                :model-value="isToolItemEnabled(item.name)"
                                @update:model-value="
                                    setToolItemEnabled(item.name, $event)
                                "
                            />
                        </div>
                        <p class="mt-2 text-sm text-muted-foreground">
                            {{ item.description }}
                        </p>
                    </div>
                </div>
            </DialogScrollContent>
        </Dialog>

        <Dialog v-model:open="showResourcesDialog" modal>
            <DialogScrollContent class="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>可用 Resources</DialogTitle>
                    <DialogDescription>
                        总开关控制整个 Resource
                        能力，下面的单项开关用于精确控制每个 Resource。
                    </DialogDescription>
                </DialogHeader>

                <div
                    class="flex items-center justify-between rounded-xl border bg-muted/35 px-4 py-3"
                >
                    <div>
                        <div class="font-medium">Resources 开关</div>
                        <div class="text-sm text-muted-foreground">
                            {{ resourcesSummary }}
                        </div>
                    </div>
                    <Switch v-model="mcpResourcesEnabled" />
                </div>

                <div class="grid gap-3 pt-4">
                    <div
                        v-for="item in mcpResourceDefinitions"
                        :key="item.uri"
                        class="rounded-xl border p-3"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0 space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-medium">{{
                                        item.uri
                                    }}</span>
                                    <Badge variant="outline">{{
                                        item.title
                                    }}</Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">
                                    {{
                                        isResourceItemEnabled(item.uri)
                                            ? "已启用"
                                            : "已关闭"
                                    }}
                                </p>
                            </div>
                            <Switch
                                :model-value="isResourceItemEnabled(item.uri)"
                                @update:model-value="
                                    setResourceItemEnabled(item.uri, $event)
                                "
                            />
                        </div>
                        <p class="mt-2 text-sm text-muted-foreground">
                            {{ item.description }}
                        </p>
                    </div>
                </div>
            </DialogScrollContent>
        </Dialog>

        <Dialog v-model:open="showPromptsDialog" modal>
            <DialogScrollContent class="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>可用 Prompts</DialogTitle>
                    <DialogDescription>
                        总开关控制整个 Prompt
                        能力，下面的单项开关用于精确控制每个 Prompt。
                    </DialogDescription>
                </DialogHeader>

                <div
                    class="flex items-center justify-between rounded-xl border bg-muted/35 px-4 py-3"
                >
                    <div>
                        <div class="font-medium">Prompts 开关</div>
                        <div class="text-sm text-muted-foreground">
                            {{ promptsSummary }}
                        </div>
                    </div>
                    <Switch v-model="mcpPromptsEnabled" />
                </div>

                <div class="grid gap-3 pt-4">
                    <div
                        v-for="item in mcpPromptDefinitions"
                        :key="item.name"
                        class="rounded-xl border p-3"
                    >
                        <div class="flex items-center justify-between gap-3">
                            <div class="min-w-0 space-y-1">
                                <div class="flex flex-wrap items-center gap-2">
                                    <span class="font-medium">{{
                                        item.name
                                    }}</span>
                                    <Badge variant="outline">{{
                                        item.title
                                    }}</Badge>
                                </div>
                                <p class="text-xs text-muted-foreground">
                                    {{
                                        isPromptItemEnabled(item.name)
                                            ? "已启用"
                                            : "已关闭"
                                    }}
                                </p>
                            </div>
                            <Switch
                                :model-value="isPromptItemEnabled(item.name)"
                                @update:model-value="
                                    setPromptItemEnabled(item.name, $event)
                                "
                            />
                        </div>
                        <p class="mt-2 text-sm text-muted-foreground">
                            {{ item.description }}
                        </p>
                    </div>
                </div>
            </DialogScrollContent>
        </Dialog>
    </div>
</template>

<style scoped></style>
