---
title: 无法启动
---

## 无法启动软件

首先，GMM 是不兼容win7系统的，如果你使用的是win7，那么请[升级Win10](https://www.microsoft.com/zh-cn/software-download/windows10)

其次，GMM 只做了 x64 版本, 32位系统可能无法运行, 如果你是32位系统，那么建议你更换 64 位.

### 确认系统无误, 依然无法启动?

那么你可以尝试以下方法：
 - 更新你的显卡驱动到最新版本.
 - 将软件安装到C盘. (默认路径)
 - 禁用沙盒模式
   - 右键快捷方式，属性，在目标后面加个 --no-sandbox
 - 禁用硬件加速
 - 重新安装软件

如果以上方法无法解决你的问题, 那么请提供错误日志, 获取方法:
- Ctrl+R, 输入 cmd
- 在控制台输入 ` "F:\app\Gloss Mod Manager\Gloss Mod Manager.exe" `
  - 其中 `F:\app\Gloss Mod Manager\` 是管理器安装路径
  - 输入时需包含双引号
- 然后将控制台报错的内容反馈给我
