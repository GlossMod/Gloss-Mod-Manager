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

const pageTitle = "支持的游戏列表";
const pageDescription =
    "查看 Gloss Mod Manager 支持的 150 多款热门游戏，覆盖赛博朋克 2077、博德之门 3、艾尔登法环、黑神话：悟空等游戏的 Mod 管理。";

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

// 静态抽取的支持游戏列表
const gamesList = [
    "艾尔登法环",
    "只狼: 影逝二度",
    "霍格沃兹之遗",
    "求生之路2",
    "赛博朋克 2077",
    "模拟人生4",
    "怪物猎人: 世界",
    "怪物猎人: 崛起",
    "怪物猎人: 荒野",
    "鬼谷八荒",
    "太吾绘卷",
    "觅长生",
    "噬血代码",
    "生化危机4 重制版",
    "生化危机2 重制版",
    "生化危机3 重制版",
    "生化危机8",
    "星露谷物语",
    "巫师 3: 狂猎",
    "辐射 4",
    "骑马与砍杀 2: 霸主",
    "饥荒 & 联机版",
    "博德之门 3",
    "星空",
    "装甲核心 6",
    "最终幻想 7 重制版",
    "最终幻想 7 重生",
    "匹诺曹的谎言",
    "神界: 原罪 2",
    "边缘世界",
    "全面战争: 三国",
    "全面战争: 战锤 3",
    "师父 (Sifu)",
    "鬼泣 5",
    "上古卷轴 V: 天际 重制版",
    "无人深空",
    "七日杀",
    "动物园之星",
    "GTA SA 最终版",
    "荒野大镖客: 救赎 2",
    "荒野大镖客",
    "仁王 2",
    "仁王 3",
    "腐烂国度 2",
    "深海迷航",
    "龙腾世纪: 影障守护者",
    "城市: 天际线 2",
    "戴森球计划",
    "大侠立志传",
    "雨中冒险 2",
    "森林之子",
    "逸剑风云决",
    "暖雪",
    "欧洲卡车模拟 2",
    "美洲卡车模拟",
    "侠盗猎车手 5 (含增强版)",
    "致命公司",
    "纪元 1800",
    "纪元 117：罗马和平",
    "人类 (Humankind)",
    "双点校园",
    "文明 6",
    "文明 7",
    "泰坦陨落 2",
    "幻兽帕鲁",
    "铁拳 8",
    "如龙 8",
    "剑士 (Kenshi)",
    "缉私警察",
    "英灵神殿",
    "街头霸王 6",
    "皇牌空战 7",
    "咩咩启示录",
    "群星",
    "仙剑奇侠传 7",
    "龙之信条 2",
    "原子之心",
    "看门狗 2",
    "木卫四协议",
    "Jump 大乱斗",
    "无双大蛇 3",
    "漫漫长夜",
    "十字军之王 3",
    "猎人: 荒野的召唤",
    "天国: 拯救",
    "天国: 拯救 2",
    "消逝的光芒 2",
    "下一站江湖 2",
    "山门与幻境",
    "庄园领主",
    "哈迪斯 2",
    "家园 3",
    "道衍诀",
    "夜族崛起",
    "对马岛之魂",
    "堕落之主",
    "暗黑地牢 2",
    "黑暗地牢",
    "地狱之刃 2",
    "泰拉瑞亚",
    "坎巴拉太空计划",
    "远征: 泥泞奔驰",
    "活侠传",
    "海山：昆仑镜",
    "燧石枪：黎明之围",
    "铁血联盟 3",
    "异形工厂 2",
    "龙珠战士 Z",
    "黑神话: 悟空",
    "原神",
    "刀剑江湖路",
    "冰汽时代 2",
    "高达创坏者 4",
    "战锤 40K: 星际战士 2",
    "丧尸围城豪华复刻版",
    "潜行者 2",
    "七龙珠 电光炸裂！ZERO",
    "勇者斗恶龙 III HD-2D Remake",
    "最后的生还者 第二部",
    "英雄立志传 三国志",
    "上古卷轴 4: 湮灭 重制版",
    "光与影: 33号远征队",
    "剑星 (Stellar Blade)",
    "明末: 渊虚之羽",
    "空洞骑士: 丝之歌",
    "寂静岭 F",
    "无主之地 4",
    "龙崖",
    "逃离鸭科夫",
    "生化危机9：安魂曲",
    "正当防卫 3",
    "X4 基石",
].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));

const searchQuery = ref("");

const filteredGames = computed(() => {
    if (!searchQuery.value.trim()) return gamesList;
    const q = searchQuery.value.toLowerCase();
    return gamesList.filter((g) => g.toLowerCase().includes(q));
});
</script>

<template>
    <div class="container max-w-7xl mx-auto px-4 md:px-8 py-12 lg:py-20 mb-16">
        <div class="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="outline" class="mb-4">超 150+ 热门大作</Badge>
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
                placeholder="搜索游戏名称或系列..."
                class="flex h-12 w-full rounded-full border border-input bg-background/50 backdrop-blur pl-10 pr-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 transition-all hover:bg-background shadow-sm"
            />
        </div>

        <!-- Games Grid -->
        <div
            v-if="filteredGames.length > 0"
            class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
        >
            <!-- <Card
                v-for="game in filteredGames"
                :key="game"
                class="bg-card hover:bg-muted/50 border-border/50 hover:border-primary/30 transition-all cursor-default"
            >
                <CardHeader
                    class="p-4 flex flex-col items-center justify-center text-center min-h-20"
                >
                    <CardTitle
                        class="text-[0.95rem] font-medium leading-snug"
                        >{{ game }}</CardTitle
                    >
                </CardHeader>
            </Card> -->
            <Item v-for="game in filteredGames" :key="game">
                <ItemContent>{{ game }}</ItemContent>
            </Item>
        </div>

        <!-- Empty State -->
        <div
            v-else
            class="text-center py-20 text-muted-foreground border border-dashed rounded-3xl bg-muted/20"
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
