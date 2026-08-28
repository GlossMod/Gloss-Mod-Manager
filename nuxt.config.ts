import tailwindcss from "@tailwindcss/vite";
import type { RollupLog, WarningHandlerWithDefault } from "rollup";
import { defineNuxtConfig } from "nuxt/config";

const defaultSiteUrl = "https://gmm.aoe.top";
const shouldIgnoreBuildWarning = (warning: RollupLog) => {
    if (
        warning.message.includes("Sourcemap is likely to be incorrect") &&
        (warning.plugin === "nuxt:module-preload-polyfill" ||
            warning.plugin === "@tailwindcss/vite:generate:build")
    ) {
        return true;
    }

    return (
        warning.code === "INVALID_ANNOTATION" &&
        typeof warning.id === "string" &&
        warning.id.includes("node_modules/@vueuse/core/")
    );
};

const handleBuildWarning: WarningHandlerWithDefault = (warning, warn) => {
    if (shouldIgnoreBuildWarning(warning)) {
        return;
    }

    warn(warning);
};
type MutableViteWarningConfig = {
    build?: {
        rollupOptions?: {
            onwarn?: WarningHandlerWithDefault;
        };
    };
};

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
                { name: "theme-color", content: "#0a0a0a" },
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
    sourcemap: false,
    hooks: {
        "vite:extendConfig"(config) {
            const mutableConfig = config as MutableViteWarningConfig;

            mutableConfig.build ||= {};
            mutableConfig.build.rollupOptions ||= {};

            const currentOnwarn = mutableConfig.build.rollupOptions.onwarn;

            mutableConfig.build.rollupOptions.onwarn = (warning, warn) => {
                if (shouldIgnoreBuildWarning(warning)) {
                    return;
                }

                if (currentOnwarn) {
                    currentOnwarn(warning, warn);
                    return;
                }

                warn(warning);
            };
        },
    },
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
        payApiBaseUrl:
            process.env.NUXT_PAY_API_BASE_URL || "https://pay.gloscai.com",
        payAppKey: process.env.NUXT_PAY_APP_KEY || "",
        payAppSecret: process.env.NUXT_PAY_APP_SECRET || "",
        discussionBotApiBaseUrl:
            process.env.NUXT_DISCUSSION_BOT_API_BASE_URL ||
            "https://bot.gloscai.com",
        discussionBotApiToken: process.env.NUXT_DISCUSSION_BOT_API_TOKEN || "",
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
        build: {
            rollupOptions: {
                onwarn: handleBuildWarning,
            },
        },
        plugins: [tailwindcss()],
    },
});
