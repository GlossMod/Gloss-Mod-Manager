---
titleTemplate: Gloss Mod Manager
---

# 生化危机系列 Mod 安装教程

生化危机2、3、4、7、8 的安装方法大同小异，这一片文章将直接讲解这个系列的Mod安装方法以及一些需要注意的地方. 

## 前置工作

1. 下载并安装 [Gloss Mod Manager](https://mod.3dmgame.com/mod/197445)
2. 下载 前置包 [生化危机 Mod前置包](https://pan.aoe.top/GMM/Requirements)


## 选择游戏

在安装完 Gloss Mod Manager 后, 启动程序, 然后找到 生化危机 , 选择游戏运行程序:
![](https://mod.3dmgame.com/static/upload/mod/202401/MOD65a0d30a79dd8.png@webp)

## 安装前置

生化危机 的Mod前置有两个：
- REFramework: REF 框架，是FirstNatives 的前置
- FirstNatives (可选): 最初是由 nfh994 为怪物猎人崛起 开发的一个插件， 使游戏能优先的加载 `natives` 文件夹里面的内容，由 [FluffyQuack](https://github.com/FluffyQuack/FirstNatives/tree/Fluffy) 适配支持 生化危机 系列.

> 为什么说 FirstNatives 是可选的呢? 因为在 REFramework 1.5.5 版本，更新了支持 加载 natives 文件夹的功能，所以在 1.5.5 版本之后，理论上不需要 FirstNatives 了, 但这个功能是需要手动开的，如果你不想手动开启这个功能，那么就可以安装 FirstNatives 插件.
> ![](https://mod.3dmgame.com/static/upload/mod/202504/MOD68104246c0bf5.png@webp)
> 另外, REFramework 自带的 `natives` 加载功能是有问题的, 需要在开启后 重启游戏才可能会生效

需要注意一下的是，生化危机2、3 是分为 光追版(rt) 和 非光追版(dx11_not-rt), REFramework 也分了光追版 和非光追版, 前置包在安装的时候有进行标明，在安装的时候根据自己游戏的版本二选一进行导入，不要全部丢进去了！

现在(2024年1月) Steam默认下载的是 光追版, 你可以在 steam库里面右键游戏->属性->测试版->参与测试 中切换为 非光准版

另外, 前置包中提供的 REFramework 是适用于 Steam 正版的前置文件, 如果你用的是其他版本的游戏, 请自行查找对应版本的 REFramework 插件. 

## 安装Mod

你可以去任意地方下载你想要的Mod, 下面给出几个下载 生化危机 Mod的网站:

- 3DM Mods: 
  - https://mod.3dmgame.com/BIO2RE
  - https://mod.3dmgame.com/BIO3RE
  - https://mod.3dmgame.com/RE4
  - https://mod.3dmgame.com/ResidentEvilVillage
- Nexus Mods: 
  - https://www.nexusmods.com/residentevil22019/mods/
  - https://www.nexusmods.com/residentevil32020/mods/
  - https://www.nexusmods.com/residentevil42023/mods/
  - https://www.nexusmods.com/residentevilvillage/mods/

然后将下载的压缩包 添加到 管理器中, 即可进行自动安装和卸载.

## Mod无效

如果你进游戏没有找到你的Mod，那么你先进行检查：
1. 左上角有没有 REFramework 的框
   ![](https://mod.3dmgame.com/static/upload/mod/202401/MOD65a0d9e6ae8a5.png@webp)
2. FirstNatives插件是否启用
   展开 `PluginLoader` 查看里面是否有 FirstNatives
   ![](https://mod.3dmgame.com/static/upload/mod/202401/MOD65a0da1a323fa.png@webp)
3. 你的游戏版本和Mod版本是否匹配 (指光追版本和非光追版本)

4. 如果你的 REFramework 框无法关闭且显示错误, 这说明你的游戏版本和 REFramework 版本不匹配，解决方法大概为：
   - 如果你是学习版，那么自行去查找对应版本的 REFramework;
   - 如果你是Steam版，那么就是 光追版本不对，自行选择是更换游戏版本，还是更换 REFramework 版本，这两个肯定要对应上
   - 显示下图这种样子，就表明是 REFramework框架版本和你游戏版本不匹配
     ![](https://mod.3dmgame.com/static/upload/mod/202401/MOD65a0dc41c41c0.png@webp)
5. 请确保你已经换上了对应的服装, 部分Mod需要DLC才能使用;
6. 确保Mod的版本和你的游戏版本匹配，光追和非光追版本的Mod与游戏不互相兼容，你需要自行判断是更换游戏版本还是Mod版本。
7. 使用 [FLUFFY MANAGER 5000](https://fluffyquack.com/tools/modmanager.zip) 进行安装Mod. (这款管理器是英文的, 没有汉化)
8.  开启 `LooseFileLoader` 功能
  ![](https://mod.3dmgame.com/static/upload/mod/202504/MOD68104246c0bf5.png@webp)

以上方法均试过了，都没有解决，那么就是Mod的问题，换一个的Mod吧


