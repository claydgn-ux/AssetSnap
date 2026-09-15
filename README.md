# AssetSnap

> Fast webpage image capture for Tampermonkey.  
> 快速抓取网页图片、优先高清来源、可选格式转换，并直接保存到浏览器默认下载目录。

**Current release:** `AssetSnap_v0.2.0-CL`  
**Platforms:** macOS / Windows  
**Browsers:** Chrome / Edge + Tampermonkey

## Features

- `D + Click`：默认快捷下载模式。
- 连续下载模式：开启后直接点击图片即可保存。
- 优先识别网页提供的高清 / 原图来源。
- Hover 时尽量显示目标分辨率与 `高清原图 / 当前显示图`。
- 下载完成后显示缩略图、分辨率、文件大小、最终格式等信息。
- 输出格式可选：保持原格式 / 统一 JPG / 统一 PNG。
- 格式转换失败时优先保住图片，自动退回原格式下载。
- 统一文件名：`AssetSnap#yyyy-MM-dd_HH-mm-ss.ext`。
- 同一秒多张图片自动追加 `_01`、`_02`……
- 用户设置通过 Tampermonkey 持久保存。
- 一个脚本同时支持 macOS / Windows。

## Install

### GitHub 安装

1. 安装 Tampermonkey。
2. 在本仓库打开 `AssetSnap_v0.2.0-CL.user.js`。
3. 点击 GitHub 文件页面右上方的 **Raw**。
4. Tampermonkey 应打开安装页面。
5. 确认安装并启用 AssetSnap。

如果浏览器没有自动进入 Tampermonkey 安装页面，也可以在 Tampermonkey Dashboard 中新建脚本，将 `.user.js` 的完整内容粘贴后保存。

## Usage

### 默认模式

把鼠标移动到图片上，按住 `D` 后左键点击图片。

### 连续下载

点击网页右侧 AssetSnap 小胶囊的开关区域。开启后可以直接连续点击图片下载；再次点击开关或按 `Esc` 退出。

### 设置

点击胶囊右侧的下载小图标打开设置。可以修改：

- 快捷键
- 图片来源策略
- 输出格式
- 同名文件策略
- 下载完成提示
- 输入框保护

保存位置由浏览器默认下载目录决定。

## Output naming

AssetSnap 不使用网站原始文件名作为默认保存名称。

```text
AssetSnap#yyyy-MM-dd_HH-mm-ss.ext
```

示例：

```text
AssetSnap#2026-09-15_12-30-08.jpg
AssetSnap#2026-09-15_12-30-08_01.jpg
```

扩展名始终以最终实际保存格式为准。

## Documentation

完整使用说明：

- [`docs/AssetSnap_使用手册_v0.2.0-CL.md`](docs/AssetSnap_使用手册_v0.2.0-CL.md)

## Current limitations

- 不支持在脚本内部指定 macOS / Windows 任意绝对保存路径。
- 保存位置使用浏览器默认下载目录。
- 尚未加入站点专用适配器。
- 部分跨域、防盗链、授权或特殊图片实现的网站可能只能退回浏览器直接下载路径。
- 图片格式转换属于 best-effort；转换失败不会阻止原图下载。

## Version

```text
Product ID: AssetSnap
Release Identity: AssetSnap_v0.2.0-CL
Version: 0.2.0
Owner: CL
```

## License

AssetSnap 使用 **AssetSnap Non-Commercial License v1.0**。完整条款见 [`LICENSE`](LICENSE)。

简要说明：

- 允许个人、教育、研究以及公司 / 组织内部免费使用。
- 允许复制、查看源代码、修改，并免费分享原版或修改版。
- 免费再分发时必须保留版权声明与本许可证，并说明重大修改。
- 禁止出售 AssetSnap 或其修改版。
- 禁止以下载费、订阅费、授权费、付费软件包等方式收费分发 AssetSnap。
- 如需进行许可证禁止的商业分发、转售或付费打包，必须另行取得版权所有者的书面许可。

> 这是一份自定义许可，并非 MIT / GPL 等 OSI 标准开源许可证。
