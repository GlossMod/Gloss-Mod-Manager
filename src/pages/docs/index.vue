<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import MarkdownDoc from "@/components/MarkdownDoc.vue";
import { getDocDescription, resolveDocByPath } from "@/lib/docs";
import {
    createBreadcrumbJsonLd,
    createWebPageJsonLd,
    useSeoMeta,
} from "@/lib/seo";

const doc = resolveDocByPath("");
const pageTitle = "GMM 文档";
const pageDescription = doc
    ? getDocDescription(doc)
    : "阅读 Gloss Mod Manager 的安装、使用、MCP 配置、游戏适配和常见问题文档。";

useSeoMeta({
    title: pageTitle,
    description: pageDescription,
    path: "/docs",
    type: "article",
    keywords: ["GMM 文档", "Gloss Mod Manager 教程", "Mod 管理器使用指南"],
    structuredData: [
        createWebPageJsonLd(pageTitle, pageDescription, "/docs"),
        createBreadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "文档", path: "/docs" },
        ]),
    ],
});
</script>

<template>
    <DocsLayout>
        <MarkdownDoc v-if="doc" :doc="doc" />
    </DocsLayout>
</template>
