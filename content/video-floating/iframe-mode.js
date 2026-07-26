(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};

    videoFloating.createIframeController = () => {
        const iframeUiState = { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 };
        let isFloatingActive = false;
        let reportTimer = 0;

        const setFloatingActive = (active) => {
            isFloatingActive = active;
        };

        const getFloatingActive = () => isFloatingActive;

        const videoManager = videoFloating.createIframeVideoManager({
            iframeUiState,
            onStateChange: () => messageBridge.postIframeState()
        });

        const messageBridge = videoFloating.createIframeMessageBridge({
            videoManager,
            iframeUiState,
            setFloatingActive
        });

        const gestures = videoFloating.createIframeGestures({
            videoManager,
            getFloatingActive,
            postIframeState: () => messageBridge.postIframeState()
        });

        const uninstallMessageBridge = messageBridge.install();
        const uninstallGestures = gestures.install();

        const onVideoPlay = (event) => {
            const video = event.target;
            if (!(video instanceof HTMLVideoElement) || !video.isConnected) return;
            videoManager.setActiveIframeVideo(video);
            messageBridge.postIframeState();
        };
        window.addEventListener('play', onVideoPlay, true);
        
        reportTimer = window.setInterval(messageBridge.reportVideos, videoFloating.VIDEO_CHECK_INTERVAL);
        messageBridge.reportVideos();
        messageBridge.postIframeState();

        return {
            onConfigChange() { },
            destroy() {
                videoManager.unbindActiveIframeState();
                uninstallMessageBridge();
                uninstallGestures();
                window.removeEventListener('play', onVideoPlay, true);
                window.clearInterval(reportTimer);
            }
        };
    };
})();
