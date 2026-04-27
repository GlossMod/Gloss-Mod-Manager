<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Code, MessageSquareMore } from "lucide-vue-next";
</script>

<template>
    <DocsLayout>
        <h1>AI 自动化和 MCP 服务器</h1>
        <p>
            GMM V2 中最激动人心的革命特性就是引入了
            <strong>Model Context Protocol (MCP)</strong>
            协议。它使得第三方模型（如 GitHub Copilot、Glosc Copilot
            等能够执行系统指令的智能助理）得以利用统一接口，直接管理或者控制你的
            游戏和本地 Mod 文件库。你可以彻底动口不动手！
        </p>

        <h2>开启服务器和网络设置</h2>
        <p>
            打开管理器设置中心，在对应页面找到
            <code>启用 MCP 服务器</code> 开关并勾选。当服务器灯亮起变成
            <strong class="text-green-500">绿色（运行中）</strong>
            后，表示基础能力已就绪。
        </p>
        <p>
            默认端口固定使用 <code>36412</code>（可通过后台设置自定义），仅监听
            <code>localhost</code> 以保障数据安全。
        </p>

        <!-- 配置卡片 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
            <Card class="bg-card">
                <CardHeader class="pb-3 flex flex-row items-center gap-3">
                    <MessageSquareMore class="h-6 w-6 text-primary" />
                    <CardTitle class="text-lg">配置 Glosc Copilot</CardTitle>
                </CardHeader>
                <CardContent
                    class="text-sm text-muted-foreground pb-4 space-y-2"
                >
                    <p>
                        打开 Glosc Copilot -> 选项 -> 工具 -> 选择
                        <strong>从 Glosc Store 安装</strong>。
                    </p>
                    <p>
                        搜索并点击
                        <code>Gloss Mod Manager</code>
                        原生插件安装，稍后如果使用测试按钮显示“连接成功”，此时就能在提示词里激活
                        Mod 操纵工具。
                    </p>
                </CardContent>
            </Card>

            <Card class="bg-card">
                <CardHeader class="pb-3 flex flex-row items-center gap-3">
                    <Code class="h-6 w-6 text-primary" />
                    <CardTitle class="text-lg"
                        >配置 VS Code / GitHub Copilot</CardTitle
                    >
                </CardHeader>
                <CardContent
                    class="text-sm text-muted-foreground pb-4 space-y-2"
                >
                    <p>
                        你可以通过建立一个包含
                        <code>.vscode/mcp.json</code> 配置的空文件夹与它对话：
                    </p>
                    <pre
                        class="bg-muted-foreground/10 text-xs p-2 rounded block mt-2 overflow-x-auto text-foreground"
                    >
{
  "servers": {
    "gloss-mod-manager": {
      "type": "http",
      "url": "http://localhost:36412/mcp"
    }
  }
}
          </pre
                    >
                </CardContent>
            </Card>
        </div>

        <h2>支持的工具库 (Tools)</h2>
        <p>MCP 连接建立后，你可以向你的 AI 直接使用自然语言呼叫底层接口：</p>
        <ul>
            <li>
                <strong>游戏管理相关</strong>:
                <code>get-supported-games-list</code>,
                <code>switch-managed-game</code>,
                <code>add-game-to-manager</code>,
                <code>fetch-steam-installed-games</code>.
            </li>
            <li>
                <strong>Mod 文件流相关</strong>:
                <code>get-current-mod-list</code>,
                <code>install-mod-by-id</code>, <code>sort-mods</code>,
                <code>rename-mod</code>, <code>download-mod</code> (支持 3DM,
                NexusMods, Thunderstore, CurseForge 等丰富开源节点).
            </li>
        </ul>

        <h2>会话范例</h2>
        <p>向 AI 助理下达类似这样的请求：</p>
        <pre class="mb-4">
"帮我看看我现在管理的博德之门3有哪些 Mod 处于冲突或者需要前置依赖未能满足的状态？"</pre
        >
        <p>
            你的 AI 助手就会自主呼叫
            <code>get-current-mod-list</code>
            并检查依赖状态后返回有逻辑的判断建议，并能自动帮你下载依赖。
        </p>

        <div
            class="mt-12 flex justify-between items-center border-t border-border pt-6"
        >
            <Button variant="ghost" as-child>
                <RouterLink to="/docs/install"
                    >&larr; 上一页：安装管理与卸载</RouterLink
                >
            </Button>
            <Button variant="outline" as-child>
                <RouterLink to="/games"
                    >下一页：浏览超百款支持的游戏库 &rarr;</RouterLink
                >
            </Button>
        </div>
    </DocsLayout>
</template>
