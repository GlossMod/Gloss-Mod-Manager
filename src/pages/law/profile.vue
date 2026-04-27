<script setup lang="ts">
import { useRouter } from "vue-router";
import {
    ChevronLeft,
    Wallet,
    FileText,
    Settings,
    HelpCircle,
    UserCheck,
    ChevronRight,
    Crown,
    LogOut,
} from "lucide-vue-next";

const router = useRouter();

const menuItems = [
    {
        id: 1,
        name: "我的钱包",
        icon: Wallet,
        path: "/law/recharge",
        color: "text-amber-500",
        bg: "bg-amber-100",
    },
    {
        id: 2,
        name: "历史订单",
        icon: FileText,
        path: "/law/orders",
        color: "text-blue-500",
        bg: "bg-blue-100",
    },
    {
        id: 3,
        name: "账号设置",
        icon: Settings,
        path: "/law/settings",
        color: "text-gray-600",
        bg: "bg-gray-100",
    },
    {
        id: 4,
        name: "帮助中心",
        icon: HelpCircle,
        path: "/law/chat",
        color: "text-green-500",
        bg: "bg-green-100",
    },
];

const handleLogout = () => {
    router.push("/law/auth");
};
</script>

<template>
    <div
        class="min-h-screen bg-slate-50 flex flex-col w-full lg:max-w-md lg:mx-auto relative pb-20"
    >
        <!-- Header -->
        <header class="bg-blue-600 px-4 pt-10 pb-20 relative">
            <div
                class="absolute top-4 left-2 w-10 h-10 flex items-center justify-center cursor-pointer rounded-full hover:bg-white/10 transition"
                @click="router.back()"
            >
                <ChevronLeft class="w-6 h-6 text-white" />
            </div>

            <div class="flex items-center gap-4 mt-8 px-2">
                <div class="w-16 h-16 bg-white rounded-full p-1 shadow-md">
                    <img
                        src="https://api.dicebear.com/7.x/notionists/svg?seed=Felix&backgroundColor=f8fafc"
                        alt="Avatar"
                        class="w-full h-full rounded-full object-cover"
                    />
                </div>
                <div class="text-white flex-1 cursor-pointer">
                    <h1 class="text-xl font-bold flex items-center gap-2">
                        手机用户A
                        <UserCheck class="w-4 h-4 text-blue-200" />
                    </h1>
                    <p class="text-blue-100 text-sm mt-1">138****0000</p>
                </div>
                <div>
                    <ChevronRight class="w-5 h-5 text-blue-200" />
                </div>
            </div>
        </header>

        <main class="flex-1 px-4 -mt-10 relative z-10 w-full">
            <!-- VIP Card -->
            <div
                class="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-5 shadow-lg mb-6 text-white relative overflow-hidden"
            >
                <div
                    class="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4"
                >
                    <Crown class="w-32 h-32" />
                </div>
                <div class="flex justify-between items-center relative z-10">
                    <div>
                        <h2
                            class="text-amber-200 font-bold text-lg flex items-center gap-2"
                        >
                            <Crown class="w-5 h-5" />
                            升级专业版
                        </h2>
                        <p class="text-gray-400 text-sm mt-1">
                            解锁无限次文书生成及高阶咨询
                        </p>
                    </div>
                    <button
                        class="bg-amber-200 text-gray-900 px-4 py-2 rounded-full text-xs font-bold shadow-sm active:scale-95 transition"
                        @click="router.push('/law/recharge')"
                    >
                        立即开通
                    </button>
                </div>
            </div>

            <!-- Menu List -->
            <div
                class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6"
            >
                <div
                    v-for="(item, index) in menuItems"
                    :key="item.id"
                    class="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition"
                    :class="[
                        index !== menuItems.length - 1
                            ? 'border-b border-gray-100'
                            : '',
                    ]"
                    @click="router.push(item.path)"
                >
                    <div class="flex items-center gap-3">
                        <div
                            :class="`w-8 h-8 rounded-full flex items-center justify-center ${item.bg}`"
                        >
                            <component
                                :is="item.icon"
                                :class="`w-4 h-4 ${item.color}`"
                            />
                        </div>
                        <span class="text-gray-800 font-medium text-sm">{{
                            item.name
                        }}</span>
                    </div>
                    <ChevronRight class="w-4 h-4 text-gray-400" />
                </div>
            </div>

            <!-- Logout -->
            <button
                class="w-full bg-white text-red-500 font-medium py-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center gap-2 hover:bg-red-50 transition active:scale-95"
                @click="handleLogout"
            >
                <LogOut class="w-4 h-4" />
                退出登录
            </button>
        </main>
    </div>
</template>
