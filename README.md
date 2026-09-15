# AssetSnap

> Fast webpage image capture for Tampermonkey.  
> 快速抓取网页图片、优先高清来源、可选格式转换，并直接保存到浏览器默认下载目录。

**Current release:** `AssetSnap_v0.3.1-CL`  
**Platforms:** macOS / Windows  
**Browsers:** Chrome / Edge + Tampermonkey

## Features

- `D + Click`：默认快捷下载模式。
- 快捷触发键可自定义为单个字母、数字，或 `Shift / Option(Alt) / Control(Ctrl) / Command(Meta)`。
- 修饰键快捷方式可在普通网页输入框仍有焦点时使用，适合 ChatGPT、搜索框、编辑器等页面。
- 字母 / 数字快捷键继续受“输入框保护”控制，正常打字不会触发抓图。
- 连续下载模式：开启后直接点击图片即可保存。
- 优先识别网页提供的高清 / 原图来源。
- Hover 时尽量显示目标分辨率与 `高清原图 / 当前显示图`。
- 下载完成后显示缩略图、分辨率、文件大小、最终格式等信息。
- 输出格式可选：保持原格式 / 统一 JPG / 统一 PNG。
- 格式转换失败时优先保住图片，自动退回原格式下载。
- 可自定义 `#` 前的命名前缀；默认前缀为 `AssetSnap`。
- 固定命名结构：`<自定义前缀>#yyyy-MM-dd_HH-mm-ss.ext`。
- 同一秒多张图片自动追加 `_01`、`_02`……
- 用户设置通过 Tampermonkey 持久保存。
- 一个脚本同时支持 macOS / Windows。

## Install

### GitHub 安装

1. 安装 Tampermonkey。
2. 在本仓库打开 `AssetSnap_v0.3.1-CL.user.js`。
3. 点击 GitHub 文件页面右上方的 **Raw**。
4. Tampermonkey 应打开安装页面。
5. 确认安装并启用 AssetSnap。

如果浏览器没有自动进入 Tampermonkey 安装页面，也可以在 Tampermonkey Dashboard 中新建脚本，将 `.user.js` 的完整内容粘贴后保存。

## Usage

### 默认模式

把鼠标移动到图片上，按住 `D` 后左键点击图片。

### 在 ChatGPT / 搜索框 / 编辑器页面使用

如果网页经常保持输入框焦点，建议把快捷键改成修饰键：

1. 打开 AssetSnap 设置。
2. 点击“快捷键”右侧当前快捷键。
3. 直接按一次 `Option`、`Shift`、`Control` 或 `Command`；Windows 可使用 `Alt`、`Shift`、`Ctrl`。
4. 之后按住该键，再左键点击图片。

修饰键模式不会因为网页输入框仍有焦点而被“输入框保护”拦截。

不同网站 / 浏览器可能自身占用某些修饰键点击行为；如果某个键冲突，换用另一个修饰键即可。

### 连续下载

点击网页右侧 AssetSnap 小胶囊的开关区域。开启后可以直接连续点击图片下载；再次点击开关或按 `Esc` 退出。

### 设置

点击胶囊右侧的下载小图标打开设置。可以修改：

- 快捷触发键
- 图片来源策略
- 输出格式
- 同名文件策略
- 文件命名前缀
- 下载完成提示
- 输入框保护

保存位置由浏览器默认下载目录决定。

### 修改命名前缀

在“文件命名”一行点击铅笔按钮：

1. 输入新的前缀，例如 `Harper`。
2. 点击 `✓` 或按 `Enter` 保存。
3. 按 `Esc` 可取消本次编辑，保留上一次已保存的前缀。

`#`、日期时间、同秒序号和扩展名由 AssetSnap 自动添加，不需要手动输入。

## Output naming

AssetSnap 不使用网站原始文件名作为默认保存名称。

默认：

```text
AssetSnap#yyyy-MM-dd_HH-mm-ss.ext
```

自定义为 `Harper` 后：

```text
Harper#2026-09-15_16-30-08.jpg
Harper#2026-09-15_16-30-08_01.jpg
```

命名前缀不能包含 `# / \\ : * ? " < > |` 或控制字符，也不能以点开头、以前后空白结束。扩展名始终以最终实际保存格式为准。

## Documentation

完整使用说明：

- [`docs/AssetSnap_使用手册_v0.3.1-CL.md`](docs/AssetSnap_使用手册_v0.3.1-CL.md)

## Current limitations

- 当前快捷键是“一个触发键 + 左键”，不提供多键组合模板。
- 某些网站或浏览器可能自行占用特定修饰键点击行为；可改用另一个触发键。
- 不支持完整自定义命名模板；只开放 `#` 前的前缀。
- 不支持自定义 `#` 分隔符或日期时间格式。
- 不支持在脚本内部指定 macOS / Windows 任意绝对保存路径。
- 保存位置使用浏览器默认下载目录。
- 尚未加入站点专用适配器。
- 部分跨域、防盗链、授权或特殊图片实现的网站可能只能退回浏览器直接下载路径。
- 图片格式转换属于 best-effort；转换失败不会阻止原图下载。

## Version

```text
Product ID: AssetSnap
Release Identity: AssetSnap_v0.3.1-CL
Version: 0.3.1
Owner: CL
```

## License

AssetSnap 使用 **AssetSnap Non-Commercial License v1.0**。完整条款见 [`LICENSE`](LICENSE)。

允许个人、教育、研究以及公司 / 组织内部免费使用，也允许在遵守许可证条件的前提下免费再分发；禁止出售、收费下载、付费打包或其他许可证禁止的商业分发。
