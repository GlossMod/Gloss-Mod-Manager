<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Apple,
    CircleAlert,
    Download,
    ExternalLink,
    Monitor,
    Package as PackageIcon,
    Terminal,
} from "lucide-vue-next";
import type {
    DetectedPlatformKey,
    DownloadItem,
    PlatformKey,
} from "@/lib/downloads";
import {
    RELEASE_PAGE_URL,
    formatFileSize,
    groupDownloadsByPlatform,
    platformLabels,
} from "@/lib/downloads";

interface PlatformCard {
    key: PlatformKey;
    title: string;
    subtitle: string;
    icon: Component;
}

const props = withDefaults(
    defineProps<{
        items: DownloadItem[];
        detectedPlatform: DetectedPlatformKey;
        version: string;
        loading?: boolean;
        error?: string;
        title?: string;
        description?: string;
    }>(),
    {
        loading: false,
        error: "",
        title: "下载 Gloss Mod Manager",
        description: "自动匹配当前系统，也可以手动选择其他平台安装包。",
    },
);

const platformCards: PlatformCard[] = [
    {
        key: "windows",
        title: "Windows",
        subtitle: "Windows 10、11",
        icon: Monitor,
    },
    {
        key: "linux",
        title: "Linux",
        subtitle: "AppImage、Debian、Fedora、SUSE",
        icon: Terminal,
    },
    {
        key: "macos",
        title: "macOS",
        subtitle: "macOS 12.0+",
        icon: Apple,
    },
];

const groupedDownloads = computed(() => groupDownloadsByPlatform(props.items));

function getPrimaryItem(platform: PlatformKey) {
    const items = groupedDownloads.value[platform];

    return items.find((item) => item.primary) ?? items[0];
}

function getDownloadHref(item?: DownloadItem) {
    return item?.downloadUrl ?? RELEASE_PAGE_URL;
}

function getDownloadLabel(card: PlatformCard, item?: DownloadItem) {
    if (props.loading && !item) {
        return "获取下载地址...";
    }

    return item?.label ?? `查看 ${card.title} 下载`;
}

function getDownloadDetail(card: PlatformCard, item?: DownloadItem) {
    return item?.detail ?? card.subtitle;
}
</script>

<template>
    <section class="container max-w-7xl mx-auto">
        <div class="text-center">
            <div
                v-if="error"
                class="mt-4 inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
                <CircleAlert class="h-4 w-4" />
                {{ error }}
            </div>
        </div>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Card
                v-for="card in platformCards"
                :key="card.key"
                class="flex min-h-112 flex-col items-center rounded-lg border bg-background px-5 py-8 text-center shadow-sm transition-colors hover:border-primary/40"
                :class="[
                    detectedPlatform === card.key
                        ? 'border-primary/50 bg-primary/3'
                        : 'border-border',
                ]"
            >
                <div class="relative mb-6 flex items-center justify-center">
                    <component
                        :is="card.icon"
                        class="h-20 w-20 text-foreground"
                        stroke-width="1.6"
                    />
                    <Badge
                        v-if="detectedPlatform === card.key"
                        class="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap"
                    >
                        当前系统
                    </Badge>
                </div>

                <h3 class="mb-1 text-2xl font-semibold tracking-tight">
                    {{ card.title }}
                </h3>
                <p class="mb-6 min-h-10 text-sm text-muted-foreground">
                    {{ card.subtitle }}
                </p>

                <Button
                    size="lg"
                    as="a"
                    :href="getDownloadHref(getPrimaryItem(card.key))"
                    target="_blank"
                    rel="noreferrer"
                    class="h-auto w-full flex-col gap-1 px-4 py-3 text-base"
                    :aria-disabled="loading && !getPrimaryItem(card.key)"
                >
                    <span class="flex items-center justify-center">
                        <Download class="mr-2 h-5 w-5" />
                        {{ getDownloadLabel(card, getPrimaryItem(card.key)) }}
                    </span>
                    <span class="text-xs font-normal opacity-80">
                        {{ getDownloadDetail(card, getPrimaryItem(card.key)) }}
                    </span>
                </Button>

                <div class="mt-6 w-full flex-1 space-y-2 text-sm">
                    <div
                        v-for="item in groupedDownloads[card.key]"
                        :key="item.id"
                        class="grid min-h-9 grid-cols-[5rem_1fr_auto] items-center gap-3 rounded-md px-2 text-left transition-colors"
                    >
                        <span class="text-right font-semibold">
                            {{ item.format }}
                        </span>
                        <a
                            :href="item.downloadUrl"
                            target="_blank"
                            rel="noreferrer"
                            class="inline-flex w-fit items-center rounded-md bg-primary/10 px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
                        >
                            {{ item.arch }}
                            <ExternalLink class="ml-1 h-3 w-3" />
                        </a>
                        <span
                            class="whitespace-nowrap text-xs text-muted-foreground"
                        >
                            {{ formatFileSize(item.size) }}
                        </span>
                    </div>

                    <div
                        v-if="
                            !loading && groupedDownloads[card.key].length === 0
                        "
                        class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground"
                    >
                        <PackageIcon class="h-5 w-5" />
                        <span>暂无 {{ platformLabels[card.key] }} 安装包</span>
                    </div>
                </div>
            </Card>
        </div>
    </section>
</template>
