<script setup lang="ts">
import { onMounted, ref } from "vue";

type FriendLink = {
    name: string;
    url: string;
    description?: string;
};

const links = ref<FriendLink[]>([]);
const pending = ref(true);
const failed = ref(false);

async function loadLinks() {
    try {
        const response = await fetch("https://api.aoe.top/api/friendly/links");
        if (!response.ok) {
            throw new Error(`Failed to load links: ${response.status}`);
        }

        const data = await response.json();
        links.value = Array.isArray(data) ? data : [];
    } catch (error) {
        console.error(error);
        failed.value = true;
    } finally {
        pending.value = false;
    }
}

onMounted(loadLinks);
</script>

<template>
    <div class="w-full">
        <h3 class="text-sm font-semibold text-foreground mb-4">友情链接</h3>
        <div v-if="pending" class="text-sm text-muted-foreground">
            友链加载中...
        </div>
        <div v-else-if="failed" class="text-sm text-muted-foreground">
            友链暂时不可用，请稍后再试。
        </div>
        <div v-else class="flex flex-wrap gap-x-4 gap-y-2">
            <a
                v-for="link in links"
                :key="link.url"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                {{ link.name }}
            </a>
        </div>
    </div>
</template>
