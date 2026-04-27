<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-vue-next";
</script>

<template>
    <DocsLayout>
        <h1>介绍与下载 (Gloss Mod Manager)</h1>
        <p>
            <strong>Gloss Mod Manager (GMM)</strong>
            是一款综合性的现代化游戏模组管理器，目标是降低使用 Mod
            的门槛，让更多的玩家不再因为不会装而放弃 Mod
            这一乐趣。并且，作为国内首屈一指的 Mod
            管理工具，我们将常见流程集中到了一个统一且智能的入口。
        </p>

        <h2>为什么选择 GMM V2？</h2>
        <p>
            新一代的 V2 版本经历了全面的底层重构，引入了
            <strong>AI MCP 与 Skills 大语言模型工具链</strong
            >，显著改善了跨平台体验，并将安装包体积压缩了 90%
            以上。它不仅安全无毒、简单易用，还能通过自适应语言与主题提供极其舒适的使用体验。
        </p>

        <h2>如何下载？</h2>
        <p>目前由官方更新维护的安全可用下载渠道有以下几种：</p>
        <ul>
            <li>
                <a
                    href="https://github.com/GlossMod/Gloss-Mod-Manager/releases"
                    target="_blank"
                    >GitHub Releases (官方首选)</a
                >
            </li>
            <li>
                <a href="https://mod.3dmgame.com/mod/197445" target="_blank"
                    >3DM Mod 站</a
                >
            </li>
            <li>
                <a
                    href="https://apps.microsoft.com/detail/9P5VGZ39PK6T"
                    target="_blank"
                    >Microsoft Apps 分发</a
                >
            </li>
        </ul>

        <blockquote class="flex items-start gap-3">
            <AlertTriangle class="w-6 h-6 shrink-0 mt-0.5 text-amber-500" />
            <div>
                <strong>安全性声明：</strong>
                除了以上官方渠道外，其他平台分发的版本本站不保证安全性。GMM
                安装和运行均
                <strong>不需要向你的电脑请求管理员权限</strong> ，并且完全通过了
                VirusTotal 的查毒验证。如遇误报，请对比官方签名。
            </div>
        </blockquote>

        <h2>如何安装？</h2>
        <ol>
            <li>
                下载最新版本的
                <code>Gloss Mod Manager_*.exe</code>（或适用您操作系统的文件）。
            </li>
            <li>双击运行安装程序，按照提示下一步即可。</li>
            <li>
                你可以将其安装到除系统系统受保护目录 (如
                <code>Program Files</code>)
                外的任意目录，路径存在中文和空格也不受影响。
            </li>
        </ol>
        <p>安装完成后，点击桌面的快捷方式，准备开始你的游戏 Mod 之旅！</p>

        <div
            class="mt-12 flex justify-between items-center border-t border-border pt-6"
        >
            <div class="text-sm text-muted-foreground"></div>
            <Button variant="outline" as-child>
                <RouterLink to="/docs/use"
                    >下一页：运行与首次配置 &rarr;</RouterLink
                >
            </Button>
        </div>
    </DocsLayout>
</template>
