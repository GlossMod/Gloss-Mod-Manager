---
title: JSON 适配
---

# JSON 适配

JSON 适配适合描述稳定、可枚举的安装规则。它不需要编写程序逻辑，主要通过字段告诉 GMM 如何识别游戏、识别 Mod 类型，以及把文件安装到哪里。

## 适用场景

推荐在这些情况下使用 JSON：

- Mod 安装路径固定。
- 可以通过文件名、扩展名或路径判断 Mod 类型。
- 安装和卸载规则可以用已有通用函数表达。
- 不需要联网、读取注册表或执行复杂脚本。

如果游戏需要复杂判断，请改用 [TypeScript 适配](TS.md)。

## 基础结构

下面是一个简化示例，字段名称以当前适配接口为准：

```json
{
    "GlossGameId": 0,
    "steamAppID": 0,
    "installdir": "",
    "gameName": "Example Game",
    "gameExe": "ExampleGame.exe",
    "startExe": "ExampleGame.exe",
    "gameCoverImg": "",
    "modType": [
        {
            "id": 1,
            "name": "Default",
            "installPath": "Mods",
            "install": {
                "UseFunction": "generalInstall",
                "isInstall": true,
                "keepPath": true
            },
            "uninstall": {
                "UseFunction": "generalUninstall",
                "isInstall": false,
                "keepPath": true
            }
        }
    ],
    "checkModType": [
        {
            "UseFunction": "inPath",
            "Keyword": ["Mods"],
            "TypeId": 1
        }
    ]
}
```

## 关键字段

- `GlossGameId`：站点或社区使用的游戏标识，没有时可以填 `0`。
- `steamAppID`：Steam AppId，没有 Steam 版本时填 `0`。
- `installdir`：用于辅助定位的安装目录名称。
- `gameName`：游戏名称，建议使用稳定英文名。
- `gameExe`：用于验证游戏目录的主程序。
- `startExe`：启动游戏时使用的程序或配置。
- `modType`：声明支持的 Mod 类型和安装规则。
- `checkModType`：声明如何自动识别 Mod 类型。

更完整的字段说明请查看 [属性说明](Property.md)。

## 编写建议

- 先支持最常见的一种 Mod 类型，再逐步扩展。
- 类型名称要简短，例如 `Default`、`Pak`、`BepInEx`。
- 检查规则尽量具体，避免把无关文件识别成 Mod。
- 安装路径使用相对游戏目录的路径。
- 每次改动后都用实际 Mod 测试启用和禁用。

## 常见错误

- `gameExe` 写错，导致用户无法选择游戏目录。
- `installPath` 指向了压缩包内部路径，而不是游戏目标路径。
- `checkModType` 规则太宽，所有 Mod 都被识别成同一类型。
- 只写了安装规则，没有写对应卸载规则。
- 没有测试禁用流程，导致文件残留。