# 更新源配置

## 概述
本次更新为 Gloss Mod Manager 添加了根据安装来源自动选择更新方式的功能。

## 功能特性

### 1. 自动检测安装来源
- 自动检测应用是否来自微软应用商店（APPX包）
- 检测逻辑包括：
  - 检查 `process.windowsStore` 标志
  - 检查 `process.env.APPX_PACKAGE_NAME` 环境变量
  - 检查可执行文件路径是否包含 `WindowsApps`
  - 检查是否匹配微软应用商店的安装路径模式

### 2. 不同更新策略
- **微软应用商店版本**：
  - 禁用自动更新下载
  - 禁用自动安装
  - 提示用户前往应用商店更新
  - 提供直接打开应用商店的功能

- **安装包版本**：
  - 启用自动更新下载
  - 启用自动安装
  - 使用配置的更新服务器

### 3. 新增的IPC接口

#### 获取更新来源信息
```typescript
// 主进程 -> 渲染进程
ipcRenderer.invoke('get-update-source')
// 返回: { isFromMicrosoftStore: boolean, source: string }
```

#### 打开微软应用商店更新页面
```typescript
// 主进程 -> 渲染进程
ipcRenderer.invoke('open-microsoft-store-update')
// 返回: { success: boolean, message: string }
```

#### 新增的渲染进程事件
```typescript
// 当检测到微软应用商店版本时发送
ipcRenderer.on('update-from-store', (event) => {
    // 处理应用商店更新提示
})

// 应用启动时发送更新源信息
ipcRenderer.on('update-source-info', (event, info) => {
    // info: { isFromMicrosoftStore: boolean, source: string }
})
```

## 技术实现

### 1. 微软应用商店检测
```typescript
const isFromMicrosoftStore = (() => {
    const execPath = app.getPath('exe')
    const isAppx = process.windowsStore || 
                   process.env.APPX_PACKAGE_FULL_NAME || 
                   process.env.APPX_PACKAGE_NAME ||
                   execPath.includes('WindowsApps') ||
                   /WindowsApps.*?\.exe$/i.test(execPath)
    return isAppx
})()
```

### 2. 条件化的更新事件处理
所有 `autoUpdater` 事件监听器都添加了条件判断，只在非应用商店版本时向渲染进程发送事件。

### 3. 构建配置更新
- 在 `electron-builder.json5` 中为不同的构建目标配置了不同的发布策略
- 支持 NSIS 安装包和 APPX 包的构建

## 使用方式

### 前端检查更新来源
```javascript
// 获取更新来源信息
const updateSource = await window.ipcRenderer.invoke('get-update-source')
if (updateSource.isFromMicrosoftStore) {
    console.log('当前为微软应用商店版本')
} else {
    console.log('当前为安装包版本')
}
```

### 处理更新
```javascript
// 检查更新
const updateResult = await window.ipcRenderer.invoke('check-for-updates')
if (updateResult.fromStore) {
    // 微软应用商店版本，显示提示
    showStoreUpdateDialog()
} else {
    // 安装包版本，正常处理自动更新
    handleAutoUpdate()
}
```

## 日志和调试
- 所有更新来源检测信息都会输出到控制台
- 包括可执行文件路径、环境变量、平台信息等
- 便于调试和问题排查

## 注意事项
1. 微软应用商店版本不能使用自动更新，必须通过应用商店更新
2. 需要在应用商店中配置正确的应用ID
3. 建议在前端UI中根据不同的更新来源显示不同的提示信息
