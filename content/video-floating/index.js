(function () {
    'use strict';

    const ext = globalThis.GestureExtension;
    const { hasVisibleSize, isVisible } = ext?.shared?.domUtils || {};
    const storage = ext?.shared?.storage;
    const floating = ext?.shared?.floatingCore;

    const isInIframe = window !== window.top;
    const FVP_IFRAME_BRIDGE = 'fvp-page-bridge';

    // ============================================
    // CONSTANTS
    // ============================================
    const FIT_MODES = ['contain', 'cover', 'fill'];
    const FIT_ICONS = ['⤢', '🔍', '↔'];
    const ZOOM_LEVELS = [1, 1.5, 2, 3];
    const ZOOM_ICONS = ['+', '++', '+++', '-'];
    const VIDEO_CHECK_INTERVAL = 2000;

    // ============================================
    // UTILITIES
    // ============================================
    const el = (tag, cls, html) => {
        const e = document.createElement(tag);
        if (cls) e.className = cls;
        if (html) e.innerHTML = html;
        return e;
    };
    const $ = id => document.getElementById(id);
    const getCoord = e => { const t = e.touches?.[0] || e.changedTouches?.[0] || e; return { x: t.clientX, y: t.clientY }; };
    const formatTime = s => `${Math.floor(s / 60)}.${(Math.floor(s) % 60).toString().padStart(2, '0')}`;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const onPointer = (el, fn) => { el?.addEventListener('touchstart', fn, { passive: false }); el?.addEventListener('mousedown', fn); };
    const getRect = node => node?.getBoundingClientRect?.() || { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };

    const isDetectableVideo = video => {
        if (!video || !video.isConnected) return false;
        if (hasVisibleSize) return hasVisibleSize(video);
        const r = getRect(video);
        return r.width > 0 && r.height > 0;
    };

    // ============================================
    // PERSISTENCE
    // ============================================
    const LAYOUT_KEY = 'fvp_layout';
    let _cfgCache = null;

    const loadConfig = () => _cfgCache || {};

    const loadLayout = () => {
        if (_cfgCache?.videoFloating?.layout) return _cfgCache.videoFloating.layout;
        try { return JSON.parse(localStorage.getItem(LAYOUT_KEY)); } catch { return null; }
    };

    const saveLayout = (layout) => {
        try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { }
        if (storage?.saveVideoLayout) storage.saveVideoLayout(layout);
    };

    const iconPosStorage = floating.createPositionStorage('fvp_icon_pos', { left: 12, top: 200 });

    const loadCfgAsync = async () => {
        if (storage?.getConfig) {
            try { _cfgCache = await storage.getConfig(); } catch { }
        }
    };

    // ============================================
    // SHARED: VIDEO CONTROLS FOR CURRENT PAGE
    // ============================================
    const getFullscreenEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    const getVideo = () => {
        const fs = getFullscreenEl();
        if (fs) {
            if (fs.tagName === 'VIDEO') return fs;
            const v = fs.querySelector('video');
            if (v) return v;
        }
        const wrapper = $('fvp-wrapper');
        if (wrapper) {
            const v = wrapper.querySelector('video');
            if (v) return v;
        }
        return [...document.querySelectorAll('video')]
            .find(v => isDetectableVideo(v) && !v.closest('#fvp-wrapper')) || null;
    };

    const getVideoAtPoint = (x, y) => {
        for (const v of document.querySelectorAll('video')) {
            if (!isDetectableVideo(v) || v.closest('#fvp-wrapper')) continue;
            const r = getRect(v);
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return v;
        }
        return null;
    };

    /* ─── SEEK NOTICE ─── */
    let noticeEl, hideTimer;
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
        noticeEl.textContent = `${delta >= 0 ? '▶ +' : '◀ '}${delta}s`;
        noticeEl.classList.add('show');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => noticeEl.classList.remove('show'), 700);
    };

    /* ─── TOUCH SWIPE SEEK ─── */
    const swipe = { active: false, video: null, startX: 0, startY: 0, startTime: 0, lastUpdate: 0, cancelled: false };
    const resetSwipe = () => { swipe.active = false; swipe.cancelled = false; swipe.video = null; };

    document.addEventListener('touchstart', e => {
        resetSwipe();
        const t = e.touches?.length === 1 ? e.touches[0] : null;
        if (!t) return;
        try {
            let video = getVideoAtPoint(t.clientX, t.clientY);
            if (!video) {
                const box = $('fvp-container');
                if (box && box.style.display !== 'none') {
                    const r = getRect(box);
                    if (t.clientX >= r.left && t.clientX <= r.right && t.clientY >= r.top && t.clientY <= r.bottom)
                        video = $('fvp-wrapper')?.querySelector('video');
                }
            }
            if (!video?.isConnected || !Number.isFinite(video.duration) || video.duration <= 0) return;
            const rect = getRect(video);
            if (!rect.width || !rect.height || t.clientY > rect.bottom - rect.height * 0.15) return;
            Object.assign(swipe, { video, active: true, startX: t.clientX, startY: t.clientY, startTime: video.currentTime, lastUpdate: performance.now() });
        } catch { resetSwipe(); }
    }, { capture: true, passive: true });

    document.addEventListener('touchmove', e => {
        if (!swipe.active || !swipe.video || swipe.cancelled) return;
        const t = e.touches?.length === 1 ? e.touches[0] : null;
        if (!t || !swipe.video.isConnected) { swipe.cancelled = true; return; }
        const dx = t.clientX - swipe.startX, dy = t.clientY - swipe.startY;
        const absDx = Math.abs(dx), absDy = Math.abs(dy);
        if (absDx < 5 && absDy < 5) return;
        if (absDy > 60 || (absDx > 0 && absDx / (absDy + 1) < 1.5)) { swipe.cancelled = true; return; }
        if (absDx < 20) return;
        if (absDx > absDy && e.cancelable) e.preventDefault();
        const delta = Math.round((dx > 0 ? dx - 20 : dx + 20) * 0.3);
        showSeekNotice(swipe.video, delta);
        const now = performance.now();
        if (now - swipe.lastUpdate > 100) {
            swipe.lastUpdate = now;
            swipe.video.currentTime = clamp(swipe.startTime + delta, 0, swipe.video.duration);
        }
    }, { capture: true, passive: false });

    document.addEventListener('touchend', e => {
        if (!swipe.active || !swipe.video) return;
        resetSwipe();
    }, { capture: true, passive: true });

    // ============================================
    // IFRAME MODE
    // ============================================
    if (isInIframe) {
        const childFrameVideoMap = new Map();
        const iframeUiState = { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 };
        let activeIframeVideo = null, styledIframeVideo = null;

        const getOwnVideoCount = () => document.querySelectorAll('video').length;
        const getIframeVideos = () => [...document.querySelectorAll('video')].filter(v => {
            if (!v?.isConnected) return false;
            if (isDetectableVideo(v)) return true;
            const rect = getRect(v);
            const hasMediaSource = Boolean(v.currentSrc || v.src || v.querySelector('source[src]'));
            const hasPlaybackState = Number.isFinite(v.duration) || v.readyState > 0 || v.currentTime > 0;
            return hasMediaSource || hasPlaybackState || (rect.width > 0 && rect.height > 0);
        });

        const postIframeBridgeMessage = payload => {
            try {
                window.postMessage({ source: FVP_IFRAME_BRIDGE, ...payload }, '*');
            } catch { }
        };

        const pruneChildFrames = () => {
            for (const f of [...childFrameVideoMap.keys()]) if (!f?.isConnected) childFrameVideoMap.delete(f);
        };

        const getCurrentIframeVideo = () => {
            if (activeIframeVideo?.isConnected) return activeIframeVideo;
            activeIframeVideo = getVideo() || getIframeVideos()[0] || null;
            return activeIframeVideo;
        };

        const applyIframePresentation = (video = getCurrentIframeVideo()) => {
            if (!video) return;
            if (styledIframeVideo && styledIframeVideo !== video) Object.assign(styledIframeVideo.style, { objectFit: '', transform: '' });
            styledIframeVideo = video;
            const zoom = ZOOM_LEVELS[iframeUiState.zoomIdx];
            const transforms = [];
            if (iframeUiState.rotationAngle) transforms.push(`rotate(${iframeUiState.rotationAngle}deg)`);
            if (zoom !== 1) transforms.push(`scale(${zoom})`);
            video.style.transform = transforms.join(' ');
            video.style.objectFit = (iframeUiState.rotationAngle === 90 || iframeUiState.rotationAngle === 270) ? 'contain' : FIT_MODES[iframeUiState.fitIdx];
        };

        const switchIframeVideo = dir => {
            const list = getIframeVideos(); if (!list.length) return;
            const cur = getCurrentIframeVideo();
            const idx = Math.max(0, list.indexOf(cur));
            activeIframeVideo = list[(idx + dir + list.length) % list.length];
            Object.assign(iframeUiState, { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 });
            applyIframePresentation(activeIframeVideo);
        };

        const postIframeState = () => {
            const video = getCurrentIframeVideo();
            try {
                window.parent.postMessage({
                    type: 'fvp-iframe-state',
                    state: video ? {
                        hasVideo: true, paused: !!video.paused, muted: !!video.muted,
                        volume: video.volume || 1, currentTime: video.currentTime || 0,
                        duration: video.duration || 0,
                        bufferedEnd: video.buffered?.length ? video.buffered.end(video.buffered.length - 1) : 0,
                        fitIdx: iframeUiState.fitIdx, zoomIdx: iframeUiState.zoomIdx, rotationAngle: iframeUiState.rotationAngle
                    } : { hasVideo: false, paused: true, muted: false, volume: 1, currentTime: 0, duration: 0, bufferedEnd: 0, fitIdx: 0, zoomIdx: 0, rotationAngle: 0 }
                }, '*');
            } catch { }
        };

        const reportVideos = () => {
            pruneChildFrames();
            try { window.parent.postMessage({ type: 'fvp-iframe-videos', count: getOwnVideoCount() + [...childFrameVideoMap.values()].reduce((s, c) => s + c, 0) }, '*'); } catch { }
        };

        window.addEventListener('message', e => {
            if (e.source === window && e.data?.source === FVP_IFRAME_BRIDGE) {
                if (e.data?.type === 'fvp-page-quality-result') {
                    try {
                        window.parent.postMessage({ type: 'fvp-iframe-quality-result', detail: e.data.detail || [] }, '*');
                    } catch { }
                }
                return;
            }
            if (e.data?.type === 'fvp-iframe-videos') {
                const f = Array.from(document.querySelectorAll('iframe')).find(i => i.contentWindow === e.source);
                if (f) { if (e.data.count > 0) childFrameVideoMap.set(f, e.data.count); else childFrameVideoMap.delete(f); reportVideos(); }
                return;
            }
            if (e.data?.type !== 'fvp-iframe-command') return;
            const video = getCurrentIframeVideo();
            switch (e.data.command) {
                case 'play-pause': if (video) video.paused ? video.play().catch(() => { }) : video.pause(); break;
                case 'toggle-mute': if (video) video.muted = !video.muted; break;
                case 'seek-to-ratio': if (video?.duration) video.currentTime = clamp((e.data.ratio || 0) * video.duration, 0, video.duration); break;
                case 'prev-video': switchIframeVideo(-1); break;
                case 'next-video': switchIframeVideo(1); break;
                case 'cycle-fit': iframeUiState.fitIdx = (iframeUiState.fitIdx + 1) % FIT_MODES.length; applyIframePresentation(); break;
                case 'cycle-zoom': iframeUiState.zoomIdx = (iframeUiState.zoomIdx + 1) % ZOOM_LEVELS.length; applyIframePresentation(); break;
                case 'rotate': iframeUiState.rotationAngle = (iframeUiState.rotationAngle + 90) % 360; applyIframePresentation(); break;
                case 'get-quality': postIframeBridgeMessage({ type: 'fvp-page-get-quality' }); break;
                case 'set-quality': postIframeBridgeMessage({ type: 'fvp-page-set-quality', item: e.data.item }); break;
            }
            postIframeState();
            setTimeout(postIframeState, 80);
        });

        setInterval(reportVideos, VIDEO_CHECK_INTERVAL);
        reportVideos();
        return;
    }

    // ============================================
    // TOP FRAME logic
    // ============================================
    let box, iconRef, menuRef, curVid, origPar, ph;
    let fitIdx = 0, zoomIdx = 0, rotationAngle = 0;
    let floatedIframe = null, iframeOrigPar = null, iframePh = null, iframeOrigStyle = '';
    const iframeVideoMap = new Map();
    let iframeStatePollTimer = 0;
    const iframePlaybackState = { hasVideo: false, paused: true, muted: false, volume: 1, currentTime: 0, duration: 0, bufferedEnd: 0, fitIdx: 0, zoomIdx: 0, rotationAngle: 0 };
    const state = { isDrag: false, isResize: false, startX: 0, startY: 0, initX: 0, initY: 0, initW: 0, initH: 0, resizeDir: '', idleTimer: null, rafId: null, isSeeking: false };

    const getVideos = () => [...document.querySelectorAll('video')].filter(v => {
        if (!v?.isConnected || v.closest('#fvp-wrapper')) return false;
        if (isDetectableVideo(v)) return true;
        const rect = getRect(v);
        const hasMediaSource = Boolean(v.currentSrc || v.src || v.querySelector('source[src]'));
        const hasPlaybackState = Number.isFinite(v.duration) || v.readyState > 0 || v.currentTime > 0;
        return hasMediaSource || hasPlaybackState || (rect.width > 0 && rect.height > 0);
    });

    const getOrderedVideoSequence = () => {
        const list = getVideos();
        if (!curVid) return list;
        const withoutCurrent = list.filter(v => v !== curVid);
        if (!ph?.isConnected || !ph.parentNode) return [curVid, ...withoutCurrent];

        const ordered = [];
        let inserted = false;
        for (const video of withoutCurrent) {
            const pos = ph.compareDocumentPosition(video);
            if (!inserted && (pos & Node.DOCUMENT_POSITION_FOLLOWING)) {
                ordered.push(curVid);
                inserted = true;
            }
            ordered.push(video);
        }
        if (!inserted) ordered.push(curVid);
        return ordered;
    };

    const updateVideoDetectionUI = () => {
        if (!iconRef) return;
        for (const f of [...iframeVideoMap.keys()]) if (!f?.isConnected) iframeVideoMap.delete(f);
        const count = getVideos().length + iframeVideoMap.size + (curVid || floatedIframe ? 1 : 0);
        if (count > 0) {
            iconRef.show();
            iconRef.setBadge(count);
        } else {
            iconRef.hide();
        }
    };

    const postToFloatedIframe = cmd => floatedIframe?.contentWindow?.postMessage({ type: 'fvp-iframe-command', ...cmd }, '*');

    // IDLE
    const resetIdle = () => {
        if (iconRef) iconRef.setOpacity(1);
        const panel = $('fvp-left-panel'); if (panel) panel.style.opacity = '1';
        clearTimeout(state.idleTimer);
        state.idleTimer = setTimeout(() => {
            if (iconRef && !menuRef?.element.isConnected) iconRef.setOpacity(0.4);
            const p = $('fvp-left-panel'); if (p) p.style.opacity = '';
        }, 3000);
    };

    const updateVolUI = () => {
        const btn = $('fvp-vol-btn'); if (!btn) return;
        const v = floatedIframe ? (iframePlaybackState.muted ? 0 : iframePlaybackState.volume) : (curVid ? (curVid.muted ? 0 : curVid.volume) : 1);
        btn.textContent = v === 0 ? '🔇' : v < 0.5 ? '🔉' : '🔊';
    };

    const updatePlayPauseUI = () => {
        const btn = $('fvp-play-pause'); if (!btn) return;
        btn.textContent = (floatedIframe ? iframePlaybackState.paused : curVid?.paused ?? true) ? '▶' : '⏸';
    };

    const syncFloatedIframeUI = () => {
        const seek = $('fvp-seek'), dur = iframePlaybackState.duration || 0, cur = iframePlaybackState.currentTime || 0;
        if (seek && dur > 0 && !state.isSeeking) seek.value = (cur / dur) * 10000;
        const td = $('fvp-time-display'); if (td) td.textContent = `${formatTime(cur)}/${formatTime(dur)}`;
        const buf = $('fvp-buffer'); if (buf) buf.style.width = dur > 0 ? `${(iframePlaybackState.bufferedEnd / dur) * 100}%` : '0%';
        updateVolUI(); updatePlayPauseUI();
        const fit = $('fvp-fit'); if (fit) fit.textContent = FIT_ICONS[iframePlaybackState.fitIdx] || FIT_ICONS[0];
        const zoom = $('fvp-zoom'); if (zoom) zoom.textContent = ZOOM_ICONS[iframePlaybackState.zoomIdx] || ZOOM_ICONS[0];
        const rot = $('fvp-rotate'); if (rot) rot.style.transform = `rotate(${iframePlaybackState.rotationAngle || 0}deg)`;
    };

    const applyTransform = () => {
        if (!curVid) return;
        const zoom = ZOOM_LEVELS[zoomIdx], transforms = [];
        if (rotationAngle) transforms.push(`rotate(${rotationAngle}deg)`);
        if (zoom !== 1) transforms.push(`scale(${zoom})`);
        curVid.style.transform = transforms.join(' ');
        curVid.style.objectFit = (rotationAngle === 90 || rotationAngle === 270) ? 'contain' : FIT_MODES[fitIdx];
    };

    const switchVid = dir => {
        const sequence = getOrderedVideoSequence();
        if (!sequence.length) return;
        const currentIndex = curVid && sequence.includes(curVid) ? sequence.indexOf(curVid) : 0;
        const nextIndex = (currentIndex + dir + sequence.length) % sequence.length;
        const nextVideo = sequence[nextIndex];
        if (!nextVideo || nextVideo === curVid) return;
        float(nextVideo);
    };

    const restore = () => {
        if (state.rafId) { cancelAnimationFrame(state.rafId); state.rafId = null; }
        if (floatedIframe) {
            clearInterval(iframeStatePollTimer);
            floatedIframe.setAttribute('style', iframeOrigStyle);
            iframeOrigPar?.replaceChild(floatedIframe, iframePh);
            floatedIframe = null; iframeOrigPar = null; iframePh = null;
        } else if (curVid) {
            origPar?.replaceChild(curVid, ph);
            Object.assign(curVid.style, { width: '', height: '', objectFit: '', objectPosition: '', transform: '' });
            curVid.onplay = curVid.onpause = curVid.onended = null;
            curVid = null;
        }
        if (box) box.style.display = 'none';
        zoomIdx = 0; rotationAngle = 0;
    };

    const floatIframe = iframe => {
        if (floatedIframe) { clearInterval(iframeStatePollTimer); floatedIframe.setAttribute('style', iframeOrigStyle); iframeOrigPar?.replaceChild(floatedIframe, iframePh); }
        if (curVid) restore();
        if (!box) init();
        floatedIframe = iframe; iframeOrigPar = iframe.parentNode; iframeOrigStyle = iframe.getAttribute('style') || '';
        iframePh = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
        iframePh.style.cssText = `width:${iframe.offsetWidth || 300}px;height:${iframe.offsetHeight || 200}px`;
        iframeOrigPar?.replaceChild(iframePh, iframe);
        const wrapper = $('fvp-wrapper'); wrapper.innerHTML = '';
        iframe.style.cssText = 'width:100%!important;height:100%!important;border:none!important;position:absolute;top:0;left:0;';
        wrapper.appendChild(iframe);
        box.style.display = 'flex';
        menuRef?.hide();
        const saved = loadLayout();
        if (saved) { box.style.width = saved.width; box.style.height = saved.height; box.style.top = saved.top; box.style.left = saved.left; box.style.borderRadius = saved.borderRadius || '12px'; }
        iframeStatePollTimer = setInterval(() => postToFloatedIframe({ command: 'get-state' }), 350);
    };

    const float = v => {
        if (floatedIframe) { clearInterval(iframeStatePollTimer); floatedIframe.setAttribute('style', iframeOrigStyle); iframeOrigPar?.replaceChild(floatedIframe, iframePh); floatedIframe = null; }
        if (curVid && curVid !== v) restore();
        if (curVid === v) return;
        if (!box) init();
        origPar = v.parentNode; curVid = v;
        ph = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
        ph.style.cssText = `width:${v.offsetWidth || 300}px;height:${v.offsetHeight || 200}px`;
        origPar?.replaceChild(ph, v);
        const wrapper = $('fvp-wrapper'); wrapper.innerHTML = ''; wrapper.appendChild(v);
        v.style.objectFit = FIT_MODES[fitIdx];
        zoomIdx = 0; rotationAngle = 0; applyTransform();
        updateVolUI();
        box.style.display = 'flex';
        menuRef?.hide();
        const saved = loadLayout();
        if (saved) { box.style.width = saved.width; box.style.height = saved.height; box.style.top = saved.top; box.style.left = saved.left; box.style.borderRadius = saved.borderRadius || '12px'; }
        const updateLoop = () => {
            if (!curVid) return;
            if (!state.isSeeking && curVid.duration) {
                const seek = $('fvp-seek'); if (seek) seek.value = (curVid.currentTime / curVid.duration) * 10000;
                const td = $('fvp-time-display'); if (td) td.textContent = `${formatTime(curVid.currentTime)}/${formatTime(curVid.duration)}`;
            }
            if (curVid.buffered?.length && curVid.duration) { const buf = $('fvp-buffer'); if (buf) buf.style.width = `${(curVid.buffered.end(curVid.buffered.length - 1) / curVid.duration) * 100}%`; }
            state.rafId = requestAnimationFrame(updateLoop);
        };
        state.rafId = requestAnimationFrame(updateLoop);
        v.onplay = v.onpause = updatePlayPauseUI;
        v.onended = () => switchVid(1);
        v.play().catch(() => { });
        updatePlayPauseUI();
    };

    const toggleMenu = () => {
        if (!menuRef) return;
        const isHidden = menuRef.element.hidden || getComputedStyle(menuRef.element).display === 'none';
        if (isHidden) {
            const r = iconRef.element.getBoundingClientRect();
            menuRef.setPosition(
                clamp(r.left, 10, innerWidth - 290),
                innerHeight - r.bottom < 300 ? 'auto' : r.bottom + 10
            );
            if (innerHeight - r.bottom < 300) menuRef.element.style.bottom = `${innerHeight - r.top + 10}px`;
            else menuRef.element.style.bottom = 'auto';
            renderMenu();
            menuRef.show('flex');
        } else {
            menuRef.hide();
        }
    };

    const renderMenu = () => {
        const list = getOrderedVideoSequence();
        const iframeList = [...iframeVideoMap.entries()].filter(([f]) => f.isConnected);
        const total = list.length + iframeList.length;
        const m = menuRef.element;
        m.innerHTML = `<div style="padding:10px 16px;font-size:12px;color:#888;font-weight:600">VIDEOS (${total})</div>`;
        const cb = ext?.features?.cookieBypass;
        if (cb?.isActive?.()) {
            const status = el('div', 'fvp-menu-item'); status.style.cssText = 'font-size:12px;color:#1da6f0;border-top:1px solid #333';
            status.innerHTML = `<span>🍪</span><span style="flex:1">Cookie Bypasser Active (${cb.getBypassedCount()})</span>`;
            m.appendChild(status);
        }
        if (!total) { m.innerHTML += '<div class="fvp-menu-item" style="opacity:0.5">No videos found</div>'; return; }
        list.forEach((v, i) => {
            const item = el('div', 'fvp-menu-item', `<span>🎬</span><span style="flex:1">Video ${i + 1}</span>`);
            item.onclick = () => float(v); m.appendChild(item);
        });
        iframeList.forEach(([iframe], i) => {
            const domain = (() => { try { return new URL(iframe.src).hostname; } catch { return 'iframe'; } })();
            const item = el('div', 'fvp-menu-item', `<span>🖼️</span><span style="flex:1">iFrame: ${domain}</span>`);
            item.onclick = () => floatIframe(iframe); m.appendChild(item);
        });
    };

    // ============================================
    // INIT
    // ============================================
    const init = () => {
        // Icon (Trigger)
        iconRef = floating.createTriggerElement({
            className: 'fvp-idle',
            htmlContent: `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`,
            hidden: true
        });
        iconRef.element.id = 'fvp-master-icon';
        iconPosStorage.load().then((pos) => {
            iconRef.setPosition(pos.left, pos.top);
        });

        // Menu (Panel)
        menuRef = floating.createPanelRoot({ className: 'fvp-menu', hidden: true });
        menuRef.element.id = 'fvp-menu';

        // Player Box (Custom)
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            <div id="fvp-left-drag"></div>
            <div id="fvp-left-panel">
                <button id="fvp-vol-btn" class="fvp-btn">🔊</button>
                <button id="fvp-res" class="fvp-btn" style="font-size:11px;font-weight:700">HD</button>
                <div id="fvp-res-popup"></div>
                <button id="fvp-rotate" class="fvp-btn">↻</button>
                <button id="fvp-zoom" class="fvp-btn">+</button>
                <button id="fvp-fit" class="fvp-btn">⤢</button>
                <button id="fvp-full" class="fvp-btn">⛶</button>
                <button id="fvp-close" class="fvp-btn">✕</button>
                <button id="fvp-play-pause" class="fvp-btn">▶</button>
                <button id="fvp-prev" class="fvp-btn">⏮</button>
                <button id="fvp-next" class="fvp-btn">⏭</button>
            </div>
            <div class="fvp-resize-handle fvp-resize-br"></div>
            <div class="fvp-resize-handle fvp-resize-bl"></div>
            <div id="fvp-ctrl" class="fvp-overlay">
                <div id="fvp-seek-row">
                    <span id="fvp-time-display">0.00/0.00</span>
                    <div id="fvp-seek-container">
                        <div id="fvp-seek-track"><div id="fvp-buffer"></div></div>
                        <input type="range" id="fvp-seek" min="0" max="10000" step="1" value="0">
                    </div>
                </div>
            </div>
        `);
        box.id = 'fvp-container'; box.style.display = 'none';
        document.body.appendChild(box);

        // Bind Behaviors
        floating.bindDragBehavior({
            target: iconRef.element,
            getInitialPosition: () => ({ left: iconRef.element.offsetLeft, top: iconRef.element.offsetTop }),
            onMove: ({ deltaX, deltaY, origin }) => {
                const next = floating.clampFixedPosition({ left: origin.left + deltaX, top: origin.top + deltaY, width: 42, height: 42, margin: 10 });
                iconRef.setPosition(next.left, next.top);
                resetIdle();
            },
            onDragEnd: () => iconPosStorage.save(iconRef.element.style.left, iconRef.element.style.top),
            onClick: toggleMenu
        });

        floating.bindOutsideClickGuard({
            isOpen: () => menuRef.element.style.display !== 'none',
            containsTarget: t => iconRef.element.contains(t) || menuRef.element.contains(t),
            onOutside: () => menuRef.hide()
        });

        // Player Events
        onPointer($('fvp-left-drag'), e => { const c = getCoord(e); state.isDrag = true; state.startX = c.x; state.startY = c.y; state.initX = box.offsetLeft; state.initY = box.offsetTop; });
        box.querySelectorAll('.fvp-resize-handle').forEach(h => onPointer(h, e => {
            state.isResize = true; state.resizeDir = h.className.includes('bl') ? 'bl' : 'br';
            const c = getCoord(e); state.startX = c.x; state.startY = c.y; state.initW = box.offsetWidth; state.initH = box.offsetHeight; state.initX = box.offsetLeft;
        }));
        document.addEventListener('mousemove', e => {
            if (!state.isDrag && !state.isResize) return;
            const c = getCoord(e), dx = c.x - state.startX, dy = c.y - state.startY;
            if (state.isDrag) { box.style.left = `${state.initX + dx}px`; box.style.top = `${state.initY + dy}px`; }
            else if (state.isResize) {
                const nw = state.resizeDir === 'bl' ? state.initW - dx : state.initW + dx;
                box.style.width = `${Math.max(200, nw)}px`; box.style.height = `${Math.max(120, state.initH + dy)}px`;
                if (state.resizeDir === 'bl') box.style.left = `${state.initX + (state.initW - box.offsetWidth)}px`;
            }
        });
        document.addEventListener('mouseup', () => {
            if (state.isDrag || state.isResize) saveLayout({ top: box.style.top, left: box.style.left, width: box.style.width, height: box.style.height, borderRadius: box.style.borderRadius });
            state.isDrag = state.isResize = false;
        });

        // UI Controls
        $('fvp-close').onclick = restore;
        $('fvp-play-pause').onclick = () => { if (floatedIframe) postToFloatedIframe({ command: 'play-pause' }); else curVid?.paused ? curVid.play() : curVid?.pause(); };
        $('fvp-vol-btn').onclick = () => { if (floatedIframe) postToFloatedIframe({ command: 'toggle-mute' }); else if (curVid) { curVid.muted = !curVid.muted; updateVolUI(); } };
        $('fvp-fit').onclick = () => { if (floatedIframe) postToFloatedIframe({ command: 'cycle-fit' }); else { fitIdx = (fitIdx + 1) % FIT_MODES.length; if (curVid) curVid.style.objectFit = FIT_MODES[fitIdx]; $('fvp-fit').textContent = FIT_ICONS[fitIdx]; } };
        $('fvp-zoom').onclick = () => { if (floatedIframe) postToFloatedIframe({ command: 'cycle-zoom' }); else if (curVid) { zoomIdx = (zoomIdx + 1) % ZOOM_LEVELS.length; applyTransform(); $('fvp-zoom').textContent = ZOOM_ICONS[zoomIdx]; } };
        $('fvp-rotate').onclick = () => { if (floatedIframe) postToFloatedIframe({ command: 'rotate' }); else if (curVid) { rotationAngle = (rotationAngle + 90) % 360; applyTransform(); $('fvp-rotate').style.transform = `rotate(${rotationAngle}deg)`; } };
        $('fvp-prev').onclick = () => {
            if (floatedIframe) postToFloatedIframe({ command: 'prev-video' });
            else switchVid(-1);
        };
        $('fvp-next').onclick = () => {
            if (floatedIframe) postToFloatedIframe({ command: 'next-video' });
            else switchVid(1);
        };
        $('fvp-full').onclick = () => { const fs = getFullscreenEl(); if (!fs) box.requestFullscreen?.() || box.webkitRequestFullscreen?.(); else document.exitFullscreen?.() || document.webkitExitFullscreen?.(); };
        $('fvp-res').onclick = () => { const p = $('fvp-res-popup'); if (p.style.display === 'flex') p.style.display = 'none'; else if (floatedIframe) postToFloatedIframe({ command: 'get-quality' }); else window.dispatchEvent(new CustomEvent('fvp-get-quality')); };
        $('fvp-seek').oninput = e => { state.isSeeking = true; const r = e.target.value / 10000; if (floatedIframe) postToFloatedIframe({ command: 'seek-to-ratio', ratio: r }); else if (curVid?.duration) curVid.currentTime = r * curVid.duration; };
        $('fvp-seek').onchange = () => state.isSeeking = false;

        // Message Handling
        window.addEventListener('message', e => {
            if (e.data?.type === 'fvp-iframe-videos') {
                const iframes = document.querySelectorAll('iframe');
                const matched = Array.from(iframes).find(i => i.contentWindow === e.source);
                if (matched) { if (e.data.count > 0) iframeVideoMap.set(matched, e.data.count); else iframeVideoMap.delete(matched); updateVideoDetectionUI(); }
            }
            if (e.data?.type === 'fvp-iframe-state' && floatedIframe?.contentWindow === e.source) { Object.assign(iframePlaybackState, e.data.state || {}); syncFloatedIframeUI(); }
            if (e.data?.type === 'fvp-page-quality-result' || (e.data?.type === 'fvp-iframe-quality-result' && floatedIframe?.contentWindow === e.source)) {
                const p = $('fvp-res-popup'); p.innerHTML = '';
                (e.data.detail || []).forEach(lv => {
                    const item = el('div', `fvp-res-item${lv.active ? ' active' : ''}`, lv.label);
                    item.onclick = ev => { ev.stopPropagation(); if (floatedIframe) postToFloatedIframe({ command: 'set-quality', item: lv }); else window.dispatchEvent(new CustomEvent('fvp-set-quality', { detail: lv })); p.style.display = 'none'; };
                    p.appendChild(item);
                });
                p.style.display = 'flex';
            }
        });
        window.addEventListener('fvp-quality-result', e => {
            const p = $('fvp-res-popup'); p.innerHTML = '';
            (e.detail || []).forEach(lv => {
                const item = el('div', `fvp-res-item${lv.active ? ' active' : ''}`, lv.label);
                item.onclick = ev => { ev.stopPropagation(); window.dispatchEvent(new CustomEvent('fvp-set-quality', { detail: lv })); p.style.display = 'none'; };
                p.appendChild(item);
            });
            p.style.display = 'flex';
        });

        resetIdle();
        setInterval(updateVideoDetectionUI, VIDEO_CHECK_INTERVAL);
        loadCfgAsync();
    };

    ext.features.videoFloating = { init, isActive: () => !!(curVid || floatedIframe) };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
