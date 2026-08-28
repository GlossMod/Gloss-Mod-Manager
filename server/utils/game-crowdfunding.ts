import { randomUUID } from "node:crypto";
import {
    CROWDFUNDING_DATA_MARKER,
    CROWDFUNDING_LABEL_NAME,
    formatCnyAmount,
    type CrowdfundingGame,
    type CrowdfundingPaymentChannel,
    type CrowdfundingPaymentResponse,
    type CrowdfundingPaymentStatusResponse,
    type CrowdfundingRecord,
    type CrowdfundingRecordStatus,
    type CrowdfundingRecordWithComment,
} from "../../src/lib/game-crowdfunding";
import {
    GITHUB_REPO_NAME,
    GITHUB_REPO_OWNER,
    addDiscussionComment,
    getDiscussionByNumber,
    listNewGameDiscussionDetails,
    updateDiscussionComment,
    type DiscussionComment,
    type DiscussionDetail,
} from "./github-discussions";
import {
    createPayOrder,
    getPayOrder,
    readPayOrderCredentials,
    type PayOrder,
} from "./pay-client";
import { readSteamAppId, resolveSteamGame } from "./steam-store";

interface ParsedDiscussionGame {
    gameName: string;
    sourceUrl: string;
    modUrl: string;
    additionalInfo: string;
    steamAppId: number | null;
}

interface CrowdfundingPaymentInput {
    discussionNumber: number;
    amount: number;
    channel: CrowdfundingPaymentChannel;
    payUser: string;
}

interface CrowdfundingPaymentStatusInput {
    discussionNumber: number;
    outTradeNo: string;
    /** Payment center order id; the status query addresses the order by id. */
    paymentOrderId: number | null;
    channel: CrowdfundingPaymentChannel;
    amount: number | null;
    payUser: string;
}

interface DiscussionBotReplyResponse {
    comment?: {
        id: string;
        url?: string;
    };
}

interface SavedDiscussionReply {
    id: string;
    url?: string;
}

const CROWDFUNDING_GAMES_CACHE_MS = 5 * 60 * 1000;

let crowdfundingGamesCache: {
    expiresAt: number;
    games: CrowdfundingGame[];
} | null = null;
let crowdfundingGamesRequest: Promise<CrowdfundingGame[]> | null = null;

const readString = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";

const toPositiveAmount = (value: unknown) => {
    const amount = Number(value);

    if (!Number.isFinite(amount)) {
        return 0;
    }

    return Math.round(amount * 100) / 100;
};

/** The payment center only accepts non-negative integer fen. */
const toAmountFen = (amount: number) => Math.round(amount * 100);

/**
 * Reads a payment center order id. The id is a positive integer, but it arrives
 * as a number from the provider and may arrive as a string from JSON clients.
 */
const readOrderId = (value: unknown) => {
    const id = typeof value === "string" ? Number(value.trim()) : Number(value);

    return Number.isInteger(id) && id > 0 ? id : null;
};

const getCrowdfundingConfig = () => {
    const runtimeConfig = useRuntimeConfig();

    return {
        discussionBotApiBaseUrl:
            runtimeConfig.discussionBotApiBaseUrl || "https://bot.gloscai.com",
        discussionBotApiToken: runtimeConfig.discussionBotApiToken,
        githubToken: runtimeConfig.githubToken,
        payApiBaseUrl: runtimeConfig.payApiBaseUrl || "https://pay.gloscai.com",
    };
};

const requireGitHubBotToken = () => {
    const token = getCrowdfundingConfig().githubToken;

    if (!token) {
        throw createError({
            statusCode: 501,
            statusMessage:
                "GitHub token is required to read crowdfunding discussions.",
        });
    }

    return token;
};

const getCrowdfundingGitHubToken = () => requireGitHubBotToken();

const getDiscussionBotRequestConfig = () => {
    const config = getCrowdfundingConfig();
    const headers: Record<string, string> = {};

    if (config.discussionBotApiToken) {
        headers.Authorization = `Bearer ${config.discussionBotApiToken}`;
        headers["x-glosc-token"] = config.discussionBotApiToken;
    }

    return {
        baseUrl: config.discussionBotApiBaseUrl.replace(/\/$/, ""),
        headers,
    };
};

const createDiscussionBotReply = async ({
    body,
    discussionNumber,
}: {
    body: string;
    discussionNumber: number;
}): Promise<SavedDiscussionReply> => {
    const bot = getDiscussionBotRequestConfig();
    const response = await $fetch<DiscussionBotReplyResponse>(
        `${bot.baseUrl}/api/discussions/replies`,
        {
            method: "POST",
            headers: bot.headers,
            body: {
                body,
                discussionNumber,
                owner: GITHUB_REPO_OWNER,
                repo: GITHUB_REPO_NAME,
            },
        },
    );

    if (!response.comment?.id) {
        throw createError({
            statusCode: 502,
            statusMessage: "Glosc bot did not return a Discussion comment id.",
        });
    }

    return response.comment;
};

const updateDiscussionBotReply = async (
    commentId: string,
    body: string,
): Promise<SavedDiscussionReply> => {
    const bot = getDiscussionBotRequestConfig();
    const response = await $fetch<DiscussionBotReplyResponse>(
        `${bot.baseUrl}/api/discussions/replies/${encodeURIComponent(
            commentId,
        )}`,
        {
            method: "PATCH",
            headers: bot.headers,
            body: {
                body,
                owner: GITHUB_REPO_OWNER,
                repo: GITHUB_REPO_NAME,
            },
        },
    );

    if (!response.comment?.id) {
        throw createError({
            statusCode: 502,
            statusMessage:
                "Glosc bot did not return an updated Discussion comment id.",
        });
    }

    return response.comment;
};

const getErrorMessage = (error: unknown) => {
    const payload = error as {
        data?: { error?: string; message?: string };
        message?: string;
        statusMessage?: string;
    };

    return (
        payload.data?.error ||
        payload.data?.message ||
        payload.statusMessage ||
        payload.message ||
        "Unknown error"
    );
};

const throwCrowdfundingRecordSaveError = (
    action: "create" | "update",
    botError: unknown,
    fallbackError: unknown,
): never => {
    throw createError({
        statusCode: 502,
        statusMessage: [
            `Crowdfunding record ${action} failed.`,
            `Bot: ${getErrorMessage(botError)}.`,
            `GitHub fallback: ${getErrorMessage(fallbackError)}.`,
        ].join(" "),
    });
};

const createCrowdfundingRecordReply = async (
    discussion: DiscussionDetail,
    body: string,
    githubToken: string,
): Promise<SavedDiscussionReply> => {
    try {
        return await createDiscussionBotReply({
            body,
            discussionNumber: discussion.number,
        });
    } catch (botError) {
        try {
            return await addDiscussionComment(discussion.id, body, githubToken);
        } catch (fallbackError) {
            return throwCrowdfundingRecordSaveError(
                "create",
                botError,
                fallbackError,
            );
        }
    }
};

const updateCrowdfundingRecordReply = async (
    discussion: DiscussionDetail,
    commentId: string,
    body: string,
    githubToken: string,
): Promise<SavedDiscussionReply> => {
    try {
        return await updateDiscussionBotReply(commentId, body);
    } catch (botError) {
        try {
            await updateDiscussionComment(commentId, body, githubToken);

            return { id: commentId };
        } catch {
            try {
                return await addDiscussionComment(
                    discussion.id,
                    body,
                    githubToken,
                );
            } catch (replyError) {
                return throwCrowdfundingRecordSaveError(
                    "update",
                    botError,
                    replyError,
                );
            }
        }
    }
};

const readDiscussionField = (body: string, labels: string[]) => {
    const normalizedLabels = labels.map((label) => label.toLowerCase());

    for (const line of body.split(/\r?\n/)) {
        const [rawKey = "", ...rest] = line.split(/[：:]/);
        const key = rawKey.trim().toLowerCase();

        if (normalizedLabels.includes(key)) {
            return rest.join(":").trim();
        }
    }

    return "";
};

const parseGameNameFromTitle = (title: string) =>
    title.replace(/^新游戏请求[：:]\s*/u, "").trim();

const parseDiscussionGame = (
    discussion: DiscussionDetail,
): ParsedDiscussionGame => {
    const gameName =
        readDiscussionField(discussion.body, ["游戏名称"]) ||
        parseGameNameFromTitle(discussion.title) ||
        discussion.title;
    const sourceUrl = readDiscussionField(discussion.body, [
        "游戏官网/商店/steam 地址",
        "游戏官网/商店/Steam 地址",
        "Steam 地址",
        "商店地址",
    ]);
    const modUrl = readDiscussionField(discussion.body, [
        "Mod 地址",
        "MOD 地址",
    ]);
    const additionalInfo = readDiscussionField(discussion.body, ["补充信息"]);

    return {
        gameName,
        sourceUrl,
        modUrl,
        additionalInfo,
        steamAppId: readSteamAppId(sourceUrl, discussion.body),
    };
};

const hasCrowdfundingLabel = (discussion: DiscussionDetail) =>
    discussion.labels.some((label) => label.name === CROWDFUNDING_LABEL_NAME);

const flattenComments = (comments: DiscussionComment[]): DiscussionComment[] =>
    comments.flatMap((comment) => [
        comment,
        ...flattenComments(comment.replies || []),
    ]);

const parseRecordPayload = (payload: unknown): CrowdfundingRecord | null => {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const record = payload as Partial<CrowdfundingRecord>;
    const discussionNumber = record.discussionNumber;
    const channel =
        record.channel === "wechat" || record.channel === "alipay"
            ? record.channel
            : null;
    const status = ["pending", "paid", "closed", "failed"].includes(
        readString(record.status),
    )
        ? (record.status as CrowdfundingRecordStatus)
        : null;

    if (
        record.version !== 1 ||
        typeof discussionNumber !== "number" ||
        !Number.isInteger(discussionNumber) ||
        !readString(record.discussionId) ||
        !readString(record.gameName) ||
        !readString(record.outTradeNo) ||
        !channel ||
        !status
    ) {
        return null;
    }

    const amount = toPositiveAmount(record.amount);

    if (amount <= 0) {
        return null;
    }

    return {
        version: 1,
        discussionNumber,
        discussionId: readString(record.discussionId),
        gameName: readString(record.gameName),
        steamAppId:
            typeof record.steamAppId === "number" &&
            Number.isInteger(record.steamAppId) &&
            record.steamAppId > 0
                ? record.steamAppId
                : null,
        outTradeNo: readString(record.outTradeNo),
        amount,
        channel,
        payUser: readString(record.payUser) || "anonymous",
        status,
        createdAt: readString(record.createdAt) || new Date().toISOString(),
        paidAt: readString(record.paidAt) || undefined,
        closedAt: readString(record.closedAt) || undefined,
        tradeNo: readString(record.tradeNo) || undefined,
        providerStatus: readString(record.providerStatus) || undefined,
        paymentOrderId: readOrderId(record.paymentOrderId) ?? undefined,
    };
};

const parseSummaryRecords = (payload: unknown): CrowdfundingRecord[] | null => {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const summary = payload as {
        records?: unknown;
        version?: unknown;
    };

    if (summary.version !== 1 || !Array.isArray(summary.records)) {
        return null;
    }

    return summary.records
        .map((record) => parseRecordPayload(record))
        .filter((record): record is CrowdfundingRecord => Boolean(record));
};

const readCrowdfundingMarkerPayloads = (body: string) => {
    const payloads: unknown[] = [];
    const pattern = new RegExp(
        `<!--\\s*${CROWDFUNDING_DATA_MARKER}\\s*([\\s\\S]*?)-->`,
        "g",
    );

    for (const match of body.matchAll(pattern)) {
        const payload = match[1];

        if (!payload) {
            continue;
        }

        try {
            payloads.push(JSON.parse(payload));
        } catch {
            // Ignore unrelated or malformed comments.
        }
    }

    return payloads;
};

const parseCrowdfundingRecords = (
    discussion: DiscussionDetail,
): CrowdfundingRecordWithComment[] => {
    const records: CrowdfundingRecordWithComment[] = [];

    for (const comment of flattenComments(discussion.comments)) {
        for (const payload of readCrowdfundingMarkerPayloads(comment.body)) {
            const summaryRecords = parseSummaryRecords(payload);

            if (summaryRecords) {
                records.push(
                    ...summaryRecords.map((record) => ({
                        ...record,
                        commentId: comment.id,
                    })),
                );
                continue;
            }

            const record = parseRecordPayload(payload);

            if (record) {
                records.push({
                    ...record,
                    commentId: comment.id,
                });
            }
        }
    }

    const recordsByTradeNo = new Map<string, CrowdfundingRecordWithComment>();

    for (const record of records) {
        const current = recordsByTradeNo.get(record.outTradeNo);

        if (
            !current ||
            (current.status !== "paid" && record.status === "paid")
        ) {
            recordsByTradeNo.set(record.outTradeNo, record);
        }
    }

    return [...recordsByTradeNo.values()].sort(
        (current, next) =>
            new Date(next.createdAt).getTime() -
            new Date(current.createdAt).getTime(),
    );
};

const findCrowdfundingSummaryComment = (
    discussion: DiscussionDetail,
): DiscussionComment | null => {
    for (const comment of flattenComments(discussion.comments)) {
        if (
            readCrowdfundingMarkerPayloads(comment.body).some((payload) =>
                Boolean(parseSummaryRecords(payload)),
            )
        ) {
            return comment;
        }
    }

    return null;
};

const uniquePayUsers = (records: CrowdfundingRecord[]) => [
    ...new Set(
        records.map((record) => readString(record.payUser)).filter(Boolean),
    ),
];

const createCrowdfundingProgressComment = (
    game: CrowdfundingGame,
    records: CrowdfundingRecord[],
) => {
    const paidRecords = records.filter((record) => record.status === "paid");
    const raisedAmount = toPositiveAmount(
        paidRecords.reduce((total, record) => total + record.amount, 0),
    );
    const participantText = uniquePayUsers(paidRecords).join("、") || "暂无";

    return [
        `<!-- ${CROWDFUNDING_DATA_MARKER}`,
        JSON.stringify({
            version: 1,
            type: "summary",
            discussionNumber: game.discussion.number,
            discussionId: game.discussion.id,
            gameName: game.gameName,
            steamAppId: game.steamAppId,
            records: paidRecords,
        }),
        "-->",
        `游戏众筹进度：${formatCnyAmount(raisedAmount)}/${formatCnyAmount(game.funding.targetAmount)}`,
        `参与人员：${participantText}`,
        `参与众筹: https://gmm.aoe.top/crowdfunding`,
    ].join("\n");
};

const toFundingSummary = (
    records: CrowdfundingRecordWithComment[],
    targetAmount: number | null,
) => {
    const paidRecords = records.filter((record) => record.status === "paid");
    const pendingRecords = records.filter(
        (record) => record.status === "pending",
    );
    const raisedAmount = toPositiveAmount(
        paidRecords.reduce((total, record) => total + record.amount, 0),
    );
    const pendingAmount = toPositiveAmount(
        pendingRecords.reduce((total, record) => total + record.amount, 0),
    );
    const remainingAmount =
        targetAmount === null
            ? null
            : Math.max(
                  Math.round((targetAmount - raisedAmount) * 100) / 100,
                  0,
              );
    const progress =
        targetAmount === null
            ? 0
            : targetAmount <= 0
              ? 100
              : Math.min(Math.round((raisedAmount / targetAmount) * 100), 100);

    return {
        targetAmount,
        raisedAmount,
        pendingAmount,
        remainingAmount,
        progress,
        backerCount: paidRecords.length,
        records,
    };
};

const withCrowdfundingRecord = (
    game: CrowdfundingGame,
    record: CrowdfundingRecordWithComment,
): CrowdfundingGame => ({
    ...game,
    funding: toFundingSummary(
        [
            record,
            ...game.funding.records.filter(
                (item) => item.outTradeNo !== record.outTradeNo,
            ),
        ],
        game.funding.targetAmount,
    ),
});

const createSyntheticCrowdfundingRecord = (
    input: CrowdfundingPaymentInput | CrowdfundingPaymentStatusInput,
    discussion: DiscussionDetail,
    game: CrowdfundingGame,
    status: CrowdfundingRecordStatus,
    providerStatus?: string,
): CrowdfundingRecordWithComment => ({
    version: 1,
    discussionNumber: discussion.number,
    discussionId: discussion.id,
    gameName: game.gameName,
    steamAppId: game.steamAppId,
    outTradeNo:
        "outTradeNo" in input ? input.outTradeNo : `pending-${randomUUID()}`,
    amount: input.amount || 0,
    channel: input.channel,
    payUser: readString(input.payUser) || "匿名",
    status,
    createdAt: new Date().toISOString(),
    providerStatus,
    paymentOrderId:
        "paymentOrderId" in input
            ? (input.paymentOrderId ?? undefined)
            : undefined,
    commentId: "",
});

const upsertPaidCrowdfundingProgressReply = async (
    discussion: DiscussionDetail,
    game: CrowdfundingGame,
    record: CrowdfundingRecordWithComment,
    githubToken: string,
): Promise<CrowdfundingRecordWithComment> => {
    const paidRecord: CrowdfundingRecordWithComment = {
        ...record,
        status: "paid",
    };
    const paidRecords = [
        ...game.funding.records.filter(
            (item) =>
                item.status === "paid" &&
                item.outTradeNo !== paidRecord.outTradeNo,
        ),
        paidRecord,
    ].sort(
        (current, next) =>
            new Date(current.createdAt).getTime() -
            new Date(next.createdAt).getTime(),
    );
    const commentBody = createCrowdfundingProgressComment(game, paidRecords);
    const summaryComment = findCrowdfundingSummaryComment(discussion);
    const savedReply = summaryComment
        ? await updateCrowdfundingRecordReply(
              discussion,
              summaryComment.id,
              commentBody,
              githubToken,
          )
        : await createCrowdfundingRecordReply(
              discussion,
              commentBody,
              githubToken,
          );

    return {
        ...paidRecord,
        commentId: savedReply.id || summaryComment?.id || record.commentId,
    };
};

const toCrowdfundingGame = async (
    discussion: DiscussionDetail,
): Promise<CrowdfundingGame> => {
    const parsedGame = parseDiscussionGame(discussion);
    const steam = await resolveSteamGame({
        appId: parsedGame.steamAppId,
        gameName: parsedGame.gameName,
    });
    const steamAppId = steam?.appId || parsedGame.steamAppId;
    const targetAmount =
        typeof steam?.price?.finalAmount === "number"
            ? steam.price.finalAmount
            : null;

    return {
        discussion: {
            id: discussion.id,
            number: discussion.number,
            title: discussion.title,
            body: discussion.body,
            url: discussion.url,
            createdAt: discussion.createdAt,
        },
        gameName: parsedGame.gameName,
        sourceUrl: parsedGame.sourceUrl,
        modUrl: parsedGame.modUrl,
        additionalInfo: parsedGame.additionalInfo,
        steamAppId,
        steam,
        funding: toFundingSummary(
            parseCrowdfundingRecords(discussion),
            targetAmount,
        ),
    };
};

export const listCrowdfundingGames = async (token?: string) => {
    if (
        crowdfundingGamesCache &&
        crowdfundingGamesCache.expiresAt > Date.now()
    ) {
        return crowdfundingGamesCache.games;
    }

    if (crowdfundingGamesRequest) {
        return crowdfundingGamesRequest;
    }

    crowdfundingGamesRequest = listNewGameDiscussionDetails(token)
        .then(async (discussions) => {
            const games = await Promise.all(
                discussions
                    .filter(hasCrowdfundingLabel)
                    .map((discussion) => toCrowdfundingGame(discussion)),
            );

            return games.sort((current, next) => {
                const currentFunded =
                    current.funding.targetAmount !== null &&
                    current.funding.raisedAmount >=
                        current.funding.targetAmount;
                const nextFunded =
                    next.funding.targetAmount !== null &&
                    next.funding.raisedAmount >= next.funding.targetAmount;

                if (currentFunded !== nextFunded) {
                    return currentFunded ? 1 : -1;
                }

                return (
                    new Date(next.discussion.createdAt).getTime() -
                    new Date(current.discussion.createdAt).getTime()
                );
            });
        })
        .then((games) => {
            crowdfundingGamesCache = {
                expiresAt: Date.now() + CROWDFUNDING_GAMES_CACHE_MS,
                games,
            };

            return games;
        })
        .catch((error) => {
            if (crowdfundingGamesCache) {
                return crowdfundingGamesCache.games;
            }

            throw error;
        })
        .finally(() => {
            crowdfundingGamesRequest = null;
        });

    return crowdfundingGamesRequest;
};

const invalidateCrowdfundingGamesCache = () => {
    crowdfundingGamesCache = null;
};

export const parseCrowdfundingPaymentInput = (
    body: unknown,
): CrowdfundingPaymentInput => {
    const payload =
        body && typeof body === "object"
            ? (body as Record<string, unknown>)
            : {};
    const discussionNumber = Number(payload.discussionNumber);
    const amount = toPositiveAmount(payload.amount);
    const channel =
        payload.channel === "wechat" || payload.channel === "alipay"
            ? payload.channel
            : "alipay";
    const payUser = readString(payload.payUser).slice(0, 80);

    if (!Number.isInteger(discussionNumber) || discussionNumber <= 0) {
        throw createError({
            statusCode: 400,
            statusMessage: "A valid discussion number is required.",
        });
    }

    if (amount < 1 || amount > 9999) {
        throw createError({
            statusCode: 400,
            statusMessage: "Sponsor amount must be between 1 and 9999 CNY.",
        });
    }

    return {
        discussionNumber,
        amount,
        channel,
        payUser: payUser || "匿名",
    };
};

export const parseCrowdfundingPaymentStatusInput = (
    body: unknown,
): CrowdfundingPaymentStatusInput => {
    const payload =
        body && typeof body === "object"
            ? (body as Record<string, unknown>)
            : {};
    const discussionNumber = Number(payload.discussionNumber);
    const outTradeNo = readString(payload.outTradeNo);
    const paymentOrderId = readOrderId(payload.paymentOrderId);
    const channel =
        payload.channel === "wechat" || payload.channel === "alipay"
            ? payload.channel
            : "alipay";
    const amount = toPositiveAmount(payload.amount);
    const payUser = readString(payload.payUser).slice(0, 80);

    if (!Number.isInteger(discussionNumber) || discussionNumber <= 0) {
        throw createError({
            statusCode: 400,
            statusMessage: "A valid discussion number is required.",
        });
    }

    if (!outTradeNo) {
        throw createError({
            statusCode: 400,
            statusMessage: "Payment order number is required.",
        });
    }

    return {
        discussionNumber,
        outTradeNo,
        paymentOrderId,
        channel,
        amount: amount > 0 ? amount : null,
        payUser: payUser || "匿名",
    };
};

const createCrowdfundingOrderNo = (discussionNumber: number) =>
    `gmm-cf-${discussionNumber}-${Date.now().toString(36)}-${randomUUID().slice(
        0,
        8,
    )}`;

const requestPaymentCreate = async (
    input: CrowdfundingPaymentInput,
    game: CrowdfundingGame,
) => {
    const appOrderNo = createCrowdfundingOrderNo(game.discussion.number);
    const order = await createPayOrder({
        app_order_no: appOrderNo,
        amount_fen: toAmountFen(input.amount),
        subject: `GMM 游戏众筹：${game.gameName}`.slice(0, 96),
        channel: input.channel,
        // The dialog renders the credential itself: an iframe for alipay and a
        // locally drawn QR code for wechat.
        payment_form: "native_qr",
        metadata: {
            discussionNumber: String(game.discussion.number),
            gameName: game.gameName.slice(0, 120),
            payUser: input.payUser,
        },
    });
    const credentials = readPayOrderCredentials(order);

    return {
        channel: input.channel,
        outTradeNo: order.app_order_no || appOrderNo,
        paymentOrderId: order.id,
        paymentOrderNo: order.payment_order_no || "",
        payUrl: credentials.iframeUrl || credentials.qrCodeUrl,
        codeUrl: credentials.codeUrl,
        expiresAt: order.expires_at || "",
    };
};

const normalizeProviderStatus = (order: PayOrder) => ({
    providerStatus: order.status,
    isPaid: order.status === "paid",
    isClosed: order.status === "closed" || order.status === "failed",
    recordStatus: (order.status === "failed"
        ? "failed"
        : order.status === "closed"
          ? "closed"
          : order.status) as CrowdfundingRecordStatus,
    // Amounts are integer fen on the wire; the record keeps yuan.
    totalAmount:
        typeof order.amount_fen === "number" && Number.isFinite(order.amount_fen)
            ? toPositiveAmount(order.amount_fen / 100)
            : null,
    paidAt: readString(order.paid_at) || new Date().toISOString(),
    tradeNo: readString(order.payment_order_no),
});

export const createCrowdfundingPayment = async (
    input: CrowdfundingPaymentInput,
): Promise<CrowdfundingPaymentResponse> => {
    const githubToken = getCrowdfundingGitHubToken();
    const discussion = await getDiscussionByNumber(
        input.discussionNumber,
        githubToken,
    );

    if (!hasCrowdfundingLabel(discussion)) {
        throw createError({
            statusCode: 404,
            statusMessage: "Discussion is not marked as a crowdfunding game.",
        });
    }

    const game = await toCrowdfundingGame(discussion);
    const payment = await requestPaymentCreate(input, game);
    const record: CrowdfundingRecordWithComment = {
        version: 1,
        discussionNumber: discussion.number,
        discussionId: discussion.id,
        gameName: game.gameName,
        steamAppId: game.steamAppId,
        outTradeNo: payment.outTradeNo,
        amount: input.amount,
        channel: input.channel,
        payUser: input.payUser,
        status: "pending",
        createdAt: new Date().toISOString(),
        tradeNo: payment.paymentOrderNo || undefined,
        paymentOrderId: payment.paymentOrderId,
        commentId: "",
    };

    return {
        game,
        payment,
        record,
    };
};

export const refreshCrowdfundingPaymentStatus = async (
    input: CrowdfundingPaymentStatusInput,
): Promise<CrowdfundingPaymentStatusResponse> => {
    const githubToken = getCrowdfundingGitHubToken();
    const discussion = await getDiscussionByNumber(
        input.discussionNumber,
        githubToken,
    );
    const game = await toCrowdfundingGame(discussion);
    const existingRecord = game.funding.records.find(
        (item) => item.outTradeNo === input.outTradeNo,
    );

    if (existingRecord && existingRecord.channel !== input.channel) {
        throw createError({
            statusCode: 409,
            statusMessage: "Payment channel does not match the GitHub record.",
        });
    }

    const expectedAmount = existingRecord?.amount || input.amount;
    const paymentOrderId =
        input.paymentOrderId || existingRecord?.paymentOrderId || null;

    if (!paymentOrderId) {
        throw createError({
            statusCode: 400,
            statusMessage: "A payment order id is required to query the status.",
        });
    }

    const providerOrder = await getPayOrder(paymentOrderId);

    if (
        providerOrder.app_order_no &&
        providerOrder.app_order_no !== input.outTradeNo
    ) {
        throw createError({
            statusCode: 409,
            statusMessage: "Payment order does not match the requested record.",
        });
    }

    const providerStatus = normalizeProviderStatus(providerOrder);

    if (
        providerStatus.isPaid &&
        providerStatus.totalAmount !== null &&
        expectedAmount !== null &&
        Math.abs(providerStatus.totalAmount - expectedAmount) > 0.01
    ) {
        throw createError({
            statusCode: 409,
            statusMessage: "Payment amount does not match the GitHub record.",
        });
    }

    if (providerStatus.isPaid && !existingRecord && input.amount === null) {
        throw createError({
            statusCode: 400,
            statusMessage:
                "Sponsor amount is required before saving a paid crowdfunding record.",
        });
    }

    let nextRecord: CrowdfundingRecordWithComment =
        existingRecord ||
        createSyntheticCrowdfundingRecord(
            input,
            discussion,
            game,
            "pending",
            providerStatus.providerStatus,
        );

    if (providerStatus.isPaid) {
        nextRecord = {
            ...nextRecord,
            amount: expectedAmount || nextRecord.amount,
            status: "paid",
            paidAt: providerStatus.paidAt,
            tradeNo: providerStatus.tradeNo || undefined,
            providerStatus: providerStatus.providerStatus,
            paymentOrderId,
        };
    } else if (providerStatus.isClosed && nextRecord.status === "pending") {
        nextRecord = {
            ...nextRecord,
            status: providerStatus.recordStatus,
            closedAt: new Date().toISOString(),
            providerStatus: providerStatus.providerStatus,
            paymentOrderId,
        };
    }

    if (providerStatus.isPaid) {
        nextRecord = await upsertPaidCrowdfundingProgressReply(
            discussion,
            game,
            nextRecord,
            githubToken,
        );
        invalidateCrowdfundingGamesCache();

        const updatedDiscussion = await getDiscussionByNumber(
            input.discussionNumber,
            githubToken,
        );
        const updatedGame = await toCrowdfundingGame(updatedDiscussion);
        const updatedRecord =
            updatedGame.funding.records.find(
                (item) => item.outTradeNo === input.outTradeNo,
            ) || nextRecord;

        return {
            game: updatedGame.funding.records.some(
                (item) => item.outTradeNo === input.outTradeNo,
            )
                ? updatedGame
                : withCrowdfundingRecord(updatedGame, updatedRecord),
            record: updatedRecord,
            paymentStatus: providerStatus.providerStatus,
            isPaid: true,
        };
    }

    return {
        game,
        record: nextRecord,
        paymentStatus: providerStatus.providerStatus,
        isPaid: false,
    };
};
