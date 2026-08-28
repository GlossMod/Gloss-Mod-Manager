export const CROWDFUNDING_LABEL_NAME = "无游戏";
export const CROWDFUNDING_DATA_MARKER = "gmm-game-crowdfunding:v1";

export type CrowdfundingPaymentChannel = "alipay" | "wechat";
export type CrowdfundingRecordStatus =
    | "pending"
    | "paid"
    | "closed"
    | "failed";

export interface CrowdfundingSteamPrice {
    currency: string;
    initialAmount: number;
    finalAmount: number;
    initialFormatted: string;
    finalFormatted: string;
    discountPercent: number;
    isFree: boolean;
}

export interface CrowdfundingSteamGame {
    appId: number;
    name: string;
    storeUrl: string;
    headerImage: string;
    capsuleImage: string;
    shortDescription: string;
    price: CrowdfundingSteamPrice | null;
}

export interface CrowdfundingRecord {
    version: 1;
    discussionNumber: number;
    discussionId: string;
    gameName: string;
    steamAppId: number | null;
    /** Business order number sent to the payment center as `app_order_no`. */
    outTradeNo: string;
    amount: number;
    channel: CrowdfundingPaymentChannel;
    payUser: string;
    status: CrowdfundingRecordStatus;
    createdAt: string;
    paidAt?: string;
    closedAt?: string;
    /** Payment center order number (`payment_order_no`). */
    tradeNo?: string;
    providerStatus?: string;
    /** Payment center order id (positive integer), used to query the status. */
    paymentOrderId?: number;
}

export interface CrowdfundingRecordWithComment extends CrowdfundingRecord {
    commentId: string;
}

export interface CrowdfundingGame {
    discussion: {
        id: string;
        number: number;
        title: string;
        body: string;
        url: string;
        createdAt: string;
    };
    gameName: string;
    sourceUrl: string;
    modUrl: string;
    additionalInfo: string;
    steamAppId: number | null;
    steam: CrowdfundingSteamGame | null;
    funding: {
        targetAmount: number | null;
        raisedAmount: number;
        pendingAmount: number;
        remainingAmount: number | null;
        progress: number;
        backerCount: number;
        records: CrowdfundingRecordWithComment[];
    };
}

export interface CrowdfundingGamesResponse {
    games: CrowdfundingGame[];
    generatedAt: string;
}

export interface CrowdfundingPaymentResponse {
    game: CrowdfundingGame;
    payment: {
        channel: CrowdfundingPaymentChannel;
        outTradeNo: string;
        /** Payment center order id (positive integer), required to poll status. */
        paymentOrderId: number;
        paymentOrderNo: string;
        /** Alipay renders an iframe URL; wechat has none. */
        payUrl: string;
        /** Wechat `code_url`, rendered locally as a QR code. */
        codeUrl: string;
        expiresAt: string;
    };
    record: CrowdfundingRecordWithComment;
}

export interface CrowdfundingPaymentStatusResponse {
    game: CrowdfundingGame;
    record: CrowdfundingRecordWithComment;
    paymentStatus: string;
    isPaid: boolean;
}

export const formatCnyAmount = (amount: number | null | undefined) => {
    if (typeof amount !== "number" || !Number.isFinite(amount)) {
        return "待确认";
    }

    return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
    }).format(amount);
};

export const getPaymentChannelName = (
    channel: CrowdfundingPaymentChannel,
) => (channel === "wechat" ? "微信支付" : "支付宝");
