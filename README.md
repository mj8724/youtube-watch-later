# YouTube 批量稍后观看

**YouTube Watch Later Batch Helper**

一个用于 YouTube 频道视频页的 Chrome 扩展，可以批量选择视频并加入“稍后观看”。

A Chrome extension for YouTube channel video pages that lets you select many videos at once and add them to Watch Later.

> 这是一个 `vibe coding` 项目：它来自真实使用需求，强调实用优先、快速迭代，而不是复杂的产品包装。
>
> This is a `vibe coding` project: it was built from a real personal workflow, with a focus on usefulness and fast iteration over polished product ceremony.

## 这个工具能做什么 / What This Tool Does

- 在 YouTube 频道的 `/videos` 页面批量加载视频。  
  Load videos in bulk from a YouTube channel's `/videos` page.
- 支持按“全部视频”“最早 1/2/3/5 年”“按数量”来筛选。  
  Filter by all videos, earliest 1/2/3/5 years, or a fixed count.
- 可以跳过已经看过的视频。  
  Skip videos that already show watch progress.
- 可以批量加入“稍后观看 / Watch Later”。  
  Add many selected videos to Watch Later in one run.
- 会先读取现有稍后观看列表，尽量避免重复添加。  
  Fetch the existing Watch Later list first to reduce duplicate adds.

## 适合什么场景 / When It Is Useful

- 你想把某个频道早期的视频批量存到稍后观看。  
  You want to save a channel's older videos into Watch Later in bulk.
- 你在补老频道内容，希望按年份或数量分批处理。  
  You are catching up on an older channel and want to work in year-based or count-based batches.
- 你不想手动一个个点开菜单再加入稍后观看。  
  You do not want to open the menu and click Watch Later one video at a time.

## 安装方式 / Installation

1. 下载或克隆这个仓库。
   Download or clone this repository.
2. 打开 Chrome，访问 `chrome://extensions/`。
   Open Chrome and go to `chrome://extensions/`.
3. 打开右上角的“开发者模式 / Developer mode”。
   Turn on Developer mode in the top-right corner.
4. 点击“加载已解压的扩展程序 / Load unpacked”。
   Click "Load unpacked".
5. 选择仓库里的 [`chrome-extension`](./chrome-extension) 文件夹。
   Select the [`chrome-extension`](./chrome-extension) folder from this repo.

## 如何使用 / How To Use

1. 打开任意 YouTube 频道的视频页面，例如 `https://www.youtube.com/@channel/videos`。
   Open any YouTube channel video page, for example `https://www.youtube.com/@channel/videos`.
2. 等待页面右下角出现扩展面板。
   Wait for the floating panel to appear in the bottom-right corner.
3. 选择加载范围：
   Choose a load range:
   - `全部视频 / All videos`
   - `最早 1/2/3/5 年 / Earliest 1/2/3/5 years`
   - `按数量 / By count`
4. 点击 `加载视频 / Load Videos`。
   Click `Load Videos`.
5. 等待页面自动滚动并收集视频。
   Let the page auto-scroll and collect videos.
6. 点击 `全选 / Select All`，或者手动勾选你要处理的视频。
   Click `Select All`, or manually check the videos you want.
7. 点击 `添加到稍后观看 / Add to Watch Later`。
   Click `Add to Watch Later`.
8. 等待进度条完成，查看成功、跳过和失败数量。
   Wait for the progress bar to finish, then review the success, skipped, and failed counts.

## 按钮说明 / Button Guide

- `加载视频 / Load Videos`
  开始自动滚动页面并收集当前频道的视频。  
  Start auto-scrolling and collecting videos from the current channel page.
- `全选 / Select All`
  选中当前范围内的所有视频。  
  Select all videos currently in scope.
- `取消全选 / Clear Selection`
  清空当前选择。  
  Clear the current selection.
- `添加到稍后观看 / Add to Watch Later`
  把选中的视频批量加入 Watch Later。  
  Add the selected videos to Watch Later in bulk.
- `跳过已看过的视频 / Skip watched videos`
  如果检测到视频有播放进度条，就不会在全选时自动选中它。  
  If a video already has a progress bar, it will not be selected automatically during Select All.

## 使用建议 / Practical Tips

- 如果你只想处理频道早期内容，先确认页面已经切到“最早 / Oldest”排序。  
  If you only want older uploads, make sure the page is sorted by `Oldest`.
- 大频道可能需要更长时间来滚动和收集视频。  
  Large channels may take longer to scroll and collect.
- 如果你只是想先加一小批，优先使用“按数量 / By count”。  
  If you only want a small batch first, use `By count`.
- 如果某些视频已经在 Watch Later 中，扩展会尽量自动跳过。  
  If some videos are already in Watch Later, the extension will try to skip them.

## 限制与注意事项 / Limitations

- 需要登录 YouTube 账号才能写入 Watch Later。  
  You must be signed in to YouTube to write into Watch Later.
- 扩展依赖 YouTube 当前页面结构和内部接口，YouTube 改版后可能需要修复。  
  The extension depends on YouTube's current DOM structure and internal APIs, so YouTube UI changes may break it.
- 对非常大的频道或非常长的 Watch Later 列表，读取和添加都可能变慢。  
  Very large channels or very large Watch Later lists can slow down loading and adding.
- 某些广告拦截器、脚本拦截器或浏览器策略可能影响请求。  
  Some ad blockers, script blockers, or browser policies may interfere with requests.
- 如果 YouTube 页面没有正确加载完，工具面板可能不会立刻出现，刷新页面通常可以解决。  
  If the page did not finish loading cleanly, the panel may not appear immediately; refreshing usually helps.

## 常见问题 / FAQ

### 为什么工具栏没有出现？

- 确认你在频道的视频页，URL 通常包含 `/videos`。
- 刷新页面后再试一次。
- 确认扩展已经在 `chrome://extensions/` 中成功加载。
- Make sure you are on a channel video page, and the URL usually contains `/videos`.
- Refresh the page and try again.
- Confirm that the extension is loaded successfully in `chrome://extensions/`.

### 为什么读取稍后观看列表不完整？

- YouTube 的返回结构会变化，扩展已经尽量做了 continuation 翻页处理，但超大列表仍可能受到页面或接口限制。
- 你可以打开浏览器控制台，查看 `[YT批量工具]` 开头的日志来排查。
- YouTube response structures change over time. The extension now follows continuation pages, but extremely large lists can still hit page or API limits.
- Open the browser console and inspect logs prefixed with `[YT批量工具]` for troubleshooting.

### 为什么添加失败？

- 确认你已经登录 YouTube。
- 确认 Watch Later 没有达到 YouTube 的上限或临时限制。
- 检查是否有浏览器扩展拦截了 YouTube 内部请求。
- Make sure you are signed in to YouTube.
- Make sure Watch Later has not hit a YouTube limit or temporary restriction.
- Check whether another browser extension is blocking YouTube internal requests.

## 这个项目为什么是 vibe coding / Why This Is a Vibe Coding Project

这不是一个为了“像正式 SaaS 一样展示”而构建的项目，而是一个从实际个人需求出发，快速做出来并持续修补的效率工具。它关注的是“能不能帮我现在少点很多次点击”，然后再逐步把边角问题补齐。

This project was not built to imitate a polished SaaS product. It was built to solve a real workflow quickly, then improved step by step as new edge cases showed up. The goal is practical leverage: fewer repetitive clicks, faster curation, and just enough engineering to keep it useful.

## 开发补充 / Development Notes

主要文件：
Core files:

- [`chrome-extension/manifest.json`](./chrome-extension/manifest.json)
  扩展配置，声明 content script 和权限。
- [`chrome-extension/content.js`](./chrome-extension/content.js)
  核心逻辑，包括 UI、视频提取、批量添加、Watch Later 列表读取和国际化文案。
- [`chrome-extension/styles.css`](./chrome-extension/styles.css)
  工具面板和视频复选框样式。

## License

当前仓库未单独声明许可证。

No standalone license file is included in the repository yet.
