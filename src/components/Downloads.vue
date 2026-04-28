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
    <section class="container mx-auto">
        <div class="text-center">
            <div
                v-if="error"
                class="mt-4 inline-flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive backdrop-blur-sm"
            >
                <CircleAlert class="h-4 w-4" />
                {{ error }}
            </div>
        </div>

        <div class="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Card
                v-for="card in platformCards"
                :key="card.key"
                class="relative flex flex-col items-center overflow-hidden rounded-xl border bg-background/60 px-6 py-10 text-center shadow-sm backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:shadow-lg"
                :class="[
                    detectedPlatform === card.key
                        ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                        : 'border-border/50 hover:border-primary/30',
                ]"
            >
                <div
                    v-if="detectedPlatform === card.key"
                    class="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/10 to-transparent opacity-50"
                ></div>

                <div
                    class="relative z-10 flex w-full flex-1 flex-col items-center"
                >
                    <div class="relative mb-8 flex items-center justify-center">
                        <div
                            class="absolute inset-0 blur-2xl transition-opacity duration-500"
                            :class="[
                                detectedPlatform === card.key
                                    ? 'bg-primary/30 opacity-100'
                                    : 'bg-foreground/10 opacity-0 group-hover:opacity-100',
                            ]"
                        ></div>
                        <component
                            :is="card.icon"
                            class="relative z-10 h-20 w-20 text-foreground transition-transform duration-500 hover:scale-110"
                            stroke-width="1.2"
                        />
                        <Badge
                            v-if="detectedPlatform === card.key"
                            class="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap border-primary/20 bg-background/80 text-primary backdrop-blur-md"
                            variant="outline"
                        >
                            当前系统
                        </Badge>
                    </div>

                    <h3 class="mb-2 text-2xl font-bold tracking-tight">
                        {{ card.title }}
                    </h3>
                    <p
                        class="mb-8 min-h-10 text-sm tracking-wide text-muted-foreground/80"
                    >
                        {{ card.subtitle }}
                    </p>

                    <Button
                        size="lg"
                        as="a"
                        :href="getDownloadHref(getPrimaryItem(card.key))"
                        target="_blank"
                        rel="noreferrer"
                        class="group relative h-auto w-full overflow-hidden flex-col gap-1 border border-transparent px-4 py-3 text-base transition-all duration-300"
                        :class="[
                            detectedPlatform === card.key
                                ? 'bg-primary text-primary-foreground hover:shadow-[0_0_2rem_-0.5rem] hover:shadow-primary/50'
                                : 'bg-secondary text-secondary-foreground hover:border-border hover:bg-secondary/80',
                        ]"
                        :aria-disabled="loading && !getPrimaryItem(card.key)"
                    >
                        <span
                            class="relative z-10 flex items-center justify-center font-medium tracking-wide"
                        >
                            <Download
                                class="mr-2 h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5"
                            />
                            {{
                                getDownloadLabel(card, getPrimaryItem(card.key))
                            }}
                        </span>
                        <span
                            class="relative z-10 text-xs font-normal opacity-70"
                        >
                            {{
                                getDownloadDetail(
                                    card,
                                    getPrimaryItem(card.key),
                                )
                            }}
                        </span>
                    </Button>

                    <div class="mt-8 w-full flex-1 space-y-2.5 text-sm">
                        <div
                            v-for="item in groupedDownloads[card.key]"
                            :key="item.id"
                            class="grid min-h-10 grid-cols-[5rem_1fr_auto] items-center gap-3 rounded-lg border border-transparent px-3 text-left transition-colors hover:border-border/50 hover:bg-muted/50"
                        >
                            <span
                                class="text-right font-medium text-foreground/80"
                            >
                                {{ item.format }}
                            </span>
                            <a
                                :href="item.downloadUrl"
                                target="_blank"
                                rel="noreferrer"
                                class="group/link inline-flex w-fit items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                            >
                                {{ item.arch }}
                                <ExternalLink
                                    class="ml-1.5 h-3 w-3 transition-transform duration-300 group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5"
                                />
                            </a>
                            <span
                                class="whitespace-nowrap font-mono text-xs text-muted-foreground/70"
                            >
                                {{ formatFileSize(item.size) }}
                            </span>
                        </div>

                        <div
                            v-if="
                                !loading &&
                                groupedDownloads[card.key].length === 0
                            "
                            class="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/20 text-muted-foreground/60 transition-colors hover:border-border hover:bg-muted/40"
                        >
                            <PackageIcon class="h-5 w-5 opacity-50" />
                            <span class="text-xs"
                                >暂无
                                {{ platformLabels[card.key] }} 安装包</span
                            >
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    </section>
</template>
