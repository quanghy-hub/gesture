(() => {
    const ext = globalThis.GestureExtension;
    ext.shared.floatingCore = {
        clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
        clampFixedPosition: ({ left = 0, top = 0, width = 0, height = 0, margin = 8 }) => ({
            left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin)),
            top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin))
        }),
        stopFloatingEvent: (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        },
        createFloatingElementApi: (element) => ({
            element,
            show() { element.hidden = false; },
            hide() { element.hidden = true; },
            setPosition(left, top) {
                element.style.left = `${left}px`;
                element.style.top = `${top}px`;
            },
            destroy() { element.remove(); }
        }),
        createTriggerElement: ({ className, textContent, hidden = false }) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = className;
            element.textContent = textContent;
            element.hidden = hidden;
            element.style.left = '0px';
            element.style.top = '0px';
            document.documentElement.appendChild(element);
            return ext.shared.floatingCore.createFloatingElementApi(element);
        },
        createPanelRoot: ({ className, hidden = false }) => {
            const element = document.createElement('div');
            element.className = className;
            element.hidden = hidden;
            element.style.left = '0px';
            element.style.top = '0px';
            document.documentElement.appendChild(element);
            return ext.shared.floatingCore.createFloatingElementApi(element);
        },
        bindDragBehavior: ({ target, threshold = 6, getInitialPosition, onMove, onClick, onDragEnd }) => {
            if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') {
                return () => { };
            }

            let pointerId = null;
            let startX = 0;
            let startY = 0;
            let dragging = false;
            let origin = { left: 0, top: 0 };

            const reset = () => { pointerId = null; dragging = false; };

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
                try { target.setPointerCapture(event.pointerId); } catch {}
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
                if (path.some((t) => containsTarget?.(t))) return;
                onOutside?.(event);
            };
            document.addEventListener(eventName, handler, capture);
            return () => document.removeEventListener(eventName, handler, capture);
        }
    };
})();
