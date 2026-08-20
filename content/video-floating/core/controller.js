(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.core = videoFloating.core || {};

    videoFloating.createTopFrameController = () => {
        const ctx = videoFloating.core.createContext();

        const layoutManager = videoFloating.ui.createLayoutManager(ctx);
        const shell = videoFloating.ui.createShell(ctx);
        const autoSync = videoFloating.media.createAutoSync(ctx);
        const menu = videoFloating.ui.createMenu(ctx);

        const postToFloatedIframe = (cmd) => ctx.floatedIframe?.contentWindow?.postMessage({ type: 'fvp-iframe-command', ...cmd }, '*');

        videoFloating.interactions.floatedIframeSeek = {
            getDuration: () => ctx.iframePlaybackState.duration || 0,
            getCurrentTime: () => ctx.iframePlaybackState.currentTime || 0,
            seekToRatio: (ratio) => postToFloatedIframe({ command: 'seek-to-ratio', ratio: videoFloating.core.utils.clamp(ratio, 0, 1) })
        };
        ctx.cleanup.push(() => {
            videoFloating.interactions.floatedIframeSeek = null;
        });

        const floatingSession = videoFloating.createFloatingSession(ctx, {
            el: videoFloating.core.utils.el,
            $: videoFloating.core.utils.$,
            getDirectVideos: videoFloating.media.detector.getDirectVideos,
            getDirectVideoSequence: videoFloating.media.detector.getDirectVideoSequence,
            getTrackedIframeEntries: videoFloating.media.detector.getTrackedIframeEntries,
            isFeatureEnabled: videoFloating.core.config.isFeatureEnabled,
            loadLayout: videoFloating.core.config.loadLayout,
            ensureLayoutReady: videoFloating.core.config.ensureLayoutReady,
            formatTime: videoFloating.core.utils.formatTime,
            applyBoxLayout: layoutManager.applyBoxLayout,
            updateLeftPanelLayout: layoutManager.updateLeftPanelLayout,
            updateVolUI: () => uiControls.updateVolUI(),
            updateSpeedUI: () => uiControls.updateSpeedUI(),
            updatePlaybackOverlayUI: () => uiControls.updatePlaybackOverlayUI(),
            postToFloatedIframe,
            ensureInitialized: () => shell.ensureInitialized(menu.menuVideoIcon)
        });

        // Wire up circular dependencies
        menu.setFloatingSession?.(floatingSession);
        autoSync.setFloatingSession?.(floatingSession);

        menu.floatFirstAvailableMedia = () => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            const preferredVideo = videoFloating.media.detector.getDirectVideos()[0];
            if (preferredVideo) {
                ctx.menuRef?.hide();
                floatingSession.float(preferredVideo);
                return;
            }
            // fallback logic handled in menu.js itself
        };

        const seekController = videoFloating.createSeekController(ctx, {
            $: videoFloating.core.utils.$,
            getCoord: videoFloating.core.utils.getCoord,
            getRect: videoFloating.core.utils.getRect,
            clamp: videoFloating.core.utils.clamp,
            formatTime: videoFloating.core.utils.formatTime,
            touch: ext?.shared?.touchCore,
            postToFloatedIframe
        });

        const uiControls = videoFloating.createUiControls(ctx, {
            $: videoFloating.core.utils.$,
            el: videoFloating.core.utils.el,
            formatTime: videoFloating.core.utils.formatTime,
            getFullscreenEl: videoFloating.core.utils.getFullscreenEl,
            postToFloatedIframe,
            renderSeekPreview: (ratio) => seekController.renderSeekPreview(ratio),
            restore: () => floatingSession.restore(),
            applyTransform: () => floatingSession.applyTransform()
        });

        const gesturesHandler = videoFloating.interactions.createGesturesHandler(
            ctx,
            floatingSession,
            seekController,
            uiControls,
            shell,
            postToFloatedIframe
        );
        const dragResizeHandler = videoFloating.interactions.createDragResizeHandler(ctx, layoutManager, shell);
        const iconHandler = videoFloating.interactions.createIconHandler(ctx, menu, shell);

        shell.ensureInitialized(menu.menuVideoIcon);

        ctx.cleanup.push(
            videoFloating.core.config.bindStorageListener(() => {
                if (!videoFloating.core.config.isFeatureEnabled()) floatingSession.restore();
                floatingSession.updateVideoDetectionUI();
            })
        );

        const onWindowMessage = (event) => {
            if (!event.data) return;
            if (event.data.type === 'fvp-iframe-videos') {
                if (event.source === window) return;
                const iframes = document.querySelectorAll('iframe');
                const matched = Array.from(iframes).find((iframe) => iframe.contentWindow === event.source);
                if (matched) {
                    const count = Number(event.data.count) || 0;
                    if (count > 0 && videoFloating.media.detector.isLikelyVideoIframe?.(matched)) ctx.iframeVideoMap.set(matched, count);
                    else ctx.iframeVideoMap.delete(matched);
                    floatingSession.updateVideoDetectionUI();
                }
            }
            if (event.data.type === 'fvp-iframe-state' && ctx.floatedIframe?.contentWindow === event.source) {
                if (event.data.state && typeof event.data.state === 'object') {
                    Object.assign(ctx.iframePlaybackState, event.data.state);
                    uiControls.syncFloatedIframeUI?.();
                }
            }
        };
        window.addEventListener('message', onWindowMessage);
        ctx.cleanup.push(() => window.removeEventListener('message', onWindowMessage));

        const onTouchSwitchVideo = (event) => {
            const dir = Number(event.detail?.dir) || 0;
            if (!dir) return;
            if (ctx.floatedIframe) {
                postToFloatedIframe({ command: dir > 0 ? 'next-video' : 'prev-video' });
                return;
            }
            floatingSession.switchVid(dir);
        };
        window.addEventListener(videoFloating.core.config.TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);
        ctx.cleanup.push(() => window.removeEventListener(videoFloating.core.config.TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo));

        autoSync.bindEvents(floatingSession);
        gesturesHandler.setupWrapperGestures();
        iconHandler.setupIconGestures();
        shell.setupOutsideClickGuard();
        uiControls.bindButtons();

        ctx.cleanup.push(seekController.bind());
        ctx.cleanup.push(uiControls.bindQualityEvents());

        // Wire up resize/drag handles in DOM
        const dragHandle = videoFloating.core.utils.$('fvp-left-drag');
        const resizeBr = document.querySelector('.fvp-resize-br');
        const resizeBl = document.querySelector('.fvp-resize-bl');

        if (dragHandle) {
            dragHandle.addEventListener('pointerdown', (e) => dragResizeHandler.beginBoxInteraction(e, 'drag'), true);
            dragHandle.addEventListener('pointermove', dragResizeHandler.handleBoxPointerMove, true);
            dragHandle.addEventListener('pointerup', dragResizeHandler.handleBoxPointerEnd, true);
            dragHandle.addEventListener('pointercancel', dragResizeHandler.handleBoxPointerEnd, true);
        }

        if (resizeBr) {
            resizeBr.addEventListener('pointerdown', (e) => dragResizeHandler.beginBoxInteraction(e, 'resize', 'br'), true);
            resizeBr.addEventListener('pointermove', dragResizeHandler.handleBoxPointerMove, true);
            resizeBr.addEventListener('pointerup', dragResizeHandler.handleBoxPointerEnd, true);
            resizeBr.addEventListener('pointercancel', dragResizeHandler.handleBoxPointerEnd, true);
        }

        if (resizeBl) {
            resizeBl.addEventListener('pointerdown', (e) => dragResizeHandler.beginBoxInteraction(e, 'resize', 'bl'), true);
            resizeBl.addEventListener('pointermove', dragResizeHandler.handleBoxPointerMove, true);
            resizeBl.addEventListener('pointerup', dragResizeHandler.handleBoxPointerEnd, true);
            resizeBl.addEventListener('pointercancel', dragResizeHandler.handleBoxPointerEnd, true);
        }

        videoFloating.core.config.loadCfgAsync();
        autoSync.syncFloatingWithPlayingDirectVideo();
        floatingSession.updateVideoDetectionUI();

        const detectionTimer = window.setInterval(
            () => floatingSession.updateVideoDetectionUI(),
            videoFloating.core.config.VIDEO_CHECK_INTERVAL || 2000
        );
        ctx.cleanup.push(() => window.clearInterval(detectionTimer));

        return {
            onConfigChange() {
                if (!videoFloating.core.config.isFeatureEnabled()) floatingSession.restore();
                floatingSession.updateVideoDetectionUI();
            },
            destroy() {
                floatingSession.restore();
                clearTimeout(ctx.state.idleTimer);
                ctx.cleanup.splice(0).forEach((fn) => {
                    try {
                        fn();
                    } catch {
                        /* ignore */
                    }
                });
                ctx.iconRef?.destroy();
                ctx.menuRef?.destroy();
                ctx.box?.remove();
            }
        };
    };
})();
