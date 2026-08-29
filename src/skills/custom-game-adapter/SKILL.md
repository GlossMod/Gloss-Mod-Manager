---
name: custom-game-adapter
description: "为未支持的游戏创建自定义适配配置。用户只给出游戏目录时，探测引擎类型、搜索 GlossGameId、生成并写入 Expands JSON，也用于查看、编辑和删除已有的自定义游戏适配。"
argument-hint: "Game install directory, game name, or an existing custom adapter to edit"
---

# Gloss Mod Manager: Custom Game Adapter Workflow

## 作用

这个 skill 用来给 Gloss Mod Manager 尚未内置支持的游戏创建适配配置。用户通常只提供一个游戏安装目录，你需要自己探测目录特征、补齐缺失字段、生成 JSON 并写入 Expands 目录，让这个游戏出现在游戏选择列表里。

它同时负责自定义适配的读取、编辑和删除。它不负责安装 Mod，也不负责把游戏添加到管理器（那是 gloss-mod-manager skill 的职责）。

## 什么时候使用

- 用户发来一个游戏目录，说想让 Gloss 支持这个游戏。
- 用户想给某个游戏手写或修改 Mod 类型规则。
- 用户要查看、修改或删除之前创建的自定义适配。
- 支持游戏列表里没有目标游戏，需要先做适配再管理。

## 核心规则

- 先探测，再生成。不要凭游戏名猜目录结构和引擎类型。
- 不要猜 GlossGameId。搜不到就填 0，并告知用户在线功能会受限。
- gameName 是配置的唯一标识和文件名，用英文、不带特殊字符。
- 写入前必须先校验。校验不通过就修配置，不要硬写。
- 覆盖已有配置必须先读出来看一眼，并向用户确认，`overwrite` 不要默认传 true。
- 删除是不可逆操作，执行前必须向用户确认。
- 能用内置模板就不要手写 modType。手写只用于模板都不适用的游戏。

## 推荐流程

1. 调用 mcp_gloss-mod-man_get-supported-games-list，确认这个游戏是否已经受支持。已支持就不需要适配，转去用 gloss-mod-manager skill。
2. 调用 mcp_gloss-mod-man_list-custom-games，确认是否已经存在同名的自定义适配。存在就走「编辑已有适配」分支。
3. 调用 mcp_gloss-mod-man_inspect-game-directory，传入用户给的目录，拿到 engine、exeCandidates、unity/unrealEngine 信息和 notes。
4. 调用 mcp_gloss-mod-man_search-gloss-game，用游戏名搜 GlossGameId。搜不到就用 0。
5. 根据探测结果组装配置（见下面「配置生成规则」）。
6. 调用 mcp_gloss-mod-man_validate-custom-game 校验。有 errors 就按提示改，直到通过。warnings 可以接受，但要在最后告知用户。
7. 调用 mcp_gloss-mod-man_save-custom-game 写入。
8. 调用 mcp_gloss-mod-man_get-supported-games-list 确认新游戏已经出现在列表里。
9. 向用户说明适配已生效，并提示可以继续把游戏添加到管理器。

## 配置生成规则

### 必填字段

- `gameName`: 英文游戏名，无特殊字符。作为文件名和唯一标识。
- `GlossGameId`: 从 search-gloss-game 拿。搜不到填 0。
- `steamAppID`: Steam 游戏填真实 AppId，非 Steam 游戏填 0。
- `gameExe`: 取 exeCandidates 第一项。若该项 `inRoot` 为 true，直接用文件名字符串；否则用数组形式 `[{ name, rootPath }]`，rootPath 用探测结果里给的值。
- `modType` 和 `checkModType`: 按引擎选模板，见下。

### 按引擎选模板

探测结果的 `engine` 字段直接决定模板选择：

- `Unity`: `"modType": "UnityGame.modType"`，`"checkModType": "UnityGame.checkModType"`
- `UnityIL2CPP`: `"modType": "UnityGameILCPP2.modType"`，`"checkModType": "UnityGameILCPP2.checkModType"`
- `UnrealEngine`: `"modType": "UnrealEngine.modType"`，`"checkModType": "UnrealEngine.checkModType"`，并且必须带上 `unrealEngineData`，其中 `bassPath` 和 `useUE4SS` 用探测结果里的值。
- `Unknown`: 需要手写 modType 数组和 checkModType 数组。

### 建议补充的字段

- `installdir`: Steam 游戏填从 Steam common 目录到游戏主程序的相对路径，可参考探测结果的 folderName。
- `startExe`: 有 steamAppID 时建议给两个启动方式，一个 `steam://rungameid/<steamAppID>`，一个直接指向 exe 的相对路径。
- `gameCoverImg`: 封面图 URL，推荐 1200x674 的 webp。没有就留空，但要告知用户列表里不会有封面。

### 手写 modType 的规则

只在 `engine` 为 `Unknown`，或者用户明确要求自定义时才手写。

每个类型对象需要 `id`、`name`、`installPath`、`install`、`uninstall`。install 和 uninstall 都是对象，`UseFunction` 从下面选，且都必须带 `inGameStorage`：

- `generalInstall` / `generalUninstall`: 把 Mod 内容整体复制到 installPath。最常用。配合 `keepPath` 决定是否保留 Mod 内部目录结构。
- `installByFile`: 只处理匹配 `fileName` 的文件。`isExtname` 为 true 时 fileName 按扩展名匹配。
- `installByFileSibling`: 匹配到 `fileName` 后，连同它的同级文件一起装。适合「认标志文件、装整个目录」的场景。可用 `pass` 跳过指定文件。
- `installByFolder`: 处理名为 `folderName` 的目录。`include` 控制是否包含该目录本身。
- `installByFolderParent`: 处理 `folderName` 的父目录。
- `Unknown`: 兜底占位，不执行实际安装。用于 id 99 的「未知」类型。

务必保留一个 `id` 为 99、名为「未知」的兜底类型，install 和 uninstall 都用 `Unknown`，否则无法归类的 Mod 会没有归属。

checkModType 数组里每条规则需要 `UseFunction`、`Keyword`、`TypeId`：

- `extname`: 按扩展名匹配，Keyword 形如 `[".pak"]`。
- `basename`: 按完整文件名匹配。
- `inPath`: 按路径片段匹配，要求 Keyword 里的每一项都出现在路径中。

每条规则的 `TypeId` 必须对应 modType 里真实存在的 id。

## 编辑已有适配

1. 调用 mcp_gloss-mod-man_read-custom-game 读出当前配置。
2. 向用户确认要改哪些字段，只改这些字段，其余原样保留。
3. 调用 mcp_gloss-mod-man_validate-custom-game 校验改后的完整配置。
4. 调用 mcp_gloss-mod-man_save-custom-game，传 `overwrite: true`。

## 删除适配

1. 调用 mcp_gloss-mod-man_read-custom-game 确认目标存在，并把配置内容展示给用户。
2. 明确告知用户这会同时删掉该游戏的自定义类型文件，且不可恢复。
3. 得到用户确认后再调用 mcp_gloss-mod-man_delete-custom-game。

## 分支处理

- 如果游戏已在内置支持列表里：不要创建自定义适配，内置适配会覆盖同名自定义配置。
- 如果目录不存在：要求用户提供正确的安装根目录，不要自己补路径。
- 如果 exeCandidates 为空：目录很可能不是游戏根目录，要求用户确认。
- 如果 engine 是 Unknown：先询问用户这个游戏的 Mod 通常是什么格式、装在哪个目录，再手写 modType，不要凭空编造路径。
- 如果 search-gloss-game 返回多个相近结果：把候选列给用户选，不要自己挑。
- 如果校验反复不通过：把 errors 原文告诉用户，说明缺什么，不要绕过校验。

## 完成标准

- 配置已通过 validate-custom-game 校验。
- 已成功写入，save-custom-game 返回 state 为 true。
- 新游戏已出现在 get-supported-games-list 结果中。
- 已把遗留的 warnings（例如 GlossGameId 为 0、没有封面图）告知用户。

## 参考工具

- mcp_gloss-mod-man_inspect-game-directory: 探测目录，拿引擎类型和候选主程序。
- mcp_gloss-mod-man_search-gloss-game: 按名称搜 GlossGameId 和官方 Mod 分类。
- mcp_gloss-mod-man_list-custom-games: 列出已有的自定义适配。
- mcp_gloss-mod-man_read-custom-game: 读取单个自定义适配的完整配置。
- mcp_gloss-mod-man_validate-custom-game: 写入前校验，返回 errors 和 warnings。
- mcp_gloss-mod-man_save-custom-game: 写入配置并刷新支持游戏列表。
- mcp_gloss-mod-man_delete-custom-game: 删除配置及其自定义类型文件。

## 示例

Unreal 游戏，套模板：

```json
{
    "tool": "mcp_gloss-mod-man_save-custom-game",
    "arguments": {
        "definition": {
            "GlossGameId": 0,
            "steamAppID": 2358720,
            "installdir": "BlackMythWukong",
            "gameName": "Black Myth Wukong",
            "gameExe": [{ "name": "b1.exe", "rootPath": "../../.." }],
            "startExe": [
                { "name": "Steam 启动", "exePath": "steam://rungameid/2358720" }
            ],
            "modType": "UnrealEngine.modType",
            "unrealEngineData": { "bassPath": "b1", "useUE4SS": false },
            "checkModType": "UnrealEngine.checkModType"
        }
    }
}
```

引擎未知，手写 modType：

```json
{
    "tool": "mcp_gloss-mod-man_save-custom-game",
    "arguments": {
        "definition": {
            "GlossGameId": 344,
            "steamAppID": 2420110,
            "gameName": "Horizon Forbidden West",
            "gameExe": "HorizonForbiddenWest.exe",
            "modType": [
                {
                    "id": 1,
                    "name": "stream",
                    "installPath": "LocalCacheWinGame/package/mods",
                    "install": {
                        "UseFunction": "installByFileSibling",
                        "fileName": ".stream",
                        "isExtname": true,
                        "inGameStorage": true,
                        "pass": []
                    },
                    "uninstall": {
                        "UseFunction": "installByFileSibling",
                        "fileName": ".stream",
                        "isExtname": true,
                        "inGameStorage": true,
                        "pass": []
                    }
                },
                {
                    "id": 99,
                    "name": "未知",
                    "installPath": "/",
                    "install": { "UseFunction": "Unknown", "inGameStorage": true },
                    "uninstall": { "UseFunction": "Unknown", "inGameStorage": true }
                }
            ],
            "checkModType": [
                { "UseFunction": "extname", "Keyword": [".stream"], "TypeId": 1 }
            ]
        }
    }
}
```
