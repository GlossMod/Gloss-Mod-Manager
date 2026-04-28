---
titleTemplate: Gloss Mod Manager
---

# 下载失败

## 问题1：Aria2 连接失败
![](https://mod.3dmgame.com/static/upload/mod/202502/MOD67ac6fdec0318.png@webp)

解决方法:
 - 手动运行 `手动运行 Gloss Mod Manager\resources\aria2\run.bat` ; 
 - 让其一直保持开启状态, 然后再重新启动 GMM


## 问题2：一直处于等待状态
这个问题已经在 1.20.1 版本完全修复. 
如果您的管理器版本过低，请尽快[更新](https://github.com/GlossMod/Gloss-Mod-Manager/releases)到最新版本的GMM

如果已是最新版本，依然出现这个问题，请先检查，你是否有装别的下载器，目前已知与 [Motrix](https://github.com/agalwood/Motrix) 存在冲突, 需要将其关闭才能使用GMM的内置下载

另外，如果你启用了防火墙，记得允许访问网络. 

如果以上方法均不行，可以尝试 按 ` Ctrl+R ` 然后点击 `重新下载` 按钮
![](https://mod.3dmgame.com/static/upload/mod/202408/MOD66b2c8034f4e8.png@webp)

## 问题3：写入文件失败

可能是卡了，点击 下载=》打开文件夹，将这个目录中的所有文件全部删掉，然后在管理器中按`Ctrl+R`，再重新下载
![](https://mod.3dmgame.com/static/upload/mod/202311/MOD655eb5c58e590.png@webp)
![](https://mod.3dmgame.com/static/upload/mod/202311/MOD655eb633945e0.png@webp)

## 问题4：储存目录存在中文

虽然管理器兼容中文，但有时候中文的兼容总是有问题，你可以尝试将 设置=》储存位置 换一个 英文路径试试.


![](https://mod.3dmgame.com/static/upload/mod/202311/MOD655ec63d66daf.png@webp)
