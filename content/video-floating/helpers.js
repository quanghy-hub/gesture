(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    const { hasVisibleSize } = ext?.shared?.domUtils || {};
    const touch = ext?.shared?.touchCore;
    const storage = ext?.shared?.storage;
    const configUtils = ext?.shared?.config;
    const floating = ext?.shared?.floatingCore;
    const viewport = ext?.shared?.viewportCore;
    const {
        FIT_MODES,
        VIDEO_IFRAME_PATTERN,
        DEFAULT_VIDEO_FLOATING_CONFIG,
        VIDEO_CHECK_INTERVAL
    } = videoFloating;

    const CONFIG_STORAGE_KEY = configUtils?.STORAGE_KEY || 'gesture_extension_config_v1';
    const LAYOUT_KEY = 'fvp_layout';
    let cfgCache = null;
    let layoutCache = null;
    let layoutReadyPromise = null;
    let noticeEl;
    let hideTimer;

    const el = (tag, cls, html) => {
        const element = document.createElement(tag);
        if (cls) element.className = cls;
        if (html) element.innerHTML = html;
        return element;
    };
    const $ = (id) => document.getElementById(id);
    const getCoord = (event) => touch?.getPrimaryPoint?.(event) || { x: 0, y: 0 };
    const formatTime = (seconds) => `${Math.floor(seconds / 60)}.${(Math.floor(seconds) % 60).toString().padStart(2, '0')}`;
    const clamp = (value, min, max) => viewport?.clamp?.(value, min, max) ?? Math.max(min, Math.min(max, value));
    const onPointer = (node, fn) => {
        node?.addEventListener('touchstart', fn, { passive: false });
        node?.addEventListener('mousedown', fn);
    };
    const getRect = (node) => node?.getBoundingClientRect?.() || { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };
    const queryAllDeep = (selector, root = document) => {
        const results = [];
        const visited = new Set();
        const walk = (currentRoot) => {
            if (!currentRoot || visited.has(currentRoot)) {
                return;
            }
            visited.add(currentRoot);

            if (typeof currentRoot.querySelectorAll === 'function') {
                for (const node of currentRoot.querySelectorAll(selector)) {
                    results.push(node);
                }
                for (const host of currentRoot.querySelectorAll('*')) {
                    if (host.shadowRoot) {
                        walk(host.shadowRoot);
                    }
                }
            }
        };

        walk(root);
        return results;
    };

    const isDetectableVideo = (video) => {
        if (!video || !video.isConnected) return false;
        if (hasVisibleSize) return hasVisibleSize(video);
        const rect = getRect(video);
        return rect.width > 0 && rect.height > 0;
    };

    const isVisibleIframe = (iframe) => {
        if (!iframe?.isConnected || iframe.closest('#fvp-wrapper')) return false;
        const rect = getRect(iframe);
        return rect.width >= 160 && rect.height >= 90;
    };

    const getIframeSrc = (iframe) => {
        const raw = iframe?.src || iframe?.getAttribute?.('src') || '';
        if (!raw) return '';
        try {
            return new URL(raw, location.href).href;
        } catch {
            return raw;
        }
    };

    const isLikelyVideoIframe = (iframe) => {
        if (!isVisibleIframe(iframe)) return false;
        const src = getIframeSrc(iframe);
        if (!src || src === 'about:blank') return false;
        const attrs = [
            src,
            iframe.title || '',
            iframe.getAttribute?.('aria-label') || '',
            iframe.getAttribute?.('name') || '',
            iframe.id || '',
            iframe.className || ''
        ].join(' ');
        return VIDEO_IFRAME_PATTERN.test(attrs);
    };

    const getDirectVideos = () => {
        const unique = new Map();
        for (const video of queryAllDeep('video')) {
            if (!video?.isConnected || video.closest('#fvp-wrapper')) continue;
            const rect = getRect(video);
            const hasMediaSource = Boolean(video.currentSrc || video.src || video.querySelector('source[src]'));
            const hasPlaybackState = Number.isFinite(video.duration) || video.readyState > 0 || video.currentTime > 0;
            const largeEnough = rect.width >= 160 && rect.height >= 90;
            if (!(isDetectableVideo(video) || hasMediaSource || hasPlaybackState || largeEnough)) continue;

            const key = [
                video.currentSrc || video.src || '',
                Math.round(rect.left),
                Math.round(rect.top),
                Math.round(rect.width),
                Math.round(rect.height)
            ].join('|');

            if (!unique.has(key)) {
                unique.set(key, video);
            }
        }

        return [...unique.values()].sort((left, right) => {
            const leftRect = getRect(left);
            const rightRect = getRect(right);
            return (rightRect.width * rightRect.height) - (leftRect.width * leftRect.height);
        });
    };

    const getOverlapRatio = (firstRect, secondRect) => {
        const left = Math.max(firstRect.left, secondRect.left);
        const right = Math.min(firstRect.right, secondRect.right);
        const top = Math.max(firstRect.top, secondRect.top);
        const bottom = Math.min(firstRect.bottom, secondRect.bottom);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        const overlapArea = width * height;
        const baseArea = Math.max(1, firstRect.width * firstRect.height);
        return overlapArea / baseArea;
    };

    const isRedundantIframeCandidate = (iframe, directVideos = getDirectVideos()) => {
        if (!iframe?.isConnected || !directVideos.length) return false;

        let host = '';
        try {
            host = new URL(getIframeSrc(iframe)).hostname;
        } catch { }

        const iframeRect = getRect(iframe);
        if (!iframeRect.width || !iframeRect.height) return true;

        return directVideos.some((video) => {
            const videoRect = getRect(video);
            if (!videoRect.width || !videoRect.height) return false;

            const samePlatform =
                (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(host) && /(^|\.)youtube\.com$/i.test(location.hostname)) ||
                (/redditmedia\.com|v\.redd\.it|reddit\.com/i.test(host) && /(^|\.)reddit\.com$/i.test(location.hostname));

            return samePlatform && getOverlapRatio(iframeRect, videoRect) >= 0.6;
        });
    };

    const getTrackedIframeEntries = (map) => {
        const directVideos = getDirectVideos();
        return [...map.entries()].filter(([iframe, count]) => {
            if (!iframe?.isConnected || !(count > 0)) return false;
            if (!isLikelyVideoIframe(iframe)) return false;
            if (isRedundantIframeCandidate(iframe, directVideos)) return false;
            return true;
        });
    };

    const getFeatureConfig = () => ({ ...DEFAULT_VIDEO_FLOATING_CONFIG, ...(cfgCache?.videoFloating || {}) });
    const isFeatureEnabled = () => getFeatureConfig().enabled !== false;

    const loadLayout = () => {
        if (layoutCache) return layoutCache;
        if (cfgCache?.videoFloating?.layout) return cfgCache.videoFloating.layout;
        try {
            return JSON.parse(localStorage.getItem(LAYOUT_KEY));
        } catch {
            return null;
        }
    };

    const saveLayout = (layout) => {
        layoutCache = layout;
        if (cfgCache?.videoFloating) cfgCache.videoFloating.layout = layout;
        try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { }
        if (storage?.saveVideoLayout) storage.saveVideoLayout(layout);
    };

    const iconPosStorage = floating.createPositionStorage('fvp_icon_pos', { left: 56, top: 200 });

    const loadCfgAsync = async () => {
        if (storage?.getConfig) {
            try {
                cfgCache = await storage.getConfig();
            } catch { }
        }
    };

    const ensureLayoutReady = () => {
        if (layoutReadyPromise) return layoutReadyPromise;
        layoutReadyPromise = (async () => {
            if (storage?.getConfig) {
                try {
                    cfgCache = await storage.getConfig();
                    const saved = cfgCache?.videoFloating?.layout;
                    if (saved) {
                        layoutCache = saved;
                        return saved;
                    }
                } catch { }
            }
            const fallback = loadLayout();
            if (fallback) layoutCache = fallback;
            return fallback;
        })();
        return layoutReadyPromise;
    };

    const bindStorageListener = (onChange) => {
        if (!globalThis.chrome?.storage?.onChanged?.addListener) {
            return () => { };
        }
        const handler = (changes, areaName) => {
            if (areaName !== 'local' || !changes?.[CONFIG_STORAGE_KEY]) return;
            try {
                cfgCache = configUtils?.normalizeConfig?.(changes[CONFIG_STORAGE_KEY].newValue) || cfgCache;
            } catch { }
            onChange?.();
        };
        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
    };

    const getFullscreenEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    const getVideo = () => {
        const fs = getFullscreenEl();
        if (fs) {
            if (fs.tagName === 'VIDEO') return fs;
            const video = fs.querySelector('video');
            if (video) return video;
        }
        const wrapper = $('fvp-wrapper');
        if (wrapper) {
            const video = wrapper.querySelector('video');
            if (video) return video;
        }
        return getDirectVideos()[0] || null;
    };

    const getVideoAtPoint = (x, y) => {
        for (const video of getDirectVideos()) {
            if (!isDetectableVideo(video) || video.closest('#fvp-wrapper')) continue;
            const rect = getRect(video);
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return video;
        }
        return null;
    };

    const showSeekNotice = (video, delta) => {
        if (!video) return;
        const fs = getFullscreenEl();
        const container = (fs && (fs === video || fs.contains(video))) ? fs : (video.parentElement || document.body);
        if (!noticeEl || !container.contains(noticeEl)) {
            noticeEl?.remove();
            noticeEl = document.createElement('div');
            noticeEl.className = 'vf-notice';
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            container.appendChild(noticeEl);
        }
        noticeEl.style.fontSize = `${getFeatureConfig().noticeFontSize}px`;
        noticeEl.textContent = `${delta >= 0 ? '▶ +' : '◀ '}${delta}s`;
        noticeEl.classList.add('show');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => noticeEl.classList.remove('show'), 700);
    };

    const installTouchSwipeSeek = () => {
        const swipe = { active: false, video: null, startX: 0, startY: 0, startTime: 0, lastUpdate: 0, lastDelta: 0, cancelled: false };
        const resetSwipe = () => {
            swipe.active = false;
            swipe.cancelled = false;
            swipe.video = null;
            swipe.lastDelta = 0;
        };

        const onTouchStart = (event) => {
            if (!isFeatureEnabled()) return;
            resetSwipe();
            const point = event.touches?.length === 1 ? event.touches[0] : null;
            if (!point) return;
            try {
                let video = getVideoAtPoint(point.clientX, point.clientY);
                if (!video) {
                    const box = $('fvp-container');
                    if (box && box.style.display !== 'none') {
                        const rect = getRect(box);
                        if (point.clientX >= rect.left && point.clientX <= rect.right && point.clientY >= rect.top && point.clientY <= rect.bottom) {
                            video = $('fvp-wrapper')?.querySelector('video');
                        }
                    }
                }
                if (!video?.isConnected || !Number.isFinite(video.duration) || video.duration <= 0) return;
                const rect = getRect(video);
                if (!rect.width || !rect.height || point.clientY > rect.bottom - rect.height * 0.08) return;
                Object.assign(swipe, {
                    video,
                    active: true,
                    startX: point.clientX,
                    startY: point.clientY,
                    startTime: video.currentTime,
                    lastUpdate: performance.now()
                });
            } catch {
                resetSwipe();
            }
        };

        const onTouchMove = (event) => {
            if (!swipe.active || !swipe.video || swipe.cancelled) return;
            const vfConfig = getFeatureConfig();
            const point = event.touches?.length === 1 ? event.touches[0] : null;
            if (!point || !swipe.video.isConnected) {
                swipe.cancelled = true;
                return;
            }
            const dx = point.clientX - swipe.startX;
            const dy = point.clientY - swipe.startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx < 5 && absDy < 5) return;
            if (absDy > vfConfig.verticalTolerance || (absDx > 0 && absDx / (absDy + 1) < vfConfig.diagonalThreshold)) {
                swipe.cancelled = true;
                return;
            }
            if (absDx < vfConfig.minSwipeDistance) return;
            if (absDx > absDy && event.cancelable) event.preventDefault();
            const scale = absDx < vfConfig.shortThreshold ? vfConfig.swipeShort : vfConfig.swipeLong;
            const delta = Math.round((dx > 0 ? dx - vfConfig.minSwipeDistance : dx + vfConfig.minSwipeDistance) * scale);
            swipe.lastDelta = delta;
            showSeekNotice(swipe.video, delta);
            const now = performance.now();
            if (vfConfig.realtimePreview && now - swipe.lastUpdate > vfConfig.throttle) {
                swipe.lastUpdate = now;
                swipe.video.currentTime = clamp(swipe.startTime + delta, 0, swipe.video.duration);
            }
        };

        const onTouchEnd = () => {
            if (!swipe.active || !swipe.video) return;
            const vfConfig = getFeatureConfig();
            if (!swipe.cancelled && !vfConfig.realtimePreview && swipe.video.isConnected) {
                swipe.video.currentTime = clamp(swipe.startTime + (swipe.lastDelta || 0), 0, swipe.video.duration);
            }
            resetSwipe();
        };

        document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
        document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
        document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });

        return () => {
            document.removeEventListener('touchstart', onTouchStart, { capture: true, passive: true });
            document.removeEventListener('touchmove', onTouchMove, { capture: true, passive: false });
            document.removeEventListener('touchend', onTouchEnd, { capture: true, passive: true });
        };
    };

    videoFloating.helpers = {
        CONFIG_STORAGE_KEY,
        VIDEO_CHECK_INTERVAL,
        el,
        $,
        getCoord,
        formatTime,
        clamp,
        onPointer,
        getRect,
        queryAllDeep,
        isDetectableVideo,
        getDirectVideos,
        isVisibleIframe,
        getIframeSrc,
        isLikelyVideoIframe,
        getTrackedIframeEntries,
        getFeatureConfig,
        isFeatureEnabled,
        loadLayout,
        saveLayout,
        iconPosStorage,
        loadCfgAsync,
        ensureLayoutReady,
        bindStorageListener,
        getFullscreenEl,
        getVideo,
        getVideoAtPoint,
        showSeekNotice,
        installTouchSwipeSeek
    };
})();
