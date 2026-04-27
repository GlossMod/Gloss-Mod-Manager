<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
    {
        category: "运行时常见报错",
        items: [
            {
                q: "GMM 程序一直无法启动并显示未知错误怎么办？",
                a: "常见于受阻的杀软拦截。请进入安全中心添加白名单放行，或者以管理员模式强行拉起一次来确认是否属权限问题。如果情况依旧没有好转，可能是缺少必须的 C++ 或 .NET 环境依赖。",
            },
            {
                q: "找不到游戏的可执行程序 (EXE) 是为什么？",
                a: "在设置管理游戏阶段，极少部分游戏采用了多启动器嵌套，它需要你准确指定游戏实际运行的二进制文件层级。或者你将其从另一个磁盘手动挪移了盘符，导致路径缓存失效，请重新用 `管理->选择游戏` 功能刷新一次缓存链接！",
            },
        ],
    },
    {
        category: "游戏与 Mod 功能故障",
        val: "mod_issues",
        items: [
            {
                q: "Mod 状态明明是 “已安装” 并且没有爆红，在游戏内却仍原封不动？",
                a: "这是一个经典错觉。最可能的原因往往是本游戏要求一个底层的 Mod 前置加载器 (例如《博德之门3》需要的特定 ModFixer)。或者是多个同类型 Mod 修改堆叠导致最后一个空架构的 Mod 截取了生效权。请先对照作者帖子确认前置配置完成！",
            },
            {
                q: "下载一直提示超时与下载错误怎么办？",
                a: "如果你是从 GitHub 或非大陆开源节点等外站抓取 Mod，网络连接失败是非常正常的。你可以多试几次或是选用代理。但若是 Mod 站的链接请求同样彻底熔断，往往需要重启 GMM 获取一次最新访问令牌。",
            },
        ],
    },
    {
        category: "关于未识别的状态",
        val: "unknown_type",
        items: [
            {
                q: "出现了非常突兀的类型 “未知”，但怎么也识别不出来！",
                a: "这通常因为 Mod 文件发布者为了图省事把多个不同 Mod 的压缩包放在了一个更大的压缩包里导致了俄罗斯套娃效应，GMM 的自动匹配算法找不到第一层应有的文件结构。请手动右键 `打开` 该暂存目录，手工帮它抽离出其包含的所有第二层压缩子包，然后将其逐个拽回主界面。由于这已经是脏包了，系统无法对其进行任何保证。",
            },
        ],
    },
];
</script>

<template>
    <DocsLayout>
        <h1>常见问题解答 Q&A (FAQ)</h1>
        <p>
            我们把海量用户在高频提问渠道的绝大部分答复系统性地归类在下方并给出了终极解决方案。请随时翻阅！
        </p>

        <div v-for="section in faqs" :key="section.category" class="mt-12">
            <h2 class="text-xl md:text-2xl font-bold border-b pb-2 mb-6">
                {{ section.category }}
            </h2>
            <Accordion
                type="multiple"
                class="w-full text-foreground/90 space-y-4"
            >
                <AccordionItem
                    v-for="(item, idx) in section.items"
                    :key="idx"
                    :value="`${section.category}-${idx}`"
                    class="border border-border/50 bg-card rounded-lg px-4 shadow-sm data-[state=open]:border-primary/40 data-[state=open]:shadow-md transition-all"
                >
                    <AccordionTrigger
                        class="text-[0.95rem] hover:no-underline font-semibold leading-relaxed py-4 text-left"
                    >
                        <span>{{ item.q }}</span>
                    </AccordionTrigger>
                    <AccordionContent
                        class="text-sm text-muted-foreground/90 leading-7 pb-4"
                    >
                        {{ item.a }}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    </DocsLayout>
</template>
