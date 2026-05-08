import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";
import type { H3Event } from "h3";

const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";
const OAUTH_STATE_COOKIE = "gmm_github_oauth_state";
const OAUTH_REDIRECT_COOKIE = "gmm_github_oauth_redirect";
const SESSION_COOKIE = "gmm_github_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;
const GITHUB_OAUTH_SCOPE = [
    "read:user",
    "user:email",
    "public_repo",
    "read:discussion",
    "write:discussion",
].join(" ");

interface GitHubOAuthTokenResponse {
    access_token?: string;
    error?: string;
    error_description?: string;
}

interface GitHubUserProfile {
    login: string;
    name: string | null;
    avatar_url: string;
    html_url: string;
}

export interface GitHubViewer {
    login: string;
    name: string | null;
    avatarUrl: string;
    url: string;
}

interface GitHubSessionCookie {
    accessToken: string;
    viewer: GitHubViewer;
}

const getRuntimeAuthConfig = () => {
    const runtimeConfig = useRuntimeConfig();

    return {
        clientId: runtimeConfig.githubClientId,
        clientSecret: runtimeConfig.githubClientSecret,
        sessionSecret: runtimeConfig.sessionSecret,
    };
};

const getRequestOrigin = (event: H3Event) => getRequestURL(event).origin;

const getCookieOptions = (event: H3Event) => ({
    httpOnly: true,
    sameSite: "lax" as const,
    secure: getRequestURL(event).protocol === "https:",
    path: "/",
});

const createSessionKey = (secret: string) =>
    createHash("sha256").update(secret).digest();

const encryptSession = (session: GitHubSessionCookie, secret: string) => {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", createSessionKey(secret), iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(session), "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([iv, tag, encrypted]).toString("base64url");
};

const decryptSession = (
    payload: string,
    secret: string,
): GitHubSessionCookie | null => {
    try {
        const buffer = Buffer.from(payload, "base64url");
        const iv = buffer.subarray(0, 12);
        const tag = buffer.subarray(12, 28);
        const encrypted = buffer.subarray(28);
        const decipher = createDecipheriv(
            "aes-256-gcm",
            createSessionKey(secret),
            iv,
        );

        decipher.setAuthTag(tag);

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ]).toString("utf8");

        return JSON.parse(decrypted) as GitHubSessionCookie;
    } catch {
        return null;
    }
};

const sanitizeRedirectTo = (redirectTo: string | undefined) => {
    if (
        !redirectTo ||
        !redirectTo.startsWith("/") ||
        redirectTo.startsWith("//")
    ) {
        return "/add-new-game";
    }

    return redirectTo;
};

const getCallbackUrl = (event: H3Event) =>
    new URL("/api/auth/github/callback", getRequestOrigin(event)).toString();

const withAuthStatus = (
    event: H3Event,
    redirectTo: string,
    status: "success" | "error",
    message?: string,
) => {
    const url = new URL(redirectTo, getRequestOrigin(event));

    url.searchParams.set("auth", status);

    if (message) {
        url.searchParams.set("authMessage", message);
    } else {
        url.searchParams.delete("authMessage");
    }

    return `${url.pathname}${url.search}${url.hash}`;
};

export const isGitHubOAuthConfigured = () => {
    const config = getRuntimeAuthConfig();

    return Boolean(
        config.clientId && config.clientSecret && config.sessionSecret,
    );
};

export const createGitHubLoginUrl = (event: H3Event, redirectTo?: string) => {
    if (!isGitHubOAuthConfigured()) {
        throw createError({
            statusCode: 501,
            statusMessage:
                "GitHub OAuth is not configured. Set NUXT_GITHUB_CLIENT_ID, NUXT_GITHUB_CLIENT_SECRET and NUXT_SESSION_SECRET.",
        });
    }

    const state = randomBytes(24).toString("base64url");
    const safeRedirectTo = sanitizeRedirectTo(redirectTo);

    setCookie(event, OAUTH_STATE_COOKIE, state, {
        ...getCookieOptions(event),
        maxAge: 60 * 10,
    });
    setCookie(event, OAUTH_REDIRECT_COOKIE, safeRedirectTo, {
        ...getCookieOptions(event),
        maxAge: 60 * 10,
    });

    const authorizeUrl = new URL(GITHUB_AUTHORIZE_URL);

    authorizeUrl.searchParams.set("client_id", getRuntimeAuthConfig().clientId);
    authorizeUrl.searchParams.set("redirect_uri", getCallbackUrl(event));
    authorizeUrl.searchParams.set("scope", GITHUB_OAUTH_SCOPE);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("allow_signup", "true");

    return authorizeUrl.toString();
};

export const fetchGitHubViewer = async (
    accessToken: string,
): Promise<GitHubViewer> => {
    const profile = await $fetch<GitHubUserProfile>(GITHUB_USER_URL, {
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${accessToken}`,
            "User-Agent": "Gloss-Mod-Manager-Web",
        },
    });

    return {
        login: profile.login,
        name: profile.name,
        avatarUrl: profile.avatar_url,
        url: profile.html_url,
    };
};

export const getGitHubSession = (event: H3Event) => {
    const { sessionSecret } = getRuntimeAuthConfig();
    const cookieValue = getCookie(event, SESSION_COOKIE);

    if (!sessionSecret || !cookieValue) {
        return null;
    }

    return decryptSession(cookieValue, sessionSecret);
};

export const requireGitHubSession = (event: H3Event) => {
    const session = getGitHubSession(event);

    if (!session) {
        throw createError({
            statusCode: 401,
            statusMessage: "GitHub login is required.",
        });
    }

    return session;
};

export const clearGitHubSession = (event: H3Event) => {
    deleteCookie(event, SESSION_COOKIE, getCookieOptions(event));
};

export const completeGitHubLogin = async (event: H3Event) => {
    if (!isGitHubOAuthConfigured()) {
        throw createError({
            statusCode: 501,
            statusMessage:
                "GitHub OAuth is not configured. Set NUXT_GITHUB_CLIENT_ID, NUXT_GITHUB_CLIENT_SECRET and NUXT_SESSION_SECRET.",
        });
    }

    const query = getQuery(event);
    const code = typeof query.code === "string" ? query.code : "";
    const state = typeof query.state === "string" ? query.state : "";
    const error = typeof query.error === "string" ? query.error : "";
    const storedState = getCookie(event, OAUTH_STATE_COOKIE);
    const redirectTo = sanitizeRedirectTo(
        getCookie(event, OAUTH_REDIRECT_COOKIE),
    );

    deleteCookie(event, OAUTH_STATE_COOKIE, getCookieOptions(event));
    deleteCookie(event, OAUTH_REDIRECT_COOKIE, getCookieOptions(event));

    if (error) {
        return withAuthStatus(
            event,
            redirectTo,
            "error",
            "GitHub 登录已取消或失败。",
        );
    }

    if (!code || !state || !storedState || state !== storedState) {
        return withAuthStatus(
            event,
            redirectTo,
            "error",
            "GitHub 登录状态校验失败。",
        );
    }

    const payload = new URLSearchParams({
        client_id: getRuntimeAuthConfig().clientId,
        client_secret: getRuntimeAuthConfig().clientSecret,
        code,
        redirect_uri: getCallbackUrl(event),
        state,
    });

    const tokenResponse = await $fetch<GitHubOAuthTokenResponse>(
        GITHUB_ACCESS_TOKEN_URL,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "Gloss-Mod-Manager-Web",
            },
            body: payload.toString(),
        },
    );

    if (!tokenResponse.access_token) {
        return withAuthStatus(
            event,
            redirectTo,
            "error",
            tokenResponse.error_description || "GitHub Access Token 获取失败。",
        );
    }

    const viewer = await fetchGitHubViewer(tokenResponse.access_token);
    const sessionPayload = encryptSession(
        {
            accessToken: tokenResponse.access_token,
            viewer,
        },
        getRuntimeAuthConfig().sessionSecret,
    );

    setCookie(event, SESSION_COOKIE, sessionPayload, {
        ...getCookieOptions(event),
        maxAge: SESSION_DURATION_SECONDS,
    });

    return withAuthStatus(event, redirectTo, "success");
};
