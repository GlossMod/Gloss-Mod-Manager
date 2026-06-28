<script setup lang="ts">
import type { Component } from "vue";
import {
    ArrowUpRight,
    BookOpen,
    Download,
    Gamepad2,
    Github,
    HeartHandshake,
    Languages,
    MessageSquare,
    Wrench,
} from "lucide-vue-next";
import { app } from "@tauri-apps/api";

interface ILinkItem {
    title: string;
    href: string;
    description: string;
    icon: Component;
}

const usageSteps: string[] = [
    "下载并安装 Gloss Mod Manager。",
    "运行 Gloss Mod Manager。",
    "选择您游玩的游戏。",
    "开始浏览、下载、安装和管理 Mod。",
];

const featureList: string[] = [
    "自适应语言，根据系统语言自动设置管理器的语言。",
    "自适应主题，根据系统主题决定使用浅色或深色界面。",
    "简洁的 UI，没有多余内容和臃肿广告。",
    "简单的安装和下载流程。",
    "便捷地浏览、下载 Mod。",
    "提供更舒适的动画与交互体验。",
    "程序无毒无捆绑。",
    "功能全部免费开放。",
    "支持自定义标签分类。",
    "支持备份存档和游戏文件。",
    "支持游戏库快捷切换。",
];

const relatedLinks: ILinkItem[] = [
    {
        title: "最新版本",
        href: "https://mod.3dmgame.com/mod/197445",
        description: "通过 3DM Mod 站获取项目的稳定发布版本。",
        icon: Download,
    },
    {
        title: "GitHub 仓库",
        href: "https://github.com/GlossMod/Gloss-Mod-Manager",
        description: "查看源码、版本记录、Issues 和 Discussions。",
        icon: Github,
    },
    {
        title: "Microsoft Apps",
        href: "https://apps.microsoft.com/detail/9P5VGZ39PK6T",
        description: "通过 Microsoft Store 获取桌面应用。",
        icon: ArrowUpRight,
    },
    {
        title: "网盘下载",
        href: "https://pan.aoe.top/Tools/GMM",
        description: "作为备用的下载入口使用。",
        icon: ArrowUpRight,
    },
    {
        title: "食用教程",
        href: "https://gmm.aoe.top/",
        description: "项目文档与使用说明入口。",
        icon: BookOpen,
    },
    {
        title: "Mod 前置",
        href: "https://pan.aoe.top/GMM/Requirements",
        description: "查看常见运行前置与依赖说明。",
        icon: Wrench,
    },
    {
        title: "新游戏请求",
        href: "https://github.com/GlossMod/Gloss-Mod-Manager/discussions/36",
        description: "提交希望支持的新游戏适配请求。",
        icon: Gamepad2,
    },
    {
        title: "问卷调查",
        href: "https://wj.qq.com/s2/14010887/92e3/",
        description: "反馈需求与使用偏好，帮助项目继续迭代。",
        icon: MessageSquare,
    },
    {
        title: "赞助小莫",
        href: "https://sponsor.aoe.top/",
        description: "如果项目对你有帮助，可以通过赞助支持开发。",
        icon: HeartHandshake,
    },
];

const feedbackLinks: ILinkItem[] = [
    {
        title: "QQ 频道",
        href: "https://pd.qq.com/s/hco46ol54",
        description: "README 中给出的公开反馈与交流入口。",
        icon: MessageSquare,
    },
    {
        title: "QQ群 1039886543",
        href: "https://qm.qq.com/q/iMXeJDJLiw",
        description: "相关链接部分提供的用户交流群入口。",
        icon: MessageSquare,
    },

    {
        title: "GitHub Issues",
        href: "https://github.com/GlossMod/Gloss-Mod-Manager/issues",
        description: "提交 bug、功能请求或跟踪已有问题。",
        icon: Github,
    },
    {
        title: "帮助翻译",
        href: "https://gmm.aoe.top/Translate.html",
        description: "参与项目的多语言翻译协作。",
        icon: Languages,
    },
];

const roadmapDone: string[] = [
    "设计工具整体风格和界面样式。",
    "完成工具基础架构，制作浏览 Mod 功能。",
    "添加下载 Mod 功能。",
    "实现安装和管理 Mod 功能。",
    "适配一些热门游戏。",
    "自动检查更新。",
    "实现制作 Mod 包功能，但仍需继续完善。",
    "用户登录功能。",
    "添加启动游戏功能，并允许用户选择游戏路径。",
    "多语言国际化，允许用户切换应用程序语言。",
    "自适应系统语言与系统主题。",
    "自动检查 Mod 更新功能。",
    "实现 Mod 排序功能，并允许用户自定义排序方式。",
];

const roadmapTodo: string[] = [
    "自动处理 Mod 冲突问题。",
    "继续完善 Mod 包制作能力。",
    "持续扩展游戏适配与社区协作能力。",
];

const version = ref("1.0.0");

async function getVersion() {
    version.value = await app.getVersion();
}

getVersion();
</script>

<template>
    <div class="mx-auto grid max-w-6xl gap-6 pb-6">
        <div class="flex min-w-0 flex-col gap-6">
            <Card class="border-border/70 shadow-sm">
                <CardContent class="p-4">
                    <div class="flex gap-6 items-center justify-center">
                        <img
                            src="/imgs/logo.png"
                            alt="Gloss Mod Manager Logo"
                            class="h-20 w-20 rounded-2xl border border-border/70 bg-background p-2"
                        />
                        <div class="min-w-0 space-y-3 flex flex-col">
                            <h1
                                class="text-3xl font-semibold tracking-tight mb-1"
                            >
                                Gloss Mod Manager
                                <span
                                    class="text-sm font-medium text-muted-foreground ml-2"
                                >
                                    v{{ version }}
                                </span>
                            </h1>
                            <p
                                class="max-w-3xl text-sm leading-7 text-muted-foreground gap-3 flex flex-wrap"
                            >
                                <a
                                    href="https://github.com/GlossMod/Gloss-Mod-Manager"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="doc-chip"
                                >
                                    GitHub
                                    <ArrowUpRight class="h-4 w-4" />
                                </a>
                                <a
                                    href="https://gmm.aoe.top/"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="doc-chip"
                                >
                                    食用教程
                                    <ArrowUpRight class="h-4 w-4" />
                                </a>
                                <a
                                    href="https://gmm.aoe.top/SupportedGames.html"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="doc-chip"
                                >
                                    支持的游戏
                                    <ArrowUpRight class="h-4 w-4" />
                                </a>
                                <a
                                    href="https://sponsor.aoe.top/"
                                    target="_blank"
                                    class="doc-chip"
                                >
                                    赞助
                                    <ArrowUpRight class="h-4 w-4" />
                                </a>
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card class="border-border/70 shadow-sm">
                <CardContent class="p-8 md:p-10">
                    <article class="doc-article">
                        <section id="what-is" class="doc-section">
                            <h2>这是什么？</h2>
                            <p>
                                Gloss Mod
                                Manager（GMM）是一款综合性的智能游戏模组管理器，
                                内置集成了AI MCP 和 Skills 工具.
                            </p>
                            <p>
                                安全无毒、简单易用，能够帮助用户更快地下载、安装和卸载
                                Mod。
                                无论你是第一次接触模组管理，还是已经有自己的使用习惯，GMM
                                的目标都是把常见流程集中到一个统一入口里。
                            </p>
                        </section>

                        <section id="how-to-use" class="doc-section">
                            <h2>如何使用？</h2>
                            <ol class="doc-list doc-list-decimal">
                                <li v-for="item in usageSteps" :key="item">
                                    {{ item }}
                                </li>
                            </ol>
                        </section>
                        <section id="links" class="doc-section">
                            <h2>相关链接</h2>
                            <div class="doc-link-list">
                                <a
                                    v-for="item in relatedLinks"
                                    :key="item.title"
                                    :href="item.href"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="doc-link-item"
                                >
                                    <div class="flex items-start gap-3">
                                        <component
                                            :is="item.icon"
                                            class="mt-0.5 h-4 w-4 shrink-0 text-primary"
                                        />
                                        <div class="space-y-1">
                                            <div
                                                class="font-medium text-foreground"
                                            >
                                                {{ item.title }}
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowUpRight
                                        class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                    />
                                </a>
                            </div>
                        </section>
                        <section id="features" class="doc-section">
                            <h2>特性</h2>
                            <ul class="doc-list">
                                <li v-for="item in featureList" :key="item">
                                    {{ item }}
                                </li>
                            </ul>
                        </section>

                        <section id="supported-games" class="doc-section">
                            <h2>支持的游戏</h2>
                            <p>
                                当前支持与适配中的游戏列表会持续更新，完整内容请查看
                                <a
                                    href="https://gmm.aoe.top/SupportedGames.html"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="doc-inline-link"
                                >
                                    支持的游戏页面
                                </a>
                                。
                            </p>
                        </section>

                        <section id="roadmap" class="doc-section">
                            <h2>开发计划</h2>
                            <p>
                                README
                                中的开发计划已经包含较完整的阶段信息。当前页面按“已完成”和“继续推进中”做了简单整理。
                            </p>

                            <h3>已完成</h3>
                            <ul class="doc-list">
                                <li v-for="item in roadmapDone" :key="item">
                                    {{ item }}
                                </li>
                            </ul>

                            <h3>继续推进中</h3>
                            <ul class="doc-list">
                                <li v-for="item in roadmapTodo" :key="item">
                                    {{ item }}
                                </li>
                            </ul>
                        </section>

                        <section id="feedback" class="doc-section">
                            <h2>反馈与协作</h2>
                            <p>
                                如果你需要反馈问题、提交建议、参与翻译或跟进项目动态，可以从下面这些公开入口进入。
                            </p>

                            <div class="doc-link-list">
                                <a
                                    v-for="item in feedbackLinks"
                                    :key="item.title"
                                    :href="item.href"
                                    target="_blank"
                                    rel="noreferrer"
                                    class="doc-link-item"
                                >
                                    <div class="flex items-start gap-3">
                                        <component
                                            :is="item.icon"
                                            class="mt-0.5 h-4 w-4 shrink-0 text-primary"
                                        />
                                        <div class="space-y-1">
                                            <div
                                                class="font-medium text-foreground"
                                            >
                                                {{ item.title }}
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowUpRight
                                        class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                                    />
                                </a>
                            </div>
                        </section>
                    </article>
                </CardContent>
            </Card>
        </div>
    </div>
</template>

<style scoped>
.doc-article {
    color: color-mix(in srgb, var(--foreground) 90%, transparent);
}

.doc-section {
    scroll-margin-top: 1.5rem;
}

.doc-section + .doc-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
}

.doc-section h2 {
    margin-bottom: 0.9rem;
    font-size: 1.35rem;
    font-weight: 600;
    letter-spacing: -0.02em;
}

.doc-section h3 {
    margin-top: 1.4rem;
    margin-bottom: 0.8rem;
    font-size: 1rem;
    font-weight: 600;
}

.doc-section p {
    font-size: 0.98rem;
    line-height: 1.9;
    color: color-mix(in srgb, var(--foreground) 78%, transparent);
}

.doc-list {
    display: flex;
    flex-direction: column;
    gap: 0.7rem;
    padding-left: 1.25rem;
    list-style: disc;
}

.doc-list-decimal {
    list-style: decimal;
}

.doc-list li {
    line-height: 1.8;
    color: color-mix(in srgb, var(--foreground) 82%, transparent);
}

.doc-link-list {
    display: flex;
    flex-direction: row;
    gap: 0.75rem;
    margin-top: 1rem;
    flex-wrap: wrap;
}

.doc-link-item {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
    border-radius: 1rem;
    padding: 0.95rem 1rem;
    background: color-mix(in srgb, var(--card) 92%, transparent);
    transition:
        border-color 0.2s ease,
        background-color 0.2s ease,
        transform 0.2s ease;
}

.doc-link-item:hover {
    transform: translateY(-1px);
    border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
    background: color-mix(in srgb, var(--muted) 45%, var(--card));
}

.doc-nav-link {
    display: block;
    border-radius: 0.75rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.92rem;
    color: color-mix(in srgb, var(--foreground) 78%, transparent);
    transition:
        background-color 0.2s ease,
        color 0.2s ease;
}

.doc-nav-link:hover {
    background: color-mix(in srgb, var(--muted) 75%, transparent);
    color: var(--foreground);
}

.doc-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border: 1px solid color-mix(in srgb, var(--border) 88%, transparent);
    border-radius: 9999px;
    padding: 0.45rem 0.85rem;
    font-size: 0.88rem;
    color: color-mix(in srgb, var(--foreground) 82%, transparent);
    transition:
        border-color 0.2s ease,
        background-color 0.2s ease,
        color 0.2s ease;
}

.doc-chip:hover {
    border-color: color-mix(in srgb, var(--primary) 30%, var(--border));
    background: color-mix(in srgb, var(--muted) 70%, transparent);
    color: var(--foreground);
}

.doc-inline-link {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 0.18rem;
}

.doc-inline-link:hover {
    opacity: 0.85;
}
</style>
