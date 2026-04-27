<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ChevronLeft, Scale } from "lucide-vue-next";

const router = useRouter();
const isLogin = ref(true);

const toggleMode = () => {
    isLogin.value = !isLogin.value;
};

const handleSubmit = () => {
    // Mock login/register success
    router.push("/law");
};
</script>

<template>
    <div class="min-h-screen bg-white flex flex-col relative">
        <!-- Header -->
        <header class="p-4 flex items-center">
            <div
                class="w-10 h-10 flex items-center justify-center -ml-2 cursor-pointer rounded-full hover:bg-slate-50 transition"
                @click="router.back()"
            >
                <ChevronLeft class="w-6 h-6 text-gray-700" />
            </div>
        </header>

        <!-- Main Content -->
        <main
            class="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto px-6 pb-20"
        >
            <div class="mb-10 text-center">
                <div
                    class="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200"
                >
                    <Scale class="w-8 h-8 text-white" />
                </div>
                <h1 class="text-2xl font-bold text-gray-900">
                    {{ isLogin ? "欢迎回来" : "创建新账号" }}
                </h1>
                <p class="text-sm text-gray-500 mt-2">
                    {{
                        isLogin
                            ? "登录以继续享受专业的法律咨询服务"
                            : "注册即可免费体验智能法律分析"
                    }}
                </p>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-4">
                <!-- Name Field for Registration -->
                <div v-if="!isLogin">
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >姓名</label
                    >
                    <input
                        type="text"
                        class="block w-full px-4 py-3 border border-gray-200 rounded-xl leading-5 bg-slate-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                        placeholder="请输入您的真实姓名"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >手机号码</label
                    >
                    <input
                        type="tel"
                        class="block w-full px-4 py-3 border border-gray-200 rounded-xl leading-5 bg-slate-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                        placeholder="请输入手机号"
                    />
                </div>

                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1"
                        >密码</label
                    >
                    <input
                        type="password"
                        class="block w-full px-4 py-3 border border-gray-200 rounded-xl leading-5 bg-slate-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                        placeholder="请输入密码"
                    />
                </div>

                <div v-if="isLogin" class="flex justify-end">
                    <a
                        href="#"
                        class="text-sm text-blue-600 hover:text-blue-500 font-medium pt-1"
                        >忘记密码？</a
                    >
                </div>

                <Button
                    type="submit"
                    class="w-full py-6 mt-4 text-base rounded-xl bg-blue-600 hover:bg-blue-700"
                >
                    {{ isLogin ? "登 录" : "注 册" }}
                </Button>
            </form>

            <div class="mt-8 relative">
                <div class="absolute inset-0 flex items-center">
                    <div class="w-full border-t border-gray-200"></div>
                </div>
                <div
                    class="relative flex justify-center text-sm text-gray-500 mt-2 bg-white px-4 pb-2 w-max mx-auto shadow-[0_0_0_8px_rgba(255,255,255,1)]"
                >
                    或者
                </div>
            </div>

            <div class="mt-4 text-center">
                <p class="text-sm text-gray-600">
                    {{ isLogin ? "还没有账号？" : "已经有账号了？" }}
                    <span
                        class="text-blue-600 font-medium cursor-pointer hover:underline"
                        @click="toggleMode"
                    >
                        {{ isLogin ? "立即注册" : "立即登录" }}
                    </span>
                </p>
            </div>
        </main>
    </div>
</template>
