<script setup lang="ts">
import { ChevronDown, ListTree, Menu } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { docsNavGroups, resolveDocByPath } from "@/lib/docs";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const route = useRoute();
const openGroups = ref(new Set(docsNavGroups.map((section) => section.title)));

const currentDoc = computed(() => resolveDocByPath(route.path));
const pageHeadings = computed(() => currentDoc.value?.headings ?? []);

const isMobileMenuOpen = ref(false);

// 路由变化时自动关闭移动端菜单
watch(
    () => route.path,
    () => {
        isMobileMenuOpen.value = false;
    },
);

const isActiveDocPath = (path: string) => {
    const routePath = route.path.toLowerCase();
    const linkPath = path.toLowerCase();

    return linkPath === "/docs"
        ? routePath === linkPath
        : routePath === linkPath || routePath.startsWith(`${linkPath}/`);
};

const isSectionActive = (links: { routePath: string }[]) =>
    links.some((link) => isActiveDocPath(link.routePath));

const isGroupOpen = (title: string) => openGroups.value.has(title);

const toggleGroup = (title: string) => {
    const nextOpenGroups = new Set(openGroups.value);

    if (nextOpenGroups.has(title)) {
        nextOpenGroups.delete(title);
    } else {
        nextOpenGroups.add(title);
    }

    openGroups.value = nextOpenGroups;
};
</script>

<template>
    <div
        class="container max-w-screen-2xl mx-auto px-4 md:px-8 py-8 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_14rem] lg:gap-8 flex-1"
    >
        <!-- Mobile Navigation -->
        <div class="lg:hidden mb-6">
            <Sheet v-model:open="isMobileMenuOpen">
                <SheetTrigger as-child>
                    <Button variant="outline" class="w-full justify-between">
                        <span class="flex items-center gap-2">
                            <Menu class="h-4 w-4" />
                            文档导航
                        </span>
                        <ChevronDown class="h-4 w-4 opacity-50" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" class="w-80 pl-0">
                    <div class="h-full overflow-y-auto px-4 pb-8">
                        <SheetHeader class="mb-4">
                            <SheetTitle class="text-left">文档导航</SheetTitle>
                        </SheetHeader>
                        <div class="space-y-1">
                            <div
                                v-for="section in docsNavGroups"
                                :key="section.title"
                            >
                                <button
                                    type="button"
                                    class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted/80"
                                    :class="
                                        isSectionActive(section.links)
                                            ? 'text-foreground'
                                            : 'text-muted-foreground'
                                    "
                                    @click="toggleGroup(section.title)"
                                >
                                    <span>{{ section.title }}</span>
                                    <ChevronDown
                                        class="h-4 w-4 transition-transform"
                                        :class="
                                            isGroupOpen(section.title)
                                                ? ''
                                                : '-rotate-90'
                                        "
                                    />
                                </button>
                                <ul
                                    v-show="isGroupOpen(section.title)"
                                    class="mt-1 space-y-1 pb-2"
                                >
                                    <li
                                        v-for="link in section.links"
                                        :key="link.routePath"
                                    >
                                        <NuxtLink
                                            :to="link.routePath"
                                            class="block rounded-md px-3 py-1.5 text-sm leading-6 transition-colors hover:bg-muted/70 hover:text-foreground"
                                            exact-active-class="text-primary font-medium bg-primary/10"
                                            :class="
                                                isActiveDocPath(link.routePath)
                                                    ? 'text-primary font-medium bg-primary/10'
                                                    : 'text-muted-foreground'
                                            "
                                        >
                                            {{ link.title }}
                                        </NuxtLink>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>
        </div>

        <!-- Sidebar Navigation -->
        <aside
            class="hidden lg:block w-full lg:sticky lg:top-20 self-start lg:h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-border/70 bg-background/70 p-3 shadow-sm"
        >
            <div class="space-y-1">
                <div v-for="section in docsNavGroups" :key="section.title">
                    <button
                        type="button"
                        class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-muted/80"
                        :class="
                            isSectionActive(section.links)
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                        "
                        @click="toggleGroup(section.title)"
                    >
                        <span>{{ section.title }}</span>
                        <ChevronDown
                            class="h-4 w-4 transition-transform"
                            :class="
                                isGroupOpen(section.title) ? '' : '-rotate-90'
                            "
                        />
                    </button>
                    <ul
                        v-show="isGroupOpen(section.title)"
                        class="mt-1 space-y-1 pb-2"
                    >
                        <li v-for="link in section.links" :key="link.routePath">
                            <NuxtLink
                                :to="link.routePath"
                                class="block rounded-md px-3 py-1.5 text-sm leading-6 transition-colors hover:bg-muted/70 hover:text-foreground"
                                exact-active-class="text-primary font-medium bg-primary/10"
                                :class="
                                    isActiveDocPath(link.routePath)
                                        ? 'text-primary font-medium bg-primary/10'
                                        : 'text-muted-foreground'
                                "
                            >
                                {{ link.title }}
                            </NuxtLink>
                        </li>
                    </ul>
                </div>
            </div>
        </aside>

        <!-- Main Content Area -->
        <main class="w-full min-w-0 max-w-4xl pb-16">
            <div class="prose-container">
                <slot />
            </div>
        </main>

        <aside
            v-if="pageHeadings.length > 0"
            class="hidden xl:block sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-border/70 bg-background/70 p-4 shadow-sm"
        >
            <div
                class="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground"
            >
                <ListTree class="h-4 w-4" />
                页面导航
            </div>
            <nav class="space-y-1 text-sm">
                <a
                    v-for="heading in pageHeadings"
                    :key="`${heading.id}-${heading.title}`"
                    :href="`#${heading.id}`"
                    class="block rounded-md py-1.5 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                    :class="[
                        heading.level === 3 ? 'pl-5 pr-2 text-xs' : 'px-2',
                        heading.level === 4 ? 'pl-8 pr-2 text-xs' : '',
                        route.hash === `#${heading.id}`
                            ? 'text-primary bg-primary/10'
                            : '',
                    ]"
                >
                    {{ heading.title }}
                </a>
            </nav>
        </aside>
    </div>
</template>

<style>
.prose-container {
    min-width: 0;
}

.prose-container .docs-markdown-body {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    border-radius: 1rem;
    padding: 1.5rem;
    box-shadow: 0 16px 40px rgb(15 23 42 / 0.05);
    background-color: transparent;
}

.prose-container .docs-markdown-body > :first-child {
    margin-top: 0;
}

.prose-container .docs-markdown-body > :last-child {
    margin-bottom: 0;
}

.prose-container .docs-markdown-body h1,
.prose-container .docs-markdown-body h2,
.prose-container .docs-markdown-body h3,
.prose-container .docs-markdown-body h4 {
    scroll-margin-top: 6rem;
}

.prose-container .docs-markdown-body iframe {
    display: block;
    width: 100%;
    max-width: 100%;
    margin-bottom: 1.5rem;
    border: 1px solid var(--borderColor-muted);
    border-radius: 0.75rem;
    aspect-ratio: 16 / 9;
}

@media (min-width: 768px) {
    .prose-container .docs-markdown-body {
        padding: 2rem 2.25rem;
    }
}
</style>
