<script setup lang="ts">
import {
    Box,
    Gamepad2,
    GamepadDirectional,
    ArrowDownToLine,
    Info,
    Settings,
} from "lucide-vue-next";
const list = [
    {
        titleKey: "nav.games",
        icon: Gamepad2,
        to: "/games",
    },
    {
        titleKey: "nav.manager",
        icon: Box,
        to: "/manager",
    },
    {
        titleKey: "nav.explore",
        icon: GamepadDirectional,
        to: "/explore",
    },
    {
        titleKey: "nav.download",
        icon: ArrowDownToLine,
        to: "/download",
    },
    {
        titleKey: "nav.settings",
        icon: Settings,
        to: "/settings",
    },
    {
        titleKey: "nav.about",
        icon: Info,
        to: "/about",
    },
];
</script>
<template>
    <div class="flex flex-col gap-4">
        <Card>
            <CardHeader>
                <CardTitle>{{ $t("home.welcome") }}</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="flex gap-2">
                    <!-- 快捷导航 -->
                    <Button
                        v-for="item in list"
                        :key="item.to"
                        as-child
                        variant="secondary"
                    >
                        <router-link :to="item.to">
                            <component :is="item.icon" class="h-5 w-5" />
                            {{ $t(item.titleKey) }}
                        </router-link>
                    </Button>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>{{ $t("home.partners") }}</CardTitle>
            </CardHeader>
            <CardContent>
                <div
                    class="grid grid-cols-3 items-center gap-4 justify-items-center links"
                >
                    <a
                        href="https://mod.3dmgame.com/"
                        target="_blank"
                        class="flex w-full items-center justify-center"
                    >
                        <img src="/imgs/3DMGAME.webp" alt="3DMGAME" />
                    </a>
                    <a
                        href="https://thunderstore.io/"
                        target="_blank"
                        class="flex w-full items-center justify-center"
                    >
                        <Thunderstore width="100%"></Thunderstore>
                    </a>
                    <a
                        href="https://mod.io/"
                        target="_blank"
                        class="flex w-full items-center justify-center"
                    >
                        <ModIo width="100%"></ModIo>
                    </a>
                    <a
                        href="https://www.curseforge.com/"
                        target="_blank"
                        class="flex w-full items-center justify-center"
                    >
                        <CurseForge width="100%"></CurseForge>
                    </a>
                    <a
                        href="https://gamebanana.com/"
                        target="_blank"
                        class="flex w-full items-center justify-center"
                    >
                        <img src="/imgs/Gamebanana.png" alt="Gamebanana" />
                    </a>
                    <a
                        href="https://www.nexusmods.com/"
                        class="flex w-full items-center justify-center"
                    >
                        <NexusMods height="84px" width="100%"></NexusMods>
                    </a>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle>AI {{ $t("home.partners") }}</CardTitle>
            </CardHeader>
            <CardContent>
                <div class="text-sm text-muted-foreground">
                    AI 合作方招募中, 如果您是供应商, 并对此项目感兴趣, 欢迎
                    <a
                        href="https://gmm.aoe.top/docs/Cooperation"
                        target="_blank"
                        class="text-blue-400"
                        >联系我们
                        <icon-external-link class="inline-block h-4 w-4" />
                    </a>
                </div>
            </CardContent>
        </Card>
    </div>
</template>
<style scoped>
.links a:hover {
    transition: all 0.5s;
    transform: scale(1.05);
}
</style>
