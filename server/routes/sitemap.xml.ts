import {
    escapeXml,
    getRoutePriority,
    getSiteRoutes,
} from "../utils/site-routes";

export default defineEventHandler((event) => {
    const runtimeConfig = useRuntimeConfig();
    const siteUrl = String(runtimeConfig.public.siteUrl).replace(/\/+$/, "");
    const sitemapEntries = getSiteRoutes()
        .map((route) => {
            const url = new URL(route, `${siteUrl}/`).href;

            return [
                "  <url>",
                `    <loc>${escapeXml(url)}</loc>`,
                "    <changefreq>weekly</changefreq>",
                `    <priority>${getRoutePriority(route)}</priority>`,
                "  </url>",
            ].join("\n");
        })
        .join("\n");

    setHeader(event, "content-type", "application/xml; charset=utf-8");

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        sitemapEntries,
        "</urlset>",
        "",
    ].join("\n");
});
