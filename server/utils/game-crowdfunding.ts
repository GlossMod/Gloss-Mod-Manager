import { randomUUID } from "node:crypto";
import {
    CROWDFUNDING_DATA_MARKER,
    CROWDFUNDING_LABEL_NAME,
    formatCnyAmount,
    getPaymentChannelName,
    type CrowdfundingGame,
    type CrowdfundingPaymentChannel,
    type CrowdfundingPaymentResponse,
    type CrowdfundingPaymentStatusResponse,
    type CrowdfundingRecord,
    type CrowdfundingRecordStatus,
    type CrowdfundingRecordWithComment,
} from "../../src/lib/game-crowdfunding";
import {
    addDiscussionComment,
    getDiscussionByNumber,
    isGitHubTokenAccessError,
    listNewGameDiscussionDetails,
    updateDiscussionComment,
    type DiscussionComment,
    type DiscussionDetail,
} from "./github-discussions";
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
    channel: CrowdfundingPaymentChannel;
}

interface PayCreateResponse {
    outTradeNo?: string;
    payUrl?: string;
    codeUrl?: string;
    order?: {
        status?: string;
    };
}

interface PayStatusResponse {
    outTradeNo?: string;
    status?: string;
    tradeStatus?: string;
    tradeState?: string;
    tradeNo?: string;
    transactionId?: string;
    totalAmount?: number;
    totalAmountFen?: number;
    paidAt?: string;
}

const STATUS_TEXT: Record<CrowdfundingRecordStatus, string> = {
    pending: "等待支付",
    paid: "已确认",
    closed: "已关闭",
};
const CROWDFUNDING_GAMES_CACHE_MS = 5 * 60 * 1000;

let crowdfundingGamesCache:
    | {
          expiresAt: number;
          games: CrowdfundingGame[];
      }
    | null = null;
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

const getCrowdfundingConfig = () => {
    const runtimeConfig = useRuntimeConfig();

    return {
        githubToken: runtimeConfig.githubToken,
        payApiBaseUrl:
            runtimeConfig.payApiBaseUrl || "https://pay.gloscai.com",
    };
};

const requireGitHubBotToken = () => {
    const token = getCrowdfundingConfig().githubToken;

    if (!token) {
        throw createError({
            statusCode: 501,
            statusMessage:
                "GitHub bot token is required for crowdfunding data updates.",
        });
    }

    return token;
};

const getCrowdfundingGitHubToken = (accessToken?: string) =>
    accessToken || requireGitHubBotToken();

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
    const additionalInfo = readDiscussionField(discussion.body, [
        "补充信息",
    ]);

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

const flattenComments = (
    comments: DiscussionComment[],
): DiscussionComment[] =>
    comments.flatMap((comment) => [
        comment,
        ...flattenComments(comment.replies || []),
    ]);

const parseRecordPayload = (
    payload: unknown,
): CrowdfundingRecord | null => {
    if (!payload || typeof payload !== "object") {
        return null;
    }

    const record = payload as Partial<CrowdfundingRecord>;
    const discussionNumber = record.discussionNumber;
    const channel =
        record.channel === "wechat" || record.channel === "alipay"
            ? record.channel
            : null;
    const status = ["pending", "paid", "closed"].includes(
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
    };
};

const parseCrowdfundingRecords = (
    discussion: DiscussionDetail,
): CrowdfundingRecordWithComment[] => {
    const records: CrowdfundingRecordWithComment[] = [];
    const pattern = new RegExp(
        `<!--\\s*${CROWDFUNDING_DATA_MARKER}\\s*([\\s\\S]*?)-->`,
        "g",
    );

    for (const comment of flattenComments(discussion.comments)) {
        for (const match of comment.body.matchAll(pattern)) {
            const payload = match[1];

            if (!payload) {
                continue;
            }

            try {
                const record = parseRecordPayload(JSON.parse(payload));

                if (record) {
                    records.push({
                        ...record,
                        commentId: comment.id,
                    });
                }
            } catch {
                // Ignore unrelated or malformed comments.
            }
        }
    }

    const recordsByTradeNo = new Map<string, CrowdfundingRecordWithComment>();

    for (const record of records) {
        recordsByTradeNo.set(record.outTradeNo, record);
    }

    return [...recordsByTradeNo.values()].sort(
        (current, next) =>
            new Date(next.createdAt).getTime() -
            new Date(current.createdAt).getTime(),
    );
};

const createCrowdfundingRecordComment = (record: CrowdfundingRecord) =>
    [
        `<!-- ${CROWDFUNDING_DATA_MARKER}`,
        JSON.stringify(record),
        "-->",
        [
            "GMM 游戏众筹记录",
            `状态：${STATUS_TEXT[record.status]}`,
            `金额：${formatCnyAmount(record.amount)}`,
            `方式：${getPaymentChannelName(record.channel)}`,
            `订单：${record.outTradeNo}`,
        ].join(" / "),
    ].join("\n");

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
            : Math.max(Math.round((targetAmount - raisedAmount) * 100) / 100, 0);
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
    if (crowdfundingGamesCache && crowdfundingGamesCache.expiresAt > Date.now()) {
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
                    current.funding.raisedAmount >= current.funding.targetAmount;
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
        payUser: payUser || `web-${randomUUID().slice(0, 8)}`,
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
    const channel =
        payload.channel === "wechat" || payload.channel === "alipay"
            ? payload.channel
            : "alipay";

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
        channel,
    };
};

const requestPaymentCreate = async (
    input: CrowdfundingPaymentInput,
    game: CrowdfundingGame,
) => {
    const baseUrl = getCrowdfundingConfig().payApiBaseUrl.replace(/\/$/, "");
    const path =
        input.channel === "wechat"
            ? "/api/pay/wechat/create"
            : "/api/pay/alipay/create";
    const response = await $fetch<PayCreateResponse>(`${baseUrl}${path}`, {
        method: "POST",
        body: {
            name: `GMM 游戏众筹：${game.gameName}`.slice(0, 96),
            amount: input.amount,
            description:
                `赞助 GMM 购买 ${game.gameName}，Discussion #${game.discussion.number}`.slice(
                    0,
                    180,
                ),
            payUser: input.payUser,
            ...(input.channel === "alipay" ? { channel: "pc" } : {}),
        },
    });

    if (!response.outTradeNo) {
        throw createError({
            statusCode: 502,
            statusMessage: "Payment provider did not return an order number.",
        });
    }

    return {
        channel: input.channel,
        outTradeNo: response.outTradeNo,
        payUrl: response.payUrl || "",
        codeUrl: response.codeUrl || "",
    };
};

const requestPaymentStatus = async (
    input: CrowdfundingPaymentStatusInput,
) => {
    const baseUrl = getCrowdfundingConfig().payApiBaseUrl.replace(/\/$/, "");
    const path =
        input.channel === "wechat"
            ? "/api/pay/wechat/status"
            : "/api/pay/alipay/status";

    return $fetch<PayStatusResponse>(`${baseUrl}${path}`, {
        query: {
            outTradeNo: input.outTradeNo,
        },
    });
};

const normalizeProviderStatus = (response: PayStatusResponse) => {
    const providerStatus =
        response.tradeStatus || response.tradeState || response.status || "";
    const isPaid =
        response.status === "paid" ||
        response.tradeStatus === "TRADE_SUCCESS" ||
        response.tradeStatus === "TRADE_FINISHED" ||
        response.tradeState === "SUCCESS";
    const isClosed =
        response.status === "closed" ||
        response.tradeStatus === "TRADE_CLOSED" ||
        response.tradeState === "CLOSED";
    const totalAmount =
        typeof response.totalAmount === "number"
            ? response.totalAmount
            : typeof response.totalAmountFen === "number"
              ? response.totalAmountFen / 100
              : null;

    return {
        providerStatus,
        isPaid,
        isClosed,
        totalAmount,
        paidAt: readString(response.paidAt) || new Date().toISOString(),
        tradeNo: readString(response.tradeNo || response.transactionId),
    };
};

export const createCrowdfundingPayment = async (
    input: CrowdfundingPaymentInput,
    accessToken?: string,
): Promise<CrowdfundingPaymentResponse> => {
    const githubToken = getCrowdfundingGitHubToken(accessToken);
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
    const record: CrowdfundingRecord = {
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
    };

    await addDiscussionComment(
        discussion.id,
        createCrowdfundingRecordComment(record),
        githubToken,
    );
    invalidateCrowdfundingGamesCache();

    const updatedDiscussion = await getDiscussionByNumber(
        input.discussionNumber,
        githubToken,
    );
    const updatedGame = await toCrowdfundingGame(updatedDiscussion);
    const savedRecord = updatedGame.funding.records.find(
        (item) => item.outTradeNo === payment.outTradeNo,
    );

    if (!savedRecord) {
        throw createError({
            statusCode: 502,
            statusMessage: "GitHub crowdfunding record was not saved.",
        });
    }

    return {
        game: updatedGame,
        payment,
        record: savedRecord,
    };
};

export const refreshCrowdfundingPaymentStatus = async (
    input: CrowdfundingPaymentStatusInput,
    accessToken?: string,
): Promise<CrowdfundingPaymentStatusResponse> => {
    const githubToken = getCrowdfundingGitHubToken(accessToken);
    const discussion = await getDiscussionByNumber(
        input.discussionNumber,
        githubToken,
    );
    const game = await toCrowdfundingGame(discussion);
    const record = game.funding.records.find(
        (item) => item.outTradeNo === input.outTradeNo,
    );

    if (!record) {
        throw createError({
            statusCode: 404,
            statusMessage: "Crowdfunding payment record was not found.",
        });
    }

    if (record.channel !== input.channel) {
        throw createError({
            statusCode: 409,
            statusMessage: "Payment channel does not match the GitHub record.",
        });
    }

    const providerResponse = await requestPaymentStatus(input);
    const providerStatus = normalizeProviderStatus(providerResponse);

    if (
        providerStatus.totalAmount !== null &&
        Math.abs(providerStatus.totalAmount - record.amount) > 0.01
    ) {
        throw createError({
            statusCode: 409,
            statusMessage: "Payment amount does not match the GitHub record.",
        });
    }

    let nextRecord = record;

    if (providerStatus.isPaid && record.status !== "paid") {
        nextRecord = {
            ...record,
            status: "paid",
            paidAt: providerStatus.paidAt,
            tradeNo: providerStatus.tradeNo || undefined,
            providerStatus: providerStatus.providerStatus,
        };
    } else if (providerStatus.isClosed && record.status === "pending") {
        nextRecord = {
            ...record,
            status: "closed",
            closedAt: new Date().toISOString(),
            providerStatus: providerStatus.providerStatus,
        };
    }

    if (nextRecord !== record) {
        const commentBody = createCrowdfundingRecordComment(nextRecord);

        try {
            await updateDiscussionComment(
                record.commentId,
                commentBody,
                githubToken,
            );
        } catch (error) {
            if (!isGitHubTokenAccessError(error)) {
                throw error;
            }

            await addDiscussionComment(discussion.id, commentBody, githubToken);
        }

        invalidateCrowdfundingGamesCache();
    }

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
        game: updatedGame,
        record: updatedRecord,
        paymentStatus:
            providerStatus.providerStatus || providerResponse.status || "",
        isPaid: updatedRecord.status === "paid",
    };
};
