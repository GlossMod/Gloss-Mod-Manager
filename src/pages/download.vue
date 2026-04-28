<script setup lang="ts">
import Downloads from "@/components/Downloads.vue";
import { useLatestReleaseDownloads } from "@/lib/downloads";

const {
    latestVersion,
    downloads,
    detectedPlatform,
    isReleaseLoading,
    releaseError,
} = useLatestReleaseDownloads();
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
