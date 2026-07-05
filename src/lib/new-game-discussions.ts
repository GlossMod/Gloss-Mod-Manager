export interface GameRequest {
    gameName: string;
    sourceUrl: string;
    modUrl: string;
    additionalInfo?: string;
}

export interface GitHubViewer {
    login: string;
    name: string | null;
    avatarUrl: string;
    url: string;
}

export interface AuthSessionResponse {
    isConfigured: boolean;
    isLoggedIn: boolean;
    viewer: GitHubViewer | null;
}

export type ReactionContent =
    | "THUMBS_UP"
    | "HEART"
    | "HOORAY"
    | "ROCKET"
    | "EYES";

export interface DiscussionReactionGroup {
    content: ReactionContent;
    count: number;
    viewerHasReacted: boolean;
}

export interface DiscussionAuthor {
    login: string;
    url: string;
    avatarUrl: string;
}

export interface DiscussionLabel {
    id: string;
    name: string;
    color: string;
    description: string | null;
}

export interface DiscussionComment {
    id: string;
    body: string;
    createdAt: string;
    author: DiscussionAuthor | null;
    reactions: DiscussionReactionGroup[];
    replies: DiscussionComment[];
}

export interface DiscussionSummary {
    id: string;
    number: number;
    title: string;
    body: string;
    url: string;
    createdAt: string;
    author: DiscussionAuthor | null;
    commentCount: number;
    reactions: DiscussionReactionGroup[];
    labels: DiscussionLabel[];
}

export interface DiscussionDetail extends DiscussionSummary {
    comments: DiscussionComment[];
}

export const reactionOptions: Array<{
    content: ReactionContent;
    emoji: string;
    label: string;
}> = [
    { content: "THUMBS_UP", emoji: "👍", label: "支持" },
    { content: "HEART", emoji: "❤️", label: "喜欢" },
    { content: "HOORAY", emoji: "🎉", label: "庆祝" },
    { content: "ROCKET", emoji: "🚀", label: "推进" },
    { content: "EYES", emoji: "👀", label: "关注" },
];

export const readQueryValue = (value: unknown) => {
    if (Array.isArray(value)) {
        return typeof value[0] === "string" ? value[0] : "";
    }

    return typeof value === "string" ? value : "";
};

export const parseDiscussionNumber = (value: unknown) => {
    const parsed = Number(readQueryValue(value));

    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const normalizeRequest = (request: GameRequest): GameRequest => ({
    gameName: request.gameName.trim().replace(/\s+/g, " "),
    sourceUrl: request.sourceUrl.trim(),
    modUrl: request.modUrl.trim(),
    additionalInfo: request.additionalInfo?.trim() || "",
});

export const isHttpUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};

export const buildNewGamePageQuery = (request: GameRequest | null) => {
    const query: Record<string, string> = {};

    if (request?.gameName) {
        query.game = request.gameName;
    }

    if (request?.sourceUrl) {
        query.source = request.sourceUrl;
    }

    if (request?.modUrl) {
        query.mod = request.modUrl;
    }

    if (request?.additionalInfo) {
        query.info = request.additionalInfo;
    }

    return query;
};

export const buildDiscussionDetailPath = (discussionNumber: number) =>
    `/add-new-game/${discussionNumber}`;

export const formatDiscussionDate = (value: string) =>
    new Intl.DateTimeFormat("zh-CN", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));

export const getReactionState = (
    reactions: DiscussionReactionGroup[],
    content: ReactionContent,
) =>
    reactions.find((reaction) => reaction.content === content) || {
        content,
        count: 0,
        viewerHasReacted: false,
    };

export const toDiscussionSummary = (
    discussion: DiscussionDetail,
): DiscussionSummary => ({
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    body: discussion.body,
    url: discussion.url,
    createdAt: discussion.createdAt,
    author: discussion.author,
    commentCount: discussion.commentCount,
    reactions: discussion.reactions,
    labels: discussion.labels,
});

export const defaultAuthSession: AuthSessionResponse = {
    isConfigured: false,
    isLoggedIn: false,
    viewer: null,
};
