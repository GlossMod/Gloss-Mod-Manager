<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import {
    ChevronLeft,
    Send,
    Mic,
    MoreVertical,
    Bot,
    User,
} from "lucide-vue-next";

const router = useRouter();
const messages = ref([
    {
        id: 1,
        role: "assistant",
        text: "您好，我是您的 AI 法律顾问。请用一句话描述您遇到的问题，例如“房东提前解约不退押金怎么办”或“我想写一份合作协议”。",
        time: "10:00",
    },
    {
        id: 2,
        role: "user",
        text: "你好，我在公司工作了三年，现在突然被辞退了，公司只给了一个月的赔偿，这样合法吗？",
        time: "10:02",
    },
    {
        id: 3,
        role: "assistant",
        text: "根据《中华人民共和国劳动合同法》的规定，辞退赔偿（经济补偿）的计算与辞退原因息息相关：\n\n1. **如果是违法解除**：单位需支付双倍经济补偿金（即赔偿金），工作满一年支付2个月工资。您工作了3年，应获赔6个月工资。\n2. **如果是合法解除但未提前通知**：除了经济补偿金（工作3年支付3个月工资），还需加付1个月工资的代通知金，共计4个月。\n\n所以，仅仅支付1个月大概率是不符合法律规定的。建议您先不要签署任何解除协议，并收集好劳动合同、工资流水、打卡记录等证据。",
        time: "10:03",
    },
]);

const inputStr = ref("");
const scrollArea = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
    if (scrollArea.value) {
        scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
    }
};

onMounted(() => {
    scrollToBottom();
});

const handleSend = () => {
    if (!inputStr.value.trim()) return;
    messages.value.push({
        id: Date.now(),
        role: "user",
        text: inputStr.value,
        time: new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
        }),
    });

    const text = inputStr.value;
    inputStr.value = "";

    nextTick(() => {
        scrollToBottom();
    });

    // Mock response
    setTimeout(() => {
        messages.value.push({
            id: Date.now(),
            role: "assistant",
            text:
                "这是一个演示回复。在真实应用中，这里将返回针对“" +
                text +
                "”的法律分析建议。",
            time: new Date().toLocaleTimeString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
            }),
        });
        nextTick(() => scrollToBottom());
    }, 1000);
};
</script>

<template>
    <div
        class="h-screen bg-slate-50 flex flex-col relative w-full lg:max-w-md lg:mx-auto shadow-xl"
    >
        <!-- Header -->
        <header
            class="bg-white px-4 py-3 border-b flex items-center justify-between shadow-sm z-10 w-full relative"
        >
            <div
                class="w-10 h-10 flex items-center justify-center -ml-2 cursor-pointer rounded-full hover:bg-slate-50 transition"
                @click="router.back()"
            >
                <ChevronLeft class="w-6 h-6 text-gray-700" />
            </div>
            <div class="flex flex-col items-center">
                <h1 class="text-base font-semibold text-gray-900">
                    AI 劳动法专家
                </h1>
                <div class="flex items-center text-xs text-green-500 mt-0.5">
                    <span
                        class="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"
                    ></span>
                    在线
                </div>
            </div>
            <div
                class="w-10 h-10 flex items-center justify-center -mr-2 cursor-pointer rounded-full hover:bg-slate-50 transition"
            >
                <MoreVertical class="w-5 h-5 text-gray-600" />
            </div>
        </header>

        <!-- Chat Area -->
        <main class="flex-1 overflow-y-auto p-4 space-y-6" ref="scrollArea">
            <div class="text-center">
                <span
                    class="text-xs bg-gray-200 text-gray-500 px-3 py-1 rounded-full"
                    >2026年4月27日 10:00</span
                >
            </div>

            <div
                v-for="msg in messages"
                :key="msg.id"
                class="flex w-full"
                :class="[msg.role === 'user' ? 'justify-end' : 'justify-start']"
            >
                <div
                    class="flex max-w-[85%]"
                    :class="[
                        msg.role === 'user' ? 'flex-row-reverse' : 'flex-row',
                    ]"
                >
                    <!-- Avatar target -->
                    <div
                        class="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center mt-1 outline outline-1 outline-slate-200"
                        :class="[
                            msg.role === 'user'
                                ? 'bg-indigo-100 ml-2'
                                : 'bg-blue-600 mr-2',
                        ]"
                    >
                        <User
                            v-if="msg.role === 'user'"
                            class="w-5 h-5 text-indigo-600"
                        />
                        <Bot v-else class="w-5 h-5 text-white" />
                    </div>

                    <!-- Message Bubble -->
                    <div class="relative group">
                        <div
                            class="px-4 py-3 rounded-2xl shadow-sm text-sm whitespace-pre-wrap break-words"
                            :class="[
                                msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none',
                            ]"
                        >
                            {{ msg.text }}
                        </div>

                        <span
                            class="text-[10px] text-gray-400 mt-1 block absolute -bottom-5"
                            :class="[
                                msg.role === 'user' ? 'right-1' : 'left-1',
                            ]"
                        >
                            {{ msg.time }}
                        </span>
                    </div>
                </div>
            </div>
            <!-- Spacing for bottom time fix -->
            <div class="h-4"></div>
        </main>

        <!-- Bottom Input -->
        <div
            class="bg-white border-t p-3 w-full shrink-0 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.02)]"
        >
            <div
                class="flex items-end gap-2 bg-slate-50 border border-gray-200 p-1.5 rounded-2xl focus-within:ring-2 focus-within:ring-blue-100 transition-shadow"
            >
                <button
                    class="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer flex-shrink-0"
                >
                    <Mic class="w-5 h-5" />
                </button>

                <textarea
                    v-model="inputStr"
                    rows="1"
                    class="w-full max-h-32 bg-transparent resize-none py-2.5 px-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
                    placeholder="输入您的问题..."
                    @keydown.enter.prevent="handleSend"
                ></textarea>

                <div class="flex items-center pb-1">
                    <Button
                        class="h-9 w-9 p-0 rounded-xl bg-blue-600 hover:bg-blue-700 flex-shrink-0 transition-all shadow-md"
                        :class="[
                            inputStr.trim()
                                ? 'opacity-100 scale-100'
                                : 'opacity-80 scale-95',
                        ]"
                        @click="handleSend"
                    >
                        <Send class="w-4 h-4 ml-0.5 text-white" />
                    </Button>
                </div>
            </div>
        </div>
    </div>
</template>
