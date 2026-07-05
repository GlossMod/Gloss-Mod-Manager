<script setup lang="ts">
import type { Component } from "vue";
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
    <section class="container max-w-6xl mx-auto px-4 md:px-8">
        <div
            v-if="error"
            class="mb-8 flex items-center justify-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
            <CircleAlert class="h-4 w-4" />
            {{ error }}
        </div>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card
                v-for="card in platformCards"
                :key="card.key"
                :class="[
                    'transition-colors',
                    detectedPlatform === card.key
                        ? 'border-primary/50'
                        : 'hover:border-foreground/20',
                ]"
            >
                <CardHeader>
                    <CardTitle class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div
                                class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"
                            >
                                <component
                                    :is="card.icon"
                                    class="h-5 w-5 text-primary"
                                    stroke-width="1.5"
                                />
                            </div>
                            <span class="text-xl font-bold">{{
                                card.title
                            }}</span>
                        </div>
                        <Badge
                            v-if="detectedPlatform === card.key"
                            variant="secondary"
                            class="whitespace-nowrap"
                        >
                            推荐
                        </Badge>
                    </CardTitle>
                    <CardDescription>{{ card.subtitle }}</CardDescription>
                </CardHeader>

                <div class="px-6 flex flex-col gap-4">
                    <Button
                        size="lg"
                        as="a"
                        :href="getDownloadHref(getPrimaryItem(card.key))"
                        target="_blank"
                        rel="noreferrer"
                        class="h-auto w-full flex-col gap-1 py-3"
                        :aria-disabled="loading && !getPrimaryItem(card.key)"
                    >
                        <span class="flex items-center justify-center">
                            <Download class="mr-2 h-4 w-4" />
                            {{
                                getDownloadLabel(card, getPrimaryItem(card.key))
                            }}
                        </span>
                        <span class="text-xs opacity-70">
                            {{
                                getDownloadDetail(
                                    card,
                                    getPrimaryItem(card.key),
                                )
                            }}
                        </span>
                    </Button>

                    <div class="flex flex-col gap-2">
                        <div
                            v-for="item in groupedDownloads[card.key]"
                            :key="item.id"
                            class="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border px-3 text-left transition-colors hover:border-foreground/20 hover:bg-accent/50"
                        >
                            <span
                                class="text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-12"
                            >
                                {{ item.format }}
                            </span>
                            <a
                                :href="item.downloadUrl"
                                target="_blank"
                                rel="noreferrer"
                                class="inline-flex w-fit items-center rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground uppercase"
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
                            v-if="card.key === 'macos'"
                            class="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border px-3 text-left transition-colors hover:border-foreground/20 hover:bg-accent/50"
                        >
                            <span
                                class="text-xs font-semibold text-muted-foreground uppercase tracking-wide min-w-12"
                            >
                                APP
                            </span>
                            <a
                                href="https://apps.apple.com/us/app/gloss-mod-manager/id6763454502"
                                target="_blank"
                                rel="noreferrer"
                                class="inline-flex w-fit items-center rounded bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground uppercase"
                            >
                                App Store
                                <ExternalLink class="ml-1 h-3 w-3" />
                            </a>
                            <span
                                class="whitespace-nowrap text-xs text-muted-foreground"
                            >
                                推荐
                            </span>
                        </div>

                        <div
                            v-if="
                                !loading &&
                                groupedDownloads[card.key].length === 0 &&
                                card.key !== 'macos'
                            "
                            class="flex min-h-20 flex-col items-center justify-center gap-2 rounded-md border border-dashed text-muted-foreground/60"
                        >
                            <PackageIcon class="h-5 w-5" />
                            <span class="text-xs">
                                暂无 {{ platformLabels[card.key] }} 安装包
                            </span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    </section>
</template>
