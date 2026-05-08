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
    <div class="flex flex-col gap-14 pb-20 pt-16 md:pt-24">
        <section class="container max-w-7xl mx-auto px-4 text-center md:px-8">
            <h1
                class="text-4xl font-bold tracking-tight flex items-center justify-center gap-4"
            >
                <div>下载 Gloss Mod Manager</div>
                <Badge>{{ latestVersion }}</Badge>
            </h1>
            <div class="mb-4 mt-4">
                <Button variant="link" as-child>
                    <a href="https://pan.aoe.top/Tools/GMM" target="_blank">
                        下载旧版本 <ArrowRight class="ml-2 h-5 w-5" />
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
            title="选择平台"
            description="页面会优先标出当前系统，所有可用格式都列在对应平台下。"
        />
    </div>
</template>
