<script setup lang="ts">
defineOptions({
    name: "DiscussionCommentThread",
});

import { computed, ref } from "vue";
import { CornerDownRight, Send } from "lucide-vue-next";
import DiscussionMarkdown from "@/components/DiscussionMarkdown.vue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    formatDiscussionDate,
    getReactionState,
    reactionOptions,
    type AuthSessionResponse,
    type DiscussionComment,
    type ReactionContent,
} from "@/lib/new-game-discussions";

interface Props {
    comment: DiscussionComment;
    authSession: AuthSessionResponse;
    pendingReactionTargetId: string | null;
    replyingCommentId: string | null;
    replyError: string;
    replyErrorCommentId: string | null;
    onToggleReaction: (
        subjectId: string,
        content: ReactionContent,
        viewerHasReacted: boolean,
    ) => Promise<void> | void;
    onSubmitReply: (parentId: string, body: string) => Promise<boolean>;
    onRequireLogin: () => void;
}

const props = defineProps<Props>();

const isReplyComposerOpen = ref(false);
const replyBody = ref("");

const isSubmittingReply = computed(
    () => props.replyingCommentId === props.comment.id,
);

const currentReplyError = computed(() =>
    props.replyErrorCommentId === props.comment.id ? props.replyError : "",
);

const openReplyComposer = () => {
    if (!props.authSession.isLoggedIn) {
        props.onRequireLogin();
        return;
    }

    isReplyComposerOpen.value = true;
};

const closeReplyComposer = () => {
    if (isSubmittingReply.value) {
        return;
    }

    isReplyComposerOpen.value = false;
    replyBody.value = "";
};

const submitReply = async () => {
    const didSubmit = await props.onSubmitReply(
        props.comment.id,
        replyBody.value,
    );

    if (didSubmit) {
        replyBody.value = "";
        isReplyComposerOpen.value = false;
    }
};
</script>

<template>
    <div class="space-y-4">
        <div class="flex gap-3">
            <img
                v-if="comment.author"
                :src="comment.author.avatarUrl"
                class="mt-1 h-8 w-8 shrink-0 rounded-full border"
            />
            <div
                v-else
                class="mt-1 h-8 w-8 shrink-0 rounded-full border bg-muted/40"
            ></div>

            <div class="flex-1 space-y-3 rounded-lg border bg-muted/5 p-3">
                <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2 text-sm font-medium">
                        <a
                            v-if="comment.author"
                            :href="comment.author.url"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="hover:underline"
                        >
                            {{ comment.author.login }}
                        </a>
                        <span v-else>GitHub 用户</span>
                        <span class="text-xs font-normal text-muted-foreground">
                            {{ formatDiscussionDate(comment.createdAt) }}
                        </span>
                    </div>
                </div>

                <DiscussionMarkdown
                    :content="comment.body"
                    class="text-sm leading-relaxed"
                />

                <div class="flex flex-wrap items-center gap-1.5 pt-1">
                    <Button
                        v-for="reaction in reactionOptions"
                        :key="`${comment.id}-${reaction.content}`"
                        type="button"
                        variant="ghost"
                        class="h-6 px-2 text-xs"
                        :class="{
                            'bg-primary/5 text-primary': getReactionState(
                                comment.reactions,
                                reaction.content,
                            ).viewerHasReacted,
                        }"
                        :disabled="pendingReactionTargetId === comment.id"
                        @click="
                            onToggleReaction(
                                comment.id,
                                reaction.content,
                                getReactionState(
                                    comment.reactions,
                                    reaction.content,
                                ).viewerHasReacted,
                            )
                        "
                    >
                        <span class="mr-1">{{ reaction.emoji }}</span>
                        <span>
                            {{
                                getReactionState(
                                    comment.reactions,
                                    reaction.content,
                                ).count
                            }}
                        </span>
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        class="h-6 px-2 text-xs text-muted-foreground"
                        @click="openReplyComposer"
                    >
                        <CornerDownRight class="mr-1 h-3.5 w-3.5" />
                        回复
                    </Button>
                </div>

                <div
                    v-if="isReplyComposerOpen"
                    class="space-y-3 rounded-md border bg-muted/10 p-3"
                >
                    <div
                        v-if="currentReplyError"
                        class="text-xs font-medium text-destructive"
                    >
                        {{ currentReplyError }}
                    </div>

                    <Textarea
                        v-model="replyBody"
                        rows="3"
                        placeholder="回复这条评论，支持 Markdown..."
                    />

                    <div class="flex items-center justify-between gap-3">
                        <p class="text-xs text-muted-foreground">
                            回复 {{ comment.author?.login || "GitHub 用户" }}
                        </p>

                        <div class="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                :disabled="isSubmittingReply"
                                @click="closeReplyComposer"
                            >
                                取消
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                :disabled="isSubmittingReply"
                                @click="submitReply"
                            >
                                <Send class="mr-2 h-4 w-4" />
                                {{ isSubmittingReply ? "发送中..." : "回复" }}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div
            v-if="comment.replies.length"
            class="ml-6 border-l border-border/70 pl-4 sm:ml-10 sm:pl-5"
        >
            <div class="space-y-4">
                <DiscussionCommentThread
                    v-for="reply in comment.replies"
                    :key="reply.id"
                    :comment="reply"
                    :auth-session="authSession"
                    :pending-reaction-target-id="pendingReactionTargetId"
                    :replying-comment-id="replyingCommentId"
                    :reply-error="replyError"
                    :reply-error-comment-id="replyErrorCommentId"
                    :on-toggle-reaction="onToggleReaction"
                    :on-submit-reply="onSubmitReply"
                    :on-require-login="onRequireLogin"
                />
            </div>
        </div>
    </div>
</template>
