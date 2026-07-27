(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const touch = ext.shared.touchCore;
    const THREE_TOUCH_TRANSLATE_MS = 550;

    inlineTranslate.createEventHandler = (deps) => {
        const { dom, getSettings, editableSelectionManager, blockTranslationManager } = deps;

        let lastPointer = { x: 0, y: 0 };
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let startedInVideo = false;
        let threeTouchTimer = 0;

        const onMouseMove = (event) => {
            lastPointer = touch.getPrimaryPoint(event);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                editableSelectionManager.hideEditableSelectionPanel();
                return;
            }

            const settings = getSettings();
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
                hotkey === 'ctrl+d'
                    ? event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.code === 'KeyD'
                    : hotkey === 'f2' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.code === 'F2';

            if (!matches) {
                return;
            }

            event.preventDefault();
            blockTranslationManager.toggleTranslationAtPoint(lastPointer.x, lastPointer.y);
        };

        const onSelectionChange = () => {
            editableSelectionManager.scheduleEditableSelectionEvaluation();
        };

        const onPointerDown = (event) => {
            if (!dom.isEventInsideEditableSelectionPanel(event)) {
                editableSelectionManager.hideEditableSelectionPanel();
            }
        };

        const onMouseDown = (event) => {
            lastPointer = touch.getPrimaryPoint(event);
            if (dom.isEventInsideEditableSelectionPanel(event)) {
                return;
            }
        };

        const onMouseUp = (event) => {
            editableSelectionManager.scheduleEditableSelectionEvaluation();
        };

        const onKeyUp = () => {
            editableSelectionManager.scheduleEditableSelectionEvaluation();
        };

        const onScrollOrResize = () => {
            editableSelectionManager.syncEditableSelectionPanel();
        };

        const clearThreeTouchTimer = () => {
            window.clearTimeout(threeTouchTimer);
            threeTouchTimer = 0;
        };

        const onTouchStart = (event) => {
            clearThreeTouchTimer();
            const settings = getSettings();
            if (event.touches && event.touches.length === 3) {
                const points = [...event.touches];
                const x = points.reduce((sum, point) => sum + point.clientX, 0) / points.length;
                const y = points.reduce((sum, point) => sum + point.clientY, 0) / points.length;
                if (!dom.isInVideoZone(x, y)) {
                    if (event.cancelable) {
                        event.preventDefault();
                    }
                    threeTouchTimer = window.setTimeout(() => {
                        threeTouchTimer = 0;
                        blockTranslationManager.toggleTranslationAtPoint(x, y);
                    }, THREE_TOUCH_TRANSLATE_MS);
                }
                return;
            }

            if (!settings.swipeEnabled || !event.touches || event.touches.length !== 1) {
                return;
            }
            const point = touch.getPrimaryPoint(event);
            startX = point.x;
            startY = point.y;
            startTime = Date.now();
            startedInVideo = dom.isInVideoZone(startX, startY);
        };

        const onTouchEnd = (event) => {
            clearThreeTouchTimer();
            const settings = getSettings();
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

            if (Math.abs(deltaX) > settings.swipePx && Math.abs(deltaY) < Math.abs(deltaX) * settings.swipeSlopeMax && validDirection) {
                blockTranslationManager.toggleTranslationAtPoint(endX - deltaX / 2, endY - deltaY / 2);
            }

            editableSelectionManager.scheduleEditableSelectionEvaluation(0);
        };

        const onTouchCancel = () => {
            clearThreeTouchTimer();
            startX = 0;
        };

        const install = () => {
            document.addEventListener('mousemove', onMouseMove, { passive: true });
            window.addEventListener('mousedown', onMouseDown, true);
            window.addEventListener('mouseup', onMouseUp, true);
            document.addEventListener('keydown', onKeyDown, true);
            document.addEventListener('keyup', onKeyUp, true);
            document.addEventListener('pointerdown', onPointerDown, true);
            document.addEventListener('selectionchange', onSelectionChange, true);
            document.addEventListener('touchstart', onTouchStart, { passive: false });
            document.addEventListener('touchend', onTouchEnd, { passive: true });
            document.addEventListener('touchcancel', onTouchCancel, { passive: true });
            window.addEventListener('scroll', onScrollOrResize, true);
            window.addEventListener('resize', onScrollOrResize, true);

            return () => {
                clearThreeTouchTimer();
                document.removeEventListener('mousemove', onMouseMove, { passive: true });
                window.removeEventListener('mousedown', onMouseDown, true);
                window.removeEventListener('mouseup', onMouseUp, true);
                document.removeEventListener('keydown', onKeyDown, true);
                document.removeEventListener('keyup', onKeyUp, true);
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('selectionchange', onSelectionChange, true);
                document.removeEventListener('touchstart', onTouchStart, { passive: false });
                document.removeEventListener('touchend', onTouchEnd, { passive: true });
                document.removeEventListener('touchcancel', onTouchCancel, { passive: true });
                window.removeEventListener('scroll', onScrollOrResize, true);
                window.removeEventListener('resize', onScrollOrResize, true);
            };
        };

        return { install };
    };
})();
