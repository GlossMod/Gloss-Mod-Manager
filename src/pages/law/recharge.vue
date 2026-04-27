<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import {
    ChevronLeft,
    Zap,
    Crown,
    CheckCircle2,
    AlertCircle,
} from "lucide-vue-next";

const router = useRouter();

const rechargeModes = [
    { id: "token", name: "按次充值 (算力余额)" },
    { id: "vip", name: "开通会员 (无限畅享)" },
];
const activeMode = ref("token");

const tokenPackages = [
    { id: 1, tokens: 50, price: 9.9, origPrice: 15, tag: "新手体验" },
    { id: 2, tokens: 200, price: 29.9, origPrice: 60, tag: "超值推荐" },
    { id: 3, tokens: 1000, price: 99, origPrice: 300, tag: "企业首选" },
];

const vipPackages = [
    {
        id: 1,
        duration: "1个月",
        price: 68,
        origPrice: 99,
        desc: "单月无限次法律咨询与文书生成",
    },
    {
        id: 2,
        duration: "3个月",
        price: 168,
        origPrice: 297,
        desc: "季度畅享权益，立省129元",
    },
    {
        id: 3,
        duration: "12个月",
        price: 388,
        origPrice: 1188,
        desc: "年度尊享服务，低至每天1元",
        tag: "限时特惠",
    },
];

const activeTokenPkg = ref(2);
const activeVipPkg = ref(3);

const handlePay = () => {
    const isVip = activeMode.value === "vip";
    const pkg = isVip
        ? vipPackages.find((p) => p.id === activeVipPkg.value)
        : tokenPackages.find((p) => p.id === activeTokenPkg.value);
    alert(`模拟微信支付: ￥${pkg?.price}`);
    router.push("/law/orders");
};
</script>

<template>
    <div
        class="min-h-screen bg-slate-50 flex flex-col w-full px-4 lg:max-w-md lg:mx-auto relative pb-24"
    >
        <!-- Header -->
        <header
            class="bg-white py-3 flex items-center justify-between sticky top-0 z-10 w-full mb-4 px-2 shadow-sm rounded-b-2xl"
        >
            <div
                class="w-10 h-10 flex items-center justify-center -ml-4 cursor-pointer rounded-full hover:bg-slate-50 transition"
                @click="router.back()"
            >
                <ChevronLeft class="w-6 h-6 text-gray-700" />
            </div>
            <h1 class="text-base font-semibold text-gray-900">充值中心</h1>
            <div
                class="text-sm font-medium text-gray-600 mr-2"
                @click="router.push('/law/orders')"
            >
                明细
            </div>
        </header>

        <!-- My Balance -->
        <div
            class="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white mb-6 shadow-lg shadow-blue-200 relative overflow-hidden"
        >
            <div class="absolute right-[-20%] bottom-[-20%] opacity-20">
                <Zap class="w-48 h-48" />
            </div>
            <div class="relative z-10">
                <span class="text-blue-100 text-sm font-medium"
                    >当前算力余额</span
                >
                <div class="flex items-baseline mt-2 mb-1 gap-2">
                    <span class="text-4xl font-black">12</span>
                    <span class="text-blue-100 text-sm">次 (Token)</span>
                </div>
                <p class="text-xs text-blue-200 flex items-center gap-1 mt-4">
                    <AlertCircle class="w-3.5 h-3.5" />
                    普通用户每次咨询消耗1次，生成文书消耗3次。
                </p>
            </div>
        </div>

        <!-- Switcher -->
        <div class="flex bg-gray-200 p-1 rounded-xl mb-6">
            <button
                v-for="mode in rechargeModes"
                :key="mode.id"
                class="flex-1 py-2 text-sm font-medium rounded-lg transition"
                :class="
                    activeMode === mode.id
                        ? 'bg-white shadow text-blue-600'
                        : 'text-gray-600'
                "
                @click="activeMode = mode.id"
            >
                {{ mode.name }}
            </button>
        </div>

        <!-- Token Packages -->
        <div v-show="activeMode === 'token'" class="space-y-3">
            <div
                v-for="pkg in tokenPackages"
                :key="pkg.id"
                class="border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition relative overflow-hidden"
                :class="
                    activeTokenPkg === pkg.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                "
                @click="activeTokenPkg = pkg.id"
            >
                <div
                    v-if="pkg.tag"
                    class="absolute top-0 left-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-br-lg font-bold"
                >
                    {{ pkg.tag }}
                </div>
                <div>
                    <div class="flex items-center gap-2 mt-1">
                        <span class="text-lg font-bold text-gray-900"
                            >{{ pkg.tokens }} 次</span
                        >
                    </div>
                    <span class="text-xs text-gray-500"
                        >每次低至 ￥{{
                            (pkg.price / pkg.tokens).toFixed(2)
                        }}</span
                    >
                </div>
                <div class="text-right">
                    <div class="text-xl font-bold text-red-500">
                        ￥{{ pkg.price }}
                    </div>
                    <div class="text-xs text-gray-400 line-through">
                        ￥{{ pkg.origPrice }}
                    </div>
                </div>
            </div>
        </div>

        <!-- VIP Packages -->
        <div v-show="activeMode === 'vip'" class="space-y-3">
            <div
                v-for="pkg in vipPackages"
                :key="pkg.id"
                class="border-2 rounded-2xl p-4 flex items-center justify-between cursor-pointer transition relative overflow-hidden group"
                :class="
                    activeVipPkg === pkg.id
                        ? 'border-amber-500 bg-amber-50/50'
                        : 'border-gray-200 bg-white hover:border-amber-300'
                "
                @click="activeVipPkg = pkg.id"
            >
                <div
                    v-if="pkg.tag"
                    class="absolute top-0 right-0 bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-bl-lg font-bold"
                >
                    {{ pkg.tag }}
                </div>

                <div class="flex-1 mr-4">
                    <div class="flex items-center gap-2 mt-px">
                        <Crown
                            class="w-5 h-5"
                            :class="
                                activeVipPkg === pkg.id
                                    ? 'text-amber-500'
                                    : 'text-gray-400'
                            "
                        />
                        <span class="text-lg font-bold text-gray-900">{{
                            pkg.duration
                        }}</span>
                    </div>
                    <p class="text-xs text-gray-500 mt-1 line-clamp-1">
                        {{ pkg.desc }}
                    </p>
                </div>

                <div class="text-right whitespace-nowrap">
                    <div class="text-xl font-bold text-amber-600">
                        ￥{{ pkg.price }}
                    </div>
                    <div class="text-xs text-gray-400 line-through">
                        ￥{{ pkg.origPrice }}
                    </div>
                </div>
            </div>
        </div>

        <!-- Bottom Pay Area -->
        <div
            class="fixed bottom-0 w-full left-1/2 -translate-x-1/2 max-w-md bg-white border-t border-gray-100 p-4 pb-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 flex items-center justify-between"
        >
            <div class="flex flex-col">
                <span class="text-xs text-gray-500 mb-1">合计支付</span>
                <span class="text-2xl font-bold text-red-500 leading-none">
                    ￥{{
                        activeMode === "vip"
                            ? vipPackages.find((p) => p.id === activeVipPkg)
                                  ?.price
                            : tokenPackages.find((p) => p.id === activeTokenPkg)
                                  ?.price
                    }}
                </span>
            </div>
            <Button
                class="w-40 py-6 rounded-2xl bg-gradient-to-r hover:opacity-90 transition shadow-md font-bold text-base"
                :class="
                    activeMode === 'vip'
                        ? 'from-amber-500 to-orange-400 text-white shadow-amber-200'
                        : 'from-blue-600 to-indigo-500 shadow-blue-200'
                "
                @click="handlePay"
            >
                <CheckCircle2 class="w-5 h-5 mr-1" />
                立即支付
            </Button>
        </div>
    </div>
</template>
