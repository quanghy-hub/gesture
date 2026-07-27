(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createController = ({ tabActions, getConfig }) => {
        const touch = ext.shared.touchCore;
        const selectionCore = ext.shared.selectionCore;
        const { CONFIG, DEFAULT_SETTINGS, QUICK_GLYPHS, IS_ANDROID, buildProviderUrl } = quickSearch;
        const textSessionApi = quickSearch.textSession;
        const imageSessionApi = quickSearch.imageSession;
        const ui = quickSearch.ui;

        let featureConfig = (window.__gestureQuickSearchConfig = getConfig()?.quickSearch || {});

        const getFeatureConfig = () => featureConfig;

        let sessionManager;

        const bubbleManager = quickSearch.createBubbleManager(
            ui,
            getConfig,
            () => sessionManager?.resetHoverTimer(),
            (bubble) => sessionManager?.startHoverHideTimer(bubble)
        );

        const actions = quickSearch.createActions({
            tabActions,
            hideAllBubbles: bubbleManager.hideAllBubbles,
            clearActiveSelection: () => sessionManager?.clearActiveSelection(),
            suppressSelectionFor: (key, ms) => sessionManager?.suppressSelectionFor(key, ms),
            getSelectionSnapshot: textSessionApi.getSelectionSnapshot,
            getCurrentSelectionKey: () => sessionManager?.getCurrentSelectionKey() || ''
        });

        const actionMenu = quickSearch.createActionMenu({
            CONFIG,
            DEFAULT_SETTINGS,
            QUICK_GLYPHS,
            buildProviderUrl,
            getFeatureConfig,
            actions,
            sessionManager: {
                suppressSelectionFor: (key, ms) => sessionManager?.suppressSelectionFor(key, ms),
                hideTextBubble: bubbleManager.hideTextBubble,
                hideImageBubble: bubbleManager.hideImageBubble
            },
            bubbleManager
        });

        sessionManager = quickSearch.createSessionManager({
            CONFIG,
            IS_ANDROID,
            getFeatureConfig,
            textSessionApi,
            imageSessionApi,
            selectionCore,
            bubbleManager,
            actionMenu
        });

        const onPointerUp = () => {
            if (!IS_ANDROID) {
                sessionManager.scheduleSelectionEvaluation();
            }
        };

        const onPointerMove = (event) => {
            const image = imageSessionApi.getImageElement(event.target);
            if (image !== sessionManager.getHoverImage()) {
                if (!image && bubbleManager.getImageBubble()) {
                    sessionManager.startHoverHideTimerByImage();
                }
                sessionManager.setHoverImage(image);
                sessionManager.clearHoverTimer();
            }
            if (!image || featureConfig.imageSearchEnabled === false) {
                return;
            }
            sessionManager.scheduleImageEvaluation(image, event);
        };

        const onPointerDown = (event) => {
            if (!bubbleManager.isEventInsideTextBubble(event)) {
                sessionManager.hideTextBubble();
            }
            if (!bubbleManager.isEventInsideImageBubble(event)) {
                sessionManager.hideImageBubble();
            }
        };

        const onScrollOrResize = () => {
            sessionManager.syncTextBubbleToSelection();
            sessionManager.syncImageBubble();
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                sessionManager.hideAllBubbles();
            }
        };

        const onTouchStart = (event) => {
            if (
                bubbleManager.isEventInsideTextBubble(event) ||
                bubbleManager.isEventInsideImageBubble(event) ||
                !event.touches ||
                event.touches.length !== 1
            ) {
                return;
            }
            const point = touch.getPrimaryPoint(event);
            const image = imageSessionApi.getImageElement(event.target);
            sessionManager.setTouchCandidate({ x: point.x, y: point.y, image });
            if (
                featureConfig.imageSearchEnabled === false ||
                !(image instanceof HTMLImageElement) ||
                !imageSessionApi.isSearchableImage(image)
            ) {
                return;
            }
            sessionManager.setLongPressTimer(
                () => {
                    const candidate = sessionManager.getTouchCandidate();
                    if (candidate?.image?.isConnected) {
                        sessionManager.evaluateImageCandidate(candidate.image, { clientX: candidate.x, clientY: candidate.y });
                    }
                },
                IS_ANDROID ? 160 : featureConfig.imageLongPressMs || 320
            );
        };

        const onTouchMove = (event) => {
            if (!sessionManager.getTouchCandidate() || !event.touches || event.touches.length !== 1) {
                sessionManager.clearTouchLongPress();
                return;
            }
            const point = touch.getPrimaryPoint(event);
            if (touch.getDistance(point, sessionManager.getTouchCandidate()) > 18) {
                sessionManager.clearTouchLongPress();
            }
        };

        const onTouchEnd = () => {
            sessionManager.clearTouchLongPress();
            if (!IS_ANDROID) {
                sessionManager.scheduleSelectionEvaluationSoon(140);
            }
        };

        const onSelectionChange = () => {
            sessionManager.scheduleSelectionEvaluationSoon(120);
        };

        const onPageShow = () => {
            sessionManager.clearTouchLongPress();
            sessionManager.hideAllBubbles();
            sessionManager.clearActiveSelection();
        };

        const eventManager = quickSearch.createEventManager({
            onPointerUp,
            onPointerMove,
            onPointerDown,
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onTouchCancel: sessionManager.clearTouchLongPress,
            onSelectionChange,
            onKeyDown,
            onPageShow,
            onScrollOrResize
        });

        return {
            onConfigChange(nextConfig) {
                featureConfig = window.__gestureQuickSearchConfig = nextConfig?.quickSearch || featureConfig;
                if (featureConfig.imageSearchEnabled === false) {
                    sessionManager.hideImageBubble();
                }
                sessionManager.scheduleSelectionEvaluationSoon(0);
            },
            destroy() {
                sessionManager.destroy();
                eventManager.destroy();
                ui.teardown();
                window.__gestureQuickSearchMounted = false;
            }
        };
    };
})();
