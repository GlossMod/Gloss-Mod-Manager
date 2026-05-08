import tailwindcss from "@tailwindcss/vite";
import { defineNuxtConfig } from "nuxt/config";

const defaultSiteUrl = "https://gmm.aoe.top";

export default defineNuxtConfig({
    compatibilityDate: "2026-05-08",
    srcDir: "src/",
    css: ["~/style.css"],
    modules: ["@pinia/nuxt"],
    app: {
        head: {
            htmlAttrs: {
                lang: "zh-CN",
                class: "dark",
            },
            meta: [
                { charset: "UTF-8" },
                {
                    name: "viewport",
                    content: "width=device-width, initial-scale=1.0",
                },
                { name: "theme-color", content: "#020817" },
                { name: "application-name", content: "Gloss Mod Manager" },
            ],
            link: [{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" }],
        },
    },
    components: [
        {
            path: "~/components",
            pathPrefix: false,
            extensions: ["vue"],
        },
    ],
    runtimeConfig: {
        githubToken:
            process.env.NUXT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || "",
        githubClientId: process.env.NUXT_GITHUB_CLIENT_ID || "",
        githubClientSecret: process.env.NUXT_GITHUB_CLIENT_SECRET || "",
        sessionSecret: process.env.NUXT_SESSION_SECRET || "",
        githubRepoId: process.env.NUXT_GITHUB_REPO_ID || "R_kgDOJxuy0Q",
        githubNewGamesCategoryId:
            process.env.NUXT_GITHUB_NEW_GAMES_CATEGORY_ID ||
            process.env.NUXT_GISCUS_NEW_GAMES_CATEGORY_ID ||
            "",
        public: {
            siteUrl:
                process.env.NUXT_PUBLIC_SITE_URL ||
                process.env.VITE_SITE_URL ||
                defaultSiteUrl,
            giscusRepoId:
                process.env.NUXT_PUBLIC_GISCUS_REPO_ID ||
                process.env.VITE_GISCUS_REPO_ID ||
                "R_kgDOJxuy0Q",
            giscusNewGamesCategoryId:
                process.env.NUXT_PUBLIC_GISCUS_NEW_GAMES_CATEGORY_ID ||
                process.env.VITE_GISCUS_NEW_GAMES_CATEGORY_ID ||
                "",
        },
    },
    vite: {
        plugins: [tailwindcss()],
    },
});
