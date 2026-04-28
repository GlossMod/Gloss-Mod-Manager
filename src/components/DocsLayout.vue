<script setup lang="ts">
import { ChevronDown, ListTree } from "lucide-vue-next";
import { computed, ref } from "vue";
import { useRoute } from "vue-router";
import { docsNavGroups, resolveDocByPath } from "@/lib/docs";

const route = useRoute();
const openGroups = ref(new Set(docsNavGroups.map((section) => section.title)));

const currentDoc = computed(() => resolveDocByPath(route.path));
const pageHeadings = computed(() => currentDoc.value?.headings ?? []);

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
        class="container max-w-screen-2xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)_14rem] flex-1"
    >
        <!-- Sidebar Navigation -->
        <aside
            class="w-full lg:sticky lg:top-20 self-start lg:h-[calc(100vh-6rem)] overflow-y-auto rounded-lg border border-border/70 bg-background/70 p-3 shadow-sm"
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
                            <RouterLink
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
                            </RouterLink>
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
    color: var(--foreground);
}

.prose-container h1 {
    margin-top: 0.5rem;
    margin-bottom: 1.5rem;
    font-size: 1.875rem;
    font-weight: 800;
    line-height: 1.2;
}

.prose-container h2 {
    margin-top: 2.5rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    scroll-margin-top: 6rem;
    border-bottom: 1px solid var(--border);
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.25;
}

.prose-container h3 {
    margin-top: 2rem;
    margin-bottom: 1rem;
    scroll-margin-top: 6rem;
    font-size: 1.25rem;
    font-weight: 600;
    line-height: 1.4;
}

.prose-container h4 {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    scroll-margin-top: 6rem;
    font-size: 1.125rem;
    font-weight: 600;
    line-height: 1.4;
}

.prose-container p {
    margin-bottom: 1.5rem;
    color: color-mix(in oklab, var(--foreground) 90%, transparent);
    line-height: 1.75rem;
}

.prose-container ul,
.prose-container ol {
    margin-bottom: 1.5rem;
    padding-left: 1.5rem;
}

.prose-container ul {
    list-style: disc;
}

.prose-container ol {
    list-style: decimal;
}

.prose-container li {
    color: color-mix(in oklab, var(--foreground) 90%, transparent);
    line-height: 1.75rem;
}

.prose-container li + li {
    margin-top: 0.5rem;
}

.prose-container a {
    color: var(--primary);
    font-weight: 500;
    text-decoration-line: underline;
    text-decoration-color: color-mix(in oklab, var(--primary) 30%, transparent);
    text-underline-offset: 4px;
}

.prose-container a:hover {
    text-decoration-color: var(--primary);
}

.prose-container blockquote {
    margin-top: 1.5rem;
    border-left: 4px solid color-mix(in oklab, var(--primary) 50%, transparent);
    border-radius: 0 0.5rem 0.5rem 0;
    background: color-mix(in oklab, var(--muted) 30%, transparent);
    color: var(--muted-foreground);
    padding: 0.25rem 0 0.25rem 1rem;
    font-style: italic;
}

.prose-container code {
    border-radius: 0.25rem;
    background: var(--muted);
    padding: 0.2rem 0.3rem;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 0.875rem;
    font-weight: 600;
}

.prose-container pre {
    display: flex;
    margin-bottom: 1.5rem;
    overflow-x: auto;
    border-radius: 0.5rem;
    background: var(--muted);
    padding: 1rem;
    font-size: 0.875rem;
}

.prose-container pre code {
    background: transparent;
    color: var(--foreground);
    padding: 0;
    font-weight: 400;
}

.prose-container img,
.prose-container iframe {
    margin-bottom: 1.5rem;
    max-width: 100%;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

.prose-container img {
    height: auto;
}

.prose-container kbd {
    border: 1px solid var(--border);
    border-radius: 0.25rem;
    background: var(--muted);
    padding: 0.125rem 0.375rem;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 0.75rem;
}

.prose-container hr {
    margin: 2rem 0;
    border-color: var(--border);
}

.prose-container table {
    width: 100%;
    margin-bottom: 1.5rem;
    border-collapse: collapse;
    text-align: left;
}

.prose-container th,
.prose-container td {
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 1rem;
}

.prose-container th {
    background: color-mix(in oklab, var(--muted) 30%, transparent);
    color: var(--foreground);
    font-weight: 600;
}

@media (min-width: 768px) {
    .prose-container h1 {
        font-size: 2.25rem;
    }

    .prose-container h2 {
        font-size: 1.875rem;
    }
}
</style>
