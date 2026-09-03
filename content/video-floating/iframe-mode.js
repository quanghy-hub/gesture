(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createIframeController = () => {
        const iframeUiState = { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 };
        let isFloatingActive = false;
        let reportTimer = 0;

        const ensureCenterStyle = () => {
            if (document.getElementById('fvp-iframe-center-style')) return;
            const style = document.createElement('style');
            style.id = 'fvp-iframe-center-style';
            style.textContent = `
                html.fvp-iframe-floating, html.fvp-iframe-floating body { height: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; background: #000 !important; overflow: hidden !important; }
                html.fvp-iframe-floating body { display: flex !important; align-items: center !important; justify-content: center !important; }
                html.fvp-iframe-floating .video, html.fvp-iframe-floating #jsVideo { width: 100% !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; background: #000 !important; }
                html.fvp-iframe-floating .video-container, html.fvp-iframe-floating #jsVideoContainer, html.fvp-iframe-floating .plyr, html.fvp-iframe-floating .plyr__video-wrapper { width: 100% !important; height: 100% !important; display: flex !important; align-items: center !important; justify-content: center !important; background: #000 !important; }
                html.fvp-iframe-floating video { width: auto !important; height: auto !important; max-width: 100% !important; max-height: 100% !important; object-fit: contain !important; object-position: center center !important; background: transparent !important; position: relative !important; top: auto !important; left: auto !important; transform: none !important; }
                html.fvp-iframe-floating .video-placeholder, html.fvp-iframe-floating .video-icon { z-index: 2; }
            `;
            (document.head || document.documentElement).appendChild(style);
        };
        const removeCenterStyle = () => {
            document.getElementById('fvp-iframe-center-style')?.remove();
            try {
                document.documentElement.classList.remove('fvp-iframe-floating');
            } catch {
                void 0;
            }
        };
        // Inject once at startup – rules only apply when html has .fvp-iframe-floating, so harmless for normal view.
        ensureCenterStyle();
        // If the embed shows its own big play button after reload, auto-click it
        // so the user doesn't have to click twice (once to float, once to play).
        const tryAutoPlayEmbed = () => {
            try {
                const playBtn = document.getElementById('jsReadyPlay') || document.querySelector('.video-icon__play, #jsReadyPlay');
                if (playBtn && playBtn.offsetParent !== null) playBtn.click();
            } catch {
                void 0;
            }
        };
        const setFloatingActive = (active) => {
            isFloatingActive = active;
            try {
                document.documentElement.classList.toggle('fvp-iframe-floating', !!active);
            } catch {
                void 0;
            }
            if (active) {
                // The move into #fvp-wrapper reloads the iframe document; the new
                // document's video starts in "loading" state and needs a click on
                // its big play button to init HLS. Try now and again shortly after.
                tryAutoPlayEmbed();
                setTimeout(tryAutoPlayEmbed, 800);
                setTimeout(tryAutoPlayEmbed, 1800);
                try {
                    document.querySelectorAll('video').forEach((v) => {
                        v.style.setProperty('object-fit', 'contain', 'important');
                        v.style.setProperty('object-position', 'center center', 'important');
                    });
                } catch {
                    void 0;
                }
            }
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
            onConfigChange() {},
            destroy() {
                removeCenterStyle();
                videoManager.unbindActiveIframeState();
                uninstallMessageBridge();
                uninstallGestures();
                window.removeEventListener('play', onVideoPlay, true);
                window.clearInterval(reportTimer);
            }
        };
    };
})();
