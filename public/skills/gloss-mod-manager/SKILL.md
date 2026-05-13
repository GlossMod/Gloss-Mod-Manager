---
name: gloss-mod-manager
description: "Gloss Mod Manager 游戏接入与切换技能。用于在添加游戏前确认 GlossGameId、安装根目录和当前管理状态，并安全调用 mcp_gloss-mod-man_add-game-to-manager。"
---

# Gloss Mod Manager: Add Game Workflow

## 作用

这个 skill 用来把一个已安装游戏登记到 Gloss Mod Manager，并在需要时切换到该游戏。它只处理添加与切换游戏，不负责安装游戏或安装模组。

## 什么时候使用

- 用户要把新游戏接入 Gloss Mod Manager。
- 用户重装系统、迁移游戏目录后，需要重新登记游戏。
- 用户想在多个已管理游戏之间切换当前对象。
- 用户只给了游戏名或路径，但还缺少 GlossGameId 或正确的根目录。

## 核心规则

- 先读只读信息，再做写操作。
- 不要猜 GlossGameId。
- gamePath 必须是游戏安装根目录，不是启动器目录、子目录或单个 exe 文件。
- 如果游戏已经在管理器里，优先切换，不要重复添加。
- 添加完成后，必须确认当前管理游戏已经切换到目标游戏。

## 推荐流程

1. 调用 mcp_gloss-mod-man_get-supported-games-list，确认目标游戏是否受支持，并获取 GlossGameId。
2. 调用 mcp_gloss-mod-man_get-manager-games-list，检查该游戏是否已经在管理器中。
3. 如果已经存在，直接调用 mcp_gloss-mod-man_switch-managed-game 切换到该游戏，然后结束。
4. 如果还未添加，再确认安装路径。
    - 如果是 Steam 游戏，先调用 mcp_gloss-mod-man_fetch-steam-installed-games 获取候选路径。
    - 如果用户已经提供路径，检查它是否指向游戏根目录。
    - 如果路径不明确，向用户要完整安装目录，不要自己补路径。
5. 使用确认后的 GlossGameId 和根目录调用 mcp_gloss-mod-man_add-game-to-manager。
6. 调用 mcp_gloss-mod-man_get-current-managed-game，确认当前管理游戏已经变成目标游戏。

## 路径判断

- 合格路径通常是包含主程序、数据目录或资源目录的游戏根目录。
- 不合格路径包括 Steam 库根目录、启动器目录、mods 目录、bin 子目录和 exe 文件路径。
- 如果出现多个候选路径，优先使用最接近游戏主程序的那个根目录。

## 分支处理

- 如果支持列表里没有该游戏：停止并告知用户当前 Gloss 版本不支持。
- 如果 manager 列表里已经有该游戏：切换即可，不要再次添加。
- 如果路径存在但不是根目录：要求用户提供更高一级目录。
- 如果用户只给游戏名，没有路径：先查支持列表和 Steam 安装目录，再继续。
- 如果用户只给路径，没有游戏名：先根据支持列表和路径上下文确认目标游戏，再继续。
- 如果安装路径无法确认：先询问用户，不要凭经验猜测。

## 完成标准

- 已确认正确的 GlossGameId。
- 已确认 gamePath 是游戏根目录。
- 已成功调用添加或切换工具。
- 已通过当前管理游戏检查确认目标游戏生效。

## 参考工具

- mcp_gloss-mod-man_get-supported-games-list: 获取支持的游戏和 GlossGameId。
- mcp_gloss-mod-man_get-manager-games-list: 检查是否已添加，避免重复操作。
- mcp_gloss-mod-man_fetch-steam-installed-games: 扫描 Steam 安装目录，找出候选路径。
- mcp_gloss-mod-man_get-current-managed-game: 在写入后确认当前激活对象。
- mcp_gloss-mod-man_switch-managed-game: 游戏已存在时直接切换。

## 示例

```json
{
    "tool": "mcp_gloss-mod-man_add-game-to-manager",
    "arguments": {
        "GlossGameId": 261,
        "gamePath": "F:\\SteamLibrary\\steamapps\\common\\Grand Theft Auto V"
    }
}
```
