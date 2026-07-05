<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, reactive, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogDescription,
    DialogHeader,
    DialogScrollContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CheckCircle2,
    ExternalLink,
    Github,
    LogIn,
    LogOut,
    MessageCircle,
    PlusCircle,
    Send,
    ThumbsUp,
} from "lucide-vue-next";
import {
    buildDiscussionDetailPath,
    buildNewGamePageQuery,
    formatDiscussionDate,
    isHttpUrl,
    normalizeRequest,
    parseDiscussionNumber,
    readQueryValue,
    type GameRequest,
} from "@/lib/new-game-discussions";
import {
    SITE_URL,
    createBreadcrumbJsonLd,
    createWebPageJsonLd,
    useSeoMeta,
} from "@/lib/seo";
import { useNewGameDiscussionsStore } from "@/stores/new-game-discussions";

const pageTitle = "新增游戏请求";
const pageDescription =
    "使用 GitHub 登录后，在 Gloss Mod Manager 网站内直接创建和浏览 GitHub Discussions 新游戏请求。";

useSeoMeta({
    title: pageTitle,
    description: pageDescription,
    path: "/add-new-game",
    keywords: [
        "新增游戏",
        "游戏支持请求",
        "GitHub Discussions",
        "GitHub 登录",
        "GMM 支持游戏",
    ],
    structuredData: [
        createWebPageJsonLd(pageTitle, pageDescription, "/add-new-game"),
        createBreadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "新增游戏", path: "/add-new-game" },
        ]),
    ],
});

const route = useRoute();
const router = useRouter();
const allLabelsFilterValue = "__all__";

const createDiscussionExcerpt = (body: string) => {
    const preview = body
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .filter((line) => !line.startsWith("网站请求链接："))
        .map((line) => line.replace(/https?:\/\/\S+/g, "链接"))
        .join(" · ");

    if (!preview) {
        return "暂无内容预览。";
    }

    return preview.length > 180 ? `${preview.slice(0, 177)}...` : preview;
};

const normalizeLabelColor = (color: string) => {
    const normalized = color.trim().replace(/^#/, "");

    return /^[0-9a-fA-F]{6}$/.test(normalized) ? `#${normalized}` : "";
};

const getLabelTextColor = (backgroundColor: string) => {
    const color = normalizeLabelColor(backgroundColor);

    if (!color) {
        return "";
    }

    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    const luminance = (red * 299 + green * 587 + blue * 114) / 1000;

    return luminance > 150 ? "#24292f" : "#ffffff";
};

const getLabelBadgeStyle = (color: string) => {
    const backgroundColor = normalizeLabelColor(color);

    if (!backgroundColor) {
        return undefined;
    }

    return {
        backgroundColor,
        borderColor: backgroundColor,
        color: getLabelTextColor(backgroundColor),
    };
};

const initialRequest = normalizeRequest({
    gameName: readQueryValue(route.query.game),
    sourceUrl: readQueryValue(route.query.source),
    modUrl: readQueryValue(route.query.mod),
    additionalInfo: readQueryValue(route.query.info),
});
const hasInitialDraft = Boolean(
    initialRequest.gameName ||
    initialRequest.sourceUrl ||
    initialRequest.modUrl ||
    initialRequest.additionalInfo,
);

const discussionsStore = useNewGameDiscussionsStore();
const { authSession, discussionList, isLoadingDiscussions, listError } =
    storeToRefs(discussionsStore);

const form = reactive<GameRequest>({ ...initialRequest });
const authNotice = ref<{ status: "success" | "error"; message: string } | null>(
    null,
);
const formError = ref("");
const pageMessage = ref("");
const isSubmitting = ref(false);
const isRequestDialogOpen = ref(hasInitialDraft);
const selectedLabelName = ref(allLabelsFilterValue);

const currentDraft = computed(() => {
    const request = normalizeRequest(form);

    return request.gameName ||
        request.sourceUrl ||
        request.modUrl ||
        request.additionalInfo
        ? request
        : null;
});

const previewRequest = computed(() => currentDraft.value);

const discussionTitle = computed(() => {
    const gameName = previewRequest.value?.gameName || "未命名游戏";
    return `新游戏请求：${gameName}`;
});

const requestFields = computed(() => [
    { label: "游戏名称", value: previewRequest.value?.gameName || "" },
    {
        label: "官网/商店/Steam",
        value: previewRequest.value?.sourceUrl || "",
    },
    { label: "Mod 地址", value: previewRequest.value?.modUrl || "" },
    ...(previewRequest.value?.additionalInfo
        ? [
              {
                  label: "补充信息",
                  value: previewRequest.value.additionalInfo,
              },
          ]
        : []),
]);

const discussionLabelOptions = computed(() => {
    const labels = new Map<
        string,
        {
            name: string;
            count: number;
            color: string;
            description: string | null;
        }
    >();

    for (const discussion of discussionList.value) {
        for (const label of discussion.labels) {
            const currentLabel = labels.get(label.name);

            labels.set(label.name, {
                name: label.name,
                count: (currentLabel?.count || 0) + 1,
                color: currentLabel?.color || label.color,
                description: currentLabel?.description || label.description,
            });
        }
    }

    return [...labels.values()]
        .sort((current, next) => current.name.localeCompare(next.name, "zh-CN"));
});

const activeLabelName = computed(() =>
    selectedLabelName.value === allLabelsFilterValue
        ? ""
        : selectedLabelName.value,
);

const filteredDiscussionList = computed(() => {
    if (!activeLabelName.value) {
        return discussionList.value;
    }

    return discussionList.value.filter((discussion) =>
        discussion.labels.some((label) => label.name === activeLabelName.value),
    );
});

const draftBackLink = computed(() => {
    const href = router.resolve({
        path: "/add-new-game",
        query: buildNewGamePageQuery(previewRequest.value),
    }).href;

    return new URL(href, `${SITE_URL}/`).href;
});

const loginUrl = computed(() => {
    const redirect = router.resolve({
        path: "/add-new-game",
        query: buildNewGamePageQuery(previewRequest.value),
    }).href;

    return `/api/auth/github/login?redirect=${encodeURIComponent(redirect)}`;
});

const validateForm = () => {
    const request = normalizeRequest(form);

    if (!request.gameName) {
        return "请输入游戏名称。";
    }

    if (!request.sourceUrl || !isHttpUrl(request.sourceUrl)) {
        return "请输入有效的游戏官网、商店或 Steam 地址。";
    }

    if (!request.modUrl || !isHttpUrl(request.modUrl)) {
        return "请输入有效的 Mod 地址。";
    }

    return "";
};

const syncRouteState = async () => {
    await router.replace({
        path: "/add-new-game",
        query: buildNewGamePageQuery(currentDraft.value),
    });
};

const openRequestDialog = () => {
    formError.value = "";
    pageMessage.value = "";
    isRequestDialogOpen.value = true;
};

const redirectToGitHubLogin = () => {
    if (typeof window !== "undefined") {
        window.location.assign(loginUrl.value);
    }
};

const loadPageData = async (
    options: { forceAuth?: boolean; forceList?: boolean } = {},
) => {
    await discussionsStore.ensureAuthSession({
        force: options.forceAuth,
    });

    try {
        await discussionsStore.ensureDiscussionList({
            force: options.forceList,
        });
    } catch {
        // Store state already carries the relevant error text.
    }
};

const selectDiscussion = async (discussionNumber: number) => {
    await router.push(buildDiscussionDetailPath(discussionNumber));
};

const submitRequest = async () => {
    if (!authSession.value.isConfigured) {
        pageMessage.value =
            "站点尚未配置 GitHub OAuth，请先补齐 NUXT_GITHUB_CLIENT_ID、NUXT_GITHUB_CLIENT_SECRET 和 NUXT_SESSION_SECRET。";
        return;
    }

    if (!authSession.value.isLoggedIn) {
        pageMessage.value = "创建新游戏请求前需要先登录 GitHub。";
        redirectToGitHubLogin();
        return;
    }

    const error = validateForm();

    if (error) {
        formError.value = error;
        return;
    }

    const request = normalizeRequest(form);

    formError.value = "";
    pageMessage.value = "";
    isSubmitting.value = true;

    try {
        const response = await discussionsStore.createDiscussion({
            ...request,
            backlink: draftBackLink.value,
        });

        await router.push(
            buildDiscussionDetailPath(response.discussion.number),
        );
    } catch (submitError) {
        pageMessage.value =
            submitError instanceof Error
                ? submitError.message
                : "创建讨论失败。";
    } finally {
        isSubmitting.value = false;
    }
};

const resetRequest = async () => {
    form.gameName = "";
    form.sourceUrl = "";
    form.modUrl = "";
    form.additionalInfo = "";
    formError.value = "";
    pageMessage.value = "";
    isRequestDialogOpen.value = false;
    await syncRouteState();
};

const logout = async () => {
    await discussionsStore.logout();
    await loadPageData({ forceList: true });
};

onMounted(async () => {
    const authStatus = readQueryValue(route.query.auth);
    const authMessage = readQueryValue(route.query.authMessage);
    const legacyDiscussionNumber = parseDiscussionNumber(
        route.query.discussion,
    );

    if (legacyDiscussionNumber) {
        const redirectQuery: Record<string, string> = {};

        if (authStatus === "success" || authStatus === "error") {
            redirectQuery.auth = authStatus;

            if (authMessage) {
                redirectQuery.authMessage = authMessage;
            }
        }

        await router.replace({
            path: buildDiscussionDetailPath(legacyDiscussionNumber),
            query: redirectQuery,
        });
        return;
    }

    if (authStatus === "success" || authStatus === "error") {
        authNotice.value = {
            status: authStatus,
            message:
                authMessage ||
                (authStatus === "success"
                    ? "GitHub 登录成功。"
                    : "GitHub 登录失败。"),
        };

        await router.replace({
            path: "/add-new-game",
            query: buildNewGamePageQuery(currentDraft.value),
        });
    }

    await loadPageData({
        forceAuth: authStatus === "success" || authStatus === "error",
    });
});
</script>

<template>
    <div class="container mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-16">
        <div class="space-y-8">
            <div
                class="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-start"
            >
                <div class="space-y-4">
                    <Badge variant="outline" class="w-fit gap-2">
                        <Github class="h-3.5 w-3.5" />
                        GitHub Discussions
                    </Badge>
                    <div class="space-y-3">
                        <h1
                            class="text-3xl font-bold tracking-tight md:text-4xl"
                        >
                            新增游戏请求
                        </h1>
                        <p class="max-w-2xl text-muted-foreground">
                            列表页负责浏览已有请求，发帖入口改为弹窗，帖子详情仍使用独立路由承载
                            Markdown 正文与评论。
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <template
                        v-if="authSession.isLoggedIn && authSession.viewer"
                    >
                        <a
                            :href="authSession.viewer.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors hover:bg-muted/60"
                        >
                            <img
                                :src="authSession.viewer.avatarUrl"
                                :alt="authSession.viewer.login"
                                class="h-5 w-5 rounded-full"
                            />
                            {{ authSession.viewer.login }}
                        </a>
                        <Button variant="outline" @click="logout">
                            <LogOut class="mr-2 h-4 w-4" />
                            退出
                        </Button>
                    </template>
                    <Button
                        v-else-if="authSession.isConfigured"
                        variant="outline"
                        @click="redirectToGitHubLogin"
                    >
                        <LogIn class="mr-2 h-4 w-4" />
                        登录 GitHub
                    </Button>
                </div>
            </div>

            <div
                v-if="authNotice"
                :class="[
                    'rounded-lg border px-4 py-3 text-sm',
                    authNotice.status === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700'
                        : 'border-destructive/30 bg-destructive/10 text-destructive',
                ]"
            >
                {{ authNotice.message }}
            </div>

            <Dialog v-model:open="isRequestDialogOpen">
                <div
                    class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"
                >
                    <div class="flex items-center gap-3">
                        <h2 class="text-xl font-semibold">全部讨论</h2>
                        <Badge variant="secondary">{{
                            filteredDiscussionList.length
                        }}</Badge>
                    </div>
                    <div
                        class="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center"
                    >
                        <Select
                            v-model="selectedLabelName"
                            :disabled="!discussionLabelOptions.length"
                        >
                            <SelectTrigger
                                class="w-full sm:w-[220px]"
                                aria-label="按 Labels 筛选讨论"
                            >
                                <SelectValue placeholder="按 Labels 筛选" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem :value="allLabelsFilterValue">
                                        全部 Labels
                                    </SelectItem>
                                    <SelectItem
                                        v-for="label in discussionLabelOptions"
                                        :key="label.name"
                                        :value="label.name"
                                    >
                                        <span
                                            class="flex min-w-0 items-center gap-2"
                                        >
                                            <span
                                                class="size-2 shrink-0 rounded-full"
                                                :style="{
                                                    backgroundColor:
                                                        normalizeLabelColor(
                                                            label.color,
                                                        ),
                                                }"
                                            ></span>
                                            <span class="truncate">{{
                                                label.name
                                            }}</span>
                                            <span
                                                class="text-muted-foreground"
                                            >
                                                ({{ label.count }})
                                            </span>
                                        </span>
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <DialogTrigger as-child>
                            <Button @click="openRequestDialog">
                                <PlusCircle class="mr-2 h-4 w-4" />
                                申请新游戏
                            </Button>
                        </DialogTrigger>
                    </div>
                </div>

                <DialogScrollContent class="max-w-5xl p-0 sm:max-w-4xl">
                    <div
                        class="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
                    >
                        <div class="p-6 sm:p-8">
                            <DialogHeader class="mb-6">
                                <Badge
                                    variant="secondary"
                                    class="mb-2 w-fit gap-2"
                                >
                                    <PlusCircle class="h-3.5 w-3.5" />
                                    新建游戏请求
                                </Badge>
                                <DialogTitle class="text-xl">
                                    直接发布到 GitHub Discussions
                                </DialogTitle>
                                <DialogDescription>
                                    提交后会自动创建新帖子，并跳转到独立详情页。表单支持先登录再继续提交。
                                </DialogDescription>
                            </DialogHeader>

                            <div class="space-y-6">
                                <div
                                    v-if="
                                        !authSession.isLoggedIn &&
                                        authSession.isConfigured
                                    "
                                    class="flex flex-col gap-4 rounded-lg border border-dashed bg-muted/15 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div class="space-y-1">
                                        <h3 class="text-sm font-semibold">
                                            创建前需要登录
                                        </h3>
                                        <p
                                            class="text-xs text-muted-foreground"
                                        >
                                            发帖将归属到你的 GitHub 账号。
                                        </p>
                                    </div>
                                    <Button
                                        as="a"
                                        :href="loginUrl"
                                        size="sm"
                                        class="shrink-0"
                                    >
                                        <LogIn class="mr-2 h-4 w-4" />
                                        登录 GitHub
                                    </Button>
                                </div>

                                <div
                                    v-else-if="
                                        authSession.isLoggedIn &&
                                        authSession.viewer
                                    "
                                    class="flex items-center justify-between rounded-lg border bg-muted/15 p-3"
                                >
                                    <div class="flex items-center gap-3">
                                        <img
                                            :src="authSession.viewer.avatarUrl"
                                            class="h-8 w-8 rounded-full border"
                                        />
                                        <div class="text-sm font-medium">
                                            {{
                                                authSession.viewer.name ||
                                                authSession.viewer.login
                                            }}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        @click="logout"
                                    >
                                        <LogOut class="h-4 w-4" />
                                    </Button>
                                </div>

                                <form
                                    class="space-y-5"
                                    @submit.prevent="submitRequest"
                                >
                                    <div class="space-y-2">
                                        <label
                                            for="game-name"
                                            class="text-sm font-medium"
                                        >
                                            游戏名称
                                        </label>
                                        <input
                                            id="game-name"
                                            v-model="form.gameName"
                                            type="text"
                                            maxlength="80"
                                            placeholder="例如：Stellar Blade"
                                            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </div>

                                    <div class="space-y-2">
                                        <label
                                            for="source-url"
                                            class="text-sm font-medium"
                                        >
                                            游戏官网 / 商店地址
                                        </label>
                                        <input
                                            id="source-url"
                                            v-model="form.sourceUrl"
                                            type="url"
                                            placeholder="https://store.steampowered.com/app/..."
                                            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </div>

                                    <div class="space-y-2">
                                        <label
                                            for="mod-url"
                                            class="text-sm font-medium"
                                        >
                                            Mod 地址
                                        </label>
                                        <input
                                            id="mod-url"
                                            v-model="form.modUrl"
                                            type="url"
                                            placeholder="https://www.nexusmods.com/..."
                                            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </div>
                                    <div class="space-y-2">
                                        <label
                                            for="additional-info"
                                            class="text-sm font-medium"
                                        >
                                            补充信息（选填）
                                        </label>
                                        <input
                                            id="additional-info"
                                            v-model="form.additionalInfo"
                                            type="text"
                                            placeholder="例如：适配规则、安装目录结构、测试版本或已有 Mod 生态"
                                            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        />
                                    </div>

                                    <p
                                        v-if="formError"
                                        class="text-sm text-destructive"
                                    >
                                        {{ formError }}
                                    </p>
                                    <p
                                        v-if="pageMessage"
                                        class="text-sm text-muted-foreground"
                                    >
                                        {{ pageMessage }}
                                    </p>

                                    <div class="flex flex-wrap gap-2 pt-2">
                                        <Button
                                            type="submit"
                                            :disabled="isSubmitting"
                                        >
                                            <Send class="mr-2 h-4 w-4" />
                                            {{
                                                isSubmitting
                                                    ? "正在发布..."
                                                    : authSession.isLoggedIn
                                                      ? "发布"
                                                      : "登录后发布"
                                            }}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            @click="resetRequest"
                                        >
                                            取消
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        <div
                            class="border-t bg-muted/15 p-6 sm:p-8 lg:border-t-0 lg:border-l"
                        >
                            <div class="space-y-4">
                                <Badge variant="secondary" class="mb-2 w-fit">
                                    <CheckCircle2 class="mr-1.5 h-3.5 w-3.5" />
                                    内容预览
                                </Badge>
                                <div v-if="previewRequest" class="space-y-4">
                                    <div>
                                        <h3 class="text-lg font-semibold">
                                            {{ discussionTitle }}
                                        </h3>
                                        <p
                                            class="mt-2 text-sm text-muted-foreground"
                                        >
                                            将会同步为 GitHub Discussion
                                            的首帖内容。
                                        </p>
                                    </div>

                                    <dl class="space-y-4">
                                        <div
                                            v-for="field in requestFields"
                                            :key="field.label"
                                            class="rounded-md border bg-background/70 p-3"
                                        >
                                            <dt
                                                class="mb-1 text-[11px] font-semibold uppercase text-muted-foreground"
                                            >
                                                {{ field.label }}
                                            </dt>
                                            <dd
                                                class="break-words text-sm [overflow-wrap:anywhere]"
                                            >
                                                <a
                                                    v-if="
                                                        field.value.startsWith(
                                                            'http',
                                                        )
                                                    "
                                                    :href="field.value"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    class="flex items-center gap-1 hover:underline"
                                                >
                                                    {{ field.value }}
                                                    <ExternalLink
                                                        class="h-3 w-3"
                                                    />
                                                </a>
                                                <span v-else>{{
                                                    field.value
                                                }}</span>
                                            </dd>
                                        </div>
                                    </dl>
                                </div>

                                <div
                                    v-else
                                    class="rounded-lg border border-dashed bg-background/70 p-5 text-sm text-muted-foreground"
                                >
                                    填写游戏名称、游戏来源和 Mod
                                    地址后，这里会实时显示发帖预览。
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogScrollContent>
            </Dialog>

            <p v-if="listError" class="text-sm text-destructive">
                {{ listError }}
            </p>

            <Card>
                <CardContent class="p-0">
                    <div
                        v-if="isLoadingDiscussions"
                        class="p-8 text-center text-sm text-muted-foreground"
                    >
                        正在加载讨论列表...
                    </div>

                    <div
                        v-else-if="filteredDiscussionList.length"
                        class="divide-y"
                    >
                        <button
                            v-for="discussion in filteredDiscussionList"
                            :key="discussion.number"
                            type="button"
                            class="w-full overflow-hidden p-4 text-left transition-colors hover:bg-muted/30"
                            @click="selectDiscussion(discussion.number)"
                        >
                            <div class="flex items-start justify-between gap-4">
                                <div class="min-w-0 space-y-1">
                                    <div
                                        class="flex min-w-0 flex-wrap items-center gap-2"
                                    >
                                        <Badge
                                            v-for="label in discussion.labels"
                                            :key="label.id"
                                            :title="label.description || label.name"
                                            variant="outline"
                                            class="max-w-40 truncate"
                                            :style="
                                                getLabelBadgeStyle(label.color)
                                            "
                                        >
                                            {{ label.name }}
                                        </Badge>
                                        <span
                                            class="min-w-0 flex-[1_1_14rem] truncate text-base font-medium text-primary/90"
                                        >
                                            {{ discussion.title }}
                                        </span>
                                    </div>
                                    <div
                                        class="line-clamp-2 break-all text-sm text-muted-foreground [overflow-wrap:anywhere]"
                                    >
                                        {{
                                            createDiscussionExcerpt(
                                                discussion.body,
                                            )
                                        }}
                                    </div>
                                    <div
                                        class="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
                                    >
                                        <span
                                            class="flex items-center gap-1 font-medium text-foreground/70"
                                        >
                                            <img
                                                v-if="
                                                    discussion.author?.avatarUrl
                                                "
                                                :src="
                                                    discussion.author.avatarUrl
                                                "
                                                class="h-4 w-4 rounded-full"
                                            />
                                            {{
                                                discussion.author?.login ||
                                                "GitHub 用户"
                                            }}
                                        </span>
                                        <span>发起了请求</span>
                                        <span>•</span>
                                        <span>{{
                                            formatDiscussionDate(
                                                discussion.createdAt,
                                            )
                                        }}</span>
                                    </div>
                                </div>
                                <div
                                    class="mt-1 flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground"
                                >
                                    <Badge
                                        variant="outline"
                                        class="font-mono text-[10px]"
                                    >
                                        #{{ discussion.number }}
                                    </Badge>
                                    <div
                                        v-if="
                                            discussion.commentCount > 0 ||
                                            discussion.reactions.reduce(
                                                (total, reaction) =>
                                                    total + reaction.count,
                                                0,
                                            ) > 0
                                        "
                                        class="mt-1 flex items-center gap-1.5"
                                    >
                                        <span
                                            v-if="
                                                discussion.reactions.reduce(
                                                    (total, reaction) =>
                                                        total + reaction.count,
                                                    0,
                                                ) > 0
                                            "
                                            class="flex items-center gap-1"
                                        >
                                            <ThumbsUp class="h-3 w-3" />
                                            {{
                                                discussion.reactions.reduce(
                                                    (total, reaction) =>
                                                        total + reaction.count,
                                                    0,
                                                )
                                            }}
                                        </span>
                                        <span
                                            v-if="discussion.commentCount > 0"
                                            class="flex items-center gap-1"
                                        >
                                            <MessageCircle class="h-3 w-3" />
                                            {{ discussion.commentCount }}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div
                        v-else-if="discussionList.length"
                        class="p-8 text-center text-sm text-muted-foreground"
                    >
                        当前 Label 下没有匹配的新游戏请求。
                    </div>

                    <div
                        v-else
                        class="p-8 text-center text-sm text-muted-foreground"
                    >
                        当前还没有新游戏请求，你可以成为第一个发帖的人。
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
</template>
