import { defineStore } from "pinia";
import { ref } from "vue";
import {
    defaultAuthSession,
    toDiscussionSummary,
    type AuthSessionResponse,
    type DiscussionDetail,
    type DiscussionSummary,
    type GameRequest,
    type ReactionContent,
} from "@/lib/new-game-discussions";

interface EnsureOptions {
    force?: boolean;
}

interface CreateDiscussionPayload extends GameRequest {
    backlink: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

const mergeDiscussionSummary = (
    summaries: DiscussionSummary[],
    summary: DiscussionSummary,
    prependWhenMissing = false,
) => {
    const existingIndex = summaries.findIndex(
        (discussion) => discussion.number === summary.number,
    );

    if (existingIndex === -1) {
        return prependWhenMissing
            ? [summary, ...summaries]
            : [...summaries, summary];
    }

    const nextSummaries = [...summaries];
    nextSummaries.splice(existingIndex, 1, summary);
    return nextSummaries;
};

export const useNewGameDiscussionsStore = defineStore(
    "new-game-discussions",
    () => {
        const authSession = ref<AuthSessionResponse>({ ...defaultAuthSession });
        const discussionList = ref<DiscussionSummary[]>([]);
        const discussionDetails = ref<Record<number, DiscussionDetail>>({});
        const discussionErrors = ref<Record<number, string>>({});
        const discussionLoadingStates = ref<Record<number, boolean>>({});
        const hasLoadedDiscussionDetails = ref<Record<number, boolean>>({});
        const isLoadingDiscussions = ref(false);
        const listError = ref("");
        const hasLoadedAuthSession = ref(false);
        const hasLoadedDiscussionList = ref(false);

        let authRequest: Promise<AuthSessionResponse> | null = null;
        let listRequest: Promise<DiscussionSummary[]> | null = null;
        const detailRequests = new Map<number, Promise<DiscussionDetail>>();

        const setDiscussionLoadingState = (
            discussionNumber: number,
            value: boolean,
        ) => {
            discussionLoadingStates.value = {
                ...discussionLoadingStates.value,
                [discussionNumber]: value,
            };
        };

        const setDiscussionError = (
            discussionNumber: number,
            message: string,
        ) => {
            discussionErrors.value = {
                ...discussionErrors.value,
                [discussionNumber]: message,
            };
        };

        const upsertDiscussionDetail = (
            detail: DiscussionDetail,
            prependWhenMissing = false,
        ) => {
            discussionDetails.value = {
                ...discussionDetails.value,
                [detail.number]: detail,
            };
            hasLoadedDiscussionDetails.value = {
                ...hasLoadedDiscussionDetails.value,
                [detail.number]: true,
            };
            discussionList.value = mergeDiscussionSummary(
                discussionList.value,
                toDiscussionSummary(detail),
                prependWhenMissing,
            );
        };

        const ensureAuthSession = async ({
            force = false,
        }: EnsureOptions = {}) => {
            if (!force && hasLoadedAuthSession.value) {
                return authSession.value;
            }

            if (authRequest) {
                return authRequest;
            }

            authRequest = $fetch<AuthSessionResponse>("/api/auth/session")
                .then((response) => {
                    authSession.value = response;
                    hasLoadedAuthSession.value = true;
                    return response;
                })
                .catch(() => {
                    const fallbackSession = { ...defaultAuthSession };
                    authSession.value = fallbackSession;
                    hasLoadedAuthSession.value = true;
                    return fallbackSession;
                })
                .finally(() => {
                    authRequest = null;
                });

            return authRequest;
        };

        const ensureDiscussionList = async ({
            force = false,
        }: EnsureOptions = {}) => {
            if (!force && hasLoadedDiscussionList.value) {
                return discussionList.value;
            }

            if (listRequest) {
                return listRequest;
            }

            isLoadingDiscussions.value = true;
            listError.value = "";

            listRequest = $fetch<{ discussions: DiscussionSummary[] }>(
                "/api/discussions/new-games",
            )
                .then((response) => {
                    discussionList.value = response.discussions;
                    hasLoadedDiscussionList.value = true;
                    return response.discussions;
                })
                .catch((error) => {
                    listError.value = getErrorMessage(
                        error,
                        "加载讨论列表失败。",
                    );
                    throw error;
                })
                .finally(() => {
                    isLoadingDiscussions.value = false;
                    listRequest = null;
                });

            return listRequest;
        };

        const ensureDiscussion = async (
            discussionNumber: number,
            { force = false }: EnsureOptions = {},
        ) => {
            if (
                !force &&
                hasLoadedDiscussionDetails.value[discussionNumber] &&
                discussionDetails.value[discussionNumber]
            ) {
                return discussionDetails.value[discussionNumber];
            }

            const pendingRequest = detailRequests.get(discussionNumber);

            if (pendingRequest) {
                return pendingRequest;
            }

            setDiscussionLoadingState(discussionNumber, true);
            setDiscussionError(discussionNumber, "");

            const request = $fetch<{ discussion: DiscussionDetail }>(
                `/api/discussions/${discussionNumber}`,
            )
                .then((response) => {
                    upsertDiscussionDetail(response.discussion);
                    return response.discussion;
                })
                .catch((error) => {
                    setDiscussionError(
                        discussionNumber,
                        getErrorMessage(error, "加载讨论内容失败。"),
                    );
                    throw error;
                })
                .finally(() => {
                    setDiscussionLoadingState(discussionNumber, false);
                    detailRequests.delete(discussionNumber);
                });

            detailRequests.set(discussionNumber, request);
            return request;
        };

        const createDiscussion = async (payload: CreateDiscussionPayload) => {
            const response = await $fetch<{
                discussion: { number: number; url: string };
                detail: DiscussionDetail;
            }>("/api/discussions/new-games", {
                method: "POST",
                body: payload,
            });

            upsertDiscussionDetail(response.detail, true);
            hasLoadedDiscussionList.value = true;

            return response;
        };

        const postComment = async (
            discussionNumber: number,
            body: string,
            replyToId?: string,
        ) => {
            const response = await $fetch<{ discussion: DiscussionDetail }>(
                `/api/discussions/${discussionNumber}/comments`,
                {
                    method: "POST",
                    body: { body, replyToId },
                },
            );

            upsertDiscussionDetail(response.discussion);
            return response.discussion;
        };

        const toggleReaction = async (
            discussionNumber: number,
            subjectId: string,
            content: ReactionContent,
            viewerHasReacted: boolean,
        ) => {
            await $fetch("/api/discussions/reactions", {
                method: "POST",
                body: {
                    subjectId,
                    content,
                    viewerHasReacted,
                },
            });

            return ensureDiscussion(discussionNumber, { force: true });
        };

        const logout = async () => {
            await $fetch("/api/auth/logout", { method: "POST" });
            authSession.value = { ...defaultAuthSession };
            hasLoadedAuthSession.value = false;
            return ensureAuthSession({ force: true });
        };

        return {
            authSession,
            createDiscussion,
            discussionDetails,
            discussionErrors,
            discussionList,
            discussionLoadingStates,
            ensureAuthSession,
            ensureDiscussion,
            ensureDiscussionList,
            hasLoadedAuthSession,
            hasLoadedDiscussionDetails,
            hasLoadedDiscussionList,
            isLoadingDiscussions,
            listError,
            logout,
            postComment,
            toggleReaction,
        };
    },
);
