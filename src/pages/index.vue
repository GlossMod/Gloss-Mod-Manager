<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Download,
    Zap,
    Bot,
    Layers,
    ArrowRight,
    ShieldCheck,
    Globe,
    Cpu,
    Blocks,
} from "lucide-vue-next";
</script>

<template>
    <div class="flex flex-col mb-20 space-y-24">
        <!-- Hero Section -->
        <section class="relative pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden">
            <div class="container max-w-7xl mx-auto px-4 md:px-8 text-center">
                <Badge variant="secondary" class="mb-6 mx-auto inline-flex">
                    <span class="mr-2">🎉</span> GMM V2 现已发布 - 体积锐减 90%
                </Badge>
                <h1
                    class="text-4xl md:text-6xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl mx-auto leading-tight"
                >
                    下一代
                    <span
                        class="text-transparent bg-clip-text bg-linear-to-r from-primary to-primary/60"
                        >智能游戏模组</span
                    >
                    管理器
                </h1>
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
                        href="https://github.com/GlossMod/Gloss-Mod-Manager/releases"
                        target="_blank"
                        class="w-full sm:w-auto h-12 px-8 text-base"
                    >
                        <Download class="mr-2 h-5 w-5" />
                        免费下载 V2
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
                        <div
                            class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4"
                        >
                            <Zap class="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle>体积缩减 90%</CardTitle>
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
                        <div
                            class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4"
                        >
                            <Bot class="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle>AI MCP 与 Skills</CardTitle>
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
                        <div
                            class="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4"
                        >
                            <Globe class="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle>全平台兼容</CardTitle>
                        <CardDescription
                            >不局限于单一系统。V2 将提供多平台原生支持，完美适配
                            Windows、macOS 和 Linux，让 Mod
                            管理无处不在。</CardDescription
                        >
                    </CardHeader>
                </Card>
            </div>
        </section>

        <!-- Features Section -->
        <section
            class="container max-w-7xl mx-auto px-4 md:px-8 py-12 rounded-3xl bg-muted/30 border border-border/50"
        >
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <div>
                    <Badge class="mb-4">核心特性</Badge>
                    <h2 class="text-3xl font-bold tracking-tight mb-6">
                        为什么选择 Gloss Mod Manager？
                    </h2>
                    <ul class="space-y-6">
                        <li class="flex items-start gap-4">
                            <ShieldCheck
                                class="h-6 w-6 text-primary mt-1 shrink-0"
                            />
                            <div>
                                <h3 class="font-semibold text-lg">
                                    安全、干净、无广告
                                </h3>
                                <p class="text-muted-foreground mt-1">
                                    GMM 通过了 VirusTotal
                                    验证，不需要不必要的管理员权限，绝无广告或捆绑软件。
                                </p>
                            </div>
                        </li>
                        <li class="flex items-start gap-4">
                            <Layers
                                class="h-6 w-6 text-primary mt-1 shrink-0"
                            />
                            <div>
                                <h3 class="font-semibold text-lg">
                                    自动处理 Mod 冲突
                                </h3>
                                <p class="text-muted-foreground mt-1">
                                    无论是排序还是前置依赖，GMM
                                    都能智能提示并协助处理复杂的模组冲突问题。
                                </p>
                            </div>
                        </li>
                        <li class="flex items-start gap-4">
                            <Blocks
                                class="h-6 w-6 text-primary mt-1 shrink-0"
                            />
                            <div>
                                <h3 class="font-semibold text-lg">
                                    无缝接入海量游戏
                                </h3>
                                <p class="text-muted-foreground mt-1">
                                    不仅支持超过一百款热门游戏，更向下完美兼容
                                    V1 的 Mod 列表和备份存档结构。
                                </p>
                            </div>
                        </li>
                    </ul>
                </div>
                <div
                    class="relative flex justify-center items-center h-full min-h-75 border border-border rounded-xl bg-background/50 overflow-hidden shadow-sm"
                >
                    <!-- Placeholder for UI screenshot -->
                    <div
                        class="flex flex-col items-center justify-center text-muted-foreground/50 space-y-4 p-8 text-center"
                    >
                        <Cpu class="h-16 w-16 opacity-50" />
                        <p class="text-sm font-medium">
                            智能、简洁且极度自由的全新界面
                        </p>
                    </div>
                </div>
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

        <!-- Final CTA -->
        <section class="container max-w-7xl mx-auto px-4 md:px-8 mb-12">
            <div
                class="bg-primary text-primary-foreground rounded-3xl p-8 md:p-16 text-center shadow-lg relative overflow-hidden"
            >
                <div class="relative z-10">
                    <h2 class="text-3xl md:text-4xl font-bold mb-4">
                        准备好掌控你的 Mod 库了吗？
                    </h2>
                    <p
                        class="text-primary-foreground/80 md:text-lg mb-8 max-w-2xl mx-auto"
                    >
                        立即下载 Gloss Mod Manager
                        V2，体验前所未有的智能模组管理方式，让你的游戏乐趣倍增。
                    </p>
                    <Button
                        size="lg"
                        variant="secondary"
                        as="a"
                        href="https://github.com/GlossMod/Gloss-Mod-Manager/releases"
                        target="_blank"
                        class="h-12 px-8 font-semibold text-base"
                    >
                        获取最新的正式版
                    </Button>
                </div>
                <!-- Decorative bg -->
                <div
                    class="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,var(--tw-gradient-stops))] from-white via-transparent to-transparent"
                ></div>
            </div>
        </section>
    </div>
</template>
