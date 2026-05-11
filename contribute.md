# 为 Gloss Mod Manager 贡献

## 汇报Bug
如果您在使用的时候发现了任何问题，请随时在 [GitHub Issues](https://github.com/GlossMod/Gloss-Mod-Manager/issues) 上报告。请尽可能提供详细的信息，例如操作系统、游戏版本、Mod Manager版本以及重现问题的步骤。

请注意， 我目前只会处理由管理器引起的问题， 其他与游戏或Mod本身相关的问题请直接联系Mod作者。


## 贡献代码

目录结构：
```
src/
├── components/      # Vue组件
├── lib/             # 库和工具函数
├── pages/           # 页面组件
├── Expands/         # 游戏拓展
├── stores/          # 状态管理
├── App.vue          # 根组件
├── main.ts          # 入口文件
src-tauri/
├── src/             # Tauri相关代码
├── icons/           # 应用图标
├── Cargo.toml       # Rust依赖配置
├── tauri.conf.json  # Tauri配置
```

## 贡献指南：
1. 下载并安装 [Node.js](https://nodejs.org/) 、 [Rust](https://www.rust-lang.org/tools/install)、Yarn 或 npm。
2. Fork 本仓库并克隆到本地。
3. 创建一个新的分支 `git checkout -b feature/your-feature-name` 或 `git checkout -b bugfix/your-bugfix-name`。
4. 用 vs code 打开项目，在终端运行 `yarn` 安装依赖。
5. 运行 `yarn tauri dev` 启动开发服务器，进行开发和测试。
6. 运行 `yarn tauri build` 构建生产版本。
7. 在开发过程中，请确保你的代码符合项目的[代码风格](/CodeStyle.md)和最佳实践，并且通过了所有相关的测试。
8. 提交你的更改 `git commit -m "Add some feature"`，并推送到你的分支 `git push origin feature/your-feature-name`。
9.  在 GitHub 上创建一个 Pull Request，描述你的更改和相关的背景信息。

注意: 在开发的时候请尽量兼容不同平台（Windows、macOS、Linux），并遵循项目的代码风格和最佳实践。


## 添加新游戏

如果你下为GMM 添加一个新的游戏支持， 请按照以下步骤进行：
1. 在 `src/Expands/` 目录下创建一个新的文件，命名为你的游戏名称，例如 `MyGame.ts`。

示例代码如下：
```typescript
import { join } from "@tauri-apps/api/path";
import { ElMessage } from "element-plus-message";
import { Manager } from "@/lib/Manager";
import { FileHandler } from "@/lib/FileHandler";


export const supportedGames = async () =>
    ({
        GlossGameId: 0, // 3DM Mod 游戏 ID, 找不到可直接设置为 0, 但就不能使用 3DM Mod 游览功能了
        steamAppID: 0, // Steam APP Id
        /**
         *  以 Steam 的 `D:\SteamLibrary\steamapps\common` 目录为基础， 拼接到 游戏 *.exe 的路径
         * 例如： `join("MyGame", "MyGame.exe")` 代表游戏的可执行文件路径为 * * * `D:\SteamLibrary\steamapps\common\MyGame\MyGame.exe`
         */
        installdir: await join(""), 
        gameName: "MyGame", // 游戏名称
        nexusMods:{
            game_domain_name: "",
            game_id: 0,
        },    // Nexus Mods 相关配置项, 没有可直接不填
        /**
         * 游戏可执行文件名称
         * 如果有多个可用使用 数组的形式
         * 如果游戏 exe 不在根目录，则需要再传递 rootPath，如：
         *  gameExe: [
                {
                    name: "Anno117.exe",
                    rootPath: ["..", ".."],
                },
            ],
         */
        gameExe: "MyGame.exe", 
        mod_io: 0, // mod.io 相关配置项, 没有可直接不填
        /**
         * 游戏启动方式,
         * 每项代表一种启动方式, 支持 运行 exe  和 调用 cmd 启动
         */
        startExe:[
             {
                name: "Steam 启动",
                cmd: "steam://rungameid/3274580",
            },
            {
                name: "直接启动",
                exePath: await join("MyGame.exe"),
            },
        ],
        archivePath: await join("MyGame_Mod_Archives"), // 游戏存档位置, 没有可不填，主要用于备份功能
        gameCoverImg: "https://example.com/mygame_cover.jpg", // 游戏封面图片链接
        modType:[
            /**
             * 这里是Mod安装的核心,
             */
            {
                id: 1,  // 唯一且不要重复, 后面有用
                name: "my type",  // 名称，用于显示在UI上
                installPath: await join("mods"), // 安装路径，基于游戏根目录
                async install(mod) {},  // 安装函数, 当点击安装时调用函数, 返回 Boolean 值表示安装是否成功
                async uninstall(mod) {},// 卸载函数, 当点击卸载时调用函数, 返回 Boolean 值表示安装是否成功
            }
        ],
        /**
         * 当Mod被添加到管理器时，会调用这个函数，用于检查Mod的类型，返回一个 modType 的 id， 以便管理器知道使用哪个安装方式来安装这个Mod
         */
        async checkModType(mod){}
    }) as ISupportedGames;

```

### 在添加游戏时可能需要用到的方法：

1. `src\lib\Manager.ts` 类下的快捷安装方法
```typescript

/**
 * 一般安装 (复制文件到指定目录)
 * @param mod
 * @param installPath 安装路径
 * @param keepPath 是否保留路径
 * @returns
 */
public static async generalInstall(
    mod: IModInfo,
    installPath: string,
    keepPath: boolean = false,
    inGameStorage: boolean = true,
): Promise<IState[]> {}

// 一般卸载
public static async generalUninstall(
    mod: IModInfo,
    installPath: string,
    keepPath: boolean = false,
    inGameStorage: boolean = true,
): Promise<IState[]>{}

/**
 * 以某个文件夹为分割 安装/卸载 文件
 * @param mod mod
 * @param installPath 安装路径
 * @param folderName 文件夹名称
 * @param isInstall 是否安装
 * @param include 是否包含文件夹
 * @param spare 是否保留其他文件
 * @returns
 */
public static async installByFolder(
    mod: IModInfo,
    installPath: string,
    folderName: string | string[],
    isInstall: boolean,
    include: boolean = false,
    spare: boolean = false,
): Promise<IState[]>{}

/**
 * 以某个文件为基础 将其父级目录软链 进行 安装/卸载
 * @param mod mod
 * @param installPath 安装路径
 * @param fileName 文件名称
 * @param isInstall 是否是安装
 * @param isExtname 是否按拓展名匹配 = false
 * @param inGameStorage 是否在游戏目录 = true
 * @param isLink 是否是软链 = true
 * @param commonParent 过滤掉相同路径的文件夹 = false
 */
public static async installByFile(
    mod: IModInfo,
    installPath: string,
    fileName: string,
    isInstall: boolean,
    isExtname: boolean = false,
    inGameStorage: boolean = true,
    isLink: boolean = true,
    commonParent: boolean = false,
) : Promise<IState[]>{}

/**
 * 以某个文件为基础, 将该文件同级的所有文件安装/卸载 Mod
 * @param mod mod
 * @param installPath 安装路径
 * @param fileName 文件名 | 拓展名
 * @param isInstall 是否是安装
 * @param isExtname 是否按拓展名匹配
 * @param inGameStorage 是否在游戏目录
 * @param pass 跳过的文件列表 (小写)
 * @returns
 */
public static async installByFileSibling(
    mod: IModInfo,
    installPath: string,
    fileName: string,
    isInstall: boolean,
    isExtname: boolean = false,
    inGameStorage: boolean = true,
    pass: string[] = [],
) : Promise<IState[]>{}

/**
 * 以某个文件夹为基础，将其父级目录软链 进行 安装/卸载
 * @param mod mod
 * @param installPath 安装路径
 * @param folderName  文件夹名称
 * @param isInstall  是否安装
 * @param inGameStorage 是否在游戏目录
 * @returns
 */
public static async installByFolderParent(
    mod: IModInfo,
    installPath: string,
    folderName: string,
    isInstall: boolean,
    inGameStorage: boolean = true,
) : Promise<IState[]>{}

```