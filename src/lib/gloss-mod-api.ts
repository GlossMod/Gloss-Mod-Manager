// 统一走带超时与重试的封装，避免对端无响应时请求永久挂起。
import { requestWithRetry as httpFetch } from "@/lib/http-client";

interface IGlossApiResponse<T> {
    success: boolean;
    msg: string;
    data: T | null;
}

interface IGlossApiListData<T> {
    data: T[];
    count: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface IGlossGameModType {
    id: number;
    mods_type_name: string;
    game_id: number;
    mods_type_createTime: string | null;
}

export interface IGlossGameListItem {
    id: number;
    game_name?: string;
    game_mod_types?: IGlossGameModType[];
}

export interface IGlossModUpdateItem {
    id: number;
    mods_version: string;
}

export const GLOSS_MOD_API_BASE_URL = "https://mod.3dmgame.com/api/v3";
export const GLOSS_MOD_WEB_BASE_URL = "https://mod.3dmgame.com";
export const GLOSS_MOD_KEY = (import.meta.env.GLOSS_MOD_KEY ?? "").trim();

export function resolveGlossAssetUrl(path?: string) {
    if (!path) {
        return "";
    }

    if (/^https?:\/\//u.test(path)) {
        return path;
    }

    const normalized = path.startsWith("/") ? path : `/${path}`;

    return `${GLOSS_MOD_WEB_BASE_URL}${normalized}`;
}

export async function fetchGlossModDetail(modId: number | string) {
    const normalizedModId = String(modId ?? "").trim();

    if (!normalizedModId) {
        throw new Error("缺少有效的 Mod ID。");
    }

    if (!GLOSS_MOD_KEY) {
        throw new Error("未读取到 GLOSS_MOD_KEY，请检查 .env 配置。");
    }

    const response = await httpFetch(
        `${GLOSS_MOD_API_BASE_URL}/mods/${normalizedModId}`,
        {
            method: "GET",
            headers: {
                Accept: "application/json",
                Authorization: GLOSS_MOD_KEY,
            },
        },
    );
    const payload = (await response.json()) as IGlossApiResponse<IMod>;

    if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.msg || "读取 Mod 详情失败");
    }

    return payload.data;
}

export async function checkGlossModUpdates(modIds: number[]) {
    const normalizedModIds = [...new Set(modIds)]
        .map((modId) => Number(modId))
        .filter((modId) => Number.isFinite(modId) && modId > 0);

    if (normalizedModIds.length === 0) {
        return [] as IGlossModUpdateItem[];
    }

    if (!GLOSS_MOD_KEY) {
        throw new Error("未读取到 GLOSS_MOD_KEY，请检查 .env 配置。");
    }

    const response = await httpFetch(
        `${GLOSS_MOD_API_BASE_URL}/mods/checkUpdate`,
        {
            method: "POST",
            headers: {
                Accept: "application/json",
                Authorization: GLOSS_MOD_KEY,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                modId: normalizedModIds,
            }),
        },
    );
    const payload = (await response.json()) as IGlossApiResponse<
        | {
              data?: IGlossModUpdateItem[];
          }
        | IGlossModUpdateItem[]
    >;

    if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.msg || "检查 Mod 更新失败");
    }

    if (Array.isArray(payload.data)) {
        return payload.data;
    }

    return Array.isArray(payload.data.data) ? payload.data.data : [];
}

export async function fetchGlossGamePlugins() {
    if (!GLOSS_MOD_KEY) {
        throw new Error("未读取到 GLOSS_MOD_KEY，请检查 .env 配置。");
    }

    const response = await httpFetch(`${GLOSS_MOD_API_BASE_URL}/gmm/plugins`, {
        method: "POST",
        headers: {
            Accept: "application/json",
            Authorization: GLOSS_MOD_KEY,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });
    const payload = (await response.json()) as IGlossApiResponse<
        IGamePlugins[]
    >;

    if (!response.ok || !payload.success || !Array.isArray(payload.data)) {
        throw new Error(payload.msg || "读取前置列表失败");
    }

    return payload.data;
}

export async function fetchGlossGames(params?: {
    page?: number;
    pageSize?: number;
}) {
    if (!GLOSS_MOD_KEY) {
        throw new Error("未读取到 GLOSS_MOD_KEY，请检查 .env 配置。");
    }

    const url = new URL(`${GLOSS_MOD_API_BASE_URL}/games`);
    const page = Math.max(1, params?.page ?? 1);
    const pageSize = Math.max(1, params?.pageSize ?? 200);

    url.searchParams.set("page", String(page));
    url.searchParams.set("pageSize", String(pageSize));

    const response = await httpFetch(url.toString(), {
        method: "GET",
        headers: {
            Accept: "application/json",
            Authorization: GLOSS_MOD_KEY,
        },
    });
    const payload = (await response.json()) as IGlossApiResponse<
        IGlossApiListData<IGlossGameListItem>
    >;

    if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.msg || "读取 Gloss 游戏列表失败");
    }

    return payload.data;
}

export async function fetchAllGlossGames(pageSize = 200) {
    const firstPage = await fetchGlossGames({
        page: 1,
        pageSize,
    });
    const games = [...(firstPage.data ?? [])];

    for (
        let currentPage = 2;
        currentPage <= firstPage.totalPages;
        currentPage += 1
    ) {
        const pageData = await fetchGlossGames({
            page: currentPage,
            pageSize,
        });

        games.push(...(pageData.data ?? []));
    }

    return games;
}
