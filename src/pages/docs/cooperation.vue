<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
</script>

<template>
    <DocsLayout>
        <h1>项目合作与共建</h1>
        <p>
            我们不仅欢迎各界开发者带来出色的功能反馈，同样欢迎想要利用 GMM
            底层生态力量或是希望将其强大的 Mod
            支持接入各自服务中的所有平台及产品。
        </p>

        <h2>应用场景合作</h2>
        <ul>
            <li>
                如果你是游戏修改或平台资源的独立站站长：可借助一键安装按钮直接将玩家流导流到本端原生框架。
            </li>
            <li>
                如果有专属于特定工作室、硬核汉化组的整合补丁或数据站，我们可以开放独家配置规则。
            </li>
            <li>
                如果有想在自身工具内部利用 GMM 已经写好的 AI 协议和 MCP
                引擎的高级 AI 初创团队，我们同样非常愿意开放代码或对接交流。
            </li>
        </ul>

        <h2>联系创始人</h2>
        <p>
            如果您想将自己的应用融入进 Gloss Mod
            Manager（比如内嵌在某站框架中，或者利用专门的 URL
            处理协议互相拉起），敬请直接通过我们的邮件系统或企业联系渠道沟通：
        </p>

        <div
            class="mt-8 bg-muted border border-border p-6 rounded-lg text-foreground"
        >
            <h3 class="font-bold text-lg mb-2">获取联系与讨论意向</h3>
            <p class="mb-4 text-muted-foreground text-sm">
                发送主题清晰的商业化、应用聚合或是公益整合相关提议至指定作者邮箱。
            </p>
            <div class="inline-flex gap-3">
                <span
                    class="bg-background border border-border py-1.5 px-3 font-mono text-sm leading-none flex items-center rounded select-all cursor-text"
                >
                    xm@aoe.top
                </span>
            </div>
        </div>
    </DocsLayout>
</template>
