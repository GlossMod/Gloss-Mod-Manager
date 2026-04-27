<script setup lang="ts">
const sidebarLinks = [
    {
        title: "入门指南",
        links: [
            { name: "介绍与下载", path: "/docs/getting-started" },
            { name: "安装与卸载 Mod", path: "/docs/install" },
            { name: "运行和使用", path: "/docs/use" },
        ],
    },
    {
        title: "高阶与配置",
        links: [
            { name: "MCP 服务器集成", path: "/docs/mcp" },
            { name: "支持的游戏列表", path: "/games" },
        ],
    },
    {
        title: "社区与贡献",
        links: [
            { name: "翻译软件", path: "/docs/translate" },
            { name: "常见问题 (FAQ)", path: "/docs/faq" },
            { name: "项目合作", path: "/docs/cooperation" },
            { name: "意见反馈", path: "/docs/feedback" },
        ],
    },
];
</script>

<template>
    <div
        class="container max-w-screen-2xl mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8 lg:gap-12 flex-1"
    >
        <!-- Sidebar Navigation -->
        <aside
            class="w-full md:w-64 lg:w-72 shrink-0 md:sticky md:top-20 self-start md:h-[calc(100vh-6rem)] overflow-y-auto"
        >
            <div class="space-y-8 pr-4">
                <div v-for="section in sidebarLinks" :key="section.title">
                    <h4 class="font-semibold mb-3 text-sm text-foreground">
                        {{ section.title }}
                    </h4>
                    <ul class="space-y-2.5">
                        <li v-for="link in section.links" :key="link.path">
                            <RouterLink
                                :to="link.path"
                                class="block text-sm transition-colors hover:text-primary"
                                exact-active-class="text-primary font-medium bg-primary/10 -mx-3 px-3 py-1.5 rounded-md"
                                :class="
                                    $route.path.startsWith(link.path) &&
                                    link.path !== '/docs'
                                        ? 'text-primary font-medium bg-primary/10 -mx-3 px-3 py-1.5 rounded-md'
                                        : 'text-muted-foreground'
                                "
                            >
                                {{ link.name }}
                            </RouterLink>
                        </li>
                    </ul>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 w-full min-w-0 max-w-4xl pb-16">
            <div class="prose-container">
                <slot />
            </div>
        </main>
    </div>
</template>

<style>
@reference "../style.css";

/* Basic prose-like styling since we don't have @tailwindcss/typography */
.prose-container {
    @apply text-foreground;
}
.prose-container h1 {
    @apply text-3xl md:text-4xl font-extrabold tracking-tight mb-6 mt-2;
}
.prose-container h2 {
    @apply text-2xl md:text-3xl font-bold tracking-tight mb-4 mt-10 border-b border-border pb-2;
}
.prose-container h3 {
    @apply text-xl font-semibold mb-4 mt-8;
}
.prose-container p {
    @apply leading-7 mb-6 text-foreground/90;
}
.prose-container ul {
    @apply list-disc pl-6 mb-6 space-y-2;
}
.prose-container ol {
    @apply list-decimal pl-6 mb-6 space-y-2;
}
.prose-container li {
    @apply leading-7 text-foreground/90;
}
.prose-container a {
    @apply font-medium text-primary underline underline-offset-4 decoration-primary/30 hover:decoration-primary;
}
.prose-container blockquote {
    @apply mt-6 border-l-4 border-primary/50 pl-4 py-1 italic text-muted-foreground bg-muted/30 rounded-r-lg;
}
.prose-container code {
    @apply relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold;
}
.prose-container pre {
    @apply bg-muted p-4 rounded-lg overflow-x-auto mb-6 text-sm flex;
}
.prose-container pre code {
    @apply bg-transparent p-0 text-foreground font-normal;
}
.prose-container img {
    @apply rounded-xl border border-border shadow-sm mb-6 max-w-full h-auto;
}
.prose-container hr {
    @apply my-8 border-border;
}
.prose-container table {
    @apply w-full text-left border-collapse mb-6;
}
.prose-container th {
    @apply border-b border-border py-2 px-4 font-semibold text-foreground bg-muted/30;
}
.prose-container td {
    @apply border-b border-border py-2 px-4;
}
</style>
