<script setup lang="ts">
import { fetch as httpFetch } from "@tauri-apps/plugin-http";
import MarkdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { ElMessage } from "element-plus-message";
import {
    hasGlossMultipleResources,
    queueGlossModDownloadWithSelection,
} from "@/lib/download-file-selection";

const GLOSS_MOD_API_BASE_URL = "https://mod.3dmgame.com/api/v3";
const GLOSS_MOD_WEB_BASE_URL = "https://mod.3dmgame.com";
const GLOSS_MOD_KEY = (import.meta.env.GLOSS_MOD_KEY ?? "").trim();
const EMPTY_POSTER =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
			<defs>
				<linearGradient id="detail-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#1d1814" />
					<stop offset="55%" stop-color="#87521e" />
					<stop offset="100%" stop-color="#f5cf92" />
				</linearGradient>
			</defs>
			<rect width="960" height="540" rx="32" fill="url(#detail-gradient)" />
			<circle cx="170" cy="110" r="110" fill="rgba(255,255,255,0.10)" />
			<circle cx="820" cy="410" r="130" fill="rgba(255,255,255,0.08)" />
			<text x="64" y="300" fill="#fff5df" font-size="52" font-family="Arial, sans-serif">Gloss Mod Detail</text>
			<text x="64" y="350" fill="#ffe0a3" font-size="26" font-family="Arial, sans-serif">暂无可用封面</text>
		</svg>
	`);
const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
});

interface IGlossApiResponse<T> {
    success: boolean;
    msg: string;
    data: T | null;
}

const route = useRoute();
const router = useRouter();
const manager = useManager();

const modDetail = ref<IMod | null>(null);
const loading = ref(false);
const errorMessage = ref("");
const queueingResourceKey = ref("");

let requestSequence = 0;

const markdownParser = new MarkdownIt({
    html: true,
    breaks: true,
    linkify: true,
    typographer: true,
}).use(markdownItAnchor, {
    level: [1, 2, 3],
});

const defaultLinkRender =
    markdownParser.renderer.rules.link_open ??
    ((tokens, index, options, _environment, self) =>
        self.renderToken(tokens, index, options));

markdownParser.renderer.rules.link_open = (
    tokens,
    index,
    options,
    environment,
    self,
) => {
    const token = tokens[index];

    if (token.attrIndex("target") < 0) {
        token.attrPush(["target", "_blank"]);
    }

    if (token.attrIndex("rel") < 0) {
        token.attrPush(["rel", "noopener noreferrer"]);
    }

    return defaultLinkRender(tokens, index, options, environment, self);
};

const routeModId = computed(() => {
    const { params } = route;

    if (!("id" in params)) {
        return "";
    }

    const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
    const normalized = String(rawId ?? "").trim();

    return /^\d+$/u.test(normalized) ? normalized : "";
});

const latestResource = computed(
    () =>
        modDetail.value?.mods_resource.find(
            (resource) => resource.mods_resource_latest_version,
        ) ??
        modDetail.value?.mods_resource[0] ??
        null,
);
const coverImages = computed(() => {
    const imageList = [
        modDetail.value?.mods_image_url,
        ...(modDetail.value?.mods_images_url ?? []),
    ]
        .map((item) => resolveAssetUrl(item))
        .filter(Boolean);

    return [...new Set(imageList)].slice(0, 6);
});
const markdownSource = computed(() => {
    const summary = normalizeMarkdownSource(modDetail.value?.mods_desc);
    const detail = normalizeMarkdownSource(modDetail.value?.mods_content);

    if (summary && detail && summary === detail) {
        return detail;
    }

    return [summary, detail].filter(Boolean).join("\n\n");
});
const renderedMarkdown = computed(() => {
    if (!markdownSource.value) {
        return '<p class="empty-markdown">暂无详细介绍内容。</p>';
    }

    const rendered = markdownParser.render(markdownSource.value);

    return rendered.replace(
        /(href|src)=(['"])(\/[^'"#][^'"]*)\2/giu,
        (_fullMatch, attribute, quote, value) =>
            `${attribute}=${quote}${GLOSS_MOD_WEB_BASE_URL}${value}${quote}`,
    );
});

watch(
    routeModId,
    (modId) => {
        void loadModDetail(modId);
    },
    { immediate: true },
);

function normalizeMarkdownSource(value?: string) {
    return (value ?? "").replace(/\r\n?/gu, "\n").trim();
}

function resolveAssetUrl(path?: string) {
    if (!path) {
        return "";
    }

    if (/^https?:\/\//u.test(path)) {
        return path;
    }

    const normalized = path.startsWith("/") ? path : `/${path}`;

    return `${GLOSS_MOD_WEB_BASE_URL}${normalized}`;
}

function formatDate(value?: string) {
    if (!value) {
        return "未知时间";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
        return value;
    }

    return dateFormatter.format(parsed);
}

function formatNumber(value?: string | number) {
    const normalized = Number(value ?? 0);

    return numberFormatter.format(Number.isFinite(normalized) ? normalized : 0);
}

function getErrorMessage(error: unknown) {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }

    return "读取 Mod 详情失败，请稍后重试。";
}

async function loadModDetail(modId: string) {
    if (!modId) {
        modDetail.value = null;
        errorMessage.value = "当前详情页缺少有效的 Mod ID。";
        return;
    }

    if (!GLOSS_MOD_KEY) {
        modDetail.value = null;
        errorMessage.value = "未读取到 GLOSS_MOD_KEY，请检查 .env 配置。";
        return;
    }

    const currentRequestSequence = ++requestSequence;
    loading.value = true;
    errorMessage.value = "";

    try {
        const response = await httpFetch(
            `${GLOSS_MOD_API_BASE_URL}/mods/${modId}`,
            {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Authorization: GLOSS_MOD_KEY,
                },
            },
        );
        const payload = (await response.json()) as IGlossApiResponse<IMod>;

        if (currentRequestSequence !== requestSequence) {
            return;
        }

        if (!response.ok || !payload.success || !payload.data) {
            throw new Error(payload.msg || "读取 Mod 详情失败");
        }

        modDetail.value = payload.data;
    } catch (error: unknown) {
        if (currentRequestSequence !== requestSequence) {
            return;
        }

        modDetail.value = null;
        errorMessage.value = getErrorMessage(error);
    } finally {
        if (currentRequestSequence === requestSequence) {
            loading.value = false;
        }
    }
}

async function openDownloadPage(
    resource?: IResource | null,
    autoDownload = false,
) {
    if (!routeModId.value) {
        ElMessage.warning("当前没有可用的 Mod 详情。");
        return;
    }

    try {
        await router.push({
            path: "/download",
            query: {
                modId: routeModId.value,
                ...(resource
                    ? { resourceId: String(resource.id ?? "latest") }
                    : {}),
                ...(autoDownload ? { autoDownload: "1" } : {}),
            },
        });
    } catch (error: unknown) {
        console.error(error);
        ElMessage.error("打开下载页失败。");
    }
}

function getResourceQueueKey(resource?: IResource | null) {
    if (!resource) {
        return "";
    }

    return String(resource.id ?? resource.mods_resource_name);
}

function isQueueingResource(resource?: IResource | null) {
    return (
        Boolean(resource) &&
        queueingResourceKey.value === getResourceQueueKey(resource)
    );
}

function getPrimaryDownloadButtonLabel() {
    if (isQueueingResource(latestResource.value)) {
        return "加入中...";
    }

    if (!latestResource.value) {
        return "暂无资源";
    }

    return hasGlossMultipleResources(modDetail.value)
        ? "选择资源下载"
        : "下载最新资源";
}

async function downloadResource(resource?: IResource | null) {
    if (!modDetail.value) {
        ElMessage.warning("当前没有可用的 Mod 详情。");
        return;
    }

    if (!resource) {
        ElMessage.warning("当前资源不存在或不可下载。");
        return;
    }

    const queueKey = getResourceQueueKey(resource);
    queueingResourceKey.value = queueKey;

    try {
        const shouldPromptSelection =
            hasGlossMultipleResources(modDetail.value) &&
            resource.id === latestResource.value?.id;
        const result = await queueGlossModDownloadWithSelection({
            mod: modDetail.value,
            resourceId: shouldPromptSelection ? undefined : resource.id,
            managerModList: manager.managerModList,
        });

        if (!result) {
            ElMessage.info("已取消选择下载资源。");
            return;
        }

        if (
            result.status === "created" ||
            result.status === "resumed" ||
            result.status === "retried"
        ) {
            ElMessage.success(result.message);
            return;
        }

        ElMessage.info(result.message);
    } catch (error: unknown) {
        console.error(error);
        ElMessage.error(
            error instanceof Error ? error.message : "提交下载任务失败。",
        );
    } finally {
        if (queueingResourceKey.value === queueKey) {
            queueingResourceKey.value = "";
        }
    }
}

async function goBackToExplore() {
    try {
        const returnTo = Array.isArray(route.query.returnTo)
            ? route.query.returnTo[0]
            : route.query.returnTo;
        const target =
            typeof returnTo === "string" && returnTo.startsWith("/explore")
                ? returnTo
                : "/explore";

        await router.push(target);
    } catch (error: unknown) {
        console.error(error);
        ElMessage.error("返回游览页失败。");
    }
}
</script>

<template>
    <div class="space-y-6">
        <section
            class="overflow-hidden rounded-3xl border border-border/70 bg-linear-to-br from-amber-100/70 via-background to-background"
        >
            <div
                class="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:p-6"
            >
                <div class="space-y-5">
                    <div class="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            @click="goBackToExplore"
                        >
                            <IconArrowLeft />
                            返回游览
                        </Button>
                        <Badge class="rounded-full" variant="secondary">
                            Gloss Mod Detail
                        </Badge>
                        <Badge
                            v-if="modDetail?.support_gmm"
                            class="rounded-full"
                            variant="outline"
                        >
                            支持 GMM
                        </Badge>
                    </div>

                    <div v-if="loading" class="space-y-3">
                        <div
                            class="h-10 w-2/3 animate-pulse rounded-xl bg-muted"
                        ></div>
                        <div
                            class="h-5 w-full animate-pulse rounded bg-muted"
                        ></div>
                        <div
                            class="h-5 w-4/5 animate-pulse rounded bg-muted"
                        ></div>
                        <div class="grid grid-cols-2 gap-3 pt-3 sm:grid-cols-4">
                            <div
                                v-for="item in 4"
                                :key="item"
                                class="h-18 animate-pulse rounded-2xl bg-muted"
                            ></div>
                        </div>
                    </div>

                    <div v-else-if="modDetail" class="space-y-5">
                        <div class="space-y-3">
                            <div
                                class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
                            >
                                <span>{{ modDetail.game_name }}</span>
                                <span>·</span>
                                <span>{{
                                    modDetail.mods_type_name || "未分类"
                                }}</span>
                                <span>·</span>
                                <span
                                    >更新于
                                    {{
                                        formatDate(modDetail.mods_updateTime)
                                    }}</span
                                >
                            </div>
                            <h1
                                class="text-3xl font-semibold tracking-tight lg:text-4xl"
                            >
                                {{ modDetail.mods_title }}
                            </h1>
                            <p
                                v-if="modDetail.mods_desc"
                                class="max-w-3xl text-sm leading-7 text-muted-foreground lg:text-base"
                            >
                                {{ modDetail.mods_desc }}
                            </p>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div
                                class="rounded-2xl border bg-background/80 px-4 py-4 backdrop-blur-sm"
                            >
                                <div class="text-xs text-muted-foreground">
                                    下载
                                </div>
                                <div class="mt-2 text-lg font-semibold">
                                    {{
                                        formatNumber(
                                            modDetail.mods_download_cnt,
                                        )
                                    }}
                                </div>
                            </div>
                            <div
                                class="rounded-2xl border bg-background/80 px-4 py-4 backdrop-blur-sm"
                            >
                                <div class="text-xs text-muted-foreground">
                                    浏览
                                </div>
                                <div class="mt-2 text-lg font-semibold">
                                    {{ formatNumber(modDetail.mods_click_cnt) }}
                                </div>
                            </div>
                            <div
                                class="rounded-2xl border bg-background/80 px-4 py-4 backdrop-blur-sm"
                            >
                                <div class="text-xs text-muted-foreground">
                                    收藏
                                </div>
                                <div class="mt-2 text-lg font-semibold">
                                    {{ formatNumber(modDetail.mods_mark_cnt) }}
                                </div>
                            </div>
                            <div
                                class="rounded-2xl border bg-background/80 px-4 py-4 backdrop-blur-sm"
                            >
                                <div class="text-xs text-muted-foreground">
                                    资源数
                                </div>
                                <div class="mt-2 text-lg font-semibold">
                                    {{ modDetail.mods_resource.length }}
                                </div>
                            </div>
                        </div>

                        <div class="flex flex-wrap gap-2">
                            <Badge class="rounded-full" variant="outline">
                                作者：{{
                                    modDetail.user_nickName ||
                                    modDetail.mods_author ||
                                    "未知"
                                }}
                            </Badge>
                            <Badge class="rounded-full" variant="outline">
                                版本：{{
                                    modDetail.mods_version ||
                                    latestResource?.mods_resource_version ||
                                    "未知"
                                }}
                            </Badge>
                            <Badge class="rounded-full" variant="outline">
                                发布时间：{{
                                    formatDate(modDetail.mods_createTime)
                                }}
                            </Badge>
                        </div>

                        <div class="flex flex-wrap gap-3">
                            <Button @click="openDownloadPage()">
                                <IconPanelRightOpen />
                                前往下载页
                            </Button>
                            <Button
                                v-if="latestResource"
                                variant="outline"
                                :disabled="
                                    !latestResource ||
                                    isQueueingResource(latestResource)
                                "
                                @click="downloadResource(latestResource)"
                            >
                                <IconDownload />
                                {{ getPrimaryDownloadButtonLabel() }}
                            </Button>
                        </div>
                    </div>

                    <div
                        v-else
                        class="rounded-2xl border border-dashed px-6 py-10 text-center text-sm text-muted-foreground"
                    >
                        当前没有可展示的 Mod 详情。
                    </div>

                    <div
                        v-if="errorMessage"
                        class="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-4 text-sm text-destructive"
                    >
                        {{ errorMessage }}
                    </div>
                </div>

                <div class="space-y-4">
                    <div
                        class="overflow-hidden rounded-3xl border bg-muted/30 shadow-sm"
                    >
                        <img
                            :src="coverImages[0] || EMPTY_POSTER"
                            :alt="modDetail?.mods_title || 'Gloss Mod Detail'"
                            class="aspect-video w-full object-cover"
                            @error="
                                (event) =>
                                    ((event.target as HTMLImageElement).src =
                                        EMPTY_POSTER)
                            "
                        />
                    </div>

                    <div
                        v-if="coverImages.length > 1"
                        class="grid grid-cols-3 gap-3 sm:grid-cols-4"
                    >
                        <div
                            v-for="(item, index) in coverImages.slice(1)"
                            :key="`${item}-${index}`"
                            class="overflow-hidden rounded-2xl border bg-muted/30"
                        >
                            <img
                                :src="item"
                                :alt="`${modDetail?.mods_title || 'Gloss Mod'}-${index + 1}`"
                                class="aspect-video w-full object-cover"
                                @error="
                                    (event) =>
                                        ((
                                            event.target as HTMLImageElement
                                        ).src = EMPTY_POSTER)
                                "
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section
            v-if="modDetail"
            class="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_24rem]"
        >
            <Card class="overflow-hidden">
                <CardHeader>
                    <CardTitle>详细介绍</CardTitle>
                </CardHeader>
                <CardContent>
                    <article
                        class="markdown-body"
                        v-html="renderedMarkdown"
                    ></article>
                </CardContent>
            </Card>

            <div class="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>资源列表</CardTitle>
                        <CardDescription>
                            可以直接跳转下载页，或一键加入最新资源的下载任务。
                        </CardDescription>
                    </CardHeader>
                    <CardContent class="space-y-3">
                        <div
                            v-for="resource in modDetail.mods_resource"
                            :key="resource.id"
                            class="rounded-2xl border px-4 py-4"
                        >
                            <div class="flex flex-col gap-3">
                                <div class="flex flex-wrap items-center gap-2">
                                    <div class="text-sm font-medium">
                                        {{ resource.mods_resource_name }}
                                    </div>
                                    <Badge
                                        v-if="
                                            resource.mods_resource_latest_version
                                        "
                                        class="rounded-full"
                                        variant="secondary"
                                    >
                                        最新
                                    </Badge>
                                </div>
                                <div
                                    class="flex flex-wrap gap-2 text-xs text-muted-foreground"
                                >
                                    <span
                                        >大小：{{
                                            resource.mods_resource_size ||
                                            "未知"
                                        }}</span
                                    >
                                    <span>·</span>
                                    <span
                                        >版本：{{
                                            resource.mods_resource_version ||
                                            modDetail.mods_version ||
                                            "未知"
                                        }}</span
                                    >
                                    <span
                                        v-if="resource.mods_resource_createTime"
                                        >·</span
                                    >
                                    <span
                                        v-if="resource.mods_resource_createTime"
                                        >发布时间：{{
                                            formatDate(
                                                resource.mods_resource_createTime,
                                            )
                                        }}</span
                                    >
                                </div>
                                <p
                                    v-if="resource.mods_resource_desc"
                                    class="text-sm leading-6 text-muted-foreground"
                                >
                                    {{ resource.mods_resource_desc }}
                                </p>
                                <div class="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        @click="openDownloadPage(resource)"
                                    >
                                        <IconPanelRightOpen />
                                        打开下载页
                                    </Button>
                                    <Button
                                        size="sm"
                                        :disabled="isQueueingResource(resource)"
                                        @click="downloadResource(resource)"
                                    >
                                        <IconDownload />
                                        {{
                                            isQueueingResource(resource)
                                                ? "加入中..."
                                                : "立即下载"
                                        }}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>附加信息</CardTitle>
                    </CardHeader>
                    <CardContent
                        class="space-y-3 text-sm text-muted-foreground"
                    >
                        <div class="flex items-start justify-between gap-4">
                            <span>Mod ID</span>
                            <span class="text-right text-foreground">{{
                                modDetail.id
                            }}</span>
                        </div>
                        <div class="flex items-start justify-between gap-4">
                            <span>作者</span>
                            <span class="text-right text-foreground">{{
                                modDetail.user_nickName ||
                                modDetail.mods_author ||
                                "未知"
                            }}</span>
                        </div>
                        <div class="flex items-start justify-between gap-4">
                            <span>创建时间</span>
                            <span class="text-right text-foreground">{{
                                formatDate(modDetail.mods_createTime)
                            }}</span>
                        </div>
                        <div class="flex items-start justify-between gap-4">
                            <span>更新时间</span>
                            <span class="text-right text-foreground">{{
                                formatDate(modDetail.mods_updateTime)
                            }}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    </div>
</template>

<style scoped>
.markdown-body {
    color: hsl(var(--foreground));
    font-size: 0.95rem;
    line-height: 1.9;
}

.markdown-body :deep(.empty-markdown) {
    margin: 0;
    color: hsl(var(--muted-foreground));
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
    margin-top: 1.75rem;
    margin-bottom: 0.9rem;
    font-weight: 700;
    line-height: 1.35;
    scroll-margin-top: 5rem;
}

.markdown-body :deep(h1) {
    font-size: 1.8rem;
}

.markdown-body :deep(h2) {
    font-size: 1.45rem;
}

.markdown-body :deep(h3) {
    font-size: 1.15rem;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre),
.markdown-body :deep(table) {
    margin: 0 0 1rem;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
    padding-left: 1.4rem;
}

.markdown-body :deep(li + li) {
    margin-top: 0.45rem;
}

.markdown-body :deep(a) {
    color: #9a5a12;
    text-decoration: underline;
    text-underline-offset: 0.2rem;
}

.markdown-body :deep(blockquote) {
    border-left: 4px solid rgba(154, 90, 18, 0.35);
    background: rgba(154, 90, 18, 0.07);
    border-radius: 1rem;
    padding: 0.95rem 1rem;
    color: hsl(var(--muted-foreground));
}

.markdown-body :deep(code) {
    border-radius: 0.45rem;
    background: rgba(30, 41, 59, 0.08);
    padding: 0.12rem 0.4rem;
    font-size: 0.9em;
}

.markdown-body :deep(pre) {
    overflow-x: auto;
    border-radius: 1rem;
    background: rgba(15, 23, 42, 0.92);
    padding: 1rem;
    color: #f8fafc;
}

.markdown-body :deep(pre code) {
    background: transparent;
    padding: 0;
    color: inherit;
}

.markdown-body :deep(table) {
    width: 100%;
    border-collapse: collapse;
    overflow: hidden;
    border-radius: 1rem;
    border: 1px solid hsl(var(--border));
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
    border-bottom: 1px solid hsl(var(--border));
    padding: 0.7rem 0.85rem;
    text-align: left;
}

.markdown-body :deep(th) {
    background: rgba(148, 163, 184, 0.12);
    font-weight: 600;
}

.markdown-body :deep(img) {
    display: block;
    max-width: 100%;
    border-radius: 1rem;
    margin: 1rem 0;
}

@media (max-width: 768px) {
    .markdown-body {
        font-size: 0.92rem;
    }

    .markdown-body :deep(h1) {
        font-size: 1.55rem;
    }

    .markdown-body :deep(h2) {
        font-size: 1.3rem;
    }
}
</style>
