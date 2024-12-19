---
title: 翻译 Gloss Mod Manager
---

# Gloss Mod Manager

### 翻译软件

如果您愿意帮助我们将 GMM 翻译成您的语言,您可以这样操作：

- 在[设置](#/Settings) 中点击 “导出语言包”, 
- 导出的语言包会在`我的文档\Gloss Mod Manager\lang`中.
- 复制一份您熟悉的语言(我们会优先更新 简体中文 和 English 的语言包)
- 修改 `data:code` 为您的语言代码 (记得注意json格式规范)
- 在管理器里面按`Ctrl + R`重载管理器, 即可在设置页面的语言列表里面看到您的文本
- 使用您喜欢的文本编辑器打开`*.json`文件, 然后进行翻译.
- 您可以随时按`Ctrl + R`重载管理器来即时查看翻译.

 你可以将翻译好的语言文件，推送到 [GitHub](https://github.com/GlossMod/Gloss-Mod-Manager-info) , 我将在下一个版本中将你的翻译添加到管理器中.

### 1.51.0 机制更新

**注意： 旧的语言包现在已不支持, 请您手动更新为新版本的语言包**

现在， 语言包支持 读取 子目录的 `*.json` 文件, 例如 `zh_CN\Cyberpunk 2077.json` , 这样可以更好的管理多个语言文件.
只需要 data.code 为正确的语言代码即可. 


### 语言包示例

```json
{
    "data": {
        "name": "简体中文",
        "code": "zh_CN",
        "author": "",
        "version": "1.51.0"
    },
    "Language": {
        // 具体翻译 
        "Cyberpunk 2077": "赛博朋克2077"
    }
}
```

### 读取顺序

管理器会按照文件名进行读取, 越靠后的文件会覆盖前面的文件
