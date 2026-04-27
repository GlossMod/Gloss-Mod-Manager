<script setup lang="ts">
import { useDark, useToggle } from "@vueuse/core";
import { Sun, Moon } from "lucide-vue-next";

const hideHeader = ref(false);
const isDark = useDark();
const toggleDark = useToggle(isDark);
</script>

<template>
    <div
        class="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-300"
    >
        <header
            v-if="!hideHeader"
            class="sticky top-0 z-50 w-full border-b backdrop-blur supports-backdrop-filter:bg-background/60"
        >
            <div
                class="container mx-auto flex h-14 items-center justify-between px-4"
            >
                <div class="font-bold">UI 设计合集</div>
                <nav class="flex items-center gap-2">
                    <Switch v-model="hideHeader" />
                    <Button variant="ghost" size="icon" @click="toggleDark()">
                        <Sun v-if="!isDark" class="h-5 w-5" />
                        <Moon v-else class="h-5 w-5" />
                        <span class="sr-only">切换主题</span>
                    </Button>
                </nav>
            </div>
        </header>

        <main class="flex-1">
            <slot />
        </main>
    </div>
</template>

<style scoped></style>
