import { createHash, createHmac, randomBytes } from "node:crypto";

const PAY_ORDERS_PATH = "/api/v1/pay/orders";
const EMPTY_BODY_SHA256 =
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export type PayChannel = "wechat" | "alipay" | "apple_pay";
export type PayPaymentForm =
    | "native_qr"
    | "h5"
    | "jsapi"
    | "mini_program"
    | "app";
export type PayOrderStatus = "pending" | "paid" | "closed" | "failed";

export interface PayPaymentParams {
    code_url?: string;
    qr_iframe_url?: string;
    h5_url?: string;
    order_string?: string;
    [key: string]: unknown;
}

export interface PayOrder {
    /** Positive integer, despite the docs' `pay_01J...` examples. */
    id: number;
    payment_order_no: string;
    app_order_no: string;
    amount_fen: number;
    currency?: string;
    status: PayOrderStatus;
    /** The live API returns `channel_type`, not `channel`. */
    channel_type?: PayChannel;
    payment_form: PayPaymentForm;
    qr_code_url?: string;
    payment_params?: PayPaymentParams;
    checkout_token?: string;
    checkout_url?: string;
    expires_at?: string;
    paid_at?: string;
}

export interface CreatePayOrderInput {
    app_order_no: string;
    amount_fen: number;
    subject: string;
    channel: PayChannel;
    payment_form?: PayPaymentForm;
    notify_url?: string;
    return_url?: string;
    payer_id?: string;
    payer_client_ip?: string;
    enable_checkout?: boolean;
    metadata?: Record<string, string>;
}

interface PayApiRequest {
    method: "GET" | "POST";
    /** RequestURI (path plus query) — it is signed as canonical line 2. */
    path: string;
    body?: unknown;
    idempotencyKey?: string;
}

const getPayApiConfig = () => {
    const runtimeConfig = useRuntimeConfig();
    const baseUrl = (
        runtimeConfig.payApiBaseUrl || "https://pay.gloscai.com"
    ).replace(/\/$/, "");

    if (!runtimeConfig.payAppKey || !runtimeConfig.payAppSecret) {
        throw createError({
            statusCode: 501,
            statusMessage:
                "Payment app key and secret are required to reach the payment center.",
        });
    }

    return {
        baseUrl,
        appKey: runtimeConfig.payAppKey,
        appSecret: runtimeConfig.payAppSecret,
    };
};

const readPayApiError = (error: unknown) => {
    const payload = error as {
        data?: { error?: { code?: string; message?: string } };
        response?: { status?: number };
        statusCode?: number;
        statusMessage?: string;
        message?: string;
    };

    return {
        code: payload.data?.error?.code || "",
        status: payload.response?.status || payload.statusCode || 0,
        message:
            payload.data?.error?.message ||
            payload.statusMessage ||
            payload.message ||
            "Unknown payment center error",
    };
};

/**
 * Transient failures worth another signed attempt. A replayed nonce is never
 * retried: it means a previous attempt already reached the server.
 */
const isRetryablePayApiError = (code: string, status: number) =>
    code === "internal_error" || (!code && status >= 500);

const wait = (ms: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

/**
 * Signs and sends a request to the payment center's server plane.
 *
 * The canonical string is five `\n` separated lines: method, RequestURI,
 * timestamp, nonce and the hex SHA-256 of the raw request body. The exact bytes
 * that get signed are the bytes that get sent, so the body is serialized once
 * up front and handed to `$fetch` as a string.
 */
const requestPayApi = async <T>(request: PayApiRequest): Promise<T> => {
    const { baseUrl, appKey, appSecret } = getPayApiConfig();
    const bodyText =
        request.body === undefined ? "" : JSON.stringify(request.body);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomBytes(16).toString("hex");
    const bodyDigest = bodyText
        ? createHash("sha256").update(bodyText, "utf8").digest("hex")
        : EMPTY_BODY_SHA256;
    const canonical = [
        request.method,
        request.path,
        timestamp,
        nonce,
        bodyDigest,
    ].join("\n");
    const headers: Record<string, string> = {
        "X-Pay-App-Key": appKey,
        "X-Pay-Timestamp": timestamp,
        "X-Pay-Nonce": nonce,
        "X-Pay-Signature": createHmac("sha256", appSecret)
            .update(canonical, "utf8")
            .digest("hex"),
    };

    if (bodyText) {
        headers["Content-Type"] = "application/json";
    }

    if (request.idempotencyKey) {
        headers["Idempotency-Key"] = request.idempotencyKey;
    }

    let response: { data?: T };

    try {
        response = await $fetch<{ data?: T }>(`${baseUrl}${request.path}`, {
            method: request.method,
            headers,
            ...(bodyText ? { body: bodyText } : {}),
            // ofetch retries GET requests once by default and replays the exact
            // same headers, including this nonce. The payment center rejects the
            // second attempt as `replayed_request`, which masks the real error
            // from the first. Each attempt needs its own signature, so retries
            // belong in `requestPayApiWithRetry` below, not here.
            retry: false,
        });
    } catch (error) {
        const { code, status, message } = readPayApiError(error);

        throw createError({
            statusCode: 502,
            statusMessage: [
                "Payment center request failed.",
                code ? `${code}: ${message}` : message,
            ].join(" "),
            data: { payCode: code, payStatus: status },
        });
    }

    if (!response?.data) {
        throw createError({
            statusCode: 502,
            statusMessage: "Payment center returned an empty data envelope.",
        });
    }

    return response.data;
};

/**
 * Retries transient failures with exponential backoff, as the payment center's
 * docs ask for. Every attempt is signed afresh with a new timestamp and nonce,
 * so no attempt can be rejected as a replay of the previous one.
 */
const requestPayApiWithRetry = async <T>(
    request: PayApiRequest,
    attempts = 3,
): Promise<T> => {
    for (let attempt = 1; ; attempt += 1) {
        try {
            return await requestPayApi<T>(request);
        } catch (error) {
            const { payCode = "", payStatus = 0 } =
                ((error as { data?: { payCode?: string; payStatus?: number } })
                    .data ?? {}) as { payCode?: string; payStatus?: number };

            if (
                attempt >= attempts ||
                !isRetryablePayApiError(payCode, payStatus)
            ) {
                throw error;
            }

            await wait(200 * 2 ** (attempt - 1));
        }
    }
};

export const createPayOrder = (input: CreatePayOrderInput) =>
    requestPayApiWithRetry<PayOrder>({
        method: "POST",
        path: PAY_ORDERS_PATH,
        body: input,
        // The app order number is unique per attempt and is the provider's own
        // idempotency key, so retries reuse the existing order instead of
        // creating a duplicate.
        idempotencyKey: input.app_order_no,
    });

export const getPayOrder = (orderId: number) =>
    requestPayApiWithRetry<PayOrder>({
        method: "GET",
        path: `${PAY_ORDERS_PATH}/${encodeURIComponent(String(orderId))}`,
    });

export const readPayOrderCredentials = (order: PayOrder) => {
    const params = order.payment_params || {};

    return {
        codeUrl: typeof params.code_url === "string" ? params.code_url : "",
        iframeUrl:
            typeof params.qr_iframe_url === "string" ? params.qr_iframe_url : "",
        h5Url: typeof params.h5_url === "string" ? params.h5_url : "",
        qrCodeUrl: order.qr_code_url || "",
    };
};
