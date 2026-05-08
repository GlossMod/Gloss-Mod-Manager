<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { computed } from "vue";

const props = defineProps<{
    content: string;
}>();

const markdown = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: true,
    breaks: true,
});

const defaultLinkOpen = markdown.renderer.rules.link_open;

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
    tokens[index].attrSet("target", "_blank");
    tokens[index].attrSet("rel", "noopener noreferrer");

    if (defaultLinkOpen) {
        return defaultLinkOpen(tokens, index, options, env, self);
    }

    return self.renderToken(tokens, index, options);
};

const renderedHtml = computed(() => markdown.render(props.content || ""));
</script>

<template>
    <div class="discussion-markdown" v-html="renderedHtml" />
</template>

<style scoped>
.discussion-markdown {
    color: color-mix(in oklab, var(--foreground) 92%, transparent);
    overflow-wrap: anywhere;
}

.discussion-markdown :deep(*:first-child) {
    margin-top: 0;
}

.discussion-markdown :deep(*:last-child) {
    margin-bottom: 0;
}

.discussion-markdown :deep(h1),
.discussion-markdown :deep(h2),
.discussion-markdown :deep(h3),
.discussion-markdown :deep(h4) {
    margin-top: 1.5rem;
    margin-bottom: 0.75rem;
    font-weight: 700;
    line-height: 1.35;
    color: var(--foreground);
}

.discussion-markdown :deep(h1) {
    font-size: 1.5rem;
}

.discussion-markdown :deep(h2) {
    font-size: 1.25rem;
}

.discussion-markdown :deep(h3) {
    font-size: 1.125rem;
}

.discussion-markdown :deep(p),
.discussion-markdown :deep(ul),
.discussion-markdown :deep(ol),
.discussion-markdown :deep(blockquote),
.discussion-markdown :deep(pre),
.discussion-markdown :deep(table) {
    margin-bottom: 1rem;
}

.discussion-markdown :deep(ul),
.discussion-markdown :deep(ol) {
    padding-left: 1.5rem;
}

.discussion-markdown :deep(ul) {
    list-style: disc;
}

.discussion-markdown :deep(ol) {
    list-style: decimal;
}

.discussion-markdown :deep(li + li) {
    margin-top: 0.35rem;
}

.discussion-markdown :deep(a) {
    color: var(--primary);
    text-decoration: underline;
    text-underline-offset: 4px;
}

.discussion-markdown :deep(blockquote) {
    border-left: 3px solid color-mix(in oklab, var(--primary) 35%, transparent);
    background: color-mix(in oklab, var(--muted) 45%, transparent);
    border-radius: 0 0.5rem 0.5rem 0;
    padding: 0.5rem 0.875rem;
    color: var(--muted-foreground);
}

.discussion-markdown :deep(code) {
    border-radius: 0.35rem;
    background: color-mix(in oklab, var(--muted) 85%, transparent);
    padding: 0.15rem 0.35rem;
    font-family:
        ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
        "Liberation Mono", "Courier New", monospace;
    font-size: 0.875em;
}

.discussion-markdown :deep(pre) {
    overflow-x: auto;
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    background: color-mix(in oklab, var(--muted) 75%, transparent);
    padding: 0.875rem 1rem;
}

.discussion-markdown :deep(pre code) {
    background: transparent;
    padding: 0;
}

.discussion-markdown :deep(hr) {
    margin: 1.5rem 0;
    border-color: var(--border);
}

.discussion-markdown :deep(table) {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
}

.discussion-markdown :deep(th),
.discussion-markdown :deep(td) {
    border-bottom: 1px solid var(--border);
    padding: 0.5rem 0.75rem;
    vertical-align: top;
}

.discussion-markdown :deep(th) {
    font-weight: 600;
    color: var(--foreground);
}

.discussion-markdown :deep(img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.75rem;
}
</style>
