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

参考文档 https://gmm.aoe.top/docs/Expands