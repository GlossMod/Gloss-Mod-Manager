<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MessageCircle, Github, Users, AtSign } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
</script>

<template>
    <DocsLayout>
        <h1>求助与反馈渠道</h1>
        <p>
            在使用过程中遇到了困惑？没能成功挂载想装的模组、游戏启动崩溃或者 GMM
            AI MCP
            命令罢工？我们提供了全面的反馈通路。你可以随意挑选一种你最习惯的社交渠道。
        </p>

        <p>
            在前往以下渠道之前，请确认
            <strong>FAQ 问答记录和游戏原帖下面</strong>
            是否已经给出了对应的答案。
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <!-- GitHub Action -->
            <Card
                class="bg-card hover:bg-muted/50 border-input transition-colors"
            >
                <CardHeader class="pb-3 border-b border-border mb-3">
                    <div
                        class="h-10 w-10 text-xl font-bold bg-primary/10 text-primary flex justify-center items-center rounded"
                    >
                        <Github class="h-5 w-5" />
                    </div>
                    <CardTitle class="text-xl">GitHub Issues</CardTitle>
                </CardHeader>
                <CardContent class="text-sm text-foreground/80 space-y-4">
                    <p>
                        我们所有的 Issue Tracker 都建立在开源 Github
                        核心仓库的。如果你遇到了明显的程序漏洞或是发现特定型号设备崩溃，推荐在这里发起报告。你可以提供报错日志截图来辅助我们诊断。
                    </p>
                    <Button
                        variant="outline"
                        as="a"
                        href="https://github.com/GlossMod/Gloss-Mod-Manager/issues"
                        target="_blank"
                        class="w-full"
                    >
                        前往发起汇报 \(&nearr;\)
                    </Button>
                </CardContent>
            </Card>

            <!-- QQ Group Action -->
            <Card
                class="bg-card hover:bg-muted/50 border-input transition-colors"
            >
                <CardHeader class="pb-3 border-b border-border mb-3">
                    <div
                        class="h-10 w-10 text-xl font-bold bg-[#12b7f5]/10 text-[#12b7f5] flex justify-center items-center rounded"
                    >
                        <MessageCircle class="h-5 w-5" />
                    </div>
                    <CardTitle class="text-xl">QQ 反馈交流群</CardTitle>
                </CardHeader>
                <CardContent class="text-sm text-foreground/80 space-y-4">
                    <p>
                        我们活跃维护这数个官方千人玩家讨论与测试群组。如果你想要最快的活人回答或者只是一些零散的非技术问题，请加入我们。这非常适合日常使用时遇到的玄学疑惑。
                    </p>
                    <Button
                        variant="secondary"
                        as="a"
                        href="https://qm.qq.com/q/ft6b4xx2PS"
                        target="_blank"
                        class="w-full text-[#12b7f5] border-[#12b7f5]/20 bg-[#12b7f5]/10 hover:bg-[#12b7f5]/20"
                    >
                        加群: 492849207 \(&nearr;\)
                    </Button>
                </CardContent>
            </Card>

            <!-- Discord Action -->
            <Card
                class="bg-card hover:bg-muted/50 border-input transition-colors"
            >
                <CardHeader class="pb-3 border-b border-border mb-3">
                    <div
                        class="h-10 w-10 text-xl font-bold bg-[#5865F2]/10 text-[#5865F2] flex justify-center items-center rounded"
                    >
                        <Users class="h-5 w-5" />
                    </div>
                    <CardTitle class="text-xl">Discord 与多语言社区</CardTitle>
                </CardHeader>
                <CardContent class="text-sm text-foreground/80 space-y-4">
                    <p>
                        欢迎海外用户或期望参与国际端社区生态的使用者。我们将逐渐扩充这里。开发成员同样会在日常在此潜水交流。
                    </p>
                    <Button
                        variant="secondary"
                        as="a"
                        href="https://discord.gg/TF46tu7Upw"
                        target="_blank"
                        class="w-full text-[#5865F2] border-[#5865F2]/20 bg-[#5865F2]/10 hover:bg-[#5865F2]/20"
                    >
                        Discord Channel \(&nearr;\)
                    </Button>
                </CardContent>
            </Card>
        </div>

        <div
            class="mt-12 p-6 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-400"
        >
            <h3 class="font-bold flex items-center mb-2">
                <AtSign class="mr-2 h-5 w-5" />提问的重要姿势
            </h3>
            <p class="text-sm">
                提问时切勿挤牙膏或留一句“为啥不行”。请确保告知您想处理的
                <strong>具体的游戏对象名</strong>、<strong
                    >遭遇报错前的一步准确操作</strong
                >
                和
                <strong>复现截图（若有）</strong
                >。这能有效节省彼此互动的无谓时间并加速您痛快游玩的进展！
            </p>
        </div>
    </DocsLayout>
</template>
