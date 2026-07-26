(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = ext.quickSearch = ext.quickSearch || {};

    quickSearch.createSessionManager = ({
        CONFIG,
        IS_ANDROID,
        getFeatureConfig,
        textSessionApi,
        imageSessionApi,
        selectionCore,
        bubbleManager,
        actionMenu
    }) => {

        const state = {
            textSession: null,
            imageSession: null,
            hoverImage: null,
            touchCandidate: null,
            suppressSelectionKey: '',
            suppressSelectionUntil: 0
        };

        const timers = {
            selection: 0,
            hover: 0,
            hide: 0,
            longPress: 0,
            selectionCleanup: 0
        };

        const suppressSelectionFor = (selectionKey, ms = CONFIG.suppressSelectionMs) => {
            state.suppressSelectionKey = selectionKey || '';
            state.suppressSelectionUntil = Date.now() + ms;
        };

        const clearSuppressedSelectionIfExpired = () => {
            if (state.suppressSelectionUntil && state.suppressSelectionUntil <= Date.now()) {
                state.suppressSelectionKey = '';
                state.suppressSelectionUntil = 0;
            }
        };

        const runSelectionCleanup = () => {
            try {
                const activeElement = document.activeElement;
                if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
                    const hasRange = typeof activeElement.selectionStart === 'number' && typeof activeElement.selectionEnd === 'number';
                    if (hasRange && activeElement.selectionStart !== activeElement.selectionEnd) {
                        activeElement.setSelectionRange(activeElement.selectionEnd, activeElement.selectionEnd);
                    }
                }
                if (activeElement instanceof HTMLElement && typeof activeElement.blur === 'function' && !activeElement.isContentEditable) {
                    activeElement.blur();
                }
                window.getSelection?.()?.removeAllRanges();
                document.getSelection?.()?.removeAllRanges();
            } catch {
                // Ignore selection cleanup failures on restrictive pages.
            }
        };

        const clearActiveSelection = () => {
            window.clearTimeout(timers.selectionCleanup);
            runSelectionCleanup();
            timers.selectionCleanup = window.setTimeout(() => {
                runSelectionCleanup();
                timers.selectionCleanup = window.setTimeout(() => {
                    runSelectionCleanup();
                }, CONFIG.selectionCleanupRetryMs);
            }, CONFIG.selectionCleanupDelayMs);
        };

        const hideTextBubble = () => {
            window.clearTimeout(timers.selection);
            bubbleManager.hideTextBubble();
            state.textSession = null;
        };

        const hideImageBubble = () => {
            window.clearTimeout(timers.hover);
            window.clearTimeout(timers.hide);
            bubbleManager.hideImageBubble();
            state.imageSession = null;
        };

        const hideAllBubbles = () => {
            hideTextBubble();
            hideImageBubble();
        };
        
        const resetHoverTimer = () => {
            window.clearTimeout(timers.hide);
        };
        
        const startHoverHideTimer = (imageBubbleInstance) => {
            timers.hide = window.setTimeout(() => {
                if (!state.hoverImage?.matches(':hover')) {
                    hideImageBubble();
                }
            }, CONFIG.hideDelay);
        };
        
        const startHoverHideTimerByImage = () => {
            if (state.imageSession) {
                window.clearTimeout(timers.hide);
                timers.hide = window.setTimeout(() => {
                    if (!bubbleManager.getImageBubble()?.bubble?.matches(':hover')) {
                        hideImageBubble();
                    }
                }, CONFIG.hideDelay);
            }
        };

        const updateTextSession = (snapshot) => {
            if (!snapshot?.text) {
                hideTextBubble();
                return;
            }

            clearSuppressedSelectionIfExpired();
            if (
                state.suppressSelectionUntil > Date.now()
                && (
                    state.suppressSelectionKey === '*'
                    || (snapshot.key && state.suppressSelectionKey === snapshot.key)
                )
            ) {
                hideTextBubble();
                return;
            }

            state.textSession = { text: snapshot.text, key: snapshot.key, x: snapshot.x, y: snapshot.y };
            actionMenu.showTextActions(state.textSession);
        };

        const syncTextBubbleToSelection = () => {
            const session = state.textSession;
            if (!session) {
                return;
            }
            const snapshot = textSessionApi.getSelectionSnapshot();
            if (!snapshot || snapshot.key !== session.key || snapshot.text !== session.text) {
                hideTextBubble();
                return;
            }
            state.textSession = { ...session, x: snapshot.x, y: snapshot.y };
            bubbleManager.getTextBubble()?.reposition(snapshot.x, snapshot.y);
        };

        const updateImageSession = (image, anchor, url) => {
            if (!(image instanceof HTMLImageElement) || !url || !anchor) {
                hideImageBubble();
                return;
            }
            state.imageSession = { image, url, x: anchor.x, y: anchor.y };
            actionMenu.showImageActions(state.imageSession);
        };

        const syncImageBubble = () => {
            const session = state.imageSession;
            if (!session?.image?.isConnected) {
                hideImageBubble();
                return;
            }
            const anchor = imageSessionApi.getImageAnchor(session.image);
            const url = imageSessionApi.resolveImageUrl(session.image);
            if (!anchor || !url) {
                hideImageBubble();
                return;
            }
            state.imageSession = { ...session, url, x: anchor.x, y: anchor.y };
            bubbleManager.getImageBubble()?.reposition(anchor.x, anchor.y);
        };

        const evaluateSelection = () => {
            if (selectionCore.isEditableTarget(document.activeElement)) {
                hideTextBubble();
                return;
            }
            const snapshot = textSessionApi.getSelectionSnapshot();
            if (!snapshot) {
                state.suppressSelectionKey = '';
                state.suppressSelectionUntil = 0;
                hideTextBubble();
                return;
            }
            updateTextSession(snapshot);
        };

        const scheduleSelectionEvaluation = (delay = getFeatureConfig().selectionDelay || 120) => {
            window.clearTimeout(timers.selection);
            timers.selection = window.setTimeout(evaluateSelection, delay);
        };

        const scheduleSelectionEvaluationSoon = (delay = 80) => {
            scheduleSelectionEvaluation(IS_ANDROID ? 0 : delay);
        };

        const evaluateImageCandidate = (image, event = null) => {
            if (getFeatureConfig().imageSearchEnabled === false) {
                hideImageBubble();
                return;
            }
            if (!imageSessionApi.isSearchableImage(image)) {
                hideImageBubble();
                return;
            }
            const url = imageSessionApi.resolveImageUrl(image);
            const anchor = imageSessionApi.getImageAnchor(image, event);
            if (!url || !anchor) {
                hideImageBubble();
                return;
            }
            updateImageSession(image, anchor, url);
        };

        const scheduleImageEvaluation = (image, event) => {
            window.clearTimeout(timers.hover);
            timers.hover = window.setTimeout(() => {
                evaluateImageCandidate(image, event);
            }, IS_ANDROID ? 0 : CONFIG.hoverDelay);
        };

        const clearTouchLongPress = () => {
            window.clearTimeout(timers.longPress);
            state.touchCandidate = null;
        };
        
        const setHoverImage = (image) => {
            state.hoverImage = image;
        };
        
        const getHoverImage = () => state.hoverImage;
        
        const clearHoverTimer = () => {
            window.clearTimeout(timers.hover);
        };
        
        const setTouchCandidate = (candidate) => {
            state.touchCandidate = candidate;
        };
        
        const getTouchCandidate = () => state.touchCandidate;
        
        const setLongPressTimer = (handler, ms) => {
            timers.longPress = window.setTimeout(handler, ms);
        };
        
        const getCurrentSelectionKey = () => state.textSession?.key || '';
        
        const destroy = () => {
            window.clearTimeout(timers.selection);
            window.clearTimeout(timers.hover);
            window.clearTimeout(timers.hide);
            window.clearTimeout(timers.longPress);
            window.clearTimeout(timers.selectionCleanup);
        };

        return {
            suppressSelectionFor,
            clearActiveSelection,
            hideTextBubble,
            hideImageBubble,
            hideAllBubbles,
            resetHoverTimer,
            startHoverHideTimer,
            startHoverHideTimerByImage,
            syncTextBubbleToSelection,
            syncImageBubble,
            scheduleSelectionEvaluation,
            scheduleSelectionEvaluationSoon,
            evaluateImageCandidate,
            scheduleImageEvaluation,
            clearTouchLongPress,
            setHoverImage,
            getHoverImage,
            clearHoverTimer,
            setTouchCandidate,
            getTouchCandidate,
            setLongPressTimer,
            getCurrentSelectionKey,
            destroy
        };
    };
})();
