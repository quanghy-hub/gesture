(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const utils = ext.shared.floatingUtils;

    ext.shared.floatingBehavior = {
        bindDragBehavior: ({ target, threshold = 6, getInitialPosition, onMove, onClick, onDragEnd }) => {
            if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') {
                return () => {};
            }

            let pointerId = null;
            let startX = 0;
            let startY = 0;
            let dragging = false;
            let origin = { left: 0, top: 0 };

            const reset = () => {
                pointerId = null;
                dragging = false;
            };

            const onPointerMove = (event) => {
                if (event.pointerId !== pointerId) return;
                const deltaX = event.clientX - startX;
                const deltaY = event.clientY - startY;
                if (!dragging && Math.hypot(deltaX, deltaY) >= threshold) {
                    dragging = true;
                }
                if (!dragging) return;
                onMove?.({ event, deltaX, deltaY, origin });
            };

            const onPointerUp = (event) => {
                if (event.pointerId !== pointerId) return;
                if (dragging) onDragEnd?.({ event, origin });
                else onClick?.({ event, origin });
                reset();
            };

            const onPointerCancel = (event) => {
                if (event.pointerId !== pointerId) return;
                reset();
            };

            const onPointerDown = (event) => {
                if (event.button !== 0) return;
                pointerId = event.pointerId;
                startX = event.clientX;
                startY = event.clientY;
                origin = getInitialPosition?.() || { left: 0, top: 0 };
                dragging = false;
                try {
                    target.setPointerCapture(event.pointerId);
                } catch {
                    // Pointer capture is optional on some embedded surfaces.
                }
            };

            target.addEventListener('pointerdown', onPointerDown, true);
            target.addEventListener('pointermove', onPointerMove, true);
            target.addEventListener('pointerup', onPointerUp, true);
            target.addEventListener('pointercancel', onPointerCancel, true);

            return () => {
                target.removeEventListener('pointerdown', onPointerDown, true);
                target.removeEventListener('pointermove', onPointerMove, true);
                target.removeEventListener('pointerup', onPointerUp, true);
                target.removeEventListener('pointercancel', onPointerCancel, true);
            };
        },
        bindOutsideClickGuard: ({ isOpen, containsTarget, onOutside, eventName = 'pointerdown', capture = true }) => {
            const handler = (event) => {
                if (!isOpen?.()) return;
                const path = event.composedPath?.() || [event.target];
                if (path.some((t) => utils.isNodeLike(t) && containsTarget?.(t))) return;
                onOutside?.(event);
            };
            document.addEventListener(eventName, handler, capture);
            return () => document.removeEventListener(eventName, handler, capture);
        }
    };
})();
