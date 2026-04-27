<script setup lang="ts">
import { useRouter } from "vue-router";
import {
    ChevronLeft,
    Search,
    Briefcase,
    Home,
    HeartHandshake,
    ShieldAlert,
    FileSignature,
    FilePlus2,
} from "lucide-vue-next";

const router = useRouter();

const categories = [
    {
        id: 1,
        name: "职场劳动",
        icon: Briefcase,
        color: "text-blue-500",
        bg: "bg-blue-100",
    },
    {
        id: 2,
        name: "房产租赁",
        icon: Home,
        color: "text-orange-500",
        bg: "bg-orange-100",
    },
    {
        id: 3,
        name: "婚姻家庭",
        icon: HeartHandshake,
        color: "text-pink-500",
        bg: "bg-pink-100",
    },
    {
        id: 4,
        name: "消费维权",
        icon: ShieldAlert,
        color: "text-red-500",
        bg: "bg-red-100",
    },
];

const templates = [
    {
        id: 1,
        title: "解除劳动合同通知书",
        category: "职场劳动",
        views: "2.1k",
        new: true,
    },
    {
        id: 2,
        title: "房屋租赁合同 (标准版)",
        category: "房产租赁",
        views: "8.4k",
        new: false,
    },
    {
        id: 3,
        title: "婚前财产协议",
        category: "婚姻家庭",
        views: "1.2k",
        new: false,
    },
    {
        id: 4,
        title: "离职交接清单及证明",
        category: "职场劳动",
        views: "3.5k",
        new: false,
    },
    {
        id: 5,
        title: "退房及押金退还协议",
        category: "房产租赁",
        views: "980",
        new: true,
    },
];
</script>

<template>
    <div
        class="min-h-screen bg-slate-50 flex flex-col w-full lg:max-w-md lg:mx-auto"
    >
        <!-- Header -->
        <header
            class="bg-white px-4 py-3 border-b flex items-center justify-between sticky top-0 z-10 w-full"
        >
            <div
                class="w-10 h-10 flex items-center justify-center -ml-2 cursor-pointer rounded-full hover:bg-slate-50 transition"
                @click="router.back()"
            >
                <ChevronLeft class="w-6 h-6 text-gray-700" />
            </div>
            <h1
                class="text-base font-semibold text-gray-900 absolute left-1/2 -translate-x-1/2"
            >
                智能文档
            </h1>
            <div
                class="w-10 h-10 flex items-center justify-center -mr-2 cursor-pointer rounded-full hover:bg-slate-50 transition"
            >
                <FilePlus2 class="w-5 h-5 text-gray-600" />
            </div>
        </header>

        <main class="flex-1 p-4">
            <!-- Search area -->
            <div class="relative w-full mb-6">
                <div
                    class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"
                >
                    <Search class="h-4 w-4 text-gray-400" />
                </div>
                <input
                    type="text"
                    class="block w-full pl-9 pr-3 py-2.5 border border-transparent rounded-xl leading-5 bg-white shadow-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition"
                    placeholder="搜索您需要的合同模板..."
                />
            </div>

            <!-- Categories -->
            <h2 class="text-sm font-bold text-gray-800 mb-3 ml-1">分类查找</h2>
            <div class="grid grid-cols-4 gap-3 mb-8">
                <div
                    v-for="cat in categories"
                    :key="cat.id"
                    class="flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
                >
                    <div
                        :class="`w-14 h-14 rounded-2xl flex items-center justify-center mb-2 shadow-sm border border-white ${cat.bg}`"
                    >
                        <component
                            :is="cat.icon"
                            :class="`w-6 h-6 ${cat.color}`"
                        />
                    </div>
                    <span class="text-xs font-medium text-gray-600">{{
                        cat.name
                    }}</span>
                </div>
            </div>

            <!-- Hot Templates -->
            <div class="flex justify-between items-center mb-3 px-1">
                <h2 class="text-sm font-bold text-gray-800">热门模板</h2>
                <span class="text-xs text-blue-600 cursor-pointer">换一批</span>
            </div>

            <div class="space-y-3">
                <div
                    v-for="tpl in templates"
                    :key="tpl.id"
                    class="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-start gap-3 cursor-pointer hover:border-blue-200 transition"
                >
                    <div
                        class="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0"
                    >
                        <FileSignature class="w-5 h-5 text-indigo-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 mb-1">
                            <h3
                                class="font-medium text-gray-900 text-sm truncate"
                            >
                                {{ tpl.title }}
                            </h3>
                            <span
                                v-if="tpl.new"
                                class="bg-red-100 text-red-600 text-[10px] px-1.5 py-0.5 rounded leading-none"
                                >新</span
                            >
                        </div>
                        <div
                            class="flex items-center text-xs text-gray-500 gap-3"
                        >
                            <span>{{ tpl.category }}</span>
                            <span>·</span>
                            <span>{{ tpl.views }} 人使用</span>
                        </div>
                    </div>
                    <div class="self-center">
                        <Button
                            class="h-7 text-xs px-3 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 shadow-none"
                        >
                            生成
                        </Button>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
