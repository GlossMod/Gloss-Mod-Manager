<script setup lang="ts">
import MarkdownIt from "markdown-it";
import { computed } from "vue";
import type { DocRecord } from "@/lib/docs";
import {
    createUniqueHeadingSlug,
    getRenderableMarkdown,
    rewriteDocHref,
} from "@/lib/docs";

const props = defineProps<{
    doc: DocRecord;
}>();

const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    breaks: true,
});

const defaultLinkOpen = markdown.renderer.rules.link_open;
const defaultHeadingOpen = markdown.renderer.rules.heading_open;

interface MarkdownRenderEnv {
    headingSlugCounts?: Map<string, number>;
}

markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const currentToken = tokens[index];

    if (!currentToken) {
        if (defaultLinkOpen) {
            return defaultLinkOpen(tokens, index, options, env, self);
        }

        return self.renderToken(tokens, index, options);
    }

    const hrefIndex = currentToken.attrIndex("href");

    if (hrefIndex >= 0) {
        const href = currentToken.attrs?.[hrefIndex]?.[1] ?? "";
        const rewrittenHref = rewriteDocHref(href, props.doc);
        const hrefAttribute = currentToken.attrs?.[hrefIndex];

        if (hrefAttribute) {
            hrefAttribute[1] = rewrittenHref;
        }

        if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(rewrittenHref)) {
            currentToken.attrSet("target", "_blank");
            currentToken.attrSet("rel", "noopener noreferrer");
        }
    }

    if (defaultLinkOpen) {
        return defaultLinkOpen(tokens, index, options, env, self);
    }

    return self.renderToken(tokens, index, options);
};

markdown.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const currentToken = tokens[index];

    if (!currentToken) {
        if (defaultHeadingOpen) {
            return defaultHeadingOpen(tokens, index, options, env, self);
        }

        return self.renderToken(tokens, index, options);
    }

    const tag = currentToken.tag;

    if (["h2", "h3", "h4"].includes(tag)) {
        const renderEnv = env as MarkdownRenderEnv;
        renderEnv.headingSlugCounts ??= new Map<string, number>();
        const title = tokens[index + 1]?.content ?? "";
        currentToken.attrSet(
            "id",
            createUniqueHeadingSlug(title, renderEnv.headingSlugCounts),
        );
    }

    if (defaultHeadingOpen) {
        return defaultHeadingOpen(tokens, index, options, env, self);
    }

    return self.renderToken(tokens, index, options);
};

const renderedHtml = computed(() => {
    const renderEnv: MarkdownRenderEnv = { headingSlugCounts: new Map() };
    return markdown.render(getRenderableMarkdown(props.doc.content), renderEnv);
});
</script>

<template>
    <article class="markdown-body docs-markdown-body" v-html="renderedHtml" />
</template>

<style scoped>
.markdown-body:deep(ol) {
    list-style: auto;
}
</style>
