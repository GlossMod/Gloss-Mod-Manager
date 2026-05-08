<script setup lang="ts">
const footerLinks = [
    {
        title: "文档与资源",
        links: [
            { name: "开始使用", path: "/docs" },
            { name: "安装与卸载", path: "/docs/Install" },
            { name: "支持的游戏", path: "/games" },
            { name: "MCP 配置", path: "/docs/MCP" },
            { name: "翻译支持", path: "/docs/Translate" },
        ],
    },
    {
        title: "获取帮助",
        links: [
            { name: "常见问题 (FAQ)", path: "/docs/FQA/CantStart" },
            { name: "意见反馈", path: "/docs/Feedback" },
            { name: "项目合作", path: "/docs/Cooperation" },
            {
                name: "GitHub Issues",
                href: "https://github.com/GlossMod/Gloss-Mod-Manager/issues",
            },
            { name: "Discord 社区", href: "https://discord.gg/TF46tu7Upw" },
        ],
    },
    {
        title: "相关链接",
        links: [
            { name: "小莫个人站", href: "https://www.aoe.top/" },
            { name: "小莫博客园", href: "https://blog.aoe.top/" },
            { name: "Native DB", href: "https://nativedb.aoe.top/" },
            { name: "3DM Mod 站", href: "https://mod.3dmgame.com/" },
        ],
    },
];
</script>

<template>
    <footer class="border-t border-border/40 bg-muted/20">
        <div class="container max-w-screen-2xl px-4 md:px-8 mx-auto py-12">
            <FriendlyLinks class="mb-8" />
            <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
                <div class="col-span-1 md:col-span-1">
                    <div
                        class="flex items-center font-bold text-lg mb-4 space-x-2"
                    >
                        <img
                            src="/favicon.ico"
                            alt="Gloss Mod Manager"
                            class="h-6 w-6"
                        />
                        <span>Gloss Mod Manager</span>
                    </div>
                    <p
                        class="text-sm text-muted-foreground mb-4 leading-relaxed"
                    >
                        一款综合性的智能游戏模组管理器，内置集成了 AI MCP 和
                        Skills 工具。安全无毒，简单易用，为您提供极致的 Mod
                        管理体验。
                    </p>
                    <div class="text-sm text-muted-foreground/70">
                        &copy; {{ new Date().getFullYear() }} GlossMod. <br />
                        Licensed under GPL-3.0
                    </div>
                </div>

                <div v-for="section in footerLinks" :key="section.title">
                    <h3 class="text-sm font-semibold text-foreground mb-4">
                        {{ section.title }}
                    </h3>
                    <ul class="space-y-3">
                        <li v-for="link in section.links" :key="link.name">
                            <template v-if="link.href">
                                <a
                                    :href="link.href"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center"
                                >
                                    {{ link.name }}
                                    <span class="sr-only">(external link)</span>
                                </a>
                            </template>
                            <template v-else-if="link.path">
                                <RouterLink
                                    :to="link.path"
                                    class="text-sm text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {{ link.name }}
                                </RouterLink>
                            </template>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    </footer>
</template>
