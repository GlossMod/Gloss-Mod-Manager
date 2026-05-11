# MCP 使用

MCP (Model Context Protocol) 服务器允许第三方应用通过 HTTP 接口与 Gloss Mod Manager 进行交互，从而实现自动化管理 Mod 的功能。

<iframe src="//player.bilibili.com/player.html?isOutside=true&aid=115485010168640&bvid=BV13K1YBtE6e&cid=33655555232&p=1" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="width: 100%; height: 400px;"></iframe>


## 服务端配置
- 在本页面打开 **启用 MCP 服务器** 开关
- 确认服务器状态显示为 **服务器运行中**（绿色）
- 默认端口为 **36412**（支持自定义）

![](https://assets-mod.3dmgame.com/static/upload/mod/202602/MOD69a153ef60af6.png@webp)


## 客户端配置 (Glosc Copilot)
> 使用 [Glosc Copilot](https://www.glosc.ai/) 客户端 + [Gloss Mod Manager](https://www.glosc.ai/store/plugins/gloss-mod-manager) 插件

下载并安装 Glosc Copilot, 找到 选项->工具->从 Glosc Store 安装，找到 “loss Mod Manager”，点击安装
![](https://assets-mod.3dmgame.com/static/upload/mod/202602/MOD69a1530021fa4.png@webp)
![](https://assets-mod.3dmgame.com/static/upload/mod/202602/MOD69a153baabf1e.png@webp)


可以在编辑中的 url 编辑相关的配置
![](https://assets-mod.3dmgame.com/static/upload/mod/202602/MOD69a1542eda282.png@webp)

点击 “测试”， 如果提示 “连接 Gloss Mod Manager 成功” ，并在会话中能正常看到 工具列表，证明配置成功了。
![](https://assets-mod.3dmgame.com/static/upload/mod/202602/MOD69a15486043f6.png@webp)

## 客户端配置 (vs code)

> 使用 [vscode](https://code.visualstudio.com/)

点击 **扩展**，搜索 Copilot , 安装 GitHub Copilot、 Copilot MCP、GitHub Copilot Chat 插件

![](https://assets-mod.3dmgame.com/static/upload/mod/202511/MOD691a8dad326bd.png@webp)

然后打开一个空的文件夹，在里面新建文件 `.vscode/mcp.json`, 内容如下:
::: code-group
```jsonc [.vscode/mcp.json]
{
    "servers": {
        // Gloss Mod Manager MCP 服务器配置
        "gloss-mod-manager": {
            "type": "http",
            "url": "http://localhost:36412/mcp"
        },
        // (可选) Mod站 MCP 服务器配置
        // 用于从 Mod站搜索/下载Mod
        "glossmod-mcp": {
            "type": "http",
            "url": "https://mod.3dmgame.com/mcp",
            "headers": {
                "authorization": "${input:GLOSSMOD_API_KEY}"
            }
        }
    },
    "inputs": [
        {
            "type": "promptString",
            "id": "GLOSSMOD_API_KEY",
            // 在 https://mod.3dmgame.com/Workshop/Api 获取你的 Mod 站 API Key
            "description": "输入你的Mod站 API Key",
            "default": "",
            "password": true
        }
    ]
}

```
:::

如果配置正确，那么能看到这里显示的: `正在运行|停止|重启|N 个工具|N 个提示|更多...`
![](https://assets-mod.3dmgame.com/static/upload/mod/202511/MOD691a8f201a884.png@webp)

接下来就可以使用 MCP 工具来管理 Mod 了。

## 可用工具 (Tools)

### 游戏管理
- **get-supported-games-list** - 获取支持的游戏列表
- **get-manager-games-list** - 获取已添加到管理器的游戏列表
- **get-current-managed-game** - 获取当前正在管理的游戏
- **switch-managed-game** - 切换管理的游戏
- **add-game-to-manager** - 将游戏添加到管理器
- **remove-game-from-manager** - 从管理器中移除游戏
- **fetch-steam-installed-games** - 从 Steam 获取已安装的游戏

### Mod 管理
- **get-current-mod-list** - 获取当前游戏的 Mod 列表
- **install-mod-by-id** - 安装或卸载指定 Mod
- **remove-mod-by-id** - 移除指定 Mod
- **rename-mod** - 重命名 Mod
- **sort-mods** - 对 Mod 列表排序
- **download-mod** - 下载指定 Mod

### Mod 标签和依赖
- **add-tag-to-mod** - 为 Mod 添加标签
- **remove-tag-from-mod** - 移除 Mod 标签
- **get-mod-dependencies** - 获取前置依赖列表
- **translate-game-name** - 翻译游戏名称

### 文件操作
- **get-directory-contents** - 获取目录下的所有文件夹
- **get-files-in-directory** - 获取目录下的所有文件

### 可用资源 (Resources)

- **games://supported-games-list** - 支持的游戏列表（JSON 格式）
- **mods://mod-list** - 当前游戏的 Mod 列表（JSON 格式）
- **mods://mod-dependencies** - Mod 前置依赖列表（JSON 格式）

## 使用示例

### 示例 1: 获取所有支持的游戏
```md
工具: get-supported-games-list
返回: { games: [...], count: N }
```

### 示例 2: 切换到特定游戏并安装 Mod
```md
1. 工具: get-supported-games-list (获取游戏 ID)
2. 工具: switch-managed-game { GlossGameId: 123 }
3. 工具: download-mod { webId: 456, from: "GlossMod", name: "MyMod" }
4. 工具: install-mod-by-id { modId: 789, isInstall: true }
```

### 支持的 Mod 源

下载 Mod 时支持以下源：
- **GlossMod** - Gloss Mod 网站
- **NexusMods** - Nexus Mods 网站
- **Thunderstore** - Thunderstore 平台
- **ModIo** - Mod.io 平台
- **CurseForge** - CurseForge 平台
- **GitHub** - GitHub Release
- **GameBanana** - GameBanana 平台
- **SteamWorkshop** - Steam 创意工坊
- **Customize** - 自定义 URL

## 注意事项

⚠️ **重要提示**
- 服务器启动后，端口号无法修改，需要先停止服务器再修改
- 默认监听本地 `localhost`，不支持远程访问
- 某些操作可能需要检查前置依赖（GamePlugins）
- 下载 Mod 时需要确保已添加目标游戏到管理器

## 常见问题

**Q: 为什么连接失败？**
- 确保服务器已启用（状态为绿色）
- 检查端口号是否正确
- 确认防火墙未阻止该端口

**Q: 如何在下载前检查 Mod 是否存在？**
- 使用 `get-current-mod-list` 获取已有 Mod 列表
- 如果 Mod 不存在，使用 `download-mod` 下载

**Q: 下载的 Mod 存储在哪里？**
- 默认存储在管理器配置的 Mod 存储位置的 `cache` 文件夹中

### 更多帮助

如需更多信息，请访问[官方文档](https://gmm.aoe.top/)或[反馈页面](https://github.com/GlossMod/Gloss-Mod-Manager/issues)。
