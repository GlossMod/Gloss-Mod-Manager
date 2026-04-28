<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Zap, Bot, ArrowRight, Globe } from "lucide-vue-next";
import {
    RELEASE_PAGE_URL,
    platformLabels,
    useLatestReleaseDownloads,
} from "@/lib/downloads";

const { detectedPlatform, isReleaseLoading, preferredDownload } =
    useLatestReleaseDownloads();

const downloadHref = computed(
    () => preferredDownload.value?.downloadUrl ?? RELEASE_PAGE_URL,
);

const downloadButtonText = computed(() => {
    if (isReleaseLoading.value && !preferredDownload.value) {
        return "获取下载地址...";
    }

    if (!preferredDownload.value) {
        return "查看全部下载";
    }

    return `下载 ${platformLabels[detectedPlatform.value]} 版`;
});
</script>

<template>
    <div class="flex flex-col mb-20 space-y-24">
        <!-- Hero Section -->
        <section class="relative pt-24 pb-16 md:pt-32 overflow-hidden">
            <div class="container max-w-7xl mx-auto px-4 md:px-8 text-center">
                <h1
                    class="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground max-w-4xl mx-auto leading-tight"
                >
                    Gloss Mod Manager
                </h1>
                <div class="text-2xl">
                    下一代
                    <span
                        class="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary/60"
                        >智能游戏模组</span
                    >
                    管理器
                </div>
                <p
                    class="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
                >
                    安全无毒、完全免费。全新引入 AI MCP 与 Skills 核心链，跨越
                    Windows、macOS 和 Linux，为你提供史无前例的智能化 Mod
                    自动化管理体验。
                </p>
                <div
                    class="flex flex-col sm:flex-row justify-center items-center gap-4"
                >
                    <Button
                        size="lg"
                        as="a"
                        :href="downloadHref"
                        target="_blank"
                        rel="noreferrer"
                        class="w-full sm:w-auto h-12 px-8 text-base"
                    >
                        <Download class="mr-2 h-5 w-5" />
                        {{ downloadButtonText }}
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        as-child
                        class="w-full sm:w-auto h-12 px-8 text-base"
                    >
                        <RouterLink to="/docs">
                            阅读文档参考
                            <ArrowRight class="ml-2 h-5 w-5" />
                        </RouterLink>
                    </Button>
                </div>
            </div>

            <!-- Background decoration -->
            <div
                class="absolute -z-10 top-0 left-1/2 w-full -translate-x-1/2 overflow-hidden flex justify-center pointer-events-none opacity-40 dark:opacity-20 blur-3xl"
            >
                <div
                    class="w-200 h-100 bg-primary rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"
                ></div>
                <div
                    class="w-150 h-100 bg-sky-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 -ml-32"
                ></div>
            </div>
        </section>

        <!-- Key Advantages (V1 -> V2) -->
        <section class="container max-w-7xl mx-auto px-4 md:px-8">
            <div class="mb-12 text-center">
                <h2 class="text-3xl font-bold tracking-tight mb-4">
                    V2 引擎的全面进化
                </h2>
                <p class="text-muted-foreground max-w-2xl mx-auto">
                    V2 从底层重构了整个框架，在保留 V1
                    所有优秀特性的同时，带来了突破性的性能与体验提升。
                </p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card
                    class="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-4 mb-2">
                            <div
                                class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center"
                            >
                                <Zap class="h-6 w-6 text-primary" />
                            </div>
                            <div class="">体积缩减 90%</div>
                        </CardTitle>
                        <CardDescription
                            >摒弃了臃肿的旧框架，采用全新架构，使得安装包体积相比
                            V1 减少了惊人的
                            90%，秒速下载，轻量运行。</CardDescription
                        >
                    </CardHeader>
                </Card>

                <Card
                    class="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-4 mb-2">
                            <div
                                class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center"
                            >
                                <Bot class="h-6 w-6 text-primary" />
                            </div>
                            AI MCP 与 Skills
                        </CardTitle>
                        <CardDescription
                            >全新原生集成的模型上下文协议 (MCP) 与 Skills
                            机制。让自然语言大模型直接管理、排查你的游戏模组库。</CardDescription
                        >
                    </CardHeader>
                </Card>

                <Card
                    class="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors"
                >
                    <CardHeader>
                        <CardTitle class="flex items-center gap-4 mb-2">
                            <div
                                class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center"
                            >
                                <Globe class="h-6 w-6 text-primary" />
                            </div>
                            全平台兼容
                        </CardTitle>
                        <CardDescription
                            >不局限于单一系统。V2 将提供多平台原生支持，完美适配
                            Windows、macOS 和 Linux，让 Mod
                            管理无处不在。</CardDescription
                        >
                    </CardHeader>
                </Card>
            </div>
        </section>

        <!-- Supported Games Preview -->
        <section class="container max-w-7xl mx-auto px-4 md:px-8 text-center">
            <h2 class="text-3xl font-bold tracking-tight mb-6">
                连接超百款经典与热门大作
            </h2>
            <div
                class="flex flex-wrap justify-center gap-3 mb-8 max-w-3xl mx-auto"
            >
                <Badge variant="outline" class="text-sm py-1.5 px-4"
                    >黑神话: 悟空</Badge
                >
                <Badge variant="outline" class="text-sm py-1.5 px-4"
                    >赛博朋克 2077</Badge
                >
                <Badge variant="outline" class="text-sm py-1.5 px-4"
                    >博德之门 3</Badge
                >
                <Badge variant="outline" class="text-sm py-1.5 px-4"
                    >艾尔登法环</Badge
                >
                <Badge variant="outline" class="text-sm py-1.5 px-4"
                    >幻兽帕鲁</Badge
                >
                <Badge variant="outline" class="text-sm py-1.5 px-4"
                    >生化危机4 重制版</Badge
                >
                <Badge variant="outline" class="text-sm py-1.5 px-4"
                    >星露谷物语</Badge
                >
                <Badge
                    variant="outline"
                    class="text-sm py-1.5 px-4 border-dashed bg-muted/50"
                    >+ 150 更多游戏</Badge
                >
            </div>
            <Button variant="secondary" as-child>
                <RouterLink to="/games">查看完整支持列表</RouterLink>
            </Button>
        </section>
    </div>
</template>
