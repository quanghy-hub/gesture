(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});

    videoScreenshot.createInteractions = (ctx, captureVideo, captureRegion, screenRecorder) => {
        const { CONFIG } = videoScreenshot;

        const bindKeyboardShortcut = () => {
            const onKeyDown = (event) => {
                if (captureRegion.isRegionModeActive() && event.key === 'Escape') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    captureRegion.removeRegionOverlay();
                    return;
                }
                if (screenRecorder.isRecording() && event.code === CONFIG.recordShortcutCode) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    screenRecorder.stopScreenRecording();
                    return;
                }

                const target = event.target;
                if (
                    !(target instanceof HTMLElement) ||
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable ||
                    event.ctrlKey ||
                    event.altKey ||
                    event.metaKey
                ) {
                    return;
                }
                if (event.code === CONFIG.regionShortcutCode) {
                    if (!ctx.isFeatureEnabled() || !captureRegion.canUseRegionScreenshot()) {
                        return;
                    }
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    captureRegion.startRegionMode({
                        hintText: 'Giữ chuột trái và kéo để chụp vùng',
                        onComplete: (region) => {
                            captureRegion.downloadRegion(region).catch((error) => {
                                console.error('[GestureExtension] Region capture failed', error);
                            });
                        }
                    });
                    return;
                }
                if (event.code === CONFIG.recordShortcutCode) {
                    if (!ctx.isFeatureEnabled() || !screenRecorder.canUseScreenRecorder()) {
                        return;
                    }
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    screenRecorder.toggleScreenRecording();
                    return;
                }
                if (event.key.toLowerCase() !== CONFIG.shortcutKey) {
                    return;
                }
                if (!ctx.isFeatureEnabled()) {
                    return;
                }
                if (!captureVideo.findActiveVideo()) {
                    return;
                }
                event.preventDefault();
                captureVideo.captureActiveVideo();
            };
            document.addEventListener('keydown', onKeyDown, true);
            return () => document.removeEventListener('keydown', onKeyDown, true);
        };

        return {
            bindKeyboardShortcut
        };
    };
})();
