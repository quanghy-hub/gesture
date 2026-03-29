(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    const {
        FVP_IFRAME_BRIDGE,
        FIT_MODES,
        FIT_ICONS,
        ZOOM_LEVELS,
        ZOOM_ICONS
    } = videoFloating;
    const {
        $,
        clamp,
        getRect,
        getTrackedIframeEntries,
        isDetectableVideo,
        isLikelyVideoIframe,
        getVideo,
        bindStorageListener
    } = videoFloating.helpers;

    videoFloating.createIframeController = () => {
        const childFrameVideoMap = new Map();
        const iframeUiState = { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 };
        let activeIframeVideo = null;
        let styledIframeVideo = null;
        let reportTimer = 0;

        const getOwnVideoCount = () => document.querySelectorAll('video').length;
        const getIframeVideos = () => [...document.querySelectorAll('video')].filter((video) => {
            if (!video?.isConnected) return false;
            if (isDetectableVideo(video)) return true;
            const rect = getRect(video);
            const hasMediaSource = Boolean(video.currentSrc || video.src || video.querySelector('source[src]'));
            const hasPlaybackState = Number.isFinite(video.duration) || video.readyState > 0 || video.currentTime > 0;
            return hasMediaSource || hasPlaybackState || (rect.width > 0 && rect.height > 0);
        });

        const postIframeBridgeMessage = (payload) => {
            try {
                window.postMessage({ source: FVP_IFRAME_BRIDGE, ...payload }, '*');
            } catch { }
        };

        const pruneChildFrames = () => {
            for (const frame of [...childFrameVideoMap.keys()]) {
                if (!frame?.isConnected) childFrameVideoMap.delete(frame);
            }
        };

        const getCurrentIframeVideo = () => {
            if (activeIframeVideo?.isConnected) return activeIframeVideo;
            activeIframeVideo = getVideo() || getIframeVideos()[0] || null;
            return activeIframeVideo;
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
            } catch { }
        };

        const reportVideos = () => {
            pruneChildFrames();
            try {
                window.parent.postMessage({
                    type: 'fvp-iframe-videos',
                    count: getOwnVideoCount() + [...childFrameVideoMap.values()].reduce((sum, count) => sum + count, 0)
                }, '*');
            } catch { }
        };

        const onMessage = (event) => {
            if (event.source === window && event.data?.source === FVP_IFRAME_BRIDGE) {
                if (event.data?.type === 'fvp-page-quality-result') {
                    try {
                        window.parent.postMessage({ type: 'fvp-iframe-quality-result', detail: event.data.detail || [] }, '*');
                    } catch { }
                }
                return;
            }
            if (event.data?.type === 'fvp-iframe-videos') {
                const frame = Array.from(document.querySelectorAll('iframe')).find((iframe) => iframe.contentWindow === event.source);
                if (frame) {
                    if (event.data.count > 0) childFrameVideoMap.set(frame, event.data.count);
                    else childFrameVideoMap.delete(frame);
                    reportVideos();
                }
                return;
            }
            if (event.data?.type !== 'fvp-iframe-command') return;
            const video = getCurrentIframeVideo();
            switch (event.data.command) {
                case 'play-pause': if (video) video.paused ? video.play().catch(() => { }) : video.pause(); break;
                case 'toggle-mute': if (video) video.muted = !video.muted; break;
                case 'seek-to-ratio': if (video?.duration) video.currentTime = clamp((event.data.ratio || 0) * video.duration, 0, video.duration); break;
                case 'prev-video': switchIframeVideo(-1); break;
                case 'next-video': switchIframeVideo(1); break;
                case 'cycle-fit': iframeUiState.fitIdx = (iframeUiState.fitIdx + 1) % FIT_MODES.length; applyIframePresentation(); break;
                case 'cycle-zoom': iframeUiState.zoomIdx = (iframeUiState.zoomIdx + 1) % ZOOM_LEVELS.length; applyIframePresentation(); break;
                case 'rotate': iframeUiState.rotationAngle = (iframeUiState.rotationAngle + 90) % 360; applyIframePresentation(); break;
                case 'get-quality': postIframeBridgeMessage({ type: 'fvp-page-get-quality' }); break;
                case 'set-quality': postIframeBridgeMessage({ type: 'fvp-page-set-quality', item: event.data.item }); break;
                default: break;
            }
            postIframeState();
            setTimeout(postIframeState, 80);
        };

        window.addEventListener('message', onMessage);
        reportTimer = window.setInterval(reportVideos, videoFloating.VIDEO_CHECK_INTERVAL);
        reportVideos();

        return {
            onConfigChange() { },
            destroy() {
                window.removeEventListener('message', onMessage);
                window.clearInterval(reportTimer);
            }
        };
    };
})();
