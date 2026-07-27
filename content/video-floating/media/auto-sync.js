(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.media = videoFloating.media || {};

    videoFloating.media.createAutoSync = (ctx) => {
        const { getRect, $ } = videoFloating.core.utils;

        let floatingSession = null;
        let lastAutoSyncAt = 0;

        const setFloatingSession = (fs) => {
            floatingSession = fs;
        };

        const canAutoSyncFloatingVideo = () =>
            videoFloating.core.config.isFeatureEnabled() &&
            !ctx.floatedIframe &&
            !!ctx.curVid &&
            ctx.box?.style.display !== 'none' &&
            !ctx.state.isSwitchingVideo &&
            !ctx.state.isDrag &&
            !ctx.state.isResize &&
            !ctx.state.isSeeking &&
            !ctx.state.seekDragActive;

        const getFloatingSyncReferenceRect = () => {
            const wrapper = $('fvp-wrapper');
            const wrapperRect = wrapper ? getRect(wrapper) : null;
            if (wrapperRect?.width && wrapperRect?.height) return wrapperRect;
            return ctx.curVid ? getRect(ctx.curVid) : null;
        };

        const syncFloatingWithPlayingDirectVideo = (candidate = null) => {
            if (!canAutoSyncFloatingVideo()) return;
            if (candidate && (!candidate.isConnected || candidate.closest?.('#fvp-wrapper'))) return;

            const detector = videoFloating.media.detector;
            const preferredVideo = candidate || detector.getDirectVideos()[0];

            if (!preferredVideo || preferredVideo === ctx.curVid) return;
            if (!detector.isDetectableVideo(preferredVideo)) return;
            if (!detector.isVideoActivelyPlaying(preferredVideo)) return;

            // isVideoAutoSyncCandidate requires implementation!
            // Wait, isVideoAutoSyncCandidate is in helpers.js. Let's move it to detector.js.
            if (!detector.isVideoAutoSyncCandidate?.(preferredVideo, { referenceRect: getFloatingSyncReferenceRect() })) return;

            const now = performance.now();
            if (now - lastAutoSyncAt < 350) return;
            lastAutoSyncAt = now;

            floatingSession.float(preferredVideo);
        };

        const getPlaybackEventVideo = (event) => {
            const directTarget = event.target instanceof HTMLVideoElement ? event.target : null;
            if (directTarget) return directTarget;
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            return path.find((node) => node instanceof HTMLVideoElement) || null;
        };

        const onDirectVideoPlayback = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            const video = getPlaybackEventVideo(event);
            if (!video || !video.isConnected || video.closest('#fvp-wrapper')) return;
            window.setTimeout(() => syncFloatingWithPlayingDirectVideo(video), 80);
        };

        const bindEvents = () => {
            ['play', 'playing'].forEach((eventName) => {
                window.addEventListener(eventName, onDirectVideoPlayback, true);
                ctx.cleanup.push(() => window.removeEventListener(eventName, onDirectVideoPlayback, true));
            });

            const autoSyncTimer = window.setInterval(() => syncFloatingWithPlayingDirectVideo(), 750);
            ctx.cleanup.push(() => window.clearInterval(autoSyncTimer));

            return {
                syncFloatingWithPlayingDirectVideo
            };
        };

        return { bindEvents, syncFloatingWithPlayingDirectVideo, setFloatingSession };
    };
})();
