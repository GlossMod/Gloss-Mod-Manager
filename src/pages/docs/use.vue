<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import { Button } from "@/components/ui/button";
</script>

<template>
    <DocsLayout>
        <h1>运行和配置</h1>
        <p>
            安装完成后启动
            GMM，你将感受到这不仅是一个工具，更是让你省下大量配置时间的中枢平台。跟随此简单流程完成基础配置，保证后续的一键自动接管平滑可用。
        </p>

        <h2>首次打开</h2>
        <p>
            首次打开之后，第一件事即是打开<strong>设置</strong>。找到
            <code>Mod 储存位置</code
            >，将其更改至其他空闲空间较大的非系统路径，以确保存档文件和下载的大容量缓存不会挤占宝贵的
            <code>C 盘</code>。
        </p>
        <blockquote>
            <strong>警告：</strong>
            不要将这个统一的储存文件夹直接设置为实际游戏的根目录。这可能导致游戏与管理器的深层冲突，从而发生游戏无法启动的问题。
        </blockquote>

        <h2>添加游戏管理</h2>
        <p>
            完成管理库目录配置后，接下来导航到
            <code>管理 -> 选择游戏</code>，然后在出现的对话框中：
        </p>
        <ul>
            <li>
                如果你是通过
                <strong>Steam / Epic</strong>
                下载的，那么只需点击对应的自动扫描工具或手动定位 Steam
                的库路径。GMM 会自动适配底层识别逻辑。
            </li>
            <li>
                如果是通过
                <strong>Xbox Store</strong>
                等其他有权限限制的入口下载的（比如没有访问特定系统隐藏目录的权限），请务必在设置内开启
                <code>通过目录选择游戏</code> 以进行精确指向。
            </li>
        </ul>

        <h2>导入与添加 Mod 到管理器</h2>
        <p>为了利用管理器开始工作，你有三种主要方式添加已有的 Mod 文件包：</p>
        <ol>
            <li>
                <strong>管理器内浏览（推荐）：</strong> 只要选择好游戏，即可使用
                GMM 内置的浏览器在线搜索、筛选 3DM Mod 站的内容，并点击 “下载”
                直接入库。
            </li>
            <li>
                <strong>网页一键安装：</strong>
                当你在外部浏览器寻找特定分区资源（如《博德之门3》）时，点击页面上的“一键安装”按钮，它将自动打开关联的
                <code>Gloss Mod Manager</code> 拉起后台静默下载，且你可以勾选
                <code>始终打开关联应用</code> 来一劳永逸。
            </li>
            <li>
                <strong>本地离线导入：</strong> 支持通过
                <code>导入 Mod</code> 按钮选择 zip / rar / 7z 及专属 gmm
                包格式文件；更可以直接将压缩包强行<strong>拖放拖拽</strong>进应用程序区域，后台系统就能智能分拣归类了。
            </li>
        </ol>

        <div
            class="mt-12 flex justify-between items-center border-t border-border pt-6"
        >
            <Button variant="ghost" as-child>
                <RouterLink to="/docs/getting-started"
                    >&larr; 上一页：下载与安装</RouterLink
                >
            </Button>
            <Button variant="outline" as-child>
                <RouterLink to="/docs/install"
                    >下一页：管理与安装 Mod &rarr;</RouterLink
                >
            </Button>
        </div>
    </DocsLayout>
</template>
