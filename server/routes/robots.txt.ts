export default defineEventHandler((event) => {
    const runtimeConfig = useRuntimeConfig();
    const siteUrl = String(runtimeConfig.public.siteUrl).replace(/\/+$/, "");

    setHeader(event, "content-type", "text/plain; charset=utf-8");

    return [
        "User-agent: *",
        "Allow: /",
        `Sitemap: ${siteUrl}/sitemap.xml`,
        "",
    ].join("\n");
});
