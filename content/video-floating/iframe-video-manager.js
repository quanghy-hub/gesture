(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FIT_MODES, ZOOM_LEVELS } = videoFloating;
    const { getRect, queryAllDeep, getFullscreenEl } = videoFloating.core.utils;
    const { isDetectableVideo, compareVideoPriority, isVideoActivelyPlaying, getDirectVideos } = videoFloating.media.detector;

    videoFloating.createIframeVideoManager = (deps) => {
        const { onStateChange, iframeUiState } = deps;

        let activeIframeVideo = null;
        let styledIframeVideo = null;
        let trackedStateVideo = null;
        const IFRAME_STATE_EVENTS = [
            'play',
            'pause',
            'ended',
            'timeupdate',
            'durationchange',
            'loadedmetadata',
            'volumechange',
            'progress',
            'seeking',
            'seeked'
        ];

        const getVideo = () => {
            const fs = getFullscreenEl();
            if (fs) {
                if (fs.tagName === 'VIDEO' || fs.tagName === 'AUDIO') return fs;
                const video = fs.querySelector('video, audio');
                if (video) return video;
            }
            return getDirectVideos()[0] || null;
        };

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

        const getOwnVideoCount = () => getIframeVideos().length;

        const onActiveIframeStateChange = (event) => {
            const video = event.currentTarget;
            if (video && video !== activeIframeVideo) {
                activeIframeVideo = video;
                applyIframePresentation(activeIframeVideo);
                bindActiveIframeState(activeIframeVideo);
            }
            onStateChange();
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

        const getCurrentIframeVideo = () => {
            const preferredVideo = getIframeVideos()[0] || null;
            if (
                preferredVideo &&
                (!activeIframeVideo?.isConnected || (preferredVideo !== activeIframeVideo && isVideoActivelyPlaying(preferredVideo)))
            ) {
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
            video.style.objectFit =
                iframeUiState.rotationAngle === 90 || iframeUiState.rotationAngle === 270 ? 'contain' : FIT_MODES[iframeUiState.fitIdx];
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

        const setActiveIframeVideo = (video) => {
            activeIframeVideo = video;
            bindActiveIframeState(activeIframeVideo);
            applyIframePresentation(activeIframeVideo);
        };

        return {
            getOwnVideoCount,
            getIframeVideos,
            getCurrentIframeVideo,
            applyIframePresentation,
            switchIframeVideo,
            unbindActiveIframeState,
            setActiveIframeVideo
        };
    };
})();
