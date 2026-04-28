

# 属性介绍

## GlossGameId 
- 类型: `number`
- Mod站的游戏ID
- 用于 在`游览`页面获取`3DM Mod`的数据, 如果Mod无该游戏, 可填 `0`, 但如果填 `0` 的话, 将导致无法通过 网站的 `一键安装` 进行安装

你可以在Mod站的游戏页面，按 F12 打开`开发者菜单`，你可在 `GetGameData` 接口中找到 游戏ID:

![](https://mod.3dmgame.com/static/upload/mod/202401/MOD65af2f06e8716.png@webp)


另外，如果Mod站没有此游戏, 可以联系管理员创建此游戏

## steamAppID
- 类型: `number`
- 游戏在Steam中的AppId, 
- 主要用于定位游戏所在目录.

你可以直接在游戏商店找到游戏的 AppId 

## Thunderstore
- 类型: `String`

## installdir
- 类型: `string`
- 游戏安装目录
- 主要用于定位 游戏 主程序所在目录.

eg:
比如说, 赛博朋克2077 的游戏主程序在 `F:\steam\steamapps\common\Cyberpunk 2077\bin\x64\Cyberpunk2077.exe`, 那么这就可以填:
```ts
installdir: join("Cyberpunk 2077", 'bin', 'x64')
// 或
installdir: "Cyberpunk 2077\\bin\\x64"
```

## gameName
- 类型: `string`
- 游戏名称
- 这个将是GMM定位游戏的唯一标识符, 请尽量使用游戏的英文名称, 且不要包含特殊字符

如果 你想 在管理器中将游戏显示为中文, 那么可以导出语言包, 然后在 `我的文档\Gloss Mod Manager\lang\zh_CN.json` 中根据格式新建一行即可. 

## gameExe
- 类型: `string | IGameExe[]`
- 游戏主程序
- 这是用户在选择游戏时，用于判断是否选择了正确的游戏. 以及定位游戏根目录
- 当游戏根目录就和游戏主程序在一起的时候, 只需要填写主程序的名称即可,如: `gameExe: "Palworld.exe"`  
  当游戏有多个主程序在不同目录， 或主程序与游戏根目录不在同一个目录, 那么就需要用到 `IGameExe[]`
- `IGameExe[]` 有两个参数
  - name: `string`
    - 游戏exe名称
  - rootPath: `string`
    - 根目录相对于主程序的路径

示例：
```js
gameExe: [
    {
        name: "Cyberpunk2077.exe",
        rootPath: join("..", "..")  // .. 表示上一级目录
    },
    {
        name: "REDprelauncher.exe",
        rootPath: ""
    }
],
```

## startExe
- 类型: `string | IStartExe[]`
- 游戏启动程序
- 是 选择 "启动游戏" 的时候执行的内容, 当为 `string` 时, 是那么表示只有一种启动方式, 当为 `IStartExe[]` 表示有多中启动方式, 将会出现 下拉框 
-  `IStartExe` 有两个参数
   - name: `string`
     - 下拉框 显示的启动名字
   - exePath: `string`
     - 启动指令

关于启动指令, 
如果是Steam启动, 则直接填: `steam://rungameid/XXX` 即可 (XXX 是Steam APPID)  
如果通过运行程序启动, 则填 `*.exe` 与 游戏根目录的相对路径,如：`join('bin', 'x64', 'Cyberpunk2077.exe')` 

示例:
```js
startExe: [
    {
        name: 'Steam 启动',
        exePath: 'steam://rungameid/1091500'
    },
    {
        name: "直接启动",
        exePath: join('bin', 'x64', 'Cyberpunk2077.exe')
    }
],
```

## gameCoverImg
- 类型: `string`
- 游戏封面图
- 用于在选择游戏的时候, 显示的图片
- 目前我图片用的都是Mod站的封面图, 如果是本地图片的话， 可能会不显示, 所以我这里一般都填网址, 图片比例: `247 / 139` , (别问为什么是这个比例, 我也觉得离谱) 
- 推荐图片： 尺寸 `1200 * 674` 格式 `webp`

## modType
- 类型: `IType[]`
- Mod类型列表
- 这是Mod安装的核心内容, 下一篇将详细介绍这个属性

## checkModType
- 类型: `(mod: IModInfo) => number`
- 自动检查Mod类型
- 根据Mod的内容, 来判断是什么类型的 Mod ,返回值 是 `modType` 的ID

## Thunderstore (可选)
- 类型: `community_identifier: string`
- Thunderstore 的 `community Id`
- 用于获取 Thunderstore 的Mod列表, 如果填写则将会在 `游览` 模块中显示 Thunderstore 的标签

## mod_io (可选)
- 类型：`game_id: number`
- mod.io 的 `game id`
- 用于获取  mod.io 的Mod 列表, 如果填写则会在 `游览` 模块中显示 mod.io 的标签

