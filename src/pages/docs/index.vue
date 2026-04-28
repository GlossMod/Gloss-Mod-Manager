<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import MarkdownDoc from "@/components/MarkdownDoc.vue";
import { resolveDocByPath } from "@/lib/docs";

const doc = resolveDocByPath("");
</script>

<template>
    <DocsLayout>
        <MarkdownDoc v-if="doc" :doc="doc" />
    </DocsLayout>
</template>