(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FVP_IFRAME_BRIDGE, FIT_MODES, ZOOM_LEVELS } = videoFloating;
    const { queryAllDeep, clamp } = videoFloating.core.utils;

    videoFloating.createIframeMessageBridge = (deps) => {
        const { videoManager, iframeUiState, setFloatingActive } = deps;
        const childFrameVideoMap = new Map();

        const postIframeBridgeMessage = (payload) => {
            try {
                window.postMessage({ source: FVP_IFRAME_BRIDGE, ...payload }, '*');
            } catch {
                // Bridge delivery is best-effort across frame boundaries.
            }
        };

        const postIframeState = () => {
            const video = videoManager.getCurrentIframeVideo();
            try {
                window.parent.postMessage(
                    {
                        type: 'fvp-iframe-state',
                        state: video
                            ? {
                                  hasVideo: true,
                                  paused: !!video.paused,
                                  muted: !!video.muted,
                                  volume: video.volume || 1,
                                  currentTime: video.currentTime || 0,
                                  duration: video.duration || 0,
                                  playbackRate: video.playbackRate || 1,
                                  bufferedEnd: video.buffered?.length ? video.buffered.end(video.buffered.length - 1) : 0,
                                  fitIdx: iframeUiState.fitIdx,
                                  zoomIdx: iframeUiState.zoomIdx,
                                  rotationAngle: iframeUiState.rotationAngle
                              }
                            : {
                                  hasVideo: false,
                                  paused: true,
                                  muted: false,
                                  volume: 1,
                                  currentTime: 0,
                                  duration: 0,
                                  playbackRate: 1,
                                  bufferedEnd: 0,
                                  fitIdx: 0,
                                  zoomIdx: 0,
                                  rotationAngle: 0
                              }
                    },
                    '*'
                );
            } catch {
                // Parent may be gone while the iframe is unloading.
            }
        };

        const forwardCommandToChildren = (data) => {
            for (const frame of [...childFrameVideoMap.keys()]) {
                try {
                    frame.contentWindow?.postMessage({ type: 'fvp-iframe-command', ...data }, '*');
                } catch {
                    // Best-effort forwarding to nested frames.
                }
            }
        };

        const pruneChildFrames = () => {
            for (const frame of [...childFrameVideoMap.keys()]) {
                if (!frame?.isConnected) childFrameVideoMap.delete(frame);
            }
        };

        const reportVideos = () => {
            pruneChildFrames();
            try {
                window.parent.postMessage(
                    {
                        type: 'fvp-iframe-videos',
                        count: videoManager.getOwnVideoCount() + [...childFrameVideoMap.values()].reduce((sum, count) => sum + count, 0)
                    },
                    '*'
                );
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
            'set-quality',
            'set-speed'
        ]);

        const onMessage = (event) => {
            if (!event || !event.data || typeof event.data !== 'object') return;

            if (event.source === window && event.data?.source === FVP_IFRAME_BRIDGE) {
                if (event.data?.type === 'fvp-page-quality-result') {
                    try {
                        window.parent.postMessage(
                            { type: 'fvp-iframe-quality-result', detail: Array.isArray(event.data.detail) ? event.data.detail : [] },
                            '*'
                        );
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

            if (event.data?.type === 'fvp-iframe-state' && event.source !== window) {
                try {
                    window.parent.postMessage({ type: 'fvp-iframe-state', state: event.data.state }, '*');
                } catch {
                    // Parent may be gone while the iframe is unloading.
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
                setFloatingActive(!!event.data.active);
                forwardCommandToChildren(event.data);
                return;
            }

            const video = videoManager.getCurrentIframeVideo();
            if (!video) {
                // No video in this document — forward to nested frames that reported videos.
                forwardCommandToChildren(event.data);
                return;
            }

            switch (command) {
                case 'play':
                    playIframeVideo(video);
                    break;
                case 'pause':
                    if (video) video.pause();
                    break;
                case 'play-pause':
                    if (video) video.paused ? playIframeVideo(video) : video.pause();
                    break;
                case 'toggle-mute':
                    if (video) video.muted = !video.muted;
                    break;
                case 'seek-to-ratio':
                    if (video?.duration) video.currentTime = clamp((Number(event.data.ratio) || 0) * video.duration, 0, video.duration);
                    break;
                case 'prev-video':
                    videoManager.switchIframeVideo(-1);
                    break;
                case 'next-video':
                    videoManager.switchIframeVideo(1);
                    break;
                case 'cycle-fit':
                    iframeUiState.fitIdx = (iframeUiState.fitIdx + 1) % FIT_MODES.length;
                    videoManager.applyIframePresentation();
                    break;
                case 'cycle-zoom':
                    iframeUiState.zoomIdx = (iframeUiState.zoomIdx + 1) % ZOOM_LEVELS.length;
                    videoManager.applyIframePresentation();
                    break;
                case 'rotate':
                    iframeUiState.rotationAngle = (iframeUiState.rotationAngle + 90) % 360;
                    videoManager.applyIframePresentation();
                    break;
                case 'get-state':
                    break;
                case 'get-quality':
                    postIframeBridgeMessage({ type: 'fvp-page-get-quality' });
                    break;
                case 'set-quality':
                    if (event.data.item && typeof event.data.item === 'object')
                        postIframeBridgeMessage({ type: 'fvp-page-set-quality', item: event.data.item });
                    break;
                case 'set-speed':
                    if (video) video.playbackRate = Number(event.data.rate) || 1;
                    break;
                default:
                    break;
            }
            postIframeState();
            if (command !== 'get-state') setTimeout(postIframeState, 80);
        };

        const install = () => {
            window.addEventListener('message', onMessage);
            return () => {
                window.removeEventListener('message', onMessage);
            };
        };

        return {
            install,
            postIframeState,
            reportVideos
        };
    };
})();
