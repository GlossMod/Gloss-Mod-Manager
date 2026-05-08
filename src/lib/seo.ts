import { toValue, type MaybeRefOrGetter } from "vue";

export const SITE_NAME = "Gloss Mod Manager";
export const DEFAULT_SITE_URL = "https://gmm.aoe.top";

export const SITE_URL = (
    import.meta.env.NUXT_PUBLIC_SITE_URL ||
    import.meta.env.VITE_SITE_URL ||
    DEFAULT_SITE_URL
).replace(/\/$/, "");

export const DEFAULT_SEO_TITLE = `${SITE_NAME} - 智能游戏 Mod 管理器`;
export const DEFAULT_SEO_DESCRIPTION =
    "Gloss Mod Manager (GMM) 是一款免费、安全、跨平台的智能游戏模组管理器，内置 AI MCP 与 Skills，帮助玩家轻松下载、安装和管理游戏 Mod。";

const DEFAULT_KEYWORDS = [
    SITE_NAME,
    "GMM",
    "Gloss Mod Manager 下载",
    "游戏 Mod 管理器",
    "模组管理器",
    "Mod 安装工具",
    "AI MCP",
    "游戏模组",
];

const STRUCTURED_DATA_ID = "site-structured-data";

export interface SeoMetaOptions {
    title?: string;
    description?: string;
    path?: string;
    keywords?: string[];
    type?: "website" | "article";
    image?: string;
    noindex?: boolean;
    structuredData?: StructuredData | StructuredData[];
}

export type StructuredData = Record<string, unknown>;

export interface BreadcrumbItem {
    name: string;
    path: string;
}

export const createCanonicalUrl = (path = "/") => {
    const url = new URL(path, `${SITE_URL}/`);
    url.hash = "";
    url.search = "";

    return url.href;
};

const formatTitle = (title = DEFAULT_SEO_TITLE) => {
    if (title.includes(SITE_NAME)) {
        return title;
    }

    return `${title} - ${SITE_NAME}`;
};

const resolveStructuredData = (
    structuredData?: StructuredData | StructuredData[],
) => {
    if (!structuredData) {
        return undefined;
    }

    if (Array.isArray(structuredData)) {
        const data = structuredData.filter(Boolean);
        return data.length ? data : undefined;
    }

    return structuredData;
};

const stringifyStructuredData = (
    structuredData: StructuredData | StructuredData[],
) => JSON.stringify(structuredData).replace(/</g, "\\u003c");

export const useSeoMeta = (options: MaybeRefOrGetter<SeoMetaOptions>) => {
    useHead(() => {
        const metaOptions = toValue(options);
        const title = formatTitle(metaOptions.title);
        const description =
            metaOptions.description?.trim() || DEFAULT_SEO_DESCRIPTION;
        const canonicalUrl = createCanonicalUrl(metaOptions.path ?? "/");
        const imageUrl = metaOptions.image
            ? createCanonicalUrl(metaOptions.image)
            : undefined;
        const structuredData = resolveStructuredData(
            metaOptions.structuredData,
        );
        const keywords = [
            ...DEFAULT_KEYWORDS,
            ...(metaOptions.keywords ?? []),
        ].filter((keyword, index, allKeywords) => {
            const normalizedKeyword = keyword.trim().toLowerCase();
            return (
                normalizedKeyword.length > 0 &&
                allKeywords.findIndex(
                    (item) => item.trim().toLowerCase() === normalizedKeyword,
                ) === index
            );
        });

        const meta = [
            { key: "description", name: "description", content: description },
            { key: "keywords", name: "keywords", content: keywords.join(", ") },
            {
                key: "robots",
                name: "robots",
                content: metaOptions.noindex
                    ? "noindex, nofollow"
                    : "index, follow",
            },
            {
                key: "og:site_name",
                property: "og:site_name",
                content: SITE_NAME,
            },
            {
                key: "og:type",
                property: "og:type",
                content: metaOptions.type ?? "website",
            },
            { key: "og:title", property: "og:title", content: title },
            {
                key: "og:description",
                property: "og:description",
                content: description,
            },
            { key: "og:url", property: "og:url", content: canonicalUrl },
            { key: "og:locale", property: "og:locale", content: "zh_CN" },
            {
                key: "twitter:card",
                name: "twitter:card",
                content: imageUrl ? "summary_large_image" : "summary",
            },
            { key: "twitter:title", name: "twitter:title", content: title },
            {
                key: "twitter:description",
                name: "twitter:description",
                content: description,
            },
        ];

        if (imageUrl) {
            meta.push(
                { key: "og:image", property: "og:image", content: imageUrl },
                {
                    key: "twitter:image",
                    name: "twitter:image",
                    content: imageUrl,
                },
            );
        }

        return {
            title,
            link: [{ key: "canonical", rel: "canonical", href: canonicalUrl }],
            meta,
            script: structuredData
                ? [
                      {
                          id: STRUCTURED_DATA_ID,
                          key: STRUCTURED_DATA_ID,
                          type: "application/ld+json",
                          innerHTML: stringifyStructuredData(structuredData),
                      },
                  ]
                : [],
        };
    });
};

export const createWebSiteJsonLd = (): StructuredData => ({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    alternateName: "GMM",
    url: createCanonicalUrl("/"),
    inLanguage: "zh-CN",
});

export const createSoftwareApplicationJsonLd = (): StructuredData => ({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "GMM",
    applicationCategory: "GameApplication",
    operatingSystem: "Windows, macOS, Linux",
    url: createCanonicalUrl("/"),
    downloadUrl: createCanonicalUrl("/download"),
    description: DEFAULT_SEO_DESCRIPTION,
    offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "CNY",
    },
    sameAs: [
        "https://github.com/GlossMod/Gloss-Mod-Manager",
        "https://mod.3dmgame.com/mod/197445",
    ],
});

export const createWebPageJsonLd = (
    name: string,
    description: string,
    path: string,
): StructuredData => ({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: formatTitle(name),
    description,
    url: createCanonicalUrl(path),
    inLanguage: "zh-CN",
    isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: createCanonicalUrl("/"),
    },
});

export const createBreadcrumbJsonLd = (
    items: BreadcrumbItem[],
): StructuredData => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: createCanonicalUrl(item.path),
    })),
});
