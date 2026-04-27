<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Scale, Shield, Palette, Zap, BookOpen, Heart } from "lucide-vue-next";

const router = useRouter();

// 产品线列表
const products = ref([
    {
        id: "law",
        name: "AI 法律咨询",
        description:
            "智能法律咨询平台，提供对话咨询、文档生成、订单管理等法律服务",
        icon: Scale,
        color: "blue",
        badge: "进行中",
        badgeVariant: "default" as const,
        routes: ["/law"],
    },
    {
        id: "health",
        name: "健康管理",
        description: "个人健康管理平台，包含健康数据追踪、饮食建议和运动计划",
        icon: Heart,
        color: "green",
        badge: "规划中",
        badgeVariant: "secondary" as const,
        routes: ["/health"],
    },
    {
        id: "education",
        name: "在线教育",
        description: "互动式学习平台，支持课程管理、学习进度追踪和在线测评",
        icon: BookOpen,
        color: "purple",
        badge: "规划中",
        badgeVariant: "secondary" as const,
        routes: ["/education"],
    },
    {
        id: "design",
        name: "设计工具",
        description: "在线设计协作工具，提供模板库、素材管理和团队协作功能",
        icon: Palette,
        color: "pink",
        badge: "规划中",
        badgeVariant: "secondary" as const,
        routes: ["/design"],
    },
    {
        id: "security",
        name: "安全防护",
        description: "网络安全监控平台，实时威胁检测、漏洞扫描和安全报告生成",
        icon: Shield,
        color: "orange",
        badge: "规划中",
        badgeVariant: "secondary" as const,
        routes: ["/security"],
    },
    {
        id: "productivity",
        name: "效率工具",
        description: "任务管理、时间追踪和团队协作的一站式效率提升平台",
        icon: Zap,
        color: "yellow",
        badge: "规划中",
        badgeVariant: "secondary" as const,
        routes: ["/productivity"],
    },
]);

// 颜色配置
const colorMap: Record<
    string,
    { bg: string; text: string; border: string; icon: string }
> = {
    blue: {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-600 dark:text-blue-400",
        border: "border-blue-200 dark:border-blue-800",
        icon: "text-blue-500",
    },
    green: {
        bg: "bg-green-50 dark:bg-green-950/30",
        text: "text-green-600 dark:text-green-400",
        border: "border-green-200 dark:border-green-800",
        icon: "text-green-500",
    },
    purple: {
        bg: "bg-purple-50 dark:bg-purple-950/30",
        text: "text-purple-600 dark:text-purple-400",
        border: "border-purple-200 dark:border-purple-800",
        icon: "text-purple-500",
    },
    pink: {
        bg: "bg-pink-50 dark:bg-pink-950/30",
        text: "text-pink-600 dark:text-pink-400",
        border: "border-pink-200 dark:border-pink-800",
        icon: "text-pink-500",
    },
    orange: {
        bg: "bg-orange-50 dark:bg-orange-950/30",
        text: "text-orange-600 dark:text-orange-400",
        border: "border-orange-200 dark:border-orange-800",
        icon: "text-orange-500",
    },
    yellow: {
        bg: "bg-yellow-50 dark:bg-yellow-950/30",
        text: "text-yellow-600 dark:text-yellow-400",
        border: "border-yellow-200 dark:border-yellow-800",
        icon: "text-yellow-500",
    },
};

const navigateTo = (path: string) => {
    router.push(path);
};
</script>

<template>
    <div
        class="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950"
    >
        <!-- 头部区域 -->
        <div
            class="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10"
        >
            <div class="max-w-7xl mx-auto px-6 py-6">
                <div class="flex items-center gap-3">
                    <div
                        class="p-2 bg-linear-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg"
                    >
                        <IconSparkles class="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1
                            class="text-2xl font-bold bg-linear-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent"
                        >
                            产品设计中心
                        </h1>
                        <p class="text-sm text-slate-500 dark:text-slate-400">
                            Design Center — 多产品线 UI 设计导航
                        </p>
                    </div>
                </div>
            </div>
        </div>

        <!-- 主内容区域 -->
        <div class="max-w-7xl mx-auto px-6 py-10">
            <!-- 统计信息 -->
            <div class="mb-8 flex items-center gap-4">
                <div
                    class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700"
                >
                    <span class="text-sm text-slate-500 dark:text-slate-400"
                        >产品线总数</span
                    >
                    <Badge variant="outline" class="font-semibold">{{
                        products.length
                    }}</Badge>
                </div>
                <div
                    class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700"
                >
                    <span class="text-sm text-slate-500 dark:text-slate-400"
                        >进行中</span
                    >
                    <Badge class="bg-blue-500">{{
                        products.filter((p) => p.badge === "进行中").length
                    }}</Badge>
                </div>
                <div
                    class="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-full shadow-sm border border-slate-200 dark:border-slate-700"
                >
                    <span class="text-sm text-slate-500 dark:text-slate-400"
                        >规划中</span
                    >
                    <Badge variant="secondary">{{
                        products.filter((p) => p.badge === "规划中").length
                    }}</Badge>
                </div>
            </div>

            <!-- 产品卡片网格 -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card
                    v-for="product in products"
                    :key="product.id"
                    class="group cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                    @click="navigateTo(product.routes[0])"
                >
                    <CardHeader class="pb-4">
                        <div class="flex items-start justify-between">
                            <div class="flex items-center gap-4">
                                <div
                                    :class="[
                                        colorMap[product.color].bg,
                                        colorMap[product.color].border,
                                        'p-3 rounded-xl border',
                                    ]"
                                >
                                    <component
                                        :is="product.icon"
                                        :class="[
                                            'w-6 h-6',
                                            colorMap[product.color].icon,
                                        ]"
                                    />
                                </div>
                                <div>
                                    <CardTitle class="text-lg">{{
                                        product.name
                                    }}</CardTitle>
                                    <Badge
                                        :variant="product.badgeVariant"
                                        class="mt-1 text-xs"
                                    >
                                        {{ product.badge }}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent class="pt-0">
                        <CardDescription class="text-sm leading-relaxed mb-4">
                            {{ product.description }}
                        </CardDescription>
                        <div class="flex items-center justify-end">
                            <Button
                                size="sm"
                                variant="outline"
                                class="gap-2 text-sm transition-all group-hover:bg-violet-500 group-hover:text-white group-hover:border-violet-500"
                            >
                                <span>进入设计</span>
                                <IconArrowRight class="w-4 h-4" />
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <!-- 底部说明 -->
            <div class="mt-12 text-center">
                <p class="text-sm text-slate-400 dark:text-slate-500">
                    点击卡片进入对应产品线的设计页面 · 共
                    {{ products.length }} 个产品线
                </p>
            </div>
        </div>
    </div>
</template>

<style scoped></style>
