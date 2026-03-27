(() => {
    const ext = globalThis.GestureExtension;
    const viewport = ext.shared.viewportCore;
    ext.shared.floatingCore = {
        clamp: (value, min, max) => viewport?.clamp?.(value, min, max) ?? Math.min(max, Math.max(min, value)),
        clampFixedPosition: (rect) => viewport?.clampFixedPosition?.(rect) ?? ({
            left: Math.min(Math.max(rect?.margin ?? 8, rect?.left ?? 0), Math.max(rect?.margin ?? 8, window.innerWidth - (rect?.width ?? 0) - (rect?.margin ?? 8))),
            top: Math.min(Math.max(rect?.margin ?? 8, rect?.top ?? 0), Math.max(rect?.margin ?? 8, window.innerHeight - (rect?.height ?? 0) - (rect?.margin ?? 8)))
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
            show(display) {
                element.hidden = false;
                if (display) {
                    element.style.display = display;
                } else {
                    // Fallback to a sensible default if it was hidden via inline style
                    if (element.style.display === 'none') {
                        const isPanel = element.tagName === 'DIV' || element.classList.contains('gesture-panel') || element.className.includes('panel');
                        if (isPanel) {
                            element.style.display = 'flex';
                            element.style.flexDirection = 'column';
                        } else {
                            element.style.display = 'block';
                        }
                    }
                }
            },
            hide() { 
                element.hidden = true; 
                element.style.display = 'none'; 
            },
            setPosition(left, top) {
                element.style.left = typeof left === 'number' ? `${left}px` : left;
                element.style.top = typeof top === 'number' ? `${top}px` : top;
            },
            setOpacity(value) {
                element.style.opacity = value;
            },
            setBadge(text) {
                let badge = element.querySelector('.gesture-floating-badge');
                if (!badge) {
                    badge = document.createElement('span');
                    badge.className = 'gesture-floating-badge';
                    element.appendChild(badge);
                }
                badge.textContent = text;
                badge.style.display = text ? 'flex' : 'none';
            },
            destroy() { element.remove(); }
        }),
        createTriggerElement: ({ className, textContent, htmlContent, hidden = false }) => {
            const element = document.createElement('button');
            element.type = 'button';
            element.className = className;
            if (htmlContent) element.innerHTML = htmlContent;
            else if (textContent) element.textContent = textContent;
            element.hidden = hidden;
            if (hidden) element.style.display = 'none';
            element.style.position = 'fixed';
            element.style.zIndex = '2147483646';
            document.documentElement.appendChild(element);
            return ext.shared.floatingCore.createFloatingElementApi(element);
        },
        createPanelRoot: ({ className, hidden = false }) => {
            const element = document.createElement('div');
            element.className = className;
            element.hidden = hidden;
            if (hidden) element.style.display = 'none';
            element.style.position = 'fixed';
            element.style.zIndex = '2147483645';
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
        },
        createPositionStorage: (storageKey, defaultPos = { left: 20, top: 20 }) => ({
            load: () => new Promise((resolve) => {
                chrome.storage.local.get([storageKey], (result) => {
                    const v = result?.[storageKey];
                    resolve(v && typeof v === 'object' ? v : defaultPos);
                });
            }),
            save: (left, top) => chrome.storage.local.set({ [storageKey]: { left, top } })
        })
    };
})();
