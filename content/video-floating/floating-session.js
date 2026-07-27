(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createFloatingSession = (ctx, deps) => {
        const videoCollection = videoFloating.createVideoCollection(ctx, deps);

        let videoLifecycle;
        let iframeLifecycle;
        let videoSwitcher;

        videoLifecycle = videoFloating.createVideoLifecycle(ctx, deps, videoCollection);

        iframeLifecycle = videoFloating.createIframeLifecycle(ctx, deps, videoLifecycle, videoCollection);

        videoSwitcher = videoFloating.createVideoSwitcher(ctx, deps, videoCollection, videoLifecycle);

        // Bridge circular dependencies with arrow functions
        const cleanupSwitchTransition = () => videoSwitcher.cleanupSwitchTransition();
        const restoreFloatedIframe = (opts) => iframeLifecycle.restoreFloatedIframe(opts);
        const floatFunc = (video) => videoLifecycle.float(video, restore, onVideoEnded);
        const onVideoEnded = () => videoSwitcher.switchVid(1, floatFunc, onVideoEnded);

        const restore = (skipSwitchCleanup, skipIframeRestore) => {
            videoLifecycle.restore(skipSwitchCleanup ? null : cleanupSwitchTransition, skipIframeRestore ? null : restoreFloatedIframe);
        };

        const float = (video) => videoLifecycle.float(video, restore, onVideoEnded);
        const floatIframe = (iframe) => iframeLifecycle.floatIframe(iframe, restore);
        const switchVid = (dir) => videoSwitcher.switchVid(dir, float, onVideoEnded);

        return {
            getVideos: videoCollection.getVideos,
            getOrderedVideoSequence: videoCollection.getOrderedVideoSequence,
            updateVideoDetectionUI: videoCollection.updateVideoDetectionUI,
            applyTransform: videoLifecycle.applyTransform,
            restore,
            switchVid,
            floatIframe,
            float
        };
    };
})();
