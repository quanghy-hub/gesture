(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    const {
        FVP_IFRAME_BRIDGE,
        FIT_MODES,
        ZOOM_LEVELS,
        WHEEL_GESTURE,
    } = videoFloating;
    const {
        clamp,
        getRect,
        queryAllDeep,
        isDetectableVideo,
        getVideo,
        compareVideoPriority,
        isVideoActivelyPlaying,
        TOUCH_SWITCH_VIDEO_EVENT,
    } = videoFloating.helpers;

    videoFloating.createIframeController = () => {
        const childFrameVideoMap = new Map();
        const iframeUiState = { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 };
        const IFRAME_STATE_EVENTS = ['play', 'pause', 'ended', 'timeupdate', 'durationchange', 'loadedmetadata', 'volumechange', 'progress', 'seeking', 'seeked'];
        let activeIframeVideo = null;
        let styledIframeVideo = null;
        let trackedStateVideo = null;
        let reportTimer = 0;
        let isFloatingActive = false;
        let wheelDeltaY = 0;
        let wheelGestureResetTimer = 0;
        let wheelSeekBaseTime = null;
        let wheelSeekDeltaX = 0;
        let lastWheelSwitchAt = 0;
        let hasSwitchedInCurrentGesture = false;

        const getOwnVideoCount = () => getIframeVideos().length;
        const getIframeVideos = () => {
            const unique = new Set();
            for (const video of queryAllDeep('video, audio')) {
                if (!video?.isConnected) continue;

                if (!isDetectableVideo(video)) continue;

                try {
                    const style = window.getComputedStyle(video);
                    if (style.display === 'none' || style.visibility === 'hidden') continue;
                } catch {
                    // Some cross-origin or detached nodes may not expose computed styles.
                }

                const isYouTube = location.hostname.includes('youtube.com') || location.hostname.includes('youtube-nocookie.com');
                if (isYouTube) {
                    const isMainPlayer = video.classList.contains('html5-main-video') || video.closest('#movie_player');
                    if (!isMainPlayer) continue;
                }

                const rect = getRect(video);
                const hasMediaSource = Boolean(video.currentSrc || video.src || video.querySelector('source[src]'));
                const hasPlaybackState = Number.isFinite(video.duration) || video.readyState > 0 || video.currentTime > 0;
                const largeEnough = rect.width >= 160 && rect.height >= 90;
                if (!(hasMediaSource || hasPlaybackState || largeEnough)) continue;

                unique.add(video);
            }
            return [...unique].sort(compareVideoPriority);
        };

        const postIframeBridgeMessage = (payload) => {
            try {
                window.postMessage({ source: FVP_IFRAME_BRIDGE, ...payload }, '*');
            } catch {
                // Bridge delivery is best-effort across frame boundaries.
            }
        };

        const pruneChildFrames = () => {
            for (const frame of [...childFrameVideoMap.keys()]) {
                if (!frame?.isConnected) childFrameVideoMap.delete(frame);
            }
        };

        const getCurrentIframeVideo = () => {
            const preferredVideo = getIframeVideos()[0] || null;
            if (preferredVideo && (!activeIframeVideo?.isConnected || (preferredVideo !== activeIframeVideo && isVideoActivelyPlaying(preferredVideo)))) {
                activeIframeVideo = preferredVideo;
            }
            if (activeIframeVideo?.isConnected) {
                bindActiveIframeState(activeIframeVideo);
                return activeIframeVideo;
            }
            activeIframeVideo = getVideo() || preferredVideo;
            bindActiveIframeState(activeIframeVideo);
            return activeIframeVideo;
        };

        const unbindActiveIframeState = () => {
            if (!trackedStateVideo) return;
            IFRAME_STATE_EVENTS.forEach((eventName) => trackedStateVideo.removeEventListener(eventName, onActiveIframeStateChange));
            trackedStateVideo = null;
        };

        const bindActiveIframeState = (video) => {
            if (trackedStateVideo === video) return;
            unbindActiveIframeState();
            if (!video) return;
            trackedStateVideo = video;
            IFRAME_STATE_EVENTS.forEach((eventName) => trackedStateVideo.addEventListener(eventName, onActiveIframeStateChange));
        };

        const onActiveIframeStateChange = (event) => {
            const video = event.currentTarget;
            if (video && video !== activeIframeVideo) {
                activeIframeVideo = video;
                applyIframePresentation(activeIframeVideo);
                bindActiveIframeState(activeIframeVideo);
            }
            postIframeState();
        };

        const applyIframePresentation = (video = getCurrentIframeVideo()) => {
            if (!video) return;
            if (styledIframeVideo && styledIframeVideo !== video) {
                Object.assign(styledIframeVideo.style, { objectFit: '', transform: '' });
            }
            styledIframeVideo = video;
            const zoom = ZOOM_LEVELS[iframeUiState.zoomIdx];
            const transforms = [];
            if (iframeUiState.rotationAngle) transforms.push(`rotate(${iframeUiState.rotationAngle}deg)`);
            if (zoom !== 1) transforms.push(`scale(${zoom})`);
            video.style.transform = transforms.join(' ');
            video.style.objectFit = (iframeUiState.rotationAngle === 90 || iframeUiState.rotationAngle === 270)
                ? 'contain'
                : FIT_MODES[iframeUiState.fitIdx];
        };

        const switchIframeVideo = (dir) => {
            const list = getIframeVideos();
            if (!list.length) return;
            const current = getCurrentIframeVideo();
            const index = Math.max(0, list.indexOf(current));
            activeIframeVideo = list[(index + dir + list.length) % list.length];
            bindActiveIframeState(activeIframeVideo);
            Object.assign(iframeUiState, { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 });
            applyIframePresentation(activeIframeVideo);
        };

        const postIframeState = () => {
            const video = getCurrentIframeVideo();
            try {
                window.parent.postMessage({
                    type: 'fvp-iframe-state',
                    state: video ? {
                        hasVideo: true,
                        paused: !!video.paused,
                        muted: !!video.muted,
                        volume: video.volume || 1,
                        currentTime: video.currentTime || 0,
                        duration: video.duration || 0,
                        bufferedEnd: video.buffered?.length ? video.buffered.end(video.buffered.length - 1) : 0,
                        fitIdx: iframeUiState.fitIdx,
                        zoomIdx: iframeUiState.zoomIdx,
                        rotationAngle: iframeUiState.rotationAngle
                    } : {
                        hasVideo: false,
                        paused: true,
                        muted: false,
                        volume: 1,
                        currentTime: 0,
                        duration: 0,
                        bufferedEnd: 0,
                        fitIdx: 0,
                        zoomIdx: 0,
                        rotationAngle: 0
                    }
                }, '*');
            } catch {
                // Parent may be gone while the iframe is unloading.
            }
        };

        const reportVideos = () => {
            pruneChildFrames();
            try {
                window.parent.postMessage({
                    type: 'fvp-iframe-videos',
                    count: getOwnVideoCount() + [...childFrameVideoMap.values()].reduce((sum, count) => sum + count, 0)
                }, '*');
            } catch {
                // Parent may be gone while the iframe is unloading.
            }
        };

        const playIframeVideo = (video) => {
            if (!video) return;
            video.play?.().catch(() => {
                postIframeState();
            });
        };

        const scheduleWheelGestureReset = () => {
            clearTimeout(wheelGestureResetTimer);
            wheelGestureResetTimer = window.setTimeout(() => {
                wheelDeltaY = 0;
                wheelSeekBaseTime = null;
                wheelSeekDeltaX = 0;
                wheelGestureResetTimer = 0;
                hasSwitchedInCurrentGesture = false;
            }, WHEEL_GESTURE.idleMs);
        };
        const getWheelDeltaPixels = (event) => {
            const delta = Number(event?.deltaY) || 0;
            if (event?.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
            if (event?.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * Math.max(1, innerHeight);
            return delta;
        };

        const seekFromWheel = (deltaX) => {
            const video = getCurrentIframeVideo();
            if (!video?.duration) return false;
            if (wheelSeekBaseTime === null) {
                wheelSeekBaseTime = video.currentTime || 0;
                wheelSeekDeltaX = 0;
            }
            wheelSeekDeltaX -= deltaX;
            video.currentTime = clamp(
                wheelSeekBaseTime + wheelSeekDeltaX * WHEEL_GESTURE.seekSecondsPerPixel,
                0,
                video.duration
            );
            postIframeState();
            return true;
        };

        const ALLOWED_IFRAME_COMMANDS = new Set([
            'set-floating-active',
            'play',
            'pause',
            'play-pause',
            'toggle-mute',
            'seek-to-ratio',
            'prev-video',
            'next-video',
            'cycle-fit',
            'cycle-zoom',
            'rotate',
            'get-state',
            'get-quality',
            'set-quality'
        ]);

        const onMessage = (event) => {
            if (!event || !event.data || typeof event.data !== 'object') return;

            if (event.source === window && event.data?.source === FVP_IFRAME_BRIDGE) {
                if (event.data?.type === 'fvp-page-quality-result') {
                    try {
                        window.parent.postMessage({ type: 'fvp-iframe-quality-result', detail: Array.isArray(event.data.detail) ? event.data.detail : [] }, '*');
                    } catch {
                        // Parent may be gone while the iframe is unloading.
                    }
                }
                return;
            }

            if (event.data?.type === 'fvp-iframe-videos') {
                if (event.source === window) return;
                const frame = Array.from(queryAllDeep('iframe')).find((iframe) => iframe.contentWindow === event.source);
                if (frame) {
                    const count = Number(event.data.count) || 0;
                    if (count > 0) childFrameVideoMap.set(frame, count);
                    else childFrameVideoMap.delete(frame);
                    reportVideos();
                }
                return;
            }

            if (event.data?.type !== 'fvp-iframe-command') return;

            // Security check: Only process iframe commands originating from top/parent frames or self
            if (event.source !== window.parent && event.source !== window.top && event.source !== window) {
                return;
            }

            const command = String(event.data.command || '').trim();
            if (!ALLOWED_IFRAME_COMMANDS.has(command)) {
                return;
            }

            if (command === 'set-floating-active') {
                isFloatingActive = !!event.data.active;
                return;
            }
            const video = getCurrentIframeVideo();
            switch (command) {
                case 'play': playIframeVideo(video); break;
                case 'pause': if (video) video.pause(); break;
                case 'play-pause': if (video) video.paused ? playIframeVideo(video) : video.pause(); break;
                case 'toggle-mute': if (video) video.muted = !video.muted; break;
                case 'seek-to-ratio': if (video?.duration) video.currentTime = clamp((Number(event.data.ratio) || 0) * video.duration, 0, video.duration); break;
                case 'prev-video': switchIframeVideo(-1); break;
                case 'next-video': switchIframeVideo(1); break;
                case 'cycle-fit': iframeUiState.fitIdx = (iframeUiState.fitIdx + 1) % FIT_MODES.length; applyIframePresentation(); break;
                case 'cycle-zoom': iframeUiState.zoomIdx = (iframeUiState.zoomIdx + 1) % ZOOM_LEVELS.length; applyIframePresentation(); break;
                case 'rotate': iframeUiState.rotationAngle = (iframeUiState.rotationAngle + 90) % 360; applyIframePresentation(); break;
                case 'get-state': break;
                case 'get-quality': postIframeBridgeMessage({ type: 'fvp-page-get-quality' }); break;
                case 'set-quality': if (event.data.item && typeof event.data.item === 'object') postIframeBridgeMessage({ type: 'fvp-page-set-quality', item: event.data.item }); break;
                default: break;
            }
            postIframeState();
            if (command !== 'get-state') setTimeout(postIframeState, 80);
        };

        const onWheel = (event) => {
            if (!isFloatingActive) return;
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            scheduleWheelGestureReset();

            const absX = Math.abs(event.deltaX || 0);
            const absY = Math.abs(event.deltaY || 0);
            if (absX > 0 && absX >= absY * 0.8) {
                seekFromWheel(event.deltaX || 0);
                return;
            }

            if (hasSwitchedInCurrentGesture) return;

            wheelDeltaY += getWheelDeltaPixels(event);
            if (Math.abs(wheelDeltaY) < WHEEL_GESTURE.switchThreshold) return;

            const now = performance.now();
            if (now - lastWheelSwitchAt < WHEEL_GESTURE.switchCooldownMs) return;

            const dir = wheelDeltaY > 0 ? 1 : -1;
            switchIframeVideo(dir);
            hasSwitchedInCurrentGesture = true;
            wheelDeltaY -= dir * WHEEL_GESTURE.switchThreshold;
            if (Math.sign(wheelDeltaY) !== dir) wheelDeltaY = 0;
            lastWheelSwitchAt = now;
            postIframeState();
            setTimeout(postIframeState, 80);
        };

        window.addEventListener('message', onMessage);
        window.addEventListener('wheel', onWheel, { capture: true, passive: false });
        const onVideoPlay = (event) => {
            const video = event.target;
            if (!(video instanceof HTMLVideoElement) || !video.isConnected) return;
            activeIframeVideo = video;
            bindActiveIframeState(activeIframeVideo);
            applyIframePresentation(activeIframeVideo);
            postIframeState();
        };
        window.addEventListener('play', onVideoPlay, true);
        const onTouchSwitchVideo = (event) => {
            const dir = Number(event.detail?.dir) || 0;
            if (!dir) return;
            switchIframeVideo(dir > 0 ? 1 : -1);
            postIframeState();
        };
        window.addEventListener(TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);
        reportTimer = window.setInterval(reportVideos, videoFloating.VIDEO_CHECK_INTERVAL);
        reportVideos();
        postIframeState();

        return {
            onConfigChange() { },
            destroy() {
                unbindActiveIframeState();
                window.removeEventListener('message', onMessage);
                window.removeEventListener('wheel', onWheel, { capture: true, passive: false });
                window.removeEventListener('play', onVideoPlay, true);
                window.removeEventListener(TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);
                window.clearInterval(reportTimer);
                clearTimeout(wheelGestureResetTimer);
            }
        };
    };
})();
