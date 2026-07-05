<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import DiscussionCommentThread from "@/components/DiscussionCommentThread.vue";
import DiscussionMarkdown from "@/components/DiscussionMarkdown.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    ExternalLink,
    Github,
    LogIn,
    LogOut,
    MessageCircle,
    Send,
} from "lucide-vue-next";
import {
    formatDiscussionDate,
    getReactionState,
    parseDiscussionNumber,
    reactionOptions,
    readQueryValue,
    type ReactionContent,
} from "@/lib/new-game-discussions";
import {
    createBreadcrumbJsonLd,
    createWebPageJsonLd,
    useSeoMeta,
} from "@/lib/seo";
import { useNewGameDiscussionsStore } from "@/stores/new-game-discussions";

const pageBaseTitle = "新增游戏请求";
const pageBaseDescription =
    "浏览 Gloss Mod Manager 新游戏请求详情，正文和评论支持 Markdown 渲染，并可直接与 GitHub Discussions 交互。";

const route = useRoute();
const router = useRouter();

const discussionNumber = computed(() =>
    parseDiscussionNumber(route.params.number),
);
const discussionsStore = useNewGameDiscussionsStore();
const {
    authSession,
    discussionDetails,
    discussionErrors,
    discussionLoadingStates,
} = storeToRefs(discussionsStore);

const authNotice = ref<{ status: "success" | "error"; message: string } | null>(
    null,
);
const pageMessage = ref("");
const interactionError = ref("");
const isPostingComment = ref(false);
const pendingReactionTargetId = ref<string | null>(null);
const postingReplyToId = ref<string | null>(null);
const replyErrorCommentId = ref<string | null>(null);
const commentBody = ref("");

const selectedDiscussion = computed(() => {
    if (!discussionNumber.value) {
        return null;
    }

    return discussionDetails.value[discussionNumber.value] || null;
});

const discussionError = computed(() => {
    if (interactionError.value && !replyErrorCommentId.value) {
        return interactionError.value;
    }

    if (!discussionNumber.value) {
        return "无效的讨论编号。";
    }

    return discussionErrors.value[discussionNumber.value] || "";
});

const isLoadingDiscussion = computed(() => {
    if (!discussionNumber.value) {
        return false;
    }

    return Boolean(discussionLoadingStates.value[discussionNumber.value]);
});

const normalizeMarkdownExcerpt = (value: string) =>
    value
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/[`>#*_~|-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const seoTitle = computed(() => {
    if (selectedDiscussion.value?.title) {
        return selectedDiscussion.value.title;
    }

    return discussionNumber.value
        ? `${pageBaseTitle} #${discussionNumber.value}`
        : pageBaseTitle;
});

const seoDescription = computed(() => {
    if (!selectedDiscussion.value?.body) {
        return pageBaseDescription;
    }

    const excerpt = normalizeMarkdownExcerpt(selectedDiscussion.value.body);
    return excerpt.slice(0, 140) || pageBaseDescription;
});

useSeoMeta(() => ({
    title: seoTitle.value,
    description: seoDescription.value,
    path: route.path,
    type: "article" as const,
    noindex: !discussionNumber.value,
    structuredData: [
        createWebPageJsonLd(seoTitle.value, seoDescription.value, route.path),
        createBreadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "新增游戏", path: "/add-new-game" },
            {
                name:
                    selectedDiscussion.value?.title ||
                    (discussionNumber.value
                        ? `请求 #${discussionNumber.value}`
                        : "详情"),
                path: route.path,
            },
        ]),
    ],
}));

const loginUrl = computed(
    () =>
        `/api/auth/github/login?redirect=${encodeURIComponent(route.fullPath)}`,
);

const redirectToGitHubLogin = () => {
    if (typeof window !== "undefined") {
        window.location.assign(loginUrl.value);
    }
};

const requireGitHubLogin = (message: string) => {
    interactionError.value = "";
    replyErrorCommentId.value = null;
    pageMessage.value = message;
    redirectToGitHubLogin();
};

const loadDiscussion = async (options: { force?: boolean } = {}) => {
    if (!discussionNumber.value) {
        interactionError.value = "无效的讨论编号。";
        return;
    }

    interactionError.value = "";

    try {
        await discussionsStore.ensureDiscussion(discussionNumber.value, {
            force: options.force,
        });
    } catch {
        // Store state already carries the relevant error text.
    }
};

const refreshDiscussion = async () => {
    await loadDiscussion({ force: true });
};

const submitComment = async ({
    body,
    replyToId,
}: {
    body: string;
    replyToId?: string;
}) => {
    if (!selectedDiscussion.value) {
        return false;
    }

    if (!authSession.value.isLoggedIn) {
        requireGitHubLogin(
            replyToId
                ? "回复评论前需要先登录 GitHub。"
                : "评论前需要先登录 GitHub。",
        );
        return false;
    }

    const nextBody = body.trim();

    if (!nextBody) {
        interactionError.value = replyToId
            ? "请输入回复内容。"
            : "请输入评论内容。";
        replyErrorCommentId.value = replyToId || null;
        return false;
    }

    replyErrorCommentId.value = replyToId || null;
    interactionError.value = "";
    pageMessage.value = "";

    if (replyToId) {
        postingReplyToId.value = replyToId;
    } else {
        isPostingComment.value = true;
    }

    try {
        await discussionsStore.postComment(
            selectedDiscussion.value.number,
            nextBody,
            replyToId,
        );
        replyErrorCommentId.value = null;
        return true;
    } catch (error) {
        interactionError.value =
            error instanceof Error
                ? error.message
                : replyToId
                  ? "回复评论失败。"
                  : "发表评论失败。";
        replyErrorCommentId.value = replyToId || null;
        return false;
    } finally {
        if (replyToId) {
            postingReplyToId.value = null;
        } else {
            isPostingComment.value = false;
        }
    }
};

const postComment = async () => {
    const didPost = await submitComment({ body: commentBody.value });

    if (didPost) {
        commentBody.value = "";
    }
};

const postReply = (replyToId: string, body: string) =>
    submitComment({ body, replyToId });

const beginReplyLogin = () => {
    requireGitHubLogin("回复评论前需要先登录 GitHub。");
};

const toggleReaction = async (
    subjectId: string,
    content: ReactionContent,
    viewerHasReacted: boolean,
) => {
    if (!selectedDiscussion.value) {
        return;
    }

    if (!authSession.value.isLoggedIn) {
        pageMessage.value = "添加表情前需要先登录 GitHub。";
        redirectToGitHubLogin();
        return;
    }

    pendingReactionTargetId.value = subjectId;
    interactionError.value = "";
    pageMessage.value = "";

    try {
        await discussionsStore.toggleReaction(
            selectedDiscussion.value.number,
            subjectId,
            content,
            viewerHasReacted,
        );
    } catch (error) {
        interactionError.value =
            error instanceof Error ? error.message : "更新表情失败。";
    } finally {
        pendingReactionTargetId.value = null;
    }
};

const logout = async () => {
    await discussionsStore.logout();
    await refreshDiscussion();
};

onMounted(async () => {
    const authStatus = readQueryValue(route.query.auth);
    const authMessage = readQueryValue(route.query.authMessage);

    if (authStatus === "success" || authStatus === "error") {
        authNotice.value = {
            status: authStatus,
            message:
                authMessage ||
                (authStatus === "success"
                    ? "GitHub 登录成功。"
                    : "GitHub 登录失败。"),
        };

        const nextQuery = { ...route.query };
        delete nextQuery.auth;
        delete nextQuery.authMessage;
        await router.replace({ path: route.path, query: nextQuery });
    }

    await discussionsStore.ensureAuthSession({
        force: authStatus === "success" || authStatus === "error",
    });
    await loadDiscussion({
        force: authStatus === "success" || authStatus === "error",
    });
});

watch(discussionNumber, async (nextNumber, previousNumber) => {
    if (nextNumber === previousNumber) {
        return;
    }

    interactionError.value = "";
    pageMessage.value = "";
    postingReplyToId.value = null;
    replyErrorCommentId.value = null;

    if (!nextNumber) {
        interactionError.value = "无效的讨论编号。";
        return;
    }

    await loadDiscussion();
});
</script>

<template>
    <div class="container mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-16">
        <div class="space-y-6">
            <Button
                as-child
                variant="ghost"
                class="-ml-4 text-muted-foreground"
            >
                <NuxtLink to="/add-new-game">← 返回讨论列表</NuxtLink>
            </Button>

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

            <div
                class="flex flex-col gap-4 rounded-lg border bg-card p-5 sm:flex-row sm:items-center sm:justify-between"
            >
                <div class="space-y-1.5">
                    <div class="flex items-center gap-2 text-sm font-medium">
                        <Github class="h-4 w-4" />
                        GitHub Discussions
                    </div>
                    <p class="text-sm text-muted-foreground">
                        正文与评论会按 Markdown 渲染，评论和表情交互仍直接同步到
                        GitHub。
                    </p>
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
                                class="h-6 w-6 rounded-full"
                            />
                            {{ authSession.viewer.login }}
                        </a>
                        <Button variant="outline" size="sm" @click="logout">
                            <LogOut class="mr-2 h-4 w-4" />
                            退出登录
                        </Button>
                    </template>
                    <Button
                        v-else-if="authSession.isConfigured"
                        as="a"
                        :href="loginUrl"
                        size="sm"
                    >
                        <LogIn class="mr-2 h-4 w-4" />
                        登录 GitHub
                    </Button>
                </div>
            </div>

            <div
                v-if="isLoadingDiscussion"
                class="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground"
            >
                正在加载讨论内容...
            </div>

            <div v-else-if="selectedDiscussion" class="space-y-8">
                <div class="space-y-4">
                    <div class="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" class="font-mono">
                            #{{ selectedDiscussion.number }}
                        </Badge>
                        <Badge variant="secondary">Game Request</Badge>
                    </div>

                    <h1 class="text-2xl font-bold md:text-3xl">
                        {{ selectedDiscussion.title }}
                    </h1>

                    <div
                        class="flex flex-wrap items-center gap-3 border-b pb-4 text-sm text-muted-foreground"
                    >
                        <a
                            v-if="selectedDiscussion.author"
                            :href="selectedDiscussion.author.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center gap-2 font-medium text-foreground hover:underline"
                        >
                            <img
                                :src="selectedDiscussion.author.avatarUrl"
                                class="h-5 w-5 rounded-full"
                            />
                            {{ selectedDiscussion.author.login }}
                        </a>
                        <span v-else class="font-medium text-foreground"
                            >GitHub 用户</span
                        >
                        <span
                            >发表于
                            {{
                                formatDiscussionDate(
                                    selectedDiscussion.createdAt,
                                )
                            }}</span
                        >
                        <span>•</span>
                        <a
                            :href="selectedDiscussion.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="flex items-center gap-1 hover:underline"
                        >
                            在 GitHub 打开
                            <ExternalLink class="h-3 w-3" />
                        </a>
                    </div>

                    <DiscussionMarkdown
                        :content="selectedDiscussion.body"
                        class="rounded-lg border bg-muted/5 p-4 text-sm leading-7"
                    />

                    <div class="flex flex-wrap gap-2 pt-2">
                        <Button
                            v-for="reaction in reactionOptions"
                            :key="reaction.content"
                            type="button"
                            variant="outline"
                            size="sm"
                            :class="{
                                'border-primary/20 bg-primary/5':
                                    getReactionState(
                                        selectedDiscussion.reactions,
                                        reaction.content,
                                    ).viewerHasReacted,
                            }"
                            :disabled="
                                pendingReactionTargetId ===
                                selectedDiscussion.id
                            "
                            @click="
                                toggleReaction(
                                    selectedDiscussion.id,
                                    reaction.content,
                                    getReactionState(
                                        selectedDiscussion.reactions,
                                        reaction.content,
                                    ).viewerHasReacted,
                                )
                            "
                        >
                            <span class="mr-1.5">{{ reaction.emoji }}</span>
                            <span class="text-xs">
                                {{
                                    getReactionState(
                                        selectedDiscussion.reactions,
                                        reaction.content,
                                    ).count
                                }}
                            </span>
                        </Button>
                    </div>
                </div>

                <div class="space-y-6">
                    <h2
                        class="flex items-center gap-2 border-b pb-2 text-lg font-semibold"
                    >
                        <MessageCircle class="h-5 w-5" />
                        评论 ({{ selectedDiscussion.commentCount }})
                    </h2>

                    <div
                        v-if="selectedDiscussion.comments.length"
                        class="space-y-4"
                    >
                        <DiscussionCommentThread
                            v-for="comment in selectedDiscussion.comments"
                            :key="comment.id"
                            :comment="comment"
                            :auth-session="authSession"
                            :pending-reaction-target-id="
                                pendingReactionTargetId
                            "
                            :replying-comment-id="postingReplyToId"
                            :reply-error="interactionError"
                            :reply-error-comment-id="replyErrorCommentId"
                            :on-toggle-reaction="toggleReaction"
                            :on-submit-reply="postReply"
                            :on-require-login="beginReplyLogin"
                        />
                    </div>

                    <div
                        v-else
                        class="rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
                    >
                        还没有评论，欢迎补充适配规则、目录结构或测试信息。
                    </div>

                    <div
                        class="mt-8 space-y-4 rounded-lg border bg-muted/10 p-4"
                    >
                        <div
                            v-if="discussionError"
                            class="text-sm font-medium text-destructive"
                        >
                            {{ discussionError }}
                        </div>
                        <div
                            v-if="pageMessage"
                            class="text-sm text-muted-foreground"
                        >
                            {{ pageMessage }}
                        </div>

                        <Textarea
                            v-model="commentBody"
                            rows="4"
                            placeholder="写下你的评论，支持 Markdown..."
                        />

                        <div class="flex items-center justify-between gap-4">
                            <div
                                class="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                                <template
                                    v-if="
                                        authSession.isLoggedIn &&
                                        authSession.viewer
                                    "
                                >
                                    <img
                                        :src="authSession.viewer.avatarUrl"
                                        class="h-5 w-5 rounded-full"
                                    />
                                    以 {{ authSession.viewer.login }} 的身份评论
                                </template>
                                <template v-else-if="authSession.isConfigured">
                                    请先
                                    <a
                                        :href="loginUrl"
                                        class="text-primary hover:underline"
                                    >
                                        登录 GitHub
                                    </a>
                                </template>
                            </div>

                            <Button
                                :disabled="isPostingComment"
                                @click="postComment"
                            >
                                <Send class="mr-2 h-4 w-4" />
                                {{
                                    isPostingComment ? "发送中..." : "发表评论"
                                }}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div
                v-else
                class="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground"
            >
                {{ discussionError || "未找到讨论内容。" }}
            </div>
        </div>
    </div>
</template>
