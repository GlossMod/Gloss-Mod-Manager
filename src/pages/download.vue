<script setup lang="ts">
import Downloads from "@/components/Downloads.vue";
import { ArrowRight } from "lucide-vue-next";
import { useLatestReleaseDownloads } from "@/lib/downloads";
import {
    createBreadcrumbJsonLd,
    createSoftwareApplicationJsonLd,
    createWebPageJsonLd,
    useSeoMeta,
} from "@/lib/seo";

const pageTitle = "下载 Gloss Mod Manager";
const pageDescription =
    "下载 Gloss Mod Manager 最新版本，获取 Windows、macOS 与 Linux 桌面端安装包，安全免费地管理游戏 Mod。";

const {
    latestVersion,
    downloads,
    detectedPlatform,
    isReleaseLoading,
    releaseError,
} = useLatestReleaseDownloads();

useSeoMeta({
    title: pageTitle,
    description: pageDescription,
    path: "/download",
    keywords: ["GMM 下载", "Gloss Mod Manager 安装包", "Mod 管理器下载"],
    structuredData: [
        createWebPageJsonLd(pageTitle, pageDescription, "/download"),
        createSoftwareApplicationJsonLd(),
        createBreadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "下载", path: "/download" },
        ]),
    ],
});
</script>

<template>
    <div class="flex flex-col gap-10 md:gap-14 py-8 md:py-10">
        <section class="container max-w-7xl mx-auto px-4 text-center md:px-8">
            <Badge variant="secondary" class="mb-6 px-3 py-1">
                {{ latestVersion || "..." }}
            </Badge>
            <h1
                class="text-3xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground mb-6"
            >
                Gloss Mod Manager
            </h1>
            <p
                class="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 md:mb-10"
            >
                安全免费地管理游戏 Mod。选择适合您的操作系统，立即下载安装。
            </p>
            <div class="flex items-center justify-center gap-4">
                <Button variant="outline" as-child>
                    <a href="https://pan.aoe.top/Tools/GMM" target="_blank">
                        下载更多版本 <ArrowRight class="ml-2 h-4 w-4" />
                    </a>
                </Button>
            </div>
        </section>

        <Downloads
            :items="downloads"
            :detected-platform="detectedPlatform"
            :version="latestVersion"
            :loading="isReleaseLoading"
            :error="releaseError"
        />
    </div>
</template>
