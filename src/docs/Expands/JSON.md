# JSON 适配

~~在 v1.29.0 版本, 我们将 游戏适配部分进行了开源, 这将允许所有玩家和开发者来制作自己想要适配的游戏.~~


在 v1.36.0 版本, 我对自定义拓展进行了简化，改用`json`格式来适配, 1.29.0版本的适配方式由于难度太高, 这次更新将适配的门槛进行了大量的降低, 但缺点是没有使用`TS`的扩展性高, 你可以根据自己的能力来选择



## 前置工具
- [vs code](https://code.visualstudio.com/)


## JSON参数解释

[更详细的属性](Property.md)

```json
{
    "GlossGameId": 0,           // Mod站的游戏ID, number 类型
    "steamAppID": 0 ,           // 游戏在Steam中的AppId, number 类型
    "installdir": "",           // 游戏安装目录, string 类型
    "gameName": "",             // 游戏名称, string 类型, 尽量英文
    "gameExe":  "",             // 游戏主程序， string | IGameExe[] 类型
    "startExe": "",             // 游戏启动程序, string | IStartExe[] 类型
    "gameCoverImg": "",         // 游戏封面, string 类型
    "modType": [
        {
            "id": 1,            // 类型的唯一标识符, number 类型
            "name": "",         // 在管理界面显示的名称
            "installPath": "",  // 安装路径
            "install": {
                // UseFunction 参考 https://gist.github.com/3DMXM/ed15e18a1442d69bfafcb05534561fc4
                // "generalInstall" | "generalUninstall" | "installByFolder" | "installByFile" | "installByFileSibling" | "installByFolderParent" | "Unknown"
                // 其他参数是传递到 UseFunction 里面的值, 只需要填 UseFunction 需要的即可, 均有注释.
                "UseFunction": "",
                "folderName": "",
                "isInstall":true | false,   // 是安装还是卸载
                "fileName": "",             // 文件名称 或 拓展名(.*)
                "include": true | false,    
                "spare": true | false,
                "keepPath": true | false,
                "isExtname": true | false,
                "inGameStorage": true | false,
                "pass": [],
            },
            "uninstall": {
                // 同上 install
                ...
            }
        }
    ],
    "checkModType": [
        {
            // "extname"    通过拓展名判断 
            // "basename"   通过文件名判断
            // "inPath"     通过路径判断
            "UseFunction": "",
            "Keyword": [],      // 文件名 或 拓展名 或 路径包含
            "TypeId": 1,        // 如果包含则返此ID
        }
    ]
}
```


## 接口结构

这是TS 解析的时候的接口

```ts
export type InstallUseFunction = "generalInstall" | "generalUninstall" | "installByFolder" | "installByFile" | "installByFileSibling" | "installByFolderParent" | "Unknown"

export interface IGameExe {
    name: string
    rootPath: string
}
export interface IStartExe {
    name: string
    exePath: string
}

export interface IGameInfo {
    GlossGameId: number
    steamAppID: number
    installdir?: string
    gameName: string
    gameExe: string | IGameExe[]
    startExe?: string | IStartExe[]
    gamePath?: string
    gameVersion?: string
    gameCoverImg?: string
    NexusMods?: {
        game_id: number
        game_domain_name: string
    },
    Thunderstore?: {
        community_identifier: string
    },
    mod_io?: {
        game_id: number
    }
}

export interface IState {
    file: string,
    state: boolean
}

interface IAdvancedItem {
    type: "input" | "selects" | "switch"
    label: string
    key: string
    selectItem?: { name: string, value: string }[]
    defaultValue?: string | boolean
}

export interface ITypeInstall {
    UseFunction: InstallUseFunction
    folderName?: string
    isInstall?: boolean
    fileName?: string
    include?: boolean
    spare?: boolean
    keepPath?: boolean
    isExtname?: boolean
    inGameStorage: boolean
    pass?: string[]
}

export interface ICheckModType {
    UseFunction: "extname" | "basename" | "inPath"
    Keyword: string | []
    TypeId: number
}

export interface IType {
    id: number
    name: string
    installPath?: string
    advanced?: {
        name: string
        icon: string
        item: IAdvancedItem[]
    }
    install: ((mod: IModInfo) => Promise<IState[] | boolean>) | ITypeInstall
    uninstall: (mod: IModInfo) => Promise<IState[] | boolean> | ITypeInstall
    checkPlugin?: (plugin: IModInfo) => boolean
}

export interface ISupportedGames extends IGameInfo {
    modType: IType[]
    checkModType: (mod: IModInfo) => number | ICheckModType[]
    sortMod?: (list: IModInfo[]) => boolean
}
```



## 示例

直接通过一个示例来解释 `json` 适配的方式吧：
```json
{
    "GlossGameId": 344,
    "steamAppID": 2420110,
    "installdir": "Horizon Forbidden West Complete Edition",
    "gameName": "Horizon Forbidden West",
    "gameExe": "HorizonForbiddenWest.exe",
    "startExe": [
        {
            "name": "Steam 启动",
            "exePath": "steam://rungameid/2420110"
        },
        {
            "name": "直接启动",
            "exePath": "HorizonForbiddenWest.exe"
        }
    ],
    "gameCoverImg": "https://mod.3dmgame.com/static/upload/game/65fd1629ab1c6.webp",
    "modType": [
        {
            "id": 1,
            "name": "stream",
            "installPath": "LocalCacheWinGame\\package\\mods",
            "install": {
                "UseFunction": "installByFileSibling",
                "fileName": ".stream",
                "isInstall": true,
                "isExtname": true,
                "inGameStorage": true,
                "pass": []
            },
            "uninstall": {
                "UseFunction": "installByFileSibling",
                "fileName": ".stream",
                "isInstall": false,
                "isExtname": true,
                "inGameStorage": true,
                "pass": []
            }
        },
        {
            "id": 2,
            "name": "core",
            "installPath": "LocalCacheWinGame\\package\\mods",
            "install": {
                "UseFunction": "installByFileSibling",
                "fileName": ".core",
                "isInstall": true,
                "isExtname": true,
                "inGameStorage": true,
                "pass": []
            },
            "uninstall": {
                "UseFunction": "installByFileSibling",
                "fileName": ".core",
                "isInstall": false,
                "isExtname": true,
                "inGameStorage": true,
                "pass": []
            }
        },
        {
            "id": 99,
            "name": "未知",
            "installPath": "\\",
            "install": {
                "UseFunction": "Unknown"
            },
            "uninstall": {
                "UseFunction": "Unknown"
            }
        }
    ],
    "checkModType": [
        {
            "UseFunction": "extname",
            "Keyword": [
                ".stream"
            ],
            "TypeId": 1
        },
        {
            "UseFunction": "extname",
            "Keyword": [
                ".core"
            ],
            "TypeId": 2
        }
    ]
}

```
## 安装

将`json`文件放到 `我的文档\Gloss Mod Manager\Expands` 目录， 然后在管理器里面按 `Ctrl+R` 刷新, 即可在`选择游戏`里面的最后面找到你自己新增的游戏了。
