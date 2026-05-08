<script setup lang="ts">
import {
    DEFAULT_SEO_DESCRIPTION,
    DEFAULT_SEO_TITLE,
    createSoftwareApplicationJsonLd,
    createWebSiteJsonLd,
    useSeoMeta,
} from "@/lib/seo";

useSeoMeta({
    title: DEFAULT_SEO_TITLE,
    description: DEFAULT_SEO_DESCRIPTION,
    path: "/",
    keywords: ["免费 Mod 管理器", "跨平台 Mod 工具", "游戏模组下载"],
    structuredData: [createWebSiteJsonLd(), createSoftwareApplicationJsonLd()],
});
</script>

<template>
    <Layout>
        <RouterView />
    </Layout>
</template>
