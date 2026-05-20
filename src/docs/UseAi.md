# 使用 AI 对话

## 介绍

V2 版本最大的特色就是内嵌了 AI 对话功能，它不仅仅是一个对话，还能一定程度的操作你的mod文件，帮你解决一些常见或不常见的问题。


## 配置方法

1. 访问并注册 [Glosc AI One](https://one.gloscai.com/sign-up?aff=lm6z)
2. 进入 [API Key](https://one.gloscai.com/keys)，点击 "创建 API 密钥"
3. 输入任意名称，点击保存
4. 复制刚刚创建的API密钥，应该是 `sk-xxxxxxxxx`
5. 打开 Gloss Mod Manager，进入设置界面， AI 配置
6. 填入 API Key，API 地址为 `https://one.gloscai.com/v1`

![](https://assets-mod.3dmgame.com/static/upload/mod/202605/MOD6a0c313fba743.png)


## 使用方法

1. 打开 “AI 对话” 界面，选择一个你喜欢的`模型`. (如果没有模型列表则可用点击 "刷新模型" 或 按 Ctrl+R 刷新)
2. 工具内嵌了几个 skills ，你可用使用他们来处理一些操作.
    > 你可用在 [skills](https://github.com/GlossMod/Gloss-Mod-Manager/tree/v2/src/skills) 目录下分享你的 skills 给我们
3. 在对话框中用自然语言描述你的问题

## 常用提问方式

### 添加游戏到管理器
> 使用「gloss-mod-manager」skill, 帮我将游戏 `D:\SteamLibrary\steamapps\common\BlackMythWukong` 添加到管理器

### 安装所需前置
> 帮我为当前游戏安装所有需要的前置mod

### 下载新的mod
> 使用「mod-download-and-install」skill, 帮我下载一些 `角色/武器/玩法/优化` 相关的mod

### 整理mod
> 帮我整理mod，使用 `中文` 命名, 用标签进行分类，并按标签排序
> 帮我分析有哪些mod存在冲突，帮我标记出来

### 安装mod
> 使用「mod-download-and-install」skill, 帮我安装所有mod
> 使用「mod-download-and-install」skill, 帮我安装与角色相关的mod
> 使用「mod-download-and-install」skill, 帮我安装 `xxx mod` 所需的最少前置

### 卸载mod
> 使用「mod-download-and-install」skill, 帮我卸载所有mod
> 使用「mod-download-and-install」skill, 帮我卸载与角色相关的mod

### 分析错误
> 使用「mod-not-working-troubleshooting」skill, 帮我分析为什么 `xxx mod` 无法正常工作，并尝试帮我解决
> 使用「mod-not-working-troubleshooting」skill, 帮我解决游戏打不开的问题


