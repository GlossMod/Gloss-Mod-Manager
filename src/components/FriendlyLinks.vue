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
    <section class="friendly-links-shell">
        <div class="friendly-links-card">
            <div class="friendly-links-header">
                <p class="friendly-links-eyebrow">友情链接</p>
            </div>
            <div v-if="pending" class="friendly-links-state">友链加载中...</div>
            <div v-else-if="failed" class="friendly-links-state">
                友链暂时不可用，请稍后再试。
            </div>
            <div v-else class="friendly-links-grid">
                <a
                    v-for="link in links"
                    :key="link.url"
                    :href="link.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="friendly-links-item">
                    <span class="friendly-links-name">{{ link.name }}</span>
                </a>
            </div>
        </div>
    </section>
</template>

<style scoped>
.friendly-links-shell {
    padding: 0 24px 20px;
}

.friendly-links-card {
    max-width: 1152px;
    margin: 0 auto;
    color: inherit;
}

.friendly-links-header {
    margin-bottom: 0.45rem;
}

.friendly-links-eyebrow {
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(247, 247, 255, 0.72);
}

.friendly-links-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 0.5rem;
}

.friendly-links-item {
    display: inline-flex;
    align-items: center;
    padding: 0.2rem 0.4rem;
    border-radius: 999px;
    text-decoration: none;
    border: 0;
    background: transparent;
    color: rgba(248, 249, 255, 0.72);
    font-size: 12px;
    line-height: 1.4;
    transition:
        color 0.2s ease,
        opacity 0.2s ease;
}

.friendly-links-item:hover {
    color: #8ab0ff;
}

.friendly-links-name {
    display: block;
}

.friendly-links-state {
    padding: 0.2rem 0;
    color: rgba(223, 229, 255, 0.58);
    font-size: 12px;
}

@media (max-width: 640px) {
    .friendly-links-shell {
        padding: 0 16px 16px;
    }
}
</style>
