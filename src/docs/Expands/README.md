# 游戏适配

在 1.51.0 版本，我对 游戏适配进行了更加简单优化， 在 选择游戏 窗口中，能找到 “创建自定义游戏”的选项；

![](https://mod.3dmgame.com/static/upload/mod/202412/MOD676283a00e646.png@webp)

> [新游戏请求](https://github.com/GlossMod/Gloss-Mod-Manager/discussions/36)
 
### 旧版本
-  [使用 TS 来制作游戏适配](TS.md) 
-  [使用 JSON 来制作游戏适配](JSON.md) 

### 属性介绍



| 属性         | 介绍                               | 用途                                                                                                                   | 详细介绍                                   | 必填 |
| ------------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---- |
| 游戏ID       | 3DM Mod站的游戏ID                  | 游戏的唯一标识, 同时也用于游览里面的 "3DM Mods" 选项的游览内容来源                                                     | [链接](/Expands/Property.html#glossgameid) | ✔    |
| Steam ID     | Steam 中的 AppId, 如果未上架则填 0 | 用于定位游戏安装目录 (原计划接入Steam创意工坊内容, 但到现在也没有实现)                                                 |                                            | ✔    |
| Thunderstore | Thunderstore 的社区路径            | 用于游览里面的 "Thunderstore" 选项的游览内容来源                                                                       |                                            | ✖    |
| Mod.Io Id    | 在 Mod.Io 中的ID                   | 用于游览里面的 "Mod.Io" 选项的游览内容来源                                                                             |                                            | ✖    |
| GameBanana   | 在 GameBanana 中的ID               | 用于游览里面的 "GameBanana" 选项的游览内容来源                                                                         |                                            | ✖    |
| CurseForge   | 在 CurseForge 中的ID               | 用于游览里面的 "CurseForge" 选项的游览内容来源                                                                         |                                            | ✖    |
| 安装目录     | 游戏所在的目录文件夹               | 用于 使用 Steam ID + 安装目录 来定位游戏所在目录                                                                       |                                            | ✔    |
| 游戏名称     | 游戏的名称                         | 游戏的名称, 用于生成Mod存储目录, 尽量使用英文, 然后再用翻译来将其翻译为其他语言                                        |                                            | ✔    |
| 主程序名称   | 游戏的主程序名称                   | 用于判断是否选择了正确的游戏, 如果主程序直接在根目录, 则用简易模式, 如果不在根目录, 则使用高级模式                     | [链接](/Expands/Property.html#gameexe)     | ✔    |
| 启动方式     | 游戏的启动方式                     | 如果只需要一种启动方式, 则用简易模式, 如果想要多种启动方式, 则使用高级模式, 在高级模式中, 前三个选项 和 cmd 二选一即可 | [链接](/Expands/Property.html#startexe)    | ✔    |
| 封面         | 游戏的封面图片                     | 用于游戏选择界面的显示                                                                                                 |                                            | ✔    |
| 类型         | Mod的安装类型                      | 新增了通用的 unity 、虚幻 的类型, 以及自定义安装, 自定义相关选项可参考 "modType"                                       | [参考](/Expands/JSON.html#示例)            | ✔    |
| 检查类型     | Mod的检查类型                      | 同上, 用于判断Mod是属于哪个类型， 自定义可参考 "checkModType"                                                          | [参考](/Expands/JSON.html#示例)            | ✔    |

### 翻译游戏

上面说了，游戏名称需要使用英文，那么如果你想在 GMM 中显示中文, 可以使用自定义翻译功能. 

在 `C:\Users\xiaom\Documents\Gloss Mod Manager\lang\` 目录中新建一个文件夹, 例如 `zh_CN.json`, 然后在里面添加如下内容:

```json
{
    "data": {
        "name": "简体中文",
        "code": "zh_CN",
        "author": "",
        "version": "1.51.0"
    },
    "Language": {
        "Cyberpunk 2077": "赛博朋克2077"
    }
}
```

保存后, 在 GMM 中按 `Crrl + R`即可刷新语言包, 然后就可以看到游戏名称已经变成中文了.

同理，也可以使用这个方法将 类型 翻译为其他语言
