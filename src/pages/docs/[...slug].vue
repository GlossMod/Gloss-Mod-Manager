<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import DocsLayout from "@/components/DocsLayout.vue";
import MarkdownDoc from "@/components/MarkdownDoc.vue";
import { resolveDocBySlug } from "@/lib/docs";

const route = useRoute();

const doc = computed(() => {
    const routeParams = route.params as Record<string, string | string[]>;
    const slug = routeParams.slug;
    return resolveDocBySlug(Array.isArray(slug) ? slug : String(slug));
});
</script>

<template>
    <DocsLayout>
        <MarkdownDoc v-if="doc" :doc="doc" />
        <div v-else class="rounded-lg border border-dashed border-border p-8">
            <h1>文档不存在</h1>
            <p>当前路径没有匹配到 Markdown 文档。</p>
            <RouterLink to="/docs">返回文档首页</RouterLink>
        </div>
    </DocsLayout>
</template>
