<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
    ChevronLeft,
    ChevronRight,
    Bell,
    Moon,
    Shield,
    Info,
    Trash2,
    Smartphone,
} from "lucide-vue-next";

const router = useRouter();

const notifyOn = ref(true);
const nightMode = ref(false);
const hapticFeedback = ref(true);

const clearCache = () => {
    alert("缓存已清除 (12.4MB)");
};
</script>

<template>
    <div
        class="min-h-screen bg-slate-50 flex flex-col w-full lg:max-w-md lg:mx-auto"
    >
        <!-- Header -->
        <header
            class="bg-white px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10 w-full"
        >
            <div
                class="w-10 h-10 flex items-center justify-center -ml-2 cursor-pointer rounded-full hover:bg-slate-50 transition"
                @click="router.back()"
            >
                <ChevronLeft class="w-6 h-6 text-gray-700" />
            </div>
            <h1 class="text-base font-semibold text-gray-900">设置</h1>
            <div class="w-10 h-10"></div>
            <!-- Placeholder for centering -->
        </header>

        <main class="flex-1 p-4 space-y-6">
            <!-- Group 1 -->
            <div>
                <h2
                    class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2"
                >
                    基础设置
                </h2>
                <div
                    class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100"
                >
                    <div class="flex items-center justify-between p-4 bg-white">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"
                            >
                                <Bell class="w-4 h-4 text-blue-600" />
                            </div>
                            <span class="text-sm font-medium text-gray-800"
                                >消息通知提醒</span
                            >
                        </div>
                        <div
                            class="w-11 h-6 rounded-full p-1 cursor-pointer transition-colors"
                            :class="notifyOn ? 'bg-blue-600' : 'bg-gray-200'"
                            @click="notifyOn = !notifyOn"
                        >
                            <div
                                class="w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform"
                                :class="
                                    notifyOn ? 'translate-x-5' : 'translate-x-0'
                                "
                            ></div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between p-4 bg-white">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center"
                            >
                                <Moon class="w-4 h-4 text-indigo-600" />
                            </div>
                            <span class="text-sm font-medium text-gray-800"
                                >深色模式</span
                            >
                        </div>
                        <div
                            class="w-11 h-6 rounded-full p-1 cursor-pointer transition-colors"
                            :class="nightMode ? 'bg-indigo-600' : 'bg-gray-200'"
                            @click="nightMode = !nightMode"
                        >
                            <div
                                class="w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform"
                                :class="
                                    nightMode
                                        ? 'translate-x-5'
                                        : 'translate-x-0'
                                "
                            ></div>
                        </div>
                    </div>

                    <div class="flex items-center justify-between p-4 bg-white">
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center"
                            >
                                <Smartphone class="w-4 h-4 text-teal-600" />
                            </div>
                            <span class="text-sm font-medium text-gray-800"
                                >触觉反馈</span
                            >
                        </div>
                        <div
                            class="w-11 h-6 rounded-full p-1 cursor-pointer transition-colors"
                            :class="
                                hapticFeedback ? 'bg-teal-600' : 'bg-gray-200'
                            "
                            @click="hapticFeedback = !hapticFeedback"
                        >
                            <div
                                class="w-4 h-4 bg-white rounded-full shadow-sm transform transition-transform"
                                :class="
                                    hapticFeedback
                                        ? 'translate-x-5'
                                        : 'translate-x-0'
                                "
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Group 2 -->
            <div>
                <h2
                    class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ml-2"
                >
                    账户与系统
                </h2>
                <div
                    class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-100"
                >
                    <div
                        class="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"
                            >
                                <Shield class="w-4 h-4 text-orange-600" />
                            </div>
                            <span class="text-sm font-medium text-gray-800"
                                >账号安全</span
                            >
                        </div>
                        <div
                            class="flex items-center text-xs text-gray-400 gap-1"
                        >
                            已绑定手机
                            <ChevronRight class="w-4 h-4" />
                        </div>
                    </div>

                    <div
                        class="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
                        @click="clearCache"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center"
                            >
                                <Trash2 class="w-4 h-4 text-red-600" />
                            </div>
                            <span class="text-sm font-medium text-gray-800"
                                >清理缓存</span
                            >
                        </div>
                        <div
                            class="flex items-center text-xs text-gray-400 gap-1"
                        >
                            12.4 MB
                            <ChevronRight class="w-4 h-4" />
                        </div>
                    </div>

                    <div
                        class="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
                    >
                        <div class="flex items-center gap-3">
                            <div
                                class="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center"
                            >
                                <Info class="w-4 h-4 text-emerald-600" />
                            </div>
                            <span class="text-sm font-medium text-gray-800"
                                >关于 AI 法律顾问</span
                            >
                        </div>
                        <div
                            class="flex items-center text-xs text-gray-400 gap-1"
                        >
                            v1.2.0
                            <ChevronRight class="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
