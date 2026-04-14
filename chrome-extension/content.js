/**
 * YouTube 批量稍后观看扩展
 * 在频道视频页面批量添加视频到稍后观看列表
 */

(function() {
  'use strict';

  // 配置
  const CONFIG = {
    DELAY_BETWEEN_REQUEST: 800,  // 每个请求间隔(ms)，避免太快
    WATCH_LATER_PLAYLIST_ID: 'WL',  // 稍后观看的特殊 ID
    API_BATCH_SIZE: 30  // API 每次获取视频数
  };

  // 状态
  let state = {
    selectedVideos: new Set(),
    isProcessing: false,
    videos: [],
    filteredVideos: null,  // 筛选后的视频列表
    watchLaterVideos: null  // 稍后观看列表中的视频 ID 集合
  };

  // 工具函数
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function getYearsAgo(years) {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    return date;
  }

  // 筛选最早 N 年的视频
  function filterOldestYears(videos, years) {
    // 过滤出有日期的视频
    const videosWithDate = videos.filter(v => v.publishedAt);

    if (videosWithDate.length === 0) {
      return videos; // 没有日期信息，返回全部
    }

    // 找到最老的视频日期
    const oldestDate = videosWithDate.reduce((min, v) =>
      v.publishedAt < min ? v.publishedAt : min, videosWithDate[0].publishedAt
    );

    // 计算时间范围：从最老日期开始的 N 年
    const rangeEnd = new Date(oldestDate);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + years);

    log(`频道最老视频日期: ${oldestDate.toLocaleDateString()}, 筛选范围: ${oldestDate.toLocaleDateString()} - ${rangeEnd.toLocaleDateString()}`);

    // 筛选在这个范围内的视频
    return videos.filter(v => !v.publishedAt || v.publishedAt < rangeEnd);
  }

  function log(msg, type = 'info') {
    const prefix = '[YT批量工具]';
    if (type === 'error') console.error(prefix, msg);
    else if (type === 'warn') console.warn(prefix, msg);
    else console.log(prefix, msg);
  }

  // 获取页面的认证 token
  function getAuthToken() {
    // 从页面脚本中提取
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      const text = script.textContent;
      if (text && text.includes('ytcfg.set')) {
        const match = text.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
        if (match) return match[1];
      }
    }
    // 尝试从 ytcfg 获取
    if (window.ytcfg && window.ytcfg.get) {
      return window.ytcfg.get('INNERTUBE_API_KEY');
    }
    // 备用：从 cookie 或其他位置
    return 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';  // YouTube 公开的 API key
  }

  // 从页面提取视频列表
  function extractVideos() {
    const videos = [];
    const videoElements = document.querySelectorAll('ytd-rich-item-renderer, ytd-grid-video-renderer');

    videoElements.forEach((elem, index) => {
      let videoId = '';
      let title = '';
      let timeText = '';
      let publishedAt = null;
      let thumbnailUrl = '';

      // 优先从 elem.data 获取（更可靠）
      const videoData = elem?.data?.content?.videoRenderer;
      if (videoData) {
        videoId = videoData.videoId || '';
        title = videoData.title?.runs?.[0]?.text || videoData.title?.simpleText || '';
        timeText = videoData.publishedTimeText?.simpleText || '';
        thumbnailUrl = videoData.thumbnail?.thumbnails?.[0]?.url || '';
        publishedAt = parseRelativeTime(timeText);
      }

      // 备用：从 DOM 获取
      if (!videoId) {
        const link = elem.querySelector('a#video-title-link, a#thumbnail');
        if (link) {
          const href = link.getAttribute('href') || '';
          const videoIdMatch = href.match(/v=([^&]+)/);
          if (videoIdMatch) videoId = videoIdMatch[1];
        }
      }

      if (!title) {
        const titleElem = elem.querySelector('#video-title, a#video-title');
        title = titleElem?.getAttribute('title') || titleElem?.textContent?.trim() || '';
      }

      if (!thumbnailUrl) {
        const thumbnail = elem.querySelector('img');
        thumbnailUrl = thumbnail?.src || '';
      }

      // 备用：从 DOM 获取时间
      if (!timeText) {
        const metadataLine = elem.querySelector('#metadata-line, ytd-video-meta-block');
        if (metadataLine) {
          const timeSpans = metadataLine.querySelectorAll('span.inline-metadata-item, span.ytd-video-meta-block');
          for (const span of timeSpans) {
            const text = span.textContent?.trim() || '';
            if (text && isTimeText(text)) {
              timeText = text;
              publishedAt = parseRelativeTime(text);
              break;
            }
          }
        }
      }

      if (!videoId) return;

      // 检查是否已观看（有进度条）
      const progressBar = elem.querySelector('#progress, .ytd-thumbnail-overlay-resume-playback-renderer');
      const progress = progressBar ? parseInt(progressBar.style.width) || 0 : 0;
      const isWatched = progress > 0;

      // 调试：每100个视频输出一次状态
      if (index % 100 === 0) {
        log(`视频 ${index}: 已观看=${isWatched}, 进度=${progress}%, 时间="${timeText}", 解析=${publishedAt?.toLocaleDateString() || 'null'}`);
      }

      videos.push({
        id: videoId,
        title,
        index,
        isWatched,
        progress,
        thumbnailUrl,
        publishedAt,
        element: elem
      });
    });

    log(`提取到 ${videos.length} 个视频`);
    return videos;
  }

  // 判断文本是否是时间格式（而非观看次数）
  function isTimeText(text) {
    if (!text) return false;
    const lowerStr = text.toLowerCase();
    // 时间格式关键词
    const timeKeywords = [
      '年前', '个月前', '周前', '天前', '小时前', '分钟前',  // 中文
      'year', 'month', 'week', 'day', 'hour', 'minute',  // 英文
      'ago', '前'  // 通用
    ];
    return timeKeywords.some(kw => lowerStr.includes(kw));
  }

  // 解析相对时间（如 "2年前"）为日期
  function parseRelativeTime(timeStr) {
    if (!timeStr) return null;

    const now = new Date();
    const lowerStr = timeStr.toLowerCase();

    // 匹配各种格式：2年前, 2 years ago, 2个月前, 2 months ago
    const patterns = [
      { regex: /(\d+)\s*(?:年|years?|year)\s*(?:前|ago)/i, unit: 'year' },
      { regex: /(\d+)\s*(?:个月|months?|month)\s*(?:前|ago)/i, unit: 'month' },
      { regex: /(\d+)\s*(?:周|weeks?|week)\s*(?:前|ago)/i, unit: 'week' },
      { regex: /(\d+)\s*(?:天|days?|day)\s*(?:前|ago)/i, unit: 'day' },
      { regex: /(\d+)\s*(?:小时|hours?|hour)\s*(?:前|ago)/i, unit: 'hour' }
    ];

    for (const pattern of patterns) {
      const match = lowerStr.match(pattern.regex);
      if (match) {
        const value = parseInt(match[1]);
        const date = new Date(now);

        switch (pattern.unit) {
          case 'year':
            date.setFullYear(date.getFullYear() - value);
            break;
          case 'month':
            date.setMonth(date.getMonth() - value);
            break;
          case 'week':
            date.setDate(date.getDate() - value * 7);
            break;
          case 'day':
            date.setDate(date.getDate() - value);
            break;
          case 'hour':
            date.setHours(date.getHours() - value);
            break;
        }
        return date;
      }
    }

    return null;
  }

  // 添加视频到稍后观看
  async function addToWatchLater(videoId) {
    // 使用 YouTube 内部的 API
    const url = 'https://www.youtube.com/youtubei/v1/browse/edit_playlist?prettyPrint=false';

    // 获取必要的参数
    const ytcfgData = window.ytcfg?.data_ || {};
    const client = {
      clientName: 'WEB',
      clientVersion: ytcfgData.INNERTUBE_CLIENT_VERSION || '2.20250410.00.00',
      platform: 'DESKTOP'
    };

    const body = {
      playlistId: CONFIG.WATCH_LATER_PLAYLIST_ID,
      actions: [{
        addedVideoId: videoId,
        action: 'ACTION_ADD_VIDEO'
      }],
      context: { client }
    };

    // 尝试使用页面内部的 fetch（带认证）
    try {
      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-AuthUser': '0',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': client.clientVersion,
        'X-Origin': 'https://www.youtube.com'
      };

      // 尝试获取 SAPISIDHASH
      const sapisidHash = await getSapisidHash();
      if (sapisidHash) {
        headers['Authorization'] = `SAPISIDHASH ${sapisidHash}`;
        headers['X-Origin'] = window.location.origin;
      }

      // 方法1：使用 fetch
      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (!response.ok) {
        // 检查是否是"已存在"错误
        const errorMessage = data?.error?.message || '';
        if (errorMessage.includes('already') || errorMessage.includes('已') || response.status === 409) {
          log(`视频 ${videoId} 已在稍后观看列表中`);
          return { success: false, skipped: true, videoId };
        }
        log(`添加 ${videoId} 返回 ${response.status}: ${JSON.stringify(data).substring(0, 200)}`, 'warn');
        // 如果是 403，可能需要使用其他方式
        if (response.status === 403) {
          log(`尝试备用方法`, 'warn');
          return await addToWatchLaterAlternative(videoId);
        }
        return { success: false, videoId, error: `HTTP ${response.status}` };
      }

      // 检查响应中是否有错误
      if (data?.error) {
        const errorMsg = data.error.message || JSON.stringify(data.error);
        if (errorMsg.includes('already') || errorMsg.includes('已存在')) {
          log(`视频 ${videoId} 已在稍后观看列表中`);
          return { success: false, skipped: true, videoId };
        }
        log(`添加 ${videoId} API 返回错误: ${errorMsg}`, 'warn');
        return await addToWatchLaterAlternative(videoId);
      }

      log(`成功添加视频 ${videoId}`);
      return { success: true, videoId };
    } catch (error) {
      log(`添加视频失败 ${videoId}: ${error.message}`, 'error');
      // 尝试备用方法
      return await addToWatchLaterAlternative(videoId);
    }
  }

  // 获取 SAPISIDHASH 认证 token
  async function getSapisidHash() {
    try {
      // 从 cookie 获取 SAPISID
      const cookies = document.cookie.split(';');
      let sapisid = '';
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'SAPISID' || name === '__Secure-3PAPISID') {
          sapisid = value;
          break;
        }
      }

      if (!sapisid) {
        log('未找到 SAPISID cookie，可能未登录', 'warn');
        return null;
      }

      // SAPISIDHASH 格式: timestamp_hash
      // hash = SHA1(timestamp + " " + sapisid + " " + origin)
      const timestamp = Math.floor(Date.now() / 1000);
      const origin = window.location.origin;
      const message = `${timestamp} ${sapisid} ${origin}`;

      // 使用 Web Crypto API 计算 SHA1
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await crypto.subtle.digest('SHA-1', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      return `${timestamp}_${hashHex}`;
    } catch (error) {
      log(`获取 SAPISIDHASH 失败: ${error.message}`, 'error');
      return null;
    }
  }

  // 获取稍后观看列表中的所有视频 ID
  async function fetchWatchLaterVideos() {
    log('正在获取稍后观看列表...');
    const videoIds = new Set();

    try {
      const ytcfgData = window.ytcfg?.data_ || {};
      const client = {
        clientName: 'WEB',
        clientVersion: ytcfgData.INNERTUBE_CLIENT_VERSION || '2.20250410.00.00',
        platform: 'DESKTOP'
      };

      const headers = {
        'Content-Type': 'application/json',
        'X-Goog-AuthUser': '0',
        'X-YouTube-Client-Name': '1',
        'X-YouTube-Client-Version': client.clientVersion
      };

      const sapisidHash = await getSapisidHash();
      if (sapisidHash) {
        headers['Authorization'] = `SAPISIDHASH ${sapisidHash}`;
        headers['X-Origin'] = window.location.origin;
      }

      // 使用 browse API，设置较大的数量
      const url = 'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false';
      const body = {
        context: {
          client,
          request: {
            internalExperimentFlags: [],
            useSsl: true
          }
        },
        browseId: 'VLWL',
        params: 'wgYCCAA='  // 可能用于增加返回数量
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        log(`获取稍后观看列表失败: ${response.status}`, 'error');
        return videoIds;
      }

      const data = await response.json();

      // 解析响应
      const twoColumn = data?.contents?.twoColumnBrowseResultsRenderer;
      const tabs = twoColumn?.tabs;
      const tabRenderer = tabs?.[0]?.tabRenderer;
      const sectionList = tabRenderer?.content?.sectionListRenderer;
      const sectionContents = sectionList?.contents;
      const itemSection = sectionContents?.[0]?.itemSectionRenderer;
      const itemSectionContents = itemSection?.contents;
      const playlistVideoList = itemSectionContents?.[0]?.playlistVideoListRenderer;
      const items = playlistVideoList?.contents;

      if (items) {
        for (const item of items) {
          let videoId = item?.playlistVideoRenderer?.videoId;
          if (!videoId && item?.content) {
            videoId = item.content?.playlistVideoRenderer?.videoId;
          }
          if (videoId) {
            videoIds.add(videoId);
          }
        }
      }

      log(`获取到 ${videoIds.size} 个视频`);

      // 尝试获取 continuation token 并继续获取
      let continuation = null;

      // 检查各种可能的 continuation 位置
      if (playlistVideoList?.continuations) {
        continuation = playlistVideoList.continuations[0]?.nextContinuationData?.continuation;
      }

      if (!continuation && items) {
        const lastItem = items[items.length - 1];
        // 尝试不同的 continuation 结构
        continuation = lastItem?.continuationItemRenderer?.button?.buttonRenderer?.navigationEndpoint?.continuationCommand?.token;
        if (!continuation) {
          continuation = lastItem?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
        }
      }

      if (continuation) {
        log('找到 continuation，继续获取...');
        await fetchMoreVideos(continuation, videoIds, headers, client);
      } else {
        log('未找到 continuation，可能只获取到部分列表');
      }

      log(`稍后观看列表获取完成: ${videoIds.size} 个视频`);
      return videoIds;

    } catch (error) {
      log(`获取稍后观看列表出错: ${error.message}`, 'error');
      return videoIds;
    }
  }

  // 获取更多视频（使用 continuation）
  async function fetchMoreVideos(continuation, videoIds, headers, client) {
    const url = 'https://www.youtube.com/youtubei/v1/browse?prettyPrint=false';
    let currentContinuation = continuation;
    let pageCount = 0;
    const maxPages = 20;

    while (currentContinuation && pageCount < maxPages) {
      pageCount++;

      const body = {
        context: { client },
        continuation: currentContinuation
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify(body)
        });

        if (!response.ok) break;

        const data = await response.json();

        // continuation 响应的结构不同
        let items = data?.onResponseReceivedActions?.[0]?.appendContinuationItemsAction?.continuationItems;

        if (!items) {
          items = data?.continuationContents?.playlistVideoListContinuation?.contents;
        }

        if (!items || items.length === 0) break;

        let foundVideos = 0;
        for (const item of items) {
          let videoId = item?.playlistVideoRenderer?.videoId;
          if (!videoId && item?.content) {
            videoId = item.content?.playlistVideoRenderer?.videoId;
          }
          if (videoId) {
            videoIds.add(videoId);
            foundVideos++;
          }
        }

        log(`第 ${pageCount + 1} 页: ${foundVideos} 个视频，累计 ${videoIds.size} 个`);

        // 获取下一个 continuation
        const lastItem = items[items.length - 1];
        currentContinuation = lastItem?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;

        if (!currentContinuation) {
          break;
        }

        await sleep(100);

      } catch (error) {
        log(`获取更多视频出错: ${error.message}`, 'error');
        break;
      }
    }
  }

  // 备用方法：模拟点击
  async function addToWatchLaterAlternative(videoId) {
    try {
      // 找到视频元素并点击其菜单按钮
      const videoElement = state.videos.find(v => v.id === videoId)?.element;
      if (!videoElement) {
        throw new Error('找不到视频元素');
      }

      // 点击菜单按钮
      const menuButton = videoElement.querySelector('button[aria-label="更多操作"], button#button[aria-haspopup="menu"]');
      if (!menuButton) {
        throw new Error('找不到菜单按钮');
      }

      menuButton.click();
      await sleep(300);

      // 点击"保存到播放列表"
      const saveButton = document.querySelector('tp-yt-paper-listbox ytd-menu-service-item-renderer:nth-child(2), [role="menuitem"]:nth-child(2)');
      if (!saveButton) {
        // 关闭菜单
        document.body.click();
        throw new Error('找不到保存按钮');
      }

      saveButton.click();
      await sleep(300);

      // 点击"稍后观看"复选框
      const watchLaterCheckbox = document.querySelector('tp-yt-paper-checkbox[aria-label="稍后观看"], tp-yt-paper-checkbox[aria-label="Watch later"]');
      if (!watchLaterCheckbox) {
        document.body.click();
        throw new Error('找不到稍后观看选项');
      }

      // 检查是否已选中（已在列表中）
      const isAlreadyChecked = watchLaterCheckbox.getAttribute('aria-checked') === 'true';
      if (isAlreadyChecked) {
        // 已在稍后观看列表中，关闭对话框
        document.body.click();
        await sleep(100);
        document.body.click();
        log(`视频 ${videoId} 已在稍后观看列表中（备用方法检测）`);
        return { success: false, skipped: true, videoId };
      }

      // 勾选稍后观看
      watchLaterCheckbox.click();
      await sleep(200);

      // 点击保存按钮
      const confirmButton = document.querySelector('#save-button, ytd-button-renderer#save-button button');
      if (confirmButton) {
        confirmButton.click();
      }

      // 关闭对话框
      await sleep(100);
      document.body.click();

      return { success: true, videoId, method: 'click' };
    } catch (error) {
      log(`备用方法也失败 ${videoId}: ${error.message}`, 'error');
      return { success: false, videoId, error: error.message };
    }
  }

  // 批量添加
  async function batchAddToWatchLater(videoIds, onProgress) {
    const results = {
      success: [],
      skipped: [],  // 已在列表中
      failed: []
    };

    state.isProcessing = true;

    // 先获取稍后观看列表
    onProgress({
      current: 0,
      total: videoIds.length,
      phase: '获取稍后观看列表...'
    });

    state.watchLaterVideos = await fetchWatchLaterVideos();

    if (state.watchLaterVideos.size === 0) {
      log('无法获取稍后观看列表，继续尝试添加');
    }

    // 开始逐个添加
    for (let i = 0; i < videoIds.length; i++) {
      if (!state.isProcessing) break;

      const videoId = videoIds[i];

      // 检查是否已在列表中
      if (state.watchLaterVideos.has(videoId)) {
        results.skipped.push(videoId);
        log(`视频 ${videoId} 已在稍后观看列表中，跳过`);
        onProgress({
          current: i + 1,
          total: videoIds.length,
          success: results.success.length,
          skipped: results.skipped.length,
          failed: results.failed.length
        });
        continue;
      }

      const result = await addToWatchLater(videoId);

      if (result.success) {
        results.success.push(videoId);
        state.watchLaterVideos.add(videoId); // 更新本地缓存
      } else if (result.skipped) {
        results.skipped.push(videoId);
      } else {
        results.failed.push({ videoId, error: result.error });
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: videoIds.length,
          success: results.success.length,
          skipped: results.skipped.length,
          failed: results.failed.length
        });
      }

      // 每个请求之间延迟，避免太快
      if (i < videoIds.length - 1) {
        await sleep(CONFIG.DELAY_BETWEEN_REQUEST);
      }
    }

    state.isProcessing = false;
    return results;
  }

  // 创建 UI
  function createUI() {
    // 检查是否已存在
    if (document.getElementById('yt-batch-toolbar')) return;

    const toolbar = document.createElement('div');
    toolbar.id = 'yt-batch-toolbar';
    toolbar.innerHTML = `
      <div class="ytb-header">
        <span class="ytb-title">📹 批量工具</span>
        <button class="ytb-close-btn" title="收起">−</button>
      </div>
      <div class="ytb-body">
        <div class="ytb-row">
          <label class="ytb-checkbox">
            <input type="checkbox" id="ytb-skip-watched" checked>
            <span>跳过已看过的视频</span>
          </label>
        </div>
        <div class="ytb-row">
          <label class="ytb-label">加载范围</label>
          <select id="ytb-time-range" class="ytb-select">
            <option value="all">全部视频</option>
            <option value="1">最早 1 年</option>
            <option value="2">最早 2 年</option>
            <option value="3">最早 3 年</option>
            <option value="5">最早 5 年</option>
            <option value="count">按数量</option>
          </select>
        </div>
        <div class="ytb-row" id="ytb-count-row" style="display: none;">
          <label class="ytb-label">加载视频数量</label>
          <input type="number" id="ytb-count-input" class="ytb-select" value="100" min="1" max="10000" placeholder="输入数量">
        </div>
        <div class="ytb-row ytb-stats">
          <span>已选择: <strong id="ytb-selected-count">0</strong></span>
          <span>总计: <strong id="ytb-total-count">0</strong></span>
        </div>
        <div class="ytb-buttons">
          <button class="ytb-btn ytb-btn-secondary" id="ytb-load-all">加载视频</button>
          <button class="ytb-btn ytb-btn-secondary" id="ytb-select-all">全选</button>
          <button class="ytb-btn ytb-btn-secondary" id="ytb-select-none">取消全选</button>
        </div>
        <div class="ytb-row">
          <button class="ytb-btn ytb-btn-primary" id="ytb-add-watchlater">
            添加到稍后观看
          </button>
        </div>
        <div class="ytb-progress" id="ytb-progress" style="display: none;">
          <div class="ytb-progress-bar">
            <div class="ytb-progress-fill" id="ytb-progress-fill"></div>
          </div>
          <div class="ytb-progress-text" id="ytb-progress-text"></div>
        </div>
        <div class="ytb-result" id="ytb-result" style="display: none;"></div>
      </div>
    `;

    document.body.appendChild(toolbar);

    // 绑定事件
    bindEvents();
  }

  // 给视频添加复选框
  function addCheckboxes() {
    state.videos.forEach(video => {
      if (video.element.querySelector('.ytb-video-checkbox')) return;

      const checkbox = document.createElement('div');
      checkbox.className = 'ytb-video-checkbox';
      checkbox.innerHTML = `<input type="checkbox" data-video-id="${video.id}">`;
      checkbox.title = '点击选择/取消选择';

      // 插入到缩略图角落
      const thumbnail = video.element.querySelector('#thumbnail, a#thumbnail');
      if (thumbnail) {
        thumbnail.style.position = 'relative';
        thumbnail.appendChild(checkbox);
      }
    });
  }

  // 更新统计
  function updateStats() {
    const selectedCount = document.getElementById('ytb-selected-count');
    const totalCount = document.getElementById('ytb-total-count');

    if (selectedCount) {
      selectedCount.textContent = state.selectedVideos.size;
    }
    if (totalCount) {
      const displayVideos = state.filteredVideos || state.videos;
      if (state.filteredVideos && state.filteredVideos.length !== state.videos.length) {
        totalCount.textContent = `${displayVideos.length} (共 ${state.videos.length})`;
      } else {
        totalCount.textContent = state.videos.length;
      }
    }
  }

  // 选择/取消选择视频
  function toggleVideo(videoId, selected) {
    if (selected) {
      state.selectedVideos.add(videoId);
    } else {
      state.selectedVideos.delete(videoId);
    }
    updateStats();
  }

  // 绑定事件
  function bindEvents() {
    const toolbar = document.getElementById('yt-batch-toolbar');
    if (!toolbar) return;

    // 收起/展开
    toolbar.querySelector('.ytb-close-btn').addEventListener('click', () => {
      const body = toolbar.querySelector('.ytb-body');
      const btn = toolbar.querySelector('.ytb-close-btn');
      if (body.style.display === 'none') {
        body.style.display = 'block';
        btn.textContent = '−';
      } else {
        body.style.display = 'none';
        btn.textContent = '+';
      }
    });

    // 全选
    document.getElementById('ytb-select-all').addEventListener('click', () => {
      const skipWatched = document.getElementById('ytb-skip-watched').checked;
      // 如果有筛选后的列表，只选择筛选后的
      const targetVideos = state.filteredVideos || state.videos;
      targetVideos.forEach(video => {
        if (skipWatched && video.isWatched) return;
        state.selectedVideos.add(video.id);
        const checkbox = document.querySelector(`[data-video-id="${video.id}"]`);
        if (checkbox) checkbox.checked = true;
      });
      updateStats();
    });

    // 加载视频（自动滚动）
    document.getElementById('ytb-load-all').addEventListener('click', async () => {
      const btn = document.getElementById('ytb-load-all');
      const timeRange = document.getElementById('ytb-time-range').value;

      btn.disabled = true;
      btn.textContent = '加载中...';
      state.filteredVideos = null;

      // 显示所有视频（清除之前的隐藏）
      document.querySelectorAll('.ytb-video-checkbox').forEach(cb => {
        cb.style.display = '';
      });

      let lastCount = state.videos.length;
      let noChangeCount = 0;
      let cutoffDate = null;  // 截止日期
      let oldestDate = null;  // 频道最老视频日期
      let shouldStop = false;
      let targetCount = 0;  // 目标数量

      // 如果是按数量加载，获取目标数量
      if (timeRange === 'count') {
        targetCount = parseInt(document.getElementById('ytb-count-input').value) || 100;
        log(`按数量加载，目标: ${targetCount} 个视频`);
      }

      // 加载视频
      while (noChangeCount < 3 && !shouldStop) {
        // YouTube 页面滚动
        const scrollHeight = document.documentElement.scrollHeight;

        document.documentElement.scrollTop = scrollHeight;
        window.scrollTo({ top: scrollHeight, behavior: 'smooth' });

        const ytdApp = document.querySelector('ytd-app');
        if (ytdApp) {
          ytdApp.scrollTop = ytdApp.scrollHeight;
        }

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', code: 'End', bubbles: true }));

        await sleep(1500);

        // 重新提取视频
        state.videos = extractVideos();
        addCheckboxes();
        updateStats();

        log(`加载了 ${state.videos.length} 个视频`);

        // 按数量加载
        if (timeRange === 'count') {
          btn.textContent = `加载中... ${state.videos.length} / ${targetCount} 个`;
          if (state.videos.length >= targetCount) {
            shouldStop = true;
            log(`已达到目标数量 ${targetCount}，停止加载`);
          }
        }
        // 如果选择了时间范围，检查边界
        else if (timeRange !== 'all' && state.videos.length > 0) {
          const years = parseInt(timeRange);
          const videosWithDate = state.videos.filter(v => v.publishedAt);
          const videosWithoutDate = state.videos.filter(v => !v.publishedAt);

          if (videosWithDate.length > 0) {
            // 第一次检测到有日期的视频，记录最老日期
            if (!oldestDate) {
              // 页面按"最旧优先"排序，第一个视频是最老的
              const firstVideo = videosWithDate[0];
              oldestDate = firstVideo.publishedAt;
              cutoffDate = new Date(oldestDate);
              cutoffDate.setFullYear(cutoffDate.getFullYear() + years);
              log(`最老视频日期: ${oldestDate.toLocaleDateString()}, 截止日期: ${cutoffDate.toLocaleDateString()}`);
              log(`有日期的视频: ${videosWithDate.length}, 无日期: ${videosWithoutDate.length}`);
            }

            // 检查最新加载的视频是否已超出范围
            const lastVideos = state.videos.slice(-10);
            const outOfRange = lastVideos.filter(v =>
              v.publishedAt && v.publishedAt >= cutoffDate
            );

            log(`最后10个视频中超出范围的: ${outOfRange.length}`);

            // 统计范围内的视频数
            const inRangeCount = state.videos.filter(v =>
              !v.publishedAt || v.publishedAt < cutoffDate
            ).length;

            btn.textContent = `加载中... ${inRangeCount} 个 (${years}年内)`;

            // 如果最后加载的视频大部分都超出范围了，停止
            if (outOfRange.length >= 5) {
              shouldStop = true;
              log(`检测到超出范围的视频，停止加载`);
            }
          } else {
            log(`没有解析到时间信息，有日期: ${videosWithDate.length}, 无日期: ${videosWithoutDate.length}`);
          }
        } else if (timeRange === 'all') {
          btn.textContent = `加载中... ${state.videos.length} 个`;
        }

        if (state.videos.length === lastCount) {
          noChangeCount++;
          log(`视频数量未变化，计数: ${noChangeCount}`);
        } else {
          noChangeCount = 0;
          lastCount = state.videos.length;
        }
      }

      // 根据加载类型处理结果
      if (timeRange === 'count') {
        // 按数量：截取前 targetCount 个视频
        const limited = state.videos.slice(0, targetCount);

        // 隐藏超出数量的视频
        state.videos.forEach((video, index) => {
          const checkbox = document.querySelector(`[data-video-id="${video.id}"]`);
          if (checkbox) {
            const inRange = index < targetCount;
            checkbox.closest('.ytb-video-checkbox').style.display = inRange ? '' : 'none';
          }
        });

        state.filteredVideos = limited;
        document.getElementById('ytb-total-count').textContent = `${limited.length} (共 ${state.videos.length})`;
        btn.textContent = `已加载 ${limited.length} 个`;
        showResult(`已加载 ${limited.length} 个视频`, 'success');
      } else if (timeRange !== 'all' && cutoffDate) {
        const years = parseInt(timeRange);
        const filtered = state.videos.filter(v =>
          !v.publishedAt || v.publishedAt < cutoffDate
        );

        // 更新 UI 显示筛选后的视频
        state.videos.forEach(video => {
          const checkbox = document.querySelector(`[data-video-id="${video.id}"]`);
          if (checkbox) {
            const inRange = !video.publishedAt || video.publishedAt < cutoffDate;
            checkbox.closest('.ytb-video-checkbox').style.display = inRange ? '' : 'none';
          }
        });

        // 更新状态为筛选后的列表
        state.filteredVideos = filtered;
        document.getElementById('ytb-total-count').textContent = `${filtered.length} (共 ${state.videos.length})`;
        btn.textContent = `已筛选 ${filtered.length} 个`;
        showResult(`最早 ${years} 年: ${filtered.length} 个视频`, 'success');
      } else {
        btn.textContent = `已加载 ${state.videos.length} 个`;
        showResult(`已加载 ${state.videos.length} 个视频`, 'success');
      }

      btn.disabled = false;
    });

    // 取消全选
    document.getElementById('ytb-select-none').addEventListener('click', () => {
      state.selectedVideos.clear();
      document.querySelectorAll('.ytb-video-checkbox input').forEach(cb => {
        cb.checked = false;
      });
      updateStats();
    });

    // 切换加载范围类型
    document.getElementById('ytb-time-range').addEventListener('change', (e) => {
      const countRow = document.getElementById('ytb-count-row');
      if (e.target.value === 'count') {
        countRow.style.display = '';
      } else {
        countRow.style.display = 'none';
      }
      // 显示所有视频
      document.querySelectorAll('.ytb-video-checkbox').forEach(cb => {
        cb.style.display = '';
      });
      state.filteredVideos = null;
      updateStats();
    });

    // 添加到稍后观看
    document.getElementById('ytb-add-watchlater').addEventListener('click', async () => {
      if (state.isProcessing) return;

      const videoIds = Array.from(state.selectedVideos);
      if (videoIds.length === 0) {
        showResult('请先选择视频', 'error');
        return;
      }

      const btn = document.getElementById('ytb-add-watchlater');
      btn.disabled = true;
      btn.textContent = '处理中...';

      showProgress(true);
      showResult('');

      const results = await batchAddToWatchLater(videoIds, (progress) => {
        updateProgress(progress);
      });

      btn.disabled = false;
      btn.textContent = '添加到稍后观看';

      // 显示结果
      const total = results.success.length + results.skipped.length + results.failed.length;
      let resultText = '';
      if (results.failed.length === 0) {
        const parts = [];
        if (results.success.length > 0) parts.push(`添加 ${results.success.length} 个`);
        if (results.skipped.length > 0) parts.push(`跳过 ${results.skipped.length} 个(已在列表)`);
        resultText = parts.join('，') || '无变化';
        showResult(resultText, 'success');
        state.selectedVideos.clear();
        document.querySelectorAll('.ytb-video-checkbox input').forEach(cb => {
          cb.checked = false;
        });
        updateStats();
      } else {
        const parts = [];
        if (results.success.length > 0) parts.push(`成功 ${results.success.length}`);
        if (results.skipped.length > 0) parts.push(`跳过 ${results.skipped.length}`);
        parts.push(`失败 ${results.failed.length}`);
        showResult(parts.join('，'), 'warning');
      }
    });

    // 视频复选框点击
    document.addEventListener('change', (e) => {
      if (e.target.matches('.ytb-video-checkbox input')) {
        const videoId = e.target.dataset.videoId;
        toggleVideo(videoId, e.target.checked);
      }
    });

    // 跳过已观看设置变更
    document.getElementById('ytb-skip-watched').addEventListener('change', (e) => {
      if (e.target.checked) {
        // 取消已看视频的选择
        state.videos.forEach(video => {
          if (video.isWatched && state.selectedVideos.has(video.id)) {
            state.selectedVideos.delete(video.id);
            const checkbox = document.querySelector(`[data-video-id="${video.id}"]`);
            if (checkbox) checkbox.checked = false;
          }
        });
        updateStats();
      }
    });
  }

  // 显示进度
  function showProgress(show) {
    const progress = document.getElementById('ytb-progress');
    if (progress) {
      progress.style.display = show ? 'block' : 'none';
    }
  }

  function updateProgress(data) {
    const fill = document.getElementById('ytb-progress-fill');
    const text = document.getElementById('ytb-progress-text');

    if (fill) {
      if (data.total > 0) {
        const percent = (data.current / data.total) * 100;
        fill.style.width = `${percent}%`;
      } else {
        fill.style.width = '0%';
      }
    }

    if (text) {
      if (data.phase) {
        // 显示阶段信息
        text.textContent = data.phase;
      } else {
        let statusText = `处理中: ${data.current}/${data.total}`;
        const parts = [];
        if (data.success > 0) parts.push(`成功 ${data.success}`);
        if (data.skipped > 0) parts.push(`跳过 ${data.skipped}`);
        if (data.failed > 0) parts.push(`失败 ${data.failed}`);
        if (parts.length > 0) statusText += ` (${parts.join(', ')})`;
        text.textContent = statusText;
      }
    }
  }

  // 显示结果
  function showResult(message, type = 'info') {
    const result = document.getElementById('ytb-result');
    if (result) {
      result.style.display = message ? 'block' : 'none';
      result.textContent = message;
      result.className = `ytb-result ytb-result-${type}`;
    }
  }

  // 检测页面类型
  function isVideosPage() {
    const url = window.location.href;
    return url.includes('/videos') || url.includes('/streams');
  }

  // 自动选择"最早"排序
  async function selectOldestSort() {
    try {
      // 等待页面加载
      await sleep(2000);

      // 查找 ytChipShapeButtonReset 按钮
      const chipButtons = document.querySelectorAll('button.ytChipShapeButtonReset');
      log(`找到 ${chipButtons.length} 个 chip 按钮`);

      for (const btn of chipButtons) {
        const text = (btn.textContent || '').trim();

        // 找到"最新"按钮，点击展开菜单
        if (text === '最新' || text === '最新发布' || text.toLowerCase() === 'newest') {
          log('点击"最新"按钮展开菜单');
          btn.click();
          await sleep(500);

          // 查找所有可能的菜单项
          const allButtons = document.querySelectorAll('button');
          log(`菜单展开后找到 ${allButtons.length} 个按钮`);

          for (const item of allButtons) {
            const itemText = (item.textContent || '').trim();
            if (itemText === '最早' || itemText === '最旧' || itemText.toLowerCase() === 'oldest') {
              item.click();
              log('已选择"最早"排序');
              await sleep(1000);
              return;
            }
          }

          // 没找到，关闭菜单
          document.body.click();
          log('菜单中未找到"最早"选项');
          return;
        }

        // 如果已经是"最早"
        if (text === '最早' || text === '最旧' || text.toLowerCase() === 'oldest') {
          log('当前已是"最早"排序');
          return;
        }
      }

      log('未找到排序按钮');

    } catch (error) {
      log(`选择排序失败: ${error.message}`, 'error');
    }
  }

  // 初始化
  function init() {
    // 检测是否在视频列表页
    if (!isVideosPage()) {
      // 不是视频页面，移除工具栏
      const existing = document.getElementById('yt-batch-toolbar');
      if (existing) existing.remove();
      return;
    }

    log('初始化批量工具...');

    // 自动选择"最早"排序
    selectOldestSort();

    // 等待页面加载完成
    const checkReady = setInterval(() => {
      const videosContainer = document.querySelector('ytd-rich-grid-renderer, ytd-grid-renderer');
      if (videosContainer) {
        clearInterval(checkReady);
        createUI();
        state.videos = extractVideos();
        addCheckboxes();
        updateStats();
      }
    }, 500);

    // 监听页面变化（YouTube SPA）
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      const currentUrl = location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        // URL 变化，重新初始化
        setTimeout(() => {
          const existing = document.getElementById('yt-batch-toolbar');
          if (existing) existing.remove();
          state.selectedVideos.clear();
          init();
        }, 1000);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
