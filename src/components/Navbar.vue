<script setup lang="ts">
import { useDark, useToggle } from "@vueuse/core";
import { Menu, Moon, Sun, X } from "@lucide/vue";
import { Github } from "lucide-vue-next";
import { computed, onMounted, ref } from "vue";
import { Button } from "@/components/ui/button";

const isDark = useDark();
const toggleDark = useToggle(isDark);
const isMenuOpen = ref(false);
const isThemeReady = ref(false);
const themeIcon = computed(() =>
    isThemeReady.value && isDark.value ? Sun : Moon,
);

const navLinks = [
    { name: "首页", path: "/" },
    { name: "下载", path: "/download" },
    { name: "文档", path: "/docs" },
    { name: "支持的游戏", path: "/games" },
    { name: "新增游戏", path: "/add-new-game" },
    { name: "赞助游戏", path: "/crowdfunding" },
];

const toggleMenu = () => {
    isMenuOpen.value = !isMenuOpen.value;
};

onMounted(() => {
    isThemeReady.value = true;
});
</script>

<template>
    <header
        class="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95"
    >
        <div
            class="container flex h-14 max-w-screen-2xl items-center px-4 md:px-8 mx-auto"
        >
            <!-- Desktop Nav -->
            <div class="mr-4 hidden md:flex">
                <NuxtLink to="/" class="mr-6 flex items-center gap-2">
                    <img
                        src="/favicon.ico"
                        alt="Gloss Mod Manager"
                        class="size-6"
                    />
                    <span class="hidden font-bold sm:inline-block"
                        >Gloss Mod Manager</span
                    >
                </NuxtLink>
                <nav class="flex items-center gap-6 text-sm font-medium">
                    <NuxtLink
                        v-for="link in navLinks"
                        :key="link.path"
                        :to="link.path"
                        class="transition-colors hover:text-foreground/80"
                        active-class="text-foreground"
                        :class="[
                            $route.path === link.path
                                ? 'text-foreground'
                                : 'text-foreground/60',
                        ]"
                    >
                        {{ link.name }}
                    </NuxtLink>
                </nav>
            </div>

            <!-- Mobile Menu Button -->
            <button
                class="inline-flex items-center justify-center md:hidden mr-2"
                @click="toggleMenu"
            >
                <Menu v-if="!isMenuOpen" class="size-5" />
                <X v-else class="size-5" />
                <span class="sr-only">Toggle Menu</span>
            </button>

            <!-- Mobile Title (Centered) -->
            <div class="flex-1 md:hidden flex justify-center items-center">
                <NuxtLink to="/" class="flex items-center gap-2">
                    <img
                        src="/favicon.ico"
                        alt="Gloss Mod Manager"
                        class="size-6"
                    />
                    <span class="font-bold sm:inline-block">GMM</span>
                </NuxtLink>
            </div>

            <!-- Right controls -->
            <div class="flex flex-1 items-center justify-end gap-2">
                <nav class="flex items-center gap-1">
                    <Button variant="ghost" size="icon" as-child>
                        <a
                            href="https://github.com/GlossMod/Gloss-Mod-Manager"
                            target="_blank"
                            rel="noreferrer"
                        >
                            <Github />
                            <span class="sr-only">GitHub</span>
                        </a>
                    </Button>
                    <Button variant="ghost" size="icon" @click="toggleDark()">
                        <component :is="themeIcon" />
                        <span class="sr-only">Toggle dark mode</span>
                    </Button>
                </nav>
            </div>
        </div>

        <!-- Mobile Nav Dropdown -->
        <div
            v-show="isMenuOpen"
            class="md:hidden border-b bg-background border-border/40"
        >
            <nav class="flex flex-col gap-4 p-4 text-sm font-medium">
                <NuxtLink
                    v-for="link in navLinks"
                    :key="link.path"
                    :to="link.path"
                    class="transition-colors hover:text-foreground/80 text-foreground/60 p-2 rounded-md hover:bg-accent"
                    @click="isMenuOpen = false"
                >
                    {{ link.name }}
                </NuxtLink>
            </nav>
        </div>
    </header>
</template>
