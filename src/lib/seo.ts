import { toValue, watchEffect, type MaybeRefOrGetter } from "vue";

export const SITE_NAME = "Gloss Mod Manager";
export const DEFAULT_SITE_URL = "https://gmm.aoe.top";

export const SITE_URL = (
    import.meta.env.VITE_SITE_URL || DEFAULT_SITE_URL
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

const getHeadElement = <T extends HTMLElement>(
    selector: string,
    tagName: keyof HTMLElementTagNameMap,
    attributes: Record<string, string>,
) => {
    const existingElement = document.head.querySelector<T>(selector);

    if (existingElement) {
        return existingElement;
    }

    const element = document.createElement(tagName) as T;

    Object.entries(attributes).forEach(([name, value]) => {
        element.setAttribute(name, value);
    });

    document.head.appendChild(element);
    return element;
};

const setMeta = (
    attributeName: "name" | "property",
    key: string,
    content: string,
) => {
    const meta = getHeadElement<HTMLMetaElement>(
        `meta[${attributeName}="${key}"]`,
        "meta",
        { [attributeName]: key },
    );

    meta.content = content;
};

const removeMeta = (attributeName: "name" | "property", key: string) => {
    document.head.querySelector(`meta[${attributeName}="${key}"]`)?.remove();
};

const setCanonicalLink = (href: string) => {
    const link = getHeadElement<HTMLLinkElement>(
        'link[rel="canonical"]',
        "link",
        { rel: "canonical" },
    );

    link.href = href;
};

const setStructuredData = (
    structuredData?: StructuredData | StructuredData[],
) => {
    const data = Array.isArray(structuredData)
        ? structuredData.filter(Boolean)
        : structuredData;
    const existingScript = document.head.querySelector<HTMLScriptElement>(
        `script#${STRUCTURED_DATA_ID}`,
    );

    if (!data || (Array.isArray(data) && data.length === 0)) {
        existingScript?.remove();
        return;
    }

    const script =
        existingScript ??
        getHeadElement<HTMLScriptElement>(
            `script#${STRUCTURED_DATA_ID}`,
            "script",
            {
                id: STRUCTURED_DATA_ID,
                type: "application/ld+json",
            },
        );

    script.textContent = JSON.stringify(data);
};

export const useSeoMeta = (options: MaybeRefOrGetter<SeoMetaOptions>) => {
    watchEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        const metaOptions = toValue(options);
        const title = formatTitle(metaOptions.title);
        const description =
            metaOptions.description?.trim() || DEFAULT_SEO_DESCRIPTION;
        const canonicalUrl = createCanonicalUrl(
            metaOptions.path ?? window.location.pathname,
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

        document.title = title;
        setCanonicalLink(canonicalUrl);
        setMeta("name", "description", description);
        setMeta("name", "keywords", keywords.join(", "));
        setMeta(
            "name",
            "robots",
            metaOptions.noindex ? "noindex, nofollow" : "index, follow",
        );
        setMeta("property", "og:site_name", SITE_NAME);
        setMeta("property", "og:type", metaOptions.type ?? "website");
        setMeta("property", "og:title", title);
        setMeta("property", "og:description", description);
        setMeta("property", "og:url", canonicalUrl);
        setMeta("property", "og:locale", "zh_CN");
        setMeta(
            "name",
            "twitter:card",
            metaOptions.image ? "summary_large_image" : "summary",
        );
        setMeta("name", "twitter:title", title);
        setMeta("name", "twitter:description", description);

        if (metaOptions.image) {
            const imageUrl = createCanonicalUrl(metaOptions.image);
            setMeta("property", "og:image", imageUrl);
            setMeta("name", "twitter:image", imageUrl);
        } else {
            removeMeta("property", "og:image");
            removeMeta("name", "twitter:image");
        }

        setStructuredData(metaOptions.structuredData);
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
