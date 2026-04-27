<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-vue-next";
</script>

<template>
    <DocsLayout>
        <h1>安装、卸载与冲突处理</h1>
        <p>
            GMM
            可以为你极大地自动化游戏模组管理。请严格遵照自动识别和状态切换来执行操作。
        </p>

        <h2>自动化识别机制</h2>
        <div class="bg-muted px-4 py-3 rounded-lg flex items-start gap-4 mb-6">
            <AlertCircle class="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div class="text-sm">
                <strong>核心原则：</strong> GMM
                具有完备的模组类型推断引擎。当你将压缩包导入管理器时，它就能智能扫描包内的文件目录，从而赋予该
                Mod 正确的
                <strong>类型标签</strong
                >。请不要随意修改这部分底层配置，否则将导致自动安装流程失效。
            </div>
        </div>

        <h2>手动与自动解决冲突</h2>
        <p>
            由于存在诸如《艾尔登法环》那样的特殊挂载点设计，不同 Mod
            同时修改同一文件往往会存在单一文件冲突的情况。我们目前的机制需要你的少量介入：
        </p>
        <ul>
            <li>
                如果你安装了多个拥有互斥功能的 Mod，系统默认
                <strong>最后一次部署的 Mod 会生效并将上一次文件覆盖</strong
                >。你需要手动决定想应用哪一个 Mod 来收尾。
            </li>
            <li>
                在更复杂的环境中，你可以灵活使用 `已安装 / 未安装`
                状态开关，这等于 <code>安装</code> 或
                <code>卸载</code> 的快捷方式。这可以让你随时清空并重新梳理 Mod
                的层次。
            </li>
        </ul>

        <h2>处理 "未知" 类型的特殊结构</h2>
        <p>
            若极少数作者打包存在过深的子层级，或特殊结构没能通过我们的识别模板，管理器将标注该
            Mod 类型为 <code>未知</code>。
        </p>
        <ol>
            <li>
                不用慌张。选中 Mod，找到最右边的 “操作” 下拉菜单，点击
                <code>打开</code>，这将弹开它的缓存解压目录。
            </li>
            <li>检查其中是否有多重打包的 ZIP 压缩包或非标准的结构。</li>
            <li>
                如果是二次压缩的包，请将其拖出，再直接丢进 GMM
                的软件界面进行第二轮智能识别。如果依旧失败，只能求助由 Mod
                作者提供的根目录替换（手动干预）。
            </li>
        </ol>

        <h2>利用启动配置畅玩</h2>
        <p>
            在管理器处理所有状态后，你无须再特步通过外界途径去启动游戏。GMM
            提供并代理了快捷<strong>原版启动</strong>与对应的<strong>外挂环境</strong>启动。
        </p>
        <blockquote>
            注意：当前有少部分游戏如正版环境强制验证的《艾尔登法环》或《星露谷物语》有着特殊的启动途径。请遵照系统在状态栏内的专门提示即可。
        </blockquote>

        <div
            class="mt-12 flex justify-between items-center border-t border-border pt-6"
        >
            <Button variant="ghost" as-child>
                <RouterLink to="/docs/use"
                    >&larr; 上一页：运行与配置</RouterLink
                >
            </Button>
            <Button variant="outline" as-child>
                <RouterLink to="/docs/mcp"
                    >下一页：MCP 篇与 AI 自动化 &rarr;</RouterLink
                >
            </Button>
        </div>
    </DocsLayout>
</template>
