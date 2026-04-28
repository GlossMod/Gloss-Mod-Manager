import path from "node:path";
import fs from "node:fs";
import { defineConfig, loadEnv, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import VueRouter from "vue-router/vite";
import Components from "unplugin-vue-components/vite";

const defaultSiteUrl = "https://gmm.aoe.top";
const staticRoutes = ["/", "/download", "/games", "/docs"];

const normalizeSiteUrl = (value: string) => value.replace(/\/+$/, "");

const escapeXml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

const toDocRoute = (relativeFilePath: string) => {
    const docPath = relativeFilePath.replace(/\\/g, "/").replace(/\.md$/i, "");

    if (docPath === "README") {
        return "/docs";
    }

    if (docPath === "index") {
        return undefined;
    }

    if (docPath.endsWith("/README")) {
        return `/docs/${docPath.slice(0, -"/README".length)}`;
    }

    return `/docs/${docPath}`;
};

const collectMarkdownRoutes = (
    directory: string,
    rootDirectory = directory,
): string[] => {
    if (!fs.existsSync(directory)) {
        return [];
    }

    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry): string[] => {
            const entryPath = path.join(directory, entry.name);

            if (entry.isDirectory()) {
                if (entry.name.toLowerCase() === "en") {
                    return [];
                }

                return collectMarkdownRoutes(entryPath, rootDirectory);
            }

            if (!entry.isFile() || !entry.name.endsWith(".md")) {
                return [];
            }

            const relativeFilePath = path.relative(rootDirectory, entryPath);
            const route = toDocRoute(relativeFilePath);

            return route ? [route] : [];
        });
};

const getRoutePriority = (route: string) => {
    if (route === "/") {
        return "1.0";
    }

    if (["/download", "/games", "/docs"].includes(route)) {
        return "0.9";
    }

    return "0.7";
};

const createSeoAssetsPlugin = (siteUrl: string): Plugin => ({
    name: "gmm-seo-assets",
    apply: "build",
    generateBundle() {
        const docsDirectory = path.resolve(__dirname, "src/docs");
        const routes = Array.from(
            new Set([...staticRoutes, ...collectMarkdownRoutes(docsDirectory)]),
        ).sort((firstRoute, secondRoute) =>
            firstRoute.localeCompare(secondRoute, "zh-Hans-CN"),
        );
        const sitemapEntries = routes
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

        this.emitFile({
            type: "asset",
            fileName: "sitemap.xml",
            source: [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                sitemapEntries,
                "</urlset>",
                "",
            ].join("\n"),
        });

        this.emitFile({
            type: "asset",
            fileName: "robots.txt",
            source: [
                "User-agent: *",
                "Allow: /",
                `Sitemap: ${siteUrl}/sitemap.xml`,
                "",
            ].join("\n"),
        });
    },
});

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");
    const siteUrl = normalizeSiteUrl(env.VITE_SITE_URL || defaultSiteUrl);

    return {
        plugins: [
            vue(),
            tailwindcss(),
            AutoImport({
                imports: ["vue", "vue-router", "@vueuse/core"],
                dts: "src/auto-imports.d.ts",
                dirs: ["src/lib"],
            }),
            VueRouter({
                // Recommended: auto-included by tsconfig
                dts: "src/typed-router.d.ts",
            }),
            Components({
                dirs: ["src/components/ui", "src/components"],
                resolvers: [
                    (name) => {
                        if (name.startsWith("Icon")) {
                            return {
                                name: name.slice(4),
                                from: "lucide-vue-next",
                            };
                        }
                    },
                ],
                dts: "src/components.d.ts",
            }),
            createSeoAssetsPlugin(siteUrl),
        ],
        resolve: {
            alias: {
                "@": path.resolve(__dirname, "./src"),
            },
        },
    };
});
