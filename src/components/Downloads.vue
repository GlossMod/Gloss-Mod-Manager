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

        <div
            class="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-6xl mx-auto px-4 md:px-0"
        >
            <div
                v-for="card in platformCards"
                :key="card.key"
                class="group relative flex flex-col overflow-hidden rounded-2xl bg-background/40 px-5 py-8 md:px-6 md:py-10 transition-all duration-500 hover:-translate-y-2 backdrop-blur-xl"
            >
                <div
                    class="absolute inset-0 border-2 rounded-2xl transition-all duration-500 pointer-events-none"
                    :class="[
                        detectedPlatform === card.key
                            ? 'border-primary/50'
                            : 'border-border/30 group-hover:border-primary/30',
                    ]"
                ></div>

                <div
                    v-if="detectedPlatform === card.key"
                    class="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent opacity-50 transition-opacity"
                ></div>
                <div
                    class="pointer-events-none absolute -top-24 -left-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px] group-hover:bg-primary/30 transition-colors"
                ></div>

                <div class="relative z-10 flex w-full flex-1 flex-col">
                    <div class="mb-8 flex items-center justify-between">
                        <component
                            :is="card.icon"
                            class="h-10 w-10 text-foreground/80 transition-transform duration-500 group-hover:scale-110 group-hover:text-primary"
                            stroke-width="1.5"
                        />
                        <Badge
                            v-if="detectedPlatform === card.key"
                            class="whitespace-nowrap border-primary/30 bg-primary/10 text-primary font-mono text-xs shadow-[0_0_10px_rgba(var(--primary),0.2)]"
                            variant="outline"
                        >
                            <span class="relative flex h-2 w-2 mr-2">
                                <span
                                    class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"
                                ></span>
                                <span
                                    class="relative inline-flex rounded-full h-2 w-2 bg-primary"
                                ></span>
                            </span>
                            推荐
                        </Badge>
                    </div>

                    <h3
                        class="font-mono text-3xl font-bold tracking-tight mb-2"
                    >
                        {{ card.title }}
                    </h3>
                    <p
                        class="mb-8 min-h-10 text-sm font-light tracking-wide text-muted-foreground/70"
                    >
                        {{ card.subtitle }}
                    </p>

                    <Button
                        size="lg"
                        as="a"
                        :href="getDownloadHref(getPrimaryItem(card.key))"
                        target="_blank"
                        rel="noreferrer"
                        class="group/btn relative h-auto w-full overflow-hidden flex-col gap-1.5 border px-4 py-4 transition-all duration-500 rounded-xl"
                        :class="[
                            detectedPlatform === card.key
                                ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_2rem_-0.5rem] hover:shadow-primary/60'
                                : 'border-border/50 bg-secondary/30 text-secondary-foreground hover:border-primary/40 hover:bg-secondary/60',
                        ]"
                        :aria-disabled="loading && !getPrimaryItem(card.key)"
                    >
                        <span
                            class="relative z-10 flex items-center justify-center font-mono font-medium tracking-wide"
                        >
                            <Download
                                class="mr-2 h-4 w-4 transition-transform duration-300 group-hover/btn:-translate-y-1 group-hover/btn:scale-110"
                            />
                            {{
                                getDownloadLabel(card, getPrimaryItem(card.key))
                            }}
                        </span>
                        <span
                            class="relative z-10 font-mono text-[10px] uppercase tracking-wider opacity-60"
                        >
                            {{
                                getDownloadDetail(
                                    card,
                                    getPrimaryItem(card.key),
                                )
                            }}
                        </span>
                    </Button>

                    <div class="mt-8 w-full flex-1 space-y-2">
                        <div
                            v-for="item in groupedDownloads[card.key]"
                            :key="item.id"
                            class="group/item grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border/20 bg-background/30 px-3 text-left transition-all duration-300 hover:border-primary/30 hover:bg-primary/5"
                        >
                            <span
                                class="font-mono text-xs font-semibold text-foreground/70 uppercase tracking-widest min-w-[3rem]"
                            >
                                {{ item.format }}
                            </span>
                            <a
                                :href="item.downloadUrl"
                                target="_blank"
                                rel="noreferrer"
                                class="inline-flex w-fit items-center rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground uppercase tracking-widest"
                            >
                                {{ item.arch }}
                                <ExternalLink class="ml-1 h-3 w-3" />
                            </a>
                            <span
                                class="whitespace-nowrap font-mono text-xs text-muted-foreground/60 transition-colors group-hover/item:text-primary/70"
                            >
                                {{ formatFileSize(item.size) }}
                            </span>
                        </div>

                        <div
                            v-if="card.key === 'macos'"
                            class="group/item grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-border/20 bg-background/30 px-3 text-left transition-all duration-300 hover:border-primary/30 hover:bg-primary/5"
                        >
                            <span
                                class="font-mono text-xs font-semibold text-foreground/70 uppercase tracking-widest min-w-[3rem]"
                            >
                                APP
                            </span>
                            <a
                                href="https://apps.apple.com/us/app/gloss-mod-manager/id6763454502"
                                target="_blank"
                                rel="noreferrer"
                                class="inline-flex w-fit items-center rounded bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary transition-colors hover:bg-primary hover:text-primary-foreground uppercase tracking-widest"
                            >
                                App Store
                                <ExternalLink class="ml-1 h-3 w-3" />
                            </a>
                            <span
                                class="whitespace-nowrap font-mono text-xs text-muted-foreground/60 transition-colors group-hover/item:text-primary/70"
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
                            class="flex min-h-24 flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border/30 bg-muted/10 text-muted-foreground/50 transition-colors hover:border-primary/30 hover:text-primary/70"
                        >
                            <PackageIcon class="h-6 w-6 stroke-[1.5]" />
                            <span
                                class="font-mono text-xs tracking-wider uppercase"
                                >暂无
                                {{ platformLabels[card.key] }} 安装包</span
                            >
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>
</template>
