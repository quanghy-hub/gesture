(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = ext.clipboard = ext.clipboard || {};
    const floating = ext.shared.floatingCore;
    const { UI } = clipboard;

    clipboard.createUi = ({ onTogglePanel, onPanelPaste, onPanelPin, onPanelRemove, onSuppressFocus, onPanelOpenChange }) => {
        const posStorage = floating.createPositionStorage('gesture_clipboard_icon_pos', { left: 20, top: 200 });
        let triggerRef = null;
        let panelRef = null;
        let removeDragBinding = () => { };
        let removeOutsideClick = () => { };

        const renderPanel = (markup) => {
            if (panelRef) {
                panelRef.element.innerHTML = markup;
            }
        };

        const updatePanelPosition = () => {
            if (!triggerRef || !panelRef) {
                return;
            }
            const rect = triggerRef.element.getBoundingClientRect();
            const pPos = floating.clampFixedPosition({
                left: rect.right + UI.panelOffset,
                top: rect.top,
                width: panelRef.element.offsetWidth || 320,
                height: panelRef.element.offsetHeight || 300
            });
            panelRef.setPosition(pPos.left, pPos.top);
        };

        const bind = () => {
            triggerRef = floating.createTriggerElement({
                className: 'gesture-clipboard-trigger',
                textContent: '📋',
                hidden: true
            });
            panelRef = floating.createPanelRoot({
                className: 'gesture-clipboard-panel',
                hidden: true
            });

            panelRef.element.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
                onSuppressFocus();
            });

            panelRef.element.addEventListener('click', (event) => {
                floating.stopFloatingEvent(event);
                const insertButton = event.target.closest('[data-paste]');
                const pinButton = event.target.closest('[data-pin]');
                const removeButton = event.target.closest('[data-remove]');

                if (insertButton) {
                    onSuppressFocus();
                    onPanelPaste(insertButton.getAttribute('data-paste') || '');
                    return;
                }
                if (pinButton) {
                    onSuppressFocus();
                    onPanelPin(pinButton.getAttribute('data-pin') || '');
                    return;
                }
                if (removeButton) {
                    onSuppressFocus();
                    onPanelRemove(removeButton.getAttribute('data-remove') || '');
                }
            });

            removeDragBinding = floating.bindDragBehavior({
                target: triggerRef.element,
                threshold: 6,
                getInitialPosition: () => ({
                    left: triggerRef.element.offsetLeft,
                    top: triggerRef.element.offsetTop
                }),
                onMove: ({ deltaX, deltaY, origin }) => {
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: UI.triggerSize,
                        height: UI.triggerSize,
                        margin: 8
                    });
                    triggerRef.setPosition(next.left, next.top);
                    triggerRef.element.classList.add('is-dragging');
                    updatePanelPosition();
                },
                onDragEnd: () => {
                    triggerRef.element.classList.remove('is-dragging');
                    posStorage.save(triggerRef.element.offsetLeft, triggerRef.element.offsetTop);
                },
                onClick: () => {
                    onTogglePanel();
                }
            });

            removeOutsideClick = floating.bindOutsideClickGuard({
                isOpen: onPanelOpenChange.isOpen,
                containsTarget: (target) => target instanceof Node && (panelRef.element.contains(target) || triggerRef.element.contains(target)),
                onOutside: () => {
                    onPanelOpenChange.close();
                },
                eventName: 'pointerdown',
                capture: true
            });

            triggerRef.element.addEventListener('mousedown', (event) => {
                event.preventDefault();
                event.stopPropagation();
            }, true);
            triggerRef.element.addEventListener('pointerdown', (event) => {
                event.preventDefault();
                event.stopPropagation();
            }, false);
            panelRef.element.addEventListener('mousedown', (event) => event.stopPropagation(), true);
            triggerRef.element.addEventListener('click', (event) => event.stopPropagation(), true);

            posStorage.load().then(({ left, top }) => {
                const pos = floating.clampFixedPosition({ left, top, width: UI.triggerSize, height: UI.triggerSize, margin: 8 });
                triggerRef.setPosition(pos.left, pos.top);
            });
        };

        return {
            bind,
            renderPanel,
            updatePanelPosition,
            setTriggerVisible(visible) {
                if (!triggerRef) {
                    return;
                }
                if (visible) {
                    triggerRef.show();
                } else {
                    triggerRef.hide();
                }
            },
            setPanelVisible(visible) {
                if (!panelRef) {
                    return;
                }
                if (visible) {
                    panelRef.show('flex');
                    updatePanelPosition();
                } else {
                    panelRef.hide();
                }
            },
            containsNode(node) {
                return node instanceof Node && !!(
                    (panelRef?.element && panelRef.element.contains(node))
                    || (triggerRef?.element && triggerRef.element.contains(node))
                );
            },
            focusTriggerAndPanel() {
                return { triggerRef, panelRef };
            },
            destroy() {
                removeDragBinding();
                removeOutsideClick();
                triggerRef?.destroy();
                panelRef?.destroy();
            }
        };
    };
})();
