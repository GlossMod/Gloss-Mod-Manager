<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import DocsLayout from "@/components/DocsLayout.vue";
import MarkdownDoc from "@/components/MarkdownDoc.vue";
import { getDocDescription, resolveDocBySlug } from "@/lib/docs";
import {
    createBreadcrumbJsonLd,
    createWebPageJsonLd,
    useSeoMeta,
} from "@/lib/seo";

const route = useRoute();

const doc = computed(() => {
    const routeParams = route.params as Record<string, string | string[]>;
    const slug = routeParams.slug;
    return resolveDocBySlug(Array.isArray(slug) ? slug : String(slug));
});

useSeoMeta(() => {
    if (!doc.value) {
        const description = "当前路径没有匹配到 Gloss Mod Manager 文档。";

        return {
            title: "文档不存在",
            description,
            path: route.path,
            noindex: true,
            structuredData: createWebPageJsonLd(
                "文档不存在",
                description,
                route.path,
            ),
        };
    }

    const description = getDocDescription(doc.value);

    return {
        title: doc.value.title,
        description,
        path: doc.value.routePath,
        type: "article" as const,
        keywords: ["GMM 文档", doc.value.title, "Gloss Mod Manager 使用教程"],
        structuredData: [
            createWebPageJsonLd(
                doc.value.title,
                description,
                doc.value.routePath,
            ),
            createBreadcrumbJsonLd([
                { name: "首页", path: "/" },
                { name: "文档", path: "/docs" },
                { name: doc.value.title, path: doc.value.routePath },
            ]),
        ],
    };
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
