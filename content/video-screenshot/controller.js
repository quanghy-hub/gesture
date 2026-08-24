(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});

    videoScreenshot.createController = (context) => {
        const { ensureStyles } = videoScreenshot;

        let observer = null;
        let removeShortcutListener = () => {};
        let syncTimer = 0;

        const isFeatureEnabled = () => context?.getConfig?.()?.videoScreenshot?.enabled !== false;

        // Pass a proxy context to modules so they can always check feature flag
        const ctx = {
            isFeatureEnabled
        };

        const isExcludedPage = () => /(^|\.)tiktok\.com$/i.test(window.location.hostname);

        if (isExcludedPage()) {
            return {
                onConfigChange() {},
                destroy() {}
            };
        }

        const captureVideo = videoScreenshot.createCaptureVideo(ctx);
        const captureRegion = videoScreenshot.createCaptureRegion(ctx);
        const screenRecorder = videoScreenshot.createScreenRecorder(ctx, captureRegion);
        const trigger = videoScreenshot.createTrigger(ctx, captureVideo);
        const interactions = videoScreenshot.createInteractions(ctx, captureVideo, captureRegion, screenRecorder);

        // Cho phép các module ẩn/hiện floating UI của extension trong lúc
        // chụp vùng màn hình hoặc ghi hình để UI không bị dính vào sản phẩm.
        ctx.suspendFloatingOverlays = () => trigger.setSuppressed(true);
        ctx.restoreFloatingOverlays = () => trigger.setSuppressed(false);

        const queueSyncTrigger = () => {
            // Không tốn chi phí findActiveVideo khi tính năng đang tắt.
            if (!isFeatureEnabled()) {
                return;
            }
            if (syncTimer) {
                return;
            }
            syncTimer = window.setTimeout(() => {
                syncTimer = 0;
                trigger.syncTrigger();
            }, 80);
        };

        const startObserver = () => {
            if (observer || !document.body) {
                return;
            }
            observer = new MutationObserver(() => {
                queueSyncTrigger();
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        };

        const stopObserver = () => {
            observer?.disconnect();
            observer = null;
        };

        const syncObserverLifecycle = () => {
            if (isFeatureEnabled()) {
                startObserver();
                queueSyncTrigger();
            } else {
                stopObserver();
            }
        };

        ensureStyles();
        trigger.ensureTrigger();
        trigger.syncTrigger();

        removeShortcutListener = interactions.bindKeyboardShortcut();
        window.addEventListener('resize', queueSyncTrigger);
        window.addEventListener('scroll', queueSyncTrigger, true);

        if (document.body) {
            syncObserverLifecycle();
        } else {
            window.addEventListener(
                'DOMContentLoaded',
                () => {
                    trigger.syncTrigger();
                    startObserver();
                },
                { once: true }
            );
        }

        return {
            onConfigChange() {
                if (!isFeatureEnabled()) {
                    captureRegion.removeRegionOverlay();
                    screenRecorder.stopScreenRecording();
                    stopObserver();
                    trigger.syncTrigger();
                    return;
                }
                captureRegion.removeRegionOverlay();
                screenRecorder.stopScreenRecording();
                syncObserverLifecycle();
            },
            destroy() {
                stopObserver();
                removeShortcutListener();
                captureRegion.removeRegionOverlay();
                screenRecorder.stopScreenRecording();
                window.removeEventListener('resize', queueSyncTrigger);
                window.removeEventListener('scroll', queueSyncTrigger, true);
                window.clearTimeout(syncTimer);
                trigger.destroy();
            }
        };
    };
})();
