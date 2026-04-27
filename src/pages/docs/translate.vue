<script setup lang="ts">
import DocsLayout from "@/components/DocsLayout.vue";
</script>

<template>
    <DocsLayout>
        <h1>翻译软件 (Translation Support)</h1>
        <p>
            GMM
            被全世界各地的玩家和创作者使用。除了核心的简体中文界面，也自适应支持英语等。如果您愿意帮助我们将管理器本地化为您的母语，你只需要非常简单的修改
            JSON 即可！
        </p>

        <h2>导出并编写语言包</h2>
        <p>自 GMM V1.51 起引入了极简的结构化机制，请根据您的偏好配置：</p>
        <ol>
            <li>打开管理器的 <code>设置</code> 齿轮页面。</li>
            <li>
                点击 “导出语言包”，这将把基准的语言文件解包释放到
                <code>我的文档\Gloss Mod Manager\lang</code> 目录供你编辑。
            </li>
            <li>
                我们强烈建议您直接复制 <code>zh_CN</code> (简体中文) 或
                <code>en_US</code> (English)
                的目录，重命名为对应所需的国家语言标识（如繁体
                <code>zh_TW</code>）。
            </li>
        </ol>

        <p>
            在这个包的 <code>data:code</code> 最上方定义你的目标语言代码，确保
            JSON
            格式合法嵌套和结尾的闭合。您可以使用任意自己喜欢的代码编辑器或记事本对
            <code>.json</code> 内双语对应内容进行逐条填充。
        </p>

        <h2>在管理器中即时重载</h2>
        <p>
            当你编辑并保存任意一条翻译后，无需重新启动整个软件。只需要在处于激活状态的
            GMM 界面内部直接按下 <strong><kbd>Ctrl</kbd> + <kbd>R</kbd></strong
            >，管理器就能挂载并重载子目录读取队列里面的全部语言，即时呈现你的心血结果。
        </p>

        <h2>机制与文件读取顺序</h2>
        <p>
            支持子目录级分别读取。你可以把巨大的语言文件拆解。例如，除了翻译软件框架本身，如果你需要把特定游戏的术语做规范翻译，那么：
        </p>
        <pre><code>lang/
  zh_TW/
    base.json
    Cyberpunk 2077.json
    Elden Ring.json
</code></pre>
        <p>
            系统会按照文件名排序向下依次覆盖合并（越往后的文件，同样标识符的优先级越高）。
        </p>

        <h2>推送贡献（Pull Request）</h2>
        <p>
            当你满意你的翻译本地文件后，你可以直接整理并通过 GitHub 提交 Pull
            Request，或者带上你的语言文件包发送反馈。在下一个主要发行版中我们一定会署名，并将其作为内置官方支持推给全球玩家！
        </p>
    </DocsLayout>
</template>
