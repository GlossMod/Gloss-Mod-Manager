<script setup lang="ts">
import { ref, computed } from "vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-vue-next";
import {
    createBreadcrumbJsonLd,
    createWebPageJsonLd,
    useSeoMeta,
} from "@/lib/seo";
import { supportedGames, supportedGamesCount } from "@/lib/supported-games";

const pageTitle = "支持的游戏列表";
const pageDescription =
    `查看 Gloss Mod Manager 当前支持的 ${supportedGamesCount} 款热门游戏，覆盖赛博朋克 2077、博德之门 3、艾尔登法环、黑神话：悟空等游戏的 Mod 管理。`;

useSeoMeta({
    title: pageTitle,
    description: pageDescription,
    path: "/games",
    keywords: ["支持的游戏", "游戏 Mod 列表", "GMM 支持游戏"],
    structuredData: [
        createWebPageJsonLd(pageTitle, pageDescription, "/games"),
        createBreadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "支持的游戏", path: "/games" },
        ]),
    ],
});

const searchQuery = ref("");

const filteredGames = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return supportedGames;

    return supportedGames.filter((game) =>
        [game.name, game.sourceName, String(game.steamAppId)].some((value) =>
            value.toLowerCase().includes(q),
        ),
    );
});

const getSteamUrl = (steamAppId: number) =>
    `https://store.steampowered.com/app/${steamAppId}`;
</script>

<template>
    <div class="container max-w-7xl mx-auto px-4 md:px-8 py-12 lg:py-20 mb-16">
        <div class="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" class="mb-4">
                {{ supportedGamesCount }} 款热门大作
            </Badge>
            <h1 class="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
                全量支持的游戏库
            </h1>
            <p class="text-lg text-muted-foreground">
                只需选择你要管理的游戏目录，便能瞬间连接涵盖动作、RPG、FPS
                到模拟经营的海量游戏。我们将为你提供一致的高无冲突 Mod 环境。
            </p>
        </div>

        <!-- Toolbar / Search -->
        <div class="flex max-w-lg mx-auto mb-12 relative group">
            <div
                class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-muted-foreground group-focus-within:text-primary transition-colors"
            >
                <Search class="h-5 w-5" />
            </div>
            <input
                v-model="searchQuery"
                type="text"
                placeholder="搜索中文名、英文名或 Steam ID..."
                class="flex h-12 w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            />
        </div>

        <!-- Games Grid -->
        <div
            v-if="filteredGames.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
        >
            <article
                v-for="game in filteredGames"
                :key="game.key"
                class="group overflow-hidden rounded-md border bg-card text-card-foreground transition-colors hover:border-foreground/20"
            >
                <div class="aspect-[247/139] overflow-hidden bg-muted">
                    <img
                        :src="game.cover"
                        :alt="`${game.name} 封面`"
                        loading="lazy"
                        decoding="async"
                        referrerpolicy="no-referrer"
                        class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                </div>
                <div class="flex min-h-[8.5rem] flex-col gap-3 p-4">
                    <div class="min-w-0">
                        <h2 class="line-clamp-2 text-base font-semibold leading-snug">
                            {{ game.name }}
                        </h2>
                        <p class="mt-1 truncate text-sm text-muted-foreground">
                            {{ game.sourceName }}
                        </p>
                    </div>
                    <div class="mt-auto flex flex-wrap items-center gap-2">
                        <a
                            v-if="game.steamAppId > 0"
                            :href="getSteamUrl(game.steamAppId)"
                            target="_blank"
                            rel="noreferrer"
                            class="inline-flex"
                        >
                            <Badge
                                variant="secondary"
                                class="font-mono text-[11px] transition-colors hover:bg-accent"
                            >
                                Steam {{ game.steamAppId }}
                            </Badge>
                        </a>
                        <Badge
                            v-else
                            variant="outline"
                            class="font-mono text-[11px]"
                        >
                            非 Steam
                        </Badge>
                    </div>
                </div>
            </article>
        </div>

        <!-- Empty State -->
        <div
            v-else
            class="text-center py-20 text-muted-foreground border border-dashed rounded-lg bg-muted/20"
        >
            <p class="text-lg font-medium">
                没有找到包含 “{{ searchQuery }}” 的游戏
            </p>
            <p class="text-sm mt-2">
                请尝试使用其缩写或系列统称。若未收录，你也可以为 GMM
                添加新游戏的自定义适配规则。
            </p>
            <Button variant="outline" class="mt-6" @click="searchQuery = ''">
                清空搜索并查看所有
            </Button>
        </div>

        <div class="mt-16 text-center">
            <p class="text-muted-foreground mb-6">
                如果你喜爱的大作暂未受到原生支持，你可以通过简单的 JSON
                添加适配规则。
            </p>
            <Button variant="secondary" as-child>
                <NuxtLink to="/docs/Install">我该如何开始配置环境？</NuxtLink>
            </Button>
        </div>
    </div>
</template>
