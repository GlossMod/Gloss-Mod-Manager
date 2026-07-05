const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const GITHUB_REPO_OWNER = "GlossMod";
const GITHUB_REPO_NAME = "Gloss-Mod-Manager";
export const NEW_GAMES_CATEGORY = "new-games";

const REACTION_CONTENTS = [
    "THUMBS_UP",
    "HEART",
    "HOORAY",
    "ROCKET",
    "EYES",
] as const;

type ReactionContent = (typeof REACTION_CONTENTS)[number];

interface GraphqlResponse<TData> {
    data?: TData;
    errors?: Array<{ message: string }>;
}

interface DiscussionCategory {
    id: string;
    name: string;
}

interface GitHubActor {
    login: string;
    url: string;
    avatarUrl: string;
}

interface GraphqlLabel {
    id: string;
    name: string;
    color: string;
    description: string | null;
}

interface GraphqlReactionGroup {
    content: ReactionContent;
    viewerHasReacted: boolean;
    users: {
        totalCount: number;
    };
}

interface GraphqlDiscussionCommentNode {
    id: string;
    body: string;
    createdAt?: string;
    author?: GitHubActor | null;
    reactionGroups?: GraphqlReactionGroup[];
    replies?: {
        totalCount: number;
        nodes?: GraphqlDiscussionCommentNode[];
    };
}

interface GraphqlDiscussionNode {
    id: string;
    number: number;
    title: string;
    body: string;
    url: string;
    createdAt: string;
    author: GitHubActor | null;
    category: {
        id: string;
        name: string;
    } | null;
    comments: {
        totalCount: number;
        nodes?: GraphqlDiscussionCommentNode[];
    };
    reactionGroups?: GraphqlReactionGroup[];
    labels: {
        nodes?: GraphqlLabel[];
    };
}

export interface DiscussionConfig {
    repositoryId: string;
    categoryId: string;
}

export interface NewGameRequest {
    gameName: string;
    sourceUrl: string;
    modUrl: string;
    additionalInfo?: string;
    backlink?: string;
}

export interface CreatedDiscussion {
    id: string;
    number: number;
    title: string;
    url: string;
}

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

const isHttpUrl = (value: string) => {
    try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
};

const readString = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

const normalizeCategoryName = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "-");

const looksLikeCategoryId = (value: string) =>
    Boolean(
        value &&
        value.length > 12 &&
        normalizeCategoryName(value) !== NEW_GAMES_CATEGORY,
    );

const getRuntimeDiscussionConfig = () => {
    const runtimeConfig = useRuntimeConfig();

    return {
        token: runtimeConfig.githubToken,
        repositoryId: runtimeConfig.githubRepoId,
        categoryHint:
            runtimeConfig.githubNewGamesCategoryId ||
            runtimeConfig.public.giscusNewGamesCategoryId ||
            NEW_GAMES_CATEGORY,
    };
};

const getGitHubToken = (token?: string) =>
    token || getRuntimeDiscussionConfig().token;

const isPersonalAccessTokenAccessError = (message: string) =>
    /Resource not accessible by personal access token/i.test(message);

export const isGitHubTokenAccessError = (error: unknown) => {
    const maybeError = error as {
        statusCode?: number;
        statusMessage?: string;
        message?: string;
        data?: { githubMessage?: string };
    };
    const message = [
        maybeError.statusMessage,
        maybeError.message,
        maybeError.data?.githubMessage,
    ]
        .filter(Boolean)
        .join("\n");

    return (
        maybeError.statusCode === 403 &&
        /GitHub token cannot access|Resource not accessible by personal access token/i.test(
            message,
        )
    );
};

const requestGitHubGraphql = async <TData>(
    token: string,
    query: string,
    variables: Record<string, unknown>,
) => {
    const response = await $fetch<GraphqlResponse<TData>>(GITHUB_GRAPHQL_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "Gloss-Mod-Manager-Web",
        },
        body: {
            query,
            variables,
        },
    });

    if (response.errors?.length) {
        const githubMessage = response.errors
            .map((error) => error.message)
            .join("; ");
        const isAccessError =
            isPersonalAccessTokenAccessError(githubMessage);

        throw createError({
            statusCode: isAccessError ? 403 : 502,
            statusMessage: isAccessError
                ? [
                      "GitHub token cannot access this Discussion.",
                      "Sign in with GitHub or configure a token with repository discussion write access.",
                  ].join(" ")
                : githubMessage,
            data: { githubMessage },
        });
    }

    if (!response.data) {
        throw createError({
            statusCode: 502,
            statusMessage: "GitHub GraphQL did not return data.",
        });
    }

    return response.data;
};

const toAuthor = (author: GitHubActor | null): DiscussionAuthor | null => {
    if (!author) {
        return null;
    }

    return {
        login: author.login,
        url: author.url,
        avatarUrl: author.avatarUrl,
    };
};

const toReactionGroups = (
    reactionGroups: GraphqlReactionGroup[] = [],
): DiscussionReactionGroup[] =>
    reactionGroups
        .filter((group) => REACTION_CONTENTS.includes(group.content))
        .map((group) => ({
            content: group.content,
            count: group.users.totalCount,
            viewerHasReacted: group.viewerHasReacted,
        }))
        .filter((group) => group.count > 0 || group.viewerHasReacted);

const toDiscussionLabels = (
    labels: GraphqlDiscussionNode["labels"],
): DiscussionLabel[] =>
    (labels.nodes || []).map((label) => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description,
    }));

const toDiscussionComment = (
    comment: GraphqlDiscussionCommentNode,
): DiscussionComment => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt || "",
    author: toAuthor(comment.author || null),
    reactions: toReactionGroups(comment.reactionGroups),
    replies: (comment.replies?.nodes || []).map(toDiscussionComment),
});

const toDiscussionSummary = (
    discussion: GraphqlDiscussionNode,
): DiscussionSummary => ({
    id: discussion.id,
    number: discussion.number,
    title: discussion.title,
    body: discussion.body,
    url: discussion.url,
    createdAt: discussion.createdAt,
    author: toAuthor(discussion.author),
    commentCount: discussion.comments.totalCount,
    reactions: toReactionGroups(discussion.reactionGroups),
    labels: toDiscussionLabels(discussion.labels),
});

const isNewGamesCategory = (
    category: GraphqlDiscussionNode["category"],
    config: DiscussionConfig,
) => {
    if (!category) {
        return false;
    }

    return (
        category.id === config.categoryId ||
        normalizeCategoryName(category.name) === NEW_GAMES_CATEGORY
    );
};

export const getNewGamesDiscussionConfig = async (
    token?: string,
): Promise<DiscussionConfig> => {
    const runtimeConfig = getRuntimeDiscussionConfig();

    if (
        runtimeConfig.repositoryId &&
        looksLikeCategoryId(runtimeConfig.categoryHint)
    ) {
        return {
            repositoryId: runtimeConfig.repositoryId,
            categoryId: runtimeConfig.categoryHint,
        };
    }

    const accessToken = getGitHubToken(token);

    if (!accessToken) {
        throw createError({
            statusCode: 501,
            statusMessage:
                "GitHub token is required to resolve discussion category id.",
        });
    }

    const data = await requestGitHubGraphql<{
        repository: {
            id: string;
            discussionCategories: { nodes: DiscussionCategory[] };
        } | null;
    }>(
        accessToken,
        `query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                id
                discussionCategories(first: 100) {
                    nodes {
                        id
                        name
                    }
                }
            }
        }`,
        { owner: GITHUB_REPO_OWNER, name: GITHUB_REPO_NAME },
    );

    const repository = data.repository;

    if (!repository) {
        throw createError({
            statusCode: 404,
            statusMessage: "Repository not found.",
        });
    }

    const category = repository.discussionCategories.nodes.find((item) => {
        const normalizedName = normalizeCategoryName(item.name);
        const normalizedHint = normalizeCategoryName(
            runtimeConfig.categoryHint,
        );

        return (
            item.id === runtimeConfig.categoryHint ||
            normalizedName === normalizedHint ||
            normalizedName === NEW_GAMES_CATEGORY
        );
    });

    if (!category) {
        throw createError({
            statusCode: 404,
            statusMessage: "new-games discussion category was not found.",
        });
    }

    return {
        repositoryId: repository.id,
        categoryId: category.id,
    };
};

export const parseNewGameRequest = (body: unknown): NewGameRequest => {
    const payload =
        body && typeof body === "object"
            ? (body as Record<string, unknown>)
            : {};
    const request = {
        gameName: readString(payload.gameName).replace(/\s+/g, " "),
        sourceUrl: readString(payload.sourceUrl),
        modUrl: readString(payload.modUrl),
        additionalInfo: readString(payload.additionalInfo),
        backlink: readString(payload.backlink),
    };

    if (!request.gameName) {
        throw createError({
            statusCode: 400,
            statusMessage: "Game name is required.",
        });
    }

    if (!request.sourceUrl || !isHttpUrl(request.sourceUrl)) {
        throw createError({
            statusCode: 400,
            statusMessage: "A valid game source URL is required.",
        });
    }

    if (!request.modUrl || !isHttpUrl(request.modUrl)) {
        throw createError({
            statusCode: 400,
            statusMessage: "A valid mod URL is required.",
        });
    }

    if (request.backlink && !isHttpUrl(request.backlink)) {
        request.backlink = "";
    }

    return request;
};

export const parseDiscussionCommentInput = (body: unknown) => {
    const payload =
        body && typeof body === "object"
            ? (body as Record<string, unknown>)
            : {};
    const commentBody = readString(payload.body);
    const replyToId = readString(payload.replyToId);

    if (!commentBody) {
        throw createError({
            statusCode: 400,
            statusMessage: "Comment body is required.",
        });
    }

    return {
        body: commentBody,
        replyToId,
    };
};

export const parseReactionInput = (body: unknown) => {
    const payload =
        body && typeof body === "object"
            ? (body as Record<string, unknown>)
            : {};
    const subjectId = readString(payload.subjectId);
    const content = readString(
        payload.content,
    ).toUpperCase() as ReactionContent;
    const viewerHasReacted = Boolean(payload.viewerHasReacted);

    if (!subjectId) {
        throw createError({
            statusCode: 400,
            statusMessage: "Reaction subject id is required.",
        });
    }

    if (!REACTION_CONTENTS.includes(content)) {
        throw createError({
            statusCode: 400,
            statusMessage: "Unsupported reaction type.",
        });
    }

    return {
        subjectId,
        content,
        viewerHasReacted,
    };
};

export const createNewGameDiscussionBody = (request: NewGameRequest) =>
    [
        `游戏名称：${request.gameName}`,
        `游戏官网/商店/Steam 地址：${request.sourceUrl}`,
        `Mod 地址：${request.modUrl}`,
        `补充信息：${request.additionalInfo || "无"}`,
    ].join("\n");

export const createNewGameDiscussion = async (
    request: NewGameRequest,
    accessToken: string,
    config?: DiscussionConfig,
): Promise<CreatedDiscussion> => {
    if (!accessToken) {
        throw createError({
            statusCode: 401,
            statusMessage: "GitHub login is required to create discussions.",
        });
    }

    const discussionConfig =
        config ?? (await getNewGamesDiscussionConfig(accessToken));
    const data = await requestGitHubGraphql<{
        createDiscussion: { discussion: CreatedDiscussion };
    }>(
        accessToken,
        `mutation($input: CreateDiscussionInput!) {
            createDiscussion(input: $input) {
                discussion {
                    id
                    number
                    title
                    url
                }
            }
        }`,
        {
            input: {
                repositoryId: discussionConfig.repositoryId,
                categoryId: discussionConfig.categoryId,
                title: `新游戏请求：${request.gameName}`,
                body: createNewGameDiscussionBody(request),
            },
        },
    );

    return data.createDiscussion.discussion;
};

export const listNewGameDiscussions = async (
    token?: string,
): Promise<DiscussionSummary[]> => {
    const accessToken = getGitHubToken(token);

    if (!accessToken) {
        throw createError({
            statusCode: 501,
            statusMessage: "GitHub token is required to load discussions.",
        });
    }

    const config = await getNewGamesDiscussionConfig(accessToken);
    const data = await requestGitHubGraphql<{
        repository: {
            discussions: {
                nodes: GraphqlDiscussionNode[];
            };
        } | null;
    }>(
        accessToken,
        `query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                discussions(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
                    nodes {
                        id
                        number
                        title
                        body
                        url
                        createdAt
                        author {
                            login
                            url
                            avatarUrl
                        }
                        category {
                            id
                            name
                        }
                        comments {
                            totalCount
                        }
                        labels(first: 20) {
                            nodes {
                                id
                                name
                                color
                                description
                            }
                        }
                        reactionGroups {
                            content
                            viewerHasReacted
                            users(first: 1) {
                                totalCount
                            }
                        }
                    }
                }
            }
        }`,
        { owner: GITHUB_REPO_OWNER, name: GITHUB_REPO_NAME },
    );

    const repository = data.repository;

    if (!repository) {
        throw createError({
            statusCode: 404,
            statusMessage: "Repository not found.",
        });
    }

    return repository.discussions.nodes
        .filter((discussion) => isNewGamesCategory(discussion.category, config))
        .map(toDiscussionSummary);
};

export const listNewGameDiscussionDetails = async (
    token?: string,
): Promise<DiscussionDetail[]> => {
    const accessToken = getGitHubToken(token);

    if (!accessToken) {
        throw createError({
            statusCode: 501,
            statusMessage: "GitHub token is required to load discussions.",
        });
    }

    const config = await getNewGamesDiscussionConfig(accessToken);
    const data = await requestGitHubGraphql<{
        repository: {
            discussions: {
                nodes: GraphqlDiscussionNode[];
            };
        } | null;
    }>(
        accessToken,
        `query($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
                discussions(first: 100, orderBy: { field: CREATED_AT, direction: DESC }) {
                    nodes {
                        id
                        number
                        title
                        body
                        url
                        createdAt
                        author {
                            login
                            url
                            avatarUrl
                        }
                        category {
                            id
                            name
                        }
                        labels(first: 20) {
                            nodes {
                                id
                                name
                                color
                                description
                            }
                        }
                        comments(last: 50) {
                            totalCount
                            nodes {
                                id
                                body
                                createdAt
                                author {
                                    login
                                    url
                                    avatarUrl
                                }
                            }
                        }
                    }
                }
            }
        }`,
        { owner: GITHUB_REPO_OWNER, name: GITHUB_REPO_NAME },
    );

    const repository = data.repository;

    if (!repository) {
        throw createError({
            statusCode: 404,
            statusMessage: "Repository not found.",
        });
    }

    return repository.discussions.nodes
        .filter((discussion) => isNewGamesCategory(discussion.category, config))
        .map((discussion) => ({
            ...toDiscussionSummary(discussion),
            comments: (discussion.comments.nodes || []).map(
                toDiscussionComment,
            ),
        }));
};

export const getDiscussionByNumber = async (
    number: number,
    token?: string,
): Promise<DiscussionDetail> => {
    const accessToken = getGitHubToken(token);

    if (!accessToken) {
        throw createError({
            statusCode: 501,
            statusMessage: "GitHub token is required to load discussions.",
        });
    }

    const config = await getNewGamesDiscussionConfig(accessToken);
    const data = await requestGitHubGraphql<{
        repository: {
            discussion: GraphqlDiscussionNode | null;
        } | null;
    }>(
        accessToken,
        `query($owner: String!, $name: String!, $number: Int!) {
            repository(owner: $owner, name: $name) {
                discussion(number: $number) {
                    id
                    number
                    title
                    body
                    url
                    createdAt
                    author {
                        login
                        url
                        avatarUrl
                    }
                    category {
                        id
                        name
                    }
                    labels(first: 20) {
                        nodes {
                            id
                            name
                            color
                            description
                        }
                    }
                    comments(last: 50) {
                        totalCount
                        nodes {
                            id
                            body
                            createdAt
                            author {
                                login
                                url
                                avatarUrl
                            }
                            reactionGroups {
                                content
                                viewerHasReacted
                                users(first: 1) {
                                    totalCount
                                }
                            }
                            replies(first: 20) {
                                totalCount
                                nodes {
                                    id
                                    body
                                    createdAt
                                    author {
                                        login
                                        url
                                        avatarUrl
                                    }
                                    reactionGroups {
                                        content
                                        viewerHasReacted
                                        users(first: 1) {
                                            totalCount
                                        }
                                    }
                                }
                            }
                        }
                    }
                    reactionGroups {
                        content
                        viewerHasReacted
                        users(first: 1) {
                            totalCount
                        }
                    }
                }
            }
        }`,
        { owner: GITHUB_REPO_OWNER, name: GITHUB_REPO_NAME, number },
    );

    const discussion = data.repository?.discussion;

    if (!discussion || !isNewGamesCategory(discussion.category, config)) {
        throw createError({
            statusCode: 404,
            statusMessage: "Discussion not found.",
        });
    }

    return {
        ...toDiscussionSummary(discussion),
        comments: (discussion.comments.nodes || []).map(toDiscussionComment),
    };
};

export const addDiscussionComment = async (
    discussionId: string,
    body: string,
    accessToken: string,
    replyToId?: string,
) => {
    if (!accessToken) {
        throw createError({
            statusCode: 401,
            statusMessage: "GitHub login is required to comment.",
        });
    }

    const data = await requestGitHubGraphql<{
        addDiscussionComment: { comment: { id: string } };
    }>(
        accessToken,
        `mutation($input: AddDiscussionCommentInput!) {
            addDiscussionComment(input: $input) {
                comment {
                    id
                }
            }
        }`,
        {
            input: {
                discussionId,
                body,
                replyToId: replyToId || undefined,
            },
        },
    );

    return data.addDiscussionComment.comment;
};

export const updateDiscussionComment = async (
    commentId: string,
    body: string,
    accessToken: string,
) => {
    if (!accessToken) {
        throw createError({
            statusCode: 401,
            statusMessage: "GitHub token is required to update comments.",
        });
    }

    await requestGitHubGraphql(
        accessToken,
        `mutation($input: UpdateDiscussionCommentInput!) {
            updateDiscussionComment(input: $input) {
                comment {
                    id
                }
            }
        }`,
        {
            input: {
                commentId,
                body,
            },
        },
    );
};

export const toggleDiscussionReaction = async (
    subjectId: string,
    content: ReactionContent,
    viewerHasReacted: boolean,
    accessToken: string,
) => {
    if (!accessToken) {
        throw createError({
            statusCode: 401,
            statusMessage: "GitHub login is required to react.",
        });
    }

    const mutationName = viewerHasReacted ? "removeReaction" : "addReaction";
    const inputType = viewerHasReacted
        ? "RemoveReactionInput"
        : "AddReactionInput";

    await requestGitHubGraphql(
        accessToken,
        `mutation($input: ${inputType}!) {
            ${mutationName}(input: $input) {
                subject {
                    id
                }
            }
        }`,
        {
            input: {
                subjectId,
                content,
            },
        },
    );
};
