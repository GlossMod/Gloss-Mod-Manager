<script setup lang="ts">
import { useRoute } from "vue-router";
import {
    Box,
    Gamepad2,
    Settings,
    Home,
    GamepadDirectional,
    ArrowDownToLine,
    Bot,
    Archive,
    Info,
    MessageCircleMore,
} from "lucide-vue-next";
import { cn } from "@/lib/utils";

const route = useRoute();

const navItems = [
    { labelKey: "nav.home", path: "/", icon: Home },
    { labelKey: "nav.games", path: "/games", icon: Gamepad2 },
    { labelKey: "nav.manager", path: "/manager", icon: Box },
    { labelKey: "nav.explore", path: "/explore", icon: GamepadDirectional },
    { labelKey: "nav.download", path: "/download", icon: ArrowDownToLine },
    { labelKey: "nav.mcp", path: "/mcp", icon: Bot },
    { labelKey: "nav.backup", path: "/backup", icon: Archive },
    { labelKey: "nav.aiChat", path: "/ai-chat", icon: MessageCircleMore },
    { labelKey: "nav.about", path: "/about", icon: Info },
];

const bottomItems = [
    { labelKey: "nav.settings", path: "/settings", icon: Settings },
];
</script>

<template>
    <aside
        class="flex w-16 md:w-40 flex-col border-r border-border bg-sidebar/50 backdrop-blur-xl transition-all duration-300"
    >
        <div class="flex-1 overflow-auto py-4 flex flex-col gap-1 px-3">
            <router-link
                v-for="item in navItems"
                :key="item.path"
                :to="item.path"
                :class="
                    cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors relative overflow-hidden',
                        route.path === item.path
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )
                "
            >
                <component :is="item.icon" class="h-5 w-5 shrink-0" />
                <span class="hidden md:inline-block">{{
                    $t(item.labelKey)
                }}</span>

                <div
                    v-if="route.path === item.path"
                    class="absolute left-0 top-1/2 h-1/2 w-1 -translate-y-1/2 rounded-r-full bg-primary"
                />
            </router-link>
        </div>

        <div class="p-3 border-t border-border/50">
            <router-link
                v-for="item in bottomItems"
                :key="item.path"
                :to="item.path"
                :class="
                    cn(
                        'group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors relative',
                        route.path === item.path
                            ? 'bg-accent text-accent-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )
                "
            >
                <component :is="item.icon" class="h-5 w-5 shrink-0" />
                <span class="hidden md:inline-block">{{
                    $t(item.labelKey)
                }}</span>
            </router-link>
        </div>
    </aside>
</template>
