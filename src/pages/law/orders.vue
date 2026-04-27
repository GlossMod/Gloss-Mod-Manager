<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
    ChevronLeft,
    FileText,
    Zap,
    Crown,
    CheckCircle2,
    XCircle,
    Clock,
} from "lucide-vue-next";

const router = useRouter();

const tabs = ["全部", "待支付", "已完成", "已取消"];
const activeTab = ref("全部");

const orders = [
    {
        id: "OD20260427001",
        type: "vip",
        title: "会员充值(12个月)",
        date: "2026-04-27 10:30:12",
        amount: 388,
        status: "completed",
        icon: Crown,
        bg: "bg-amber-100",
        color: "text-amber-500",
    },
    {
        id: "OD20260426052",
        type: "doc",
        title: "解除劳动合同通知书(智能版)",
        date: "2026-04-26 14:15:00",
        amount: 9.9,
        status: "completed",
        icon: FileText,
        bg: "bg-blue-100",
        color: "text-blue-500",
    },
    {
        id: "OD20260425089",
        type: "token",
        title: "算力充值(200次)",
        date: "2026-04-25 09:20:45",
        amount: 29.9,
        status: "pending",
        icon: Zap,
        bg: "bg-indigo-100",
        color: "text-indigo-500",
    },
    {
        id: "OD20260424102",
        type: "doc",
        title: "房屋租赁合同代写",
        date: "2026-04-24 16:40:22",
        amount: 19.9,
        status: "cancelled",
        icon: FileText,
        bg: "bg-blue-100",
        color: "text-blue-500",
    },
];

const getStatusInfo = (status: string) => {
    switch (status) {
        case "completed":
            return {
                text: "交易成功",
                color: "text-emerald-500",
                bg: "bg-emerald-50",
                icon: CheckCircle2,
            };
        case "pending":
            return {
                text: "待支付",
                color: "text-orange-500",
                bg: "bg-orange-50",
                icon: Clock,
            };
        case "cancelled":
            return {
                text: "已取消",
                color: "text-gray-400",
                bg: "bg-gray-100",
                icon: XCircle,
            };
        default:
            return {
                text: "未知",
                color: "text-gray-400",
                bg: "bg-gray-100",
                icon: Clock,
            };
    }
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
            <h1 class="text-base font-semibold text-gray-900">我的订单</h1>
            <div class="w-10 h-10"></div>
        </header>

        <!-- Tabs -->
        <div
            class="bg-white px-2 pt-2 border-b border-gray-100 sticky top-14 z-10"
        >
            <div
                class="flex justify-between items-center text-sm font-medium text-gray-500 overflow-x-auto no-scrollbar"
            >
                <span
                    v-for="tab in tabs"
                    :key="tab"
                    class="px-4 pb-3 relative cursor-pointer whitespace-nowrap transition-colors"
                    :class="
                        activeTab === tab
                            ? 'text-blue-600'
                            : 'hover:text-gray-800'
                    "
                    @click="activeTab = tab"
                >
                    {{ tab }}
                    <div
                        v-if="activeTab === tab"
                        class="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-600 rounded-t-lg transition-transform"
                    ></div>
                </span>
            </div>
        </div>

        <!-- Order List -->
        <main class="flex-1 p-4 space-y-4 pb-20">
            <div
                v-for="order in orders"
                :key="order.id"
                class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition cursor-pointer"
            >
                <div
                    class="flex items-center justify-between border-b border-gray-50 pb-3 mb-3"
                >
                    <div class="text-xs text-gray-400 font-mono">
                        编号: {{ order.id }}
                    </div>
                    <div
                        class="flex items-center text-[10px] px-2 py-0.5 rounded gap-1"
                        :class="[
                            getStatusInfo(order.status).bg,
                            getStatusInfo(order.status).color,
                        ]"
                    >
                        <component
                            :is="getStatusInfo(order.status).icon"
                            class="w-3 h-3"
                        />
                        {{ getStatusInfo(order.status).text }}
                    </div>
                </div>

                <div class="flex items-start justify-between">
                    <div class="flex items-start gap-3 flex-1 min-w-0 pr-4">
                        <div
                            :class="`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${order.bg}`"
                        >
                            <component
                                :is="order.icon"
                                :class="`w-5 h-5 ${order.color}`"
                            />
                        </div>
                        <div>
                            <h3
                                class="text-sm font-bold text-gray-900 leading-tight mb-1 truncate"
                            >
                                {{ order.title }}
                            </h3>
                            <p
                                class="text-xs text-gray-400 flex items-center mt-1"
                            >
                                {{ order.date }}
                            </p>
                        </div>
                    </div>

                    <div class="text-right flex-shrink-0 mt-0.5">
                        <span class="text-xs font-medium text-gray-500"
                            >￥</span
                        >
                        <span class="text-lg font-bold text-gray-900">{{
                            order.amount.toFixed(2)
                        }}</span>
                    </div>
                </div>

                <div
                    class="flex justify-end gap-2 mt-4 pt-3 border-t border-gray-50"
                    v-if="order.status === 'pending'"
                >
                    <Button
                        class="h-8 text-xs px-4 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 border-none shadow-none"
                        >取消订单</Button
                    >
                    <Button
                        class="h-8 text-xs px-4 rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                        >立即支付</Button
                    >
                </div>
                <div
                    class="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-50"
                    v-else-if="order.status === 'completed'"
                >
                    <Button
                        class="h-8 text-xs px-4 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 shadow-none"
                        >查看详情</Button
                    >
                </div>
            </div>
        </main>
    </div>
</template>
