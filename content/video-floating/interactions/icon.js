(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createIconHandler = (ctx, menu, shell) => {
        const { clamp } = videoFloating.core.utils;
        const config = videoFloating.core.config;
        const floating = ext?.shared?.floatingCore;

        const setupIconGestures = () => {
            const DOUBLE_TAP_MS = 280;
            const DRAG_THRESHOLD = 6;
            let pointerId = null;
            let startX = 0;
            let startY = 0;
            let dragging = false;
            let origin = { left: 0, top: 0 };
            let tapTimer = 0;
            let mouseClickTimer = 0;
            let lastTapAt = 0;

            const clearTapTimer = () => {
                clearTimeout(tapTimer);
                tapTimer = 0;
            };
            const clearMouseClickTimer = () => {
                clearTimeout(mouseClickTimer);
                mouseClickTimer = 0;
            };
            const resetIconPointer = () => {
                pointerId = null;
                dragging = false;
            };
            const handleIconPointerDown = (event) => {
                if (event.button !== 0) return;
                pointerId = event.pointerId;
                startX = event.clientX;
                startY = event.clientY;
                origin = { left: ctx.iconRef.element.offsetLeft, top: ctx.iconRef.element.offsetTop };
                dragging = false;
                try {
                    ctx.iconRef.element.setPointerCapture(event.pointerId);
                } catch {
                }
            };
            const handleIconPointerMove = (event) => {
                if (event.pointerId !== pointerId) return;
                const deltaX = event.clientX - startX;
                const deltaY = event.clientY - startY;
                if (!dragging && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
                    dragging = true;
                    clearTapTimer();
                    ctx.menuRef.hide();
                }
                if (!dragging) return;
                const next = floating.clampFixedPosition({ left: origin.left + deltaX, top: origin.top + deltaY, width: 42, height: 42, margin: 10 });
                ctx.iconRef.setPosition(next.left, next.top);
                shell.resetIdle();
            };
            const handleIconPointerUp = (event) => {
                if (event.pointerId !== pointerId) return;
                if (dragging) {
                    config.iconPosStorage.save(ctx.iconRef.element.style.left, ctx.iconRef.element.style.top);
                } else {
                    if (event.pointerType === 'mouse') {
                        clearTapTimer();
                        clearMouseClickTimer();
                        lastTapAt = 0;
                        mouseClickTimer = window.setTimeout(() => {
                            mouseClickTimer = 0;
                            menu.floatFirstAvailableMedia();
                        }, DOUBLE_TAP_MS);
                        resetIconPointer();
                        return;
                    }
                    const now = Date.now();
                    if (lastTapAt && now - lastTapAt <= DOUBLE_TAP_MS) {
                        clearTapTimer();
                        lastTapAt = 0;
                        menu.openMenuAtAnchor(ctx.iconRef.element);
                    } else {
                        lastTapAt = now;
                        clearTapTimer();
                        tapTimer = window.setTimeout(() => {
                            tapTimer = 0;
                            lastTapAt = 0;
                            menu.floatFirstAvailableMedia();
                        }, DOUBLE_TAP_MS);
                    }
                }
                resetIconPointer();
            };
            const handleIconPointerCancel = (event) => {
                if (event.pointerId !== pointerId) return;
                resetIconPointer();
            };
            const handleIconDoubleClick = (event) => {
                if (event.button !== 0) return;
                clearTapTimer();
                clearMouseClickTimer();
                lastTapAt = 0;
                ctx.menuRef.hide();
                menu.openMenuAtAnchor(ctx.iconRef.element);
                event.preventDefault();
                event.stopPropagation();
            };

            ctx.iconRef.element.addEventListener('pointerdown', handleIconPointerDown, true);
            ctx.iconRef.element.addEventListener('pointermove', handleIconPointerMove, true);
            ctx.iconRef.element.addEventListener('pointerup', handleIconPointerUp, true);
            ctx.iconRef.element.addEventListener('pointercancel', handleIconPointerCancel, true);
            ctx.iconRef.element.addEventListener('dblclick', handleIconDoubleClick, true);
            ctx.cleanup.push(() => {
                clearTapTimer();
                clearMouseClickTimer();
                ctx.iconRef.element.removeEventListener('pointerdown', handleIconPointerDown, true);
                ctx.iconRef.element.removeEventListener('pointermove', handleIconPointerMove, true);
                ctx.iconRef.element.removeEventListener('pointerup', handleIconPointerUp, true);
                ctx.iconRef.element.removeEventListener('pointercancel', handleIconPointerCancel, true);
                ctx.iconRef.element.removeEventListener('dblclick', handleIconDoubleClick, true);
            });
        };

        return {
            setupIconGestures
        };
    };
})();
