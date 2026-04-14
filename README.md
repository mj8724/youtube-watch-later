# YouTube 批量稍后观看

**YouTube Watch Later Batch Helper**

把一个频道的视频，成批加入你的 `Watch Later / 稍后观看`。

Batch-add videos from a YouTube channel into your `Watch Later` list.

> 一个从真实使用需求里长出来的 `vibe coding` 工具。
>
> A `vibe coding` utility built from a real workflow need.

## 为什么会有这个项目 / Why This Exists

如果你经常遇到这些情况，这个扩展就是为你准备的：

If any of these feel familiar, this extension is for you:

- 你想一次性收藏某个频道的早期视频。  
  You want to save a channel's older uploads in one go.
- 你在系统性补一个老频道，不想一个视频一个视频地点菜单。  
  You are catching up on an older channel and do not want to open the menu on every single video.
- 你希望按年份、按数量来分批整理内容。  
  You want to process a channel in year-based or count-based batches.

## 功能亮点 / Highlights

- 批量加载频道 `/videos` 页面的视频。  
  Load large batches of videos from a channel's `/videos` page.
- 支持 `全部视频 / 最早 1/2/3/5 年 / 按数量`。  
  Supports `All videos / Earliest 1/2/3/5 years / By count`.
- 可跳过已观看视频。  
  Can skip videos that already show watch progress.
- 批量加入 `稍后观看 / Watch Later`。  
  Add many selected videos to Watch Later at once.
- 会先读取现有 Watch Later 列表，尽量避免重复添加。  
  Fetches your existing Watch Later list first to reduce duplicate adds.
- 支持中文与英文界面。  
  Supports both Chinese and English UI.

## 快速开始 / Quick Start

### 1. 安装扩展 / Install

1. 下载或克隆这个仓库。  
   Download or clone this repository.
2. 打开 Chrome，进入 `chrome://extensions/`。  
   Open Chrome and go to `chrome://extensions/`.
3. 开启右上角的 `Developer mode / 开发者模式`。  
   Turn on `Developer mode`.
4. 点击 `Load unpacked / 加载已解压的扩展程序`。  
   Click `Load unpacked`.
5. 选择仓库中的 [`chrome-extension`](./chrome-extension) 文件夹。  
   Select the [`chrome-extension`](./chrome-extension) folder in this repo.

### 2. 打开频道页 / Open a Channel Page

进入任意 YouTube 频道的视频页，例如：

Open any YouTube channel videos page, for example:

`https://www.youtube.com/@channel/videos`

### 3. 批量处理 / Batch Process

1. 等待右下角出现工具面板。  
   Wait for the floating panel to appear in the bottom-right corner.
2. 选择加载范围。  
   Choose a load range.
3. 点击 `加载视频 / Load Videos`。  
   Click `Load Videos`.
4. 等待页面自动滚动并收集视频。  
   Let the page auto-scroll and collect videos.
5. 点击 `全选 / Select All`，或手动勾选视频。  
   Click `Select All`, or manually choose videos.
6. 点击 `添加到稍后观看 / Add to Watch Later`。  
   Click `Add to Watch Later`.
7. 查看成功、跳过、失败结果。  
   Review the success, skipped, and failed results.

## 面板怎么用 / How The Panel Works

### `加载视频 / Load Videos`

自动向下滚动页面，把当前频道中可见和可继续加载的视频收集出来。

Automatically scrolls the page and gathers videos from the current channel page.

### `全选 / Select All`

选中当前范围内的所有视频。如果勾选了“跳过已看过的视频”，有播放进度的视频不会被自动选中。

Selects all videos in the current scope. If `Skip watched videos` is enabled, videos with watch progress will not be selected automatically.

### `取消全选 / Clear Selection`

清空当前勾选结果。

Clears the current selection.

### `添加到稍后观看 / Add to Watch Later`

把已选择的视频批量加入 `Watch Later / 稍后观看`。

Adds the selected videos into `Watch Later`.

### `跳过已看过的视频 / Skip watched videos`

适合你只想整理还没真正看过的内容时使用。

Useful when you only want to process videos you have not really watched yet.

## 典型使用方式 / Common Workflows

### 想从最早的视频开始补频道

选择 `最早 1 年 / Earliest 1 year` 或 `最早 3 年 / Earliest 3 years`，加载后全选，再加入 Watch Later。

Pick `Earliest 1 year` or `Earliest 3 years`, load the videos, select them all, then add them to Watch Later.

### 只想先处理一小批

选择 `按数量 / By count`，例如先加载 50 或 100 个视频，避免一次操作太多。

Choose `By count`, for example 50 or 100 videos first, so the batch stays manageable.

### 只想补没看过的内容

保持 `跳过已看过的视频 / Skip watched videos` 打开，然后再使用全选。

Keep `Skip watched videos` enabled before using `Select All`.

## 使用建议 / Practical Tips

- 如果你只想处理频道早期内容，先确认 YouTube 页面已经切到 `Oldest / 最早`。  
  If you only want early uploads, make sure the YouTube page is sorted by `Oldest`.
- 大频道可能需要更长时间滚动和收集。  
  Large channels may take longer to scroll and collect.
- 如果只想先试一轮，优先用 `按数量 / By count`。  
  If you want a safer first run, start with `By count`.
- 如果视频已经在 Watch Later 中，扩展会尽量自动跳过。  
  If a video is already in Watch Later, the extension will try to skip it automatically.

## 限制 / Limitations

- 需要登录 YouTube 才能写入 Watch Later。  
  You must be signed in to YouTube to write into Watch Later.
- 扩展依赖 YouTube 当前 DOM 结构和内部接口，YouTube 改版后可能需要修复。  
  The extension depends on YouTube's current DOM structure and internal APIs, so a YouTube UI change may break it.
- 对很大的频道或很长的 Watch Later 列表，加载和写入都可能变慢。  
  Very large channels or very long Watch Later lists may slow down loading and writes.
- 某些广告拦截器、脚本拦截器或浏览器策略可能影响请求。  
  Some ad blockers, script blockers, or browser policies may interfere with requests.

## FAQ

### 工具栏为什么没出现？
### Why is the toolbar missing?

- 确认你打开的是频道的视频页，URL 通常包含 `/videos`。  
  Make sure you are on a channel videos page, and the URL usually contains `/videos`.
- 刷新页面后再试一次。  
  Refresh the page and try again.
- 确认扩展已经成功加载到 `chrome://extensions/`。  
  Confirm the extension is loaded successfully in `chrome://extensions/`.

### 为什么读取 Watch Later 不完整？
### Why is the Watch Later list incomplete?

- YouTube 的返回结构会变化，这个扩展已经做了 continuation 翻页，但超大列表仍可能受页面或接口限制。  
  YouTube response structures change over time. This extension follows continuation pages, but extremely large lists can still hit page or API limits.
- 打开浏览器控制台，查看 `[YT批量工具]` 开头的日志更容易定位问题。  
  Open the browser console and inspect logs prefixed with `[YT批量工具]` for easier troubleshooting.

### 为什么添加失败？
### Why did adding fail?

- 确认你已经登录 YouTube。  
  Make sure you are signed in to YouTube.
- 确认 Watch Later 没有达到 YouTube 的上限或临时限制。  
  Make sure Watch Later has not hit a YouTube limit or temporary restriction.
- 检查是否有其他浏览器扩展拦截了 YouTube 内部请求。  
  Check whether another browser extension is blocking YouTube internal requests.

## 这是一个 vibe coding 项目 / This Is a Vibe Coding Project

这不是一个为了包装成“完整商业产品”而写出来的项目，而是一个从个人真实使用场景里长出来的工具。它的目标很直接：减少重复点击，让整理频道内容这件事更快、更顺手，然后在使用过程中持续修补边缘情况。

This is not a project pretending to be a polished commercial product. It is a tool that grew out of a real personal workflow. The goal is simple: reduce repetitive clicks, make channel curation faster, and keep improving the rough edges as they appear in actual use.

## 开发说明 / Development Notes

主要文件：

Core files:

- [`chrome-extension/manifest.json`](./chrome-extension/manifest.json)  
  扩展配置与权限声明。  
  Extension manifest and permissions.
- [`chrome-extension/content.js`](./chrome-extension/content.js)  
  主逻辑：UI、视频提取、批量添加、Watch Later 读取、双语文案。  
  Main logic: UI, video extraction, batch add flow, Watch Later fetch, and bilingual strings.
- [`chrome-extension/styles.css`](./chrome-extension/styles.css)  
  工具面板与视频复选框样式。  
  Styles for the floating panel and video checkboxes.

## License

当前仓库还没有单独的许可证文件。

This repository does not include a standalone license file yet.
