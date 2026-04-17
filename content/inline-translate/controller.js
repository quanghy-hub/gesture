(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = ext.inlineTranslate = ext.inlineTranslate || {};
    const touch = ext.shared.touchCore;
    const selectionCore = ext.shared.selectionCore;
    const { TRANSLATION_PENDING, VIETNAMESE_CHAR_PATTERN } = inlineTranslate;
    const EDITABLE_SELECTION_DELAY_MS = 80;

    inlineTranslate.createController = ({ getConfig }) => {
        let settings = getConfig().inlineTranslate;
        let lastPointer = { x: 0, y: 0 };
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let startedInVideo = false;
        let editableSelectionTimer = 0;
        let editableSelectionRequestId = 0;

        const dom = inlineTranslate.dom;
        const actions = inlineTranslate.createActions({
            getSettings: () => settings
        });
        const editableSelectionState = {
            snapshot: null,
            translatedText: '',
            error: ''
        };

        const isVietnameseSelection = (text) => VIETNAMESE_CHAR_PATTERN.test(String(text || ''));

        const areSameEditableSnapshots = (left, right) => {
            return !!left
                && !!right
                && left.target === right.target
                && left.key === right.key
                && left.text === right.text;
        };

        const hideEditableSelectionPanel = ({ invalidateRequest = true } = {}) => {
            if (invalidateRequest) {
                editableSelectionRequestId += 1;
            }
            editableSelectionState.snapshot = null;
            editableSelectionState.translatedText = '';
            editableSelectionState.error = '';
            dom.hideEditableSelectionPanel();
        };

        const syncEditableSelectionPanel = () => {
            const snapshot = editableSelectionState.snapshot;
            if (!snapshot) {
                return;
            }
            const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
            if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                hideEditableSelectionPanel();
                return;
            }
            editableSelectionState.snapshot = currentSnapshot;
            if (editableSelectionState.translatedText) {
                dom.showEditableSelectionResult({
                    anchor: currentSnapshot.anchor,
                    text: editableSelectionState.translatedText,
                    onApply: applyEditableSelectionTranslation
                });
                return;
            }
            if (editableSelectionState.error) {
                dom.showEditableSelectionError({
                    anchor: currentSnapshot.anchor,
                    message: editableSelectionState.error
                });
                return;
            }
            dom.repositionEditableSelectionPanel(currentSnapshot.anchor);
        };

        const applyEditableSelectionTranslation = () => {
            const snapshot = editableSelectionState.snapshot;
            const translatedText = editableSelectionState.translatedText;
            if (!snapshot || !translatedText || !selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                hideEditableSelectionPanel();
                return;
            }
            selectionCore.replaceSelectionSnapshot(snapshot, translatedText);
            hideEditableSelectionPanel();
        };

        const toggleTranslationAtPoint = async (x, y) => {
            const hit = dom.hitTestTextBlock(x, y);
            if (!hit || !dom.hasMeaningfulText(hit.text)) {
                return;
            }

            const textKey = dom.getTextKey(hit.text);
            const existing = dom.findRelatedTranslationBox(hit.node, textKey);
            if (existing) {
                existing.remove();
                return;
            }

            const box = dom.createTranslationBox(hit.text, hit.node);
            dom.insertTranslationBox(hit.node, box);

            try {
                const translatedText = await actions.translateText(hit.text);
                if (translatedText === TRANSLATION_PENDING) {
                    box.firstElementChild.textContent = '⏳ Đang dịch, thử lại sau';
                    box.firstElementChild.style.color = '#ffd166';
                    box.firstElementChild.style.fontStyle = 'normal';
                    box.firstElementChild.style.fontSize = '0.8em';
                    window.setTimeout(() => box.remove(), 1500);
                    return;
                }

                if (!translatedText) {
                    box.firstElementChild.textContent = '⚠ Không có nội dung dịch';
                    box.firstElementChild.style.color = '#ff6b6b';
                    box.firstElementChild.style.fontStyle = 'normal';
                    box.firstElementChild.style.fontSize = '0.8em';
                    window.setTimeout(() => box.remove(), 3000);
                    return;
                }

                box.firstElementChild.textContent = translatedText;
            } catch (error) {
                box.firstElementChild.textContent = `⚠ ${String(error.message || 'Unknown error').slice(0, 80)}`;
                box.firstElementChild.style.color = '#ff6b6b';
                box.firstElementChild.style.fontStyle = 'normal';
                box.firstElementChild.style.fontSize = '0.8em';
                window.setTimeout(() => box.remove(), 5000);
            }
        };

        const evaluateEditableSelection = async () => {
            window.clearTimeout(editableSelectionTimer);

            if (!settings.selectionTranslateEnabled) {
                hideEditableSelectionPanel();
                return;
            }

            const snapshot = selectionCore.getEditableSelectionSnapshot();
            const trimmedText = String(snapshot?.text || '').trim();
            if (!snapshot || !trimmedText || !isVietnameseSelection(trimmedText)) {
                hideEditableSelectionPanel();
                return;
            }

            if (areSameEditableSnapshots(editableSelectionState.snapshot, snapshot)) {
                editableSelectionState.snapshot = snapshot;
                syncEditableSelectionPanel();
                return;
            }

            hideEditableSelectionPanel();
            editableSelectionState.snapshot = snapshot;
            dom.showEditableSelectionLoading(snapshot.anchor);

            const requestId = ++editableSelectionRequestId;
            try {
                const result = await ext.shared.translateCore.translateDetailed(trimmedText, {
                    provider: settings.provider,
                    targetLanguage: 'en',
                    cleanResult: true
                });

                if (requestId !== editableSelectionRequestId) {
                    return;
                }
                if (!selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                const translatedText = String(result?.translatedText || '').trim();
                if (!translatedText || translatedText === trimmedText) {
                    hideEditableSelectionPanel();
                    return;
                }

                const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                editableSelectionState.snapshot = currentSnapshot;
                editableSelectionState.translatedText = translatedText;
                editableSelectionState.error = '';
                dom.showEditableSelectionResult({
                    anchor: currentSnapshot.anchor,
                    text: translatedText,
                    onApply: applyEditableSelectionTranslation
                });
            } catch (error) {
                if (requestId !== editableSelectionRequestId) {
                    return;
                }
                if (!selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                editableSelectionState.snapshot = currentSnapshot;
                editableSelectionState.translatedText = '';
                editableSelectionState.error = String(error?.message || 'Lỗi dịch tạm thời');
                dom.showEditableSelectionError({
                    anchor: currentSnapshot.anchor,
                    message: editableSelectionState.error
                });
            }
        };

        const scheduleEditableSelectionEvaluation = (delay = EDITABLE_SELECTION_DELAY_MS) => {
            window.clearTimeout(editableSelectionTimer);
            editableSelectionTimer = window.setTimeout(() => {
                evaluateEditableSelection().catch(() => {
                    hideEditableSelectionPanel();
                });
            }, delay);
        };

        const onMouseMove = (event) => {
            lastPointer = touch.getPrimaryPoint(event);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                hideEditableSelectionPanel();
                return;
            }

            if (!settings.hotkeyEnabled) {
                return;
            }

            const activeElement = document.activeElement;
            if (
                activeElement instanceof HTMLElement &&
                (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
            ) {
                return;
            }

            const hotkey = settings.hotkey;
            const matches =
                (hotkey === 'f2' && event.code === 'F2') ||
                (hotkey === 'f4' && event.code === 'F4') ||
                (hotkey === 'f8' && event.code === 'F8');

            if (!matches) {
                return;
            }

            event.preventDefault();
            toggleTranslationAtPoint(lastPointer.x, lastPointer.y);
        };

        const onSelectionChange = () => {
            scheduleEditableSelectionEvaluation();
        };

        const onPointerDown = (event) => {
            if (!dom.isEventInsideEditableSelectionPanel(event)) {
                hideEditableSelectionPanel();
            }
        };

        const onPointerUp = () => {
            scheduleEditableSelectionEvaluation();
        };

        const onKeyUp = () => {
            scheduleEditableSelectionEvaluation();
        };

        const onScrollOrResize = () => {
            syncEditableSelectionPanel();
        };

        const onTouchStart = (event) => {
            if (!settings.swipeEnabled || event.touches.length !== 1) {
                return;
            }
            const point = touch.getPrimaryPoint(event);
            startX = point.x;
            startY = point.y;
            startTime = Date.now();
            startedInVideo = dom.isInVideoZone(startX, startY);
        };

        const onTouchEnd = (event) => {
            if (!settings.swipeEnabled || !startX || Date.now() - startTime > settings.swipeMaxDurationMs) {
                startX = 0;
                return;
            }

            const point = touch.getPrimaryPoint(event);
            const endX = point.x;
            const endY = point.y;

            if (startedInVideo || dom.isInVideoZone(endX, endY)) {
                startX = 0;
                return;
            }

            const deltaX = endX - startX;
            const deltaY = endY - startY;
            startX = 0;

            const validDirection =
                settings.swipeDir === 'both' ||
                (settings.swipeDir === 'right' && deltaX > 0) ||
                (settings.swipeDir === 'left' && deltaX < 0);

            if (
                Math.abs(deltaX) > settings.swipePx &&
                Math.abs(deltaY) < Math.abs(deltaX) * settings.swipeSlopeMax &&
                validDirection
            ) {
                toggleTranslationAtPoint(endX - deltaX / 2, endY - deltaY / 2);
            }

            scheduleEditableSelectionEvaluation(0);
        };

        dom.ensureStyles();
        dom.applyInlineTranslateCssVars(settings);

        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('keyup', onKeyUp, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('selectionchange', onSelectionChange, true);
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize, true);

        return {
            onConfigChange(nextConfig) {
                settings = nextConfig.inlineTranslate;
                dom.applyInlineTranslateCssVars(settings);
                if (!settings.selectionTranslateEnabled) {
                    hideEditableSelectionPanel();
                    return;
                }
                scheduleEditableSelectionEvaluation(0);
            },
            destroy() {
                window.clearTimeout(editableSelectionTimer);
                hideEditableSelectionPanel();
                document.removeEventListener('mousemove', onMouseMove, { passive: true });
                document.removeEventListener('keydown', onKeyDown, true);
                document.removeEventListener('keyup', onKeyUp, true);
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('pointerup', onPointerUp, true);
                document.removeEventListener('selectionchange', onSelectionChange, true);
                document.removeEventListener('touchstart', onTouchStart, { passive: true });
                document.removeEventListener('touchend', onTouchEnd, { passive: true });
                window.removeEventListener('scroll', onScrollOrResize, true);
                window.removeEventListener('resize', onScrollOrResize, true);
            }
        };
    };
})();
