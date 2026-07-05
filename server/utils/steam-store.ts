import type {
    CrowdfundingSteamGame,
    CrowdfundingSteamPrice,
} from "../../src/lib/game-crowdfunding";

const STEAM_STORE_BASE_URL = "https://store.steampowered.com";
const STEAM_APP_URL_PATTERN =
    /store\.steampowered\.com\/app\/(?<appId>\d+)/i;

interface SteamAppDetailsResponse {
    success: boolean;
    data?: {
        name?: string;
        steam_appid?: number;
        is_free?: boolean;
        header_image?: string;
        capsule_image?: string;
        capsule_imagev5?: string;
        short_description?: string;
        price_overview?: {
            currency?: string;
            initial?: number;
            final?: number;
            initial_formatted?: string;
            final_formatted?: string;
            discount_percent?: number;
        };
    };
}

interface SteamSearchResponse {
    items?: Array<{
        type?: string;
        id?: number;
        name?: string;
    }>;
}

const steamGameCache = new Map<number, Promise<CrowdfundingSteamGame | null>>();

const toAmount = (cents: number | undefined) =>
    typeof cents === "number" && Number.isFinite(cents) ? cents / 100 : 0;

const toSteamPrice = (
    data: NonNullable<SteamAppDetailsResponse["data"]>,
): CrowdfundingSteamPrice | null => {
    if (data.is_free) {
        return {
            currency: "CNY",
            initialAmount: 0,
            finalAmount: 0,
            initialFormatted: "免费",
            finalFormatted: "免费",
            discountPercent: 0,
            isFree: true,
        };
    }

    if (!data.price_overview) {
        return null;
    }

    const price = data.price_overview;

    return {
        currency: price.currency || "CNY",
        initialAmount: toAmount(price.initial),
        finalAmount: toAmount(price.final),
        initialFormatted:
            price.initial_formatted || `¥ ${toAmount(price.initial).toFixed(2)}`,
        finalFormatted:
            price.final_formatted || `¥ ${toAmount(price.final).toFixed(2)}`,
        discountPercent: price.discount_percent || 0,
        isFree: false,
    };
};

export const readSteamAppId = (...values: Array<string | undefined>) => {
    for (const value of values) {
        const match = value?.match(STEAM_APP_URL_PATTERN);
        const appId = Number(match?.groups?.appId);

        if (Number.isInteger(appId) && appId > 0) {
            return appId;
        }
    }

    return null;
};

export const fetchSteamGame = async (
    appId: number,
): Promise<CrowdfundingSteamGame | null> => {
    if (!Number.isInteger(appId) || appId <= 0) {
        return null;
    }

    const existingRequest = steamGameCache.get(appId);

    if (existingRequest) {
        return existingRequest;
    }

    const request = $fetch<Record<string, SteamAppDetailsResponse>>(
        `${STEAM_STORE_BASE_URL}/api/appdetails`,
        {
            query: {
                appids: String(appId),
                cc: "cn",
                l: "schinese",
                filters: "basic,price_overview",
            },
        },
    )
        .then((response) => {
            const entry = response[String(appId)];

            if (!entry?.success || !entry.data) {
                return null;
            }

            const data = entry.data;
            const resolvedAppId = data.steam_appid || appId;

            return {
                appId: resolvedAppId,
                name: data.name || `Steam App ${resolvedAppId}`,
                storeUrl: `${STEAM_STORE_BASE_URL}/app/${resolvedAppId}`,
                headerImage: data.header_image || "",
                capsuleImage:
                    data.capsule_image || data.capsule_imagev5 || "",
                shortDescription: data.short_description || "",
                price: toSteamPrice(data),
            };
        })
        .catch(() => null);

    steamGameCache.set(appId, request);
    return request;
};

export const searchSteamAppId = async (term: string) => {
    const query = term.trim();

    if (!query) {
        return null;
    }

    try {
        const response = await $fetch<SteamSearchResponse>(
            `${STEAM_STORE_BASE_URL}/api/storesearch/`,
            {
                query: {
                    term: query,
                    cc: "cn",
                    l: "schinese",
                },
            },
        );
        const app = response.items?.find(
            (item) =>
                item.type === "app" &&
                Number.isInteger(item.id) &&
                Number(item.id) > 0,
        );

        return app?.id || null;
    } catch {
        return null;
    }
};

export const resolveSteamGame = async ({
    appId,
    gameName,
}: {
    appId: number | null;
    gameName: string;
}) => {
    const resolvedAppId = appId || (await searchSteamAppId(gameName));

    return resolvedAppId ? fetchSteamGame(resolvedAppId) : null;
};
