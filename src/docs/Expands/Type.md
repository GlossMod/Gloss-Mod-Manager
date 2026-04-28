---
titleTemplate: Gloss Mod Manager
---

# Mod 类型

每款游戏的Mod安装方法都各有不同，不同的类型也有不同的安装方法, 

为了能方便大家更好的适配更多种类型, 我设计之初就分成了各种类型.

## 接口

```ts
interface IType {
    id: number
    name: string
    installPath?: string
    advanced?: {
        name: string
        icon: string
        item: IAdvancedItem[]
    }
    install: (mod: IModInfo) => Promise<IState[] | boolean>
    uninstall: (mod: IModInfo) => Promise<IState[] | boolean>
}
```

- id:
  - 类型的唯一标识符
- name:
  - 在管理界面显示的名称
- installPath:
  - 安装路径
- install:
  - 安装时执行的方法
- uninstall:
  - 卸载时执行的方法
- advanced:
  - 高级选项, 如果该类型需要用户进行自定义配置, 则可可以使用这个配置项,
  - 我在 [GTA5.ts](https://github.com/GlossMod/gmm-expands/blob/bef6a6d9f10390592725fb7832bae5975a35fdf1/GTA5.ts#L777) 里面有写过相关的类型, 可供各位参考

## 游戏目录和Mod目录

你可以通过下面这种方法来获取这两个配置项
 https://github.com/GlossMod/gmm-api/blob/master/test/src/Manager.ts#L294

```ts
export class Config {
    // Mod储存目录
    public static modStorage = (() => {
        let config = this.getConfig()
        return join(config.modStorageLocation, config.managerGame?.gameName ?? "")
    })()

    // 游戏储存目录
    public static gameStorage = (() => {
        let config = this.getConfig()
        return config.managerGame?.gamePath ?? ""
    })()

    public static configFolder() {
        let ConfigFolder = join(homedir(), 'My Documents', 'Gloss Mod Manager')
        if (!FileHandler.fileExists(join(homedir(), 'My Documents'))) {
            ConfigFolder = join("C:", 'Gloss Mod Manager')
        }
        return ConfigFolder
    }

    // 配置文件路径
    public static configFile() {
        const configPath = join(this.configFolder(), 'config.json')
        FileHandler.ensureDirectoryExistence(configPath, '{}')
        return configPath
    }

    // 读取配置文件
    public static getConfig(): ISettings {
        let config = readFileSync(this.configFile(), 'utf-8')
        let settings: ISettings = JSON.parse(config)
        return settings
    }
}

```

使用：
```ts
// 获取 Mod所在目录
let modStorage = join(Config.modStorage, mod.id.toString())

// 游戏目录
let gameStorage = Config.gameStorage
```



