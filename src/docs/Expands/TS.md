
如果你有一定的开发基础，那么可以来试试自己制作GMM的游戏适配.

部分游戏适配参考: https://github.com/GlossMod/gmm-expands

测试用的一个示例项目: [Github](https://github.com/GlossMod/gmm-api/blob/master/test/src/index.ts)

两个可能有用的参考文件: [Manager.ts](https://github.com/GlossMod/gmm-api/blob/master/test/src/Manager.ts) | [FileHandler.ts](https://github.com/GlossMod/gmm-api/blob/master/test/src/FileHandler.ts) (你可以直接将其引入到你的项目中)

## 前置工具

- [VS Code](https://code.visualstudio.com/)
- [Node.js](https://nodejs.org/en)
- [yarn](https://yarnpkg.com/) (可选)

## 安装 Yarn 和 TypeScript (已安装则跳过)

终端输入
```sh
npm install -g typescript yarn
```


## 初始化项目

新建一个文件夹, 用 VS Code 打开, 在终端输入
```sh
yarn init -y
yarn add @types/node typescript gmm-api -D
npx tsc --init
```

打开 `package.json` 文件，在里面添加:
```json
"scripts": {
    "build": "tsc --outDir dist"
}
```

## 入口文件

新建一个 `src/index.ts` 文件, 添加
```ts
import { ISupportedGames } from "gmm-api";

export const supportedGames: ISupportedGames = {

}
```

如果你安装了vs code 的ts 插件，那么你应该能看到报错信息，选择快速修复 "添加缺少的属性"
![](https://mod.3dmgame.com/static/upload/mod/202401/MOD65af29b613442.png@webp)

将会自动不全缺少的属性:
![](https://mod.3dmgame.com/static/upload/mod/202401/MOD65af2b1994ac1.png@webp)

## 编译/生成

当你完成代码的编写后, 可以使用 `build` 进行编译
```sh
yarn run build 
```

这回将你的 `index.ts` 编译为 `index.js`，并输出到 `dist`目录, 

## 安装

最新版本的 GMM ，将会创建一个 `我的文档/Gloss Mod Manager/Expands` 的空文件夹, ， 你需要在里面新建一个文件夹(随你自定义)，然后你需要将最终的 `index.js` 文件放入你的文件夹里面  
例如：  
```sh
Expands  
└── Cyberpunk2077  
    └── index.js  
```

GMM 会读取 index.js 文件, 并自动引入和解析，如何你有其他的依赖文件, 请一起放进去，除非你已经将所有需要的依赖打包到同一个文件中了. 

> 但我不会将多个 ts 打包到一个 js 中, 如果你会的话可以点击下方的编辑按钮直接在这里写

