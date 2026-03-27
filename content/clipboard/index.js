(() => {
    const ext = globalThis.GestureExtension;

    const floating = ext.shared.floatingCore;
    const { getEditableTarget, isEditableTarget, getActiveSelectionText, getSelectionTextFromTarget, insertTextAtCaret } = ext.shared.selectionCore;
    const { escapeHtml, encodeAttribute, decodeAttribute, previewText } = ext.shared.domUtils;

    ext.features.clipboard = {
        shouldRun: ({ getConfig }) => !!getConfig()?.clipboard?.enabled,
        init: ({ getConfig, storage }) => {
            let config = getConfig();
            let activeTarget = null;
            let triggerRef = null;
            let panelRef = null;
            let panelOpen = false;
            let rafId = 0;
            let suppressNextFocusReset = false;
            let triggerOffset = { x: 0, y: 0 };
            let triggerAnchor = { top: 0, left: 0 };
            let copiedTextCache = '';
            let mutationObserver = null;
            let removeDragBinding = () => { };
            let removeOutsideClick = () => { };
            let isDraggingTrigger = false;

            const hasSavedTriggerOffset = () => Number.isFinite(triggerOffset.x) && Number.isFinite(triggerOffset.y);

            const saveTriggerOffset = async () => {
                if (!hasSavedTriggerOffset()) {
                    return;
                }
                try {
                    const nextConfig = await storage.saveClipboardTriggerPosition({
                        x: triggerOffset.x,
                        y: triggerOffset.y
                    });
                    config = nextConfig || config;
                } catch (error) {
                    if (isExtensionContextInvalidated(error)) {
                        return;
                    }
                    console.error('[GestureExtension] save trigger position failed', error);
                }
            };

            const ensureTriggerOffsetInBounds = () => {
                if (!hasSavedTriggerOffset()) {
                    return;
                }
                const next = floating.clampFixedPosition({
                    left: triggerOffset.x,
                    top: triggerOffset.y,
                    width: 32,
                    height: 32,
                    margin: 8
                });
                triggerOffset.x = next.left;
                triggerOffset.y = next.top;
            };

            const focusActiveTarget = () => {
                if (!activeTarget?.isConnected || !isEditableTarget(activeTarget)) {
                    return;
                }
                try {
                    activeTarget.focus({ preventScroll: true });
                } catch {
                    activeTarget.focus();
                }
            };

            const getPanelData = () => {
                const clipboard = config?.clipboard || { history: [], pinned: [] };
                const pinned = Array.isArray(clipboard.pinned) ? clipboard.pinned.slice(0, 5) : [];
                const history = Array.isArray(clipboard.history) ? clipboard.history : [];
                const recent = history.filter((item) => !pinned.includes(item)).slice(0, 5);
                return { pinned, recent };
            };

            const createGroupMarkup = (title, items, emptyText) => {
                const rows = items.length
                    ? items.map((item) => {
                        const escaped = escapeHtml(item);
                        const encoded = encodeAttribute(item);
                        const pinLabel = title === 'Đã ghim' ? 'Bỏ ghim' : 'Ghim';
                        return `
                            <div class="gesture-clipboard-item">
                                <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-item-pin" data-pin="${encoded}" aria-label="${pinLabel}" title="${pinLabel}">📌</button>
                                <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-item-paste" data-paste="${encoded}" aria-label="Paste" title="Dán nội dung">⚡</button>
                                <div class="gesture-clipboard-item-text" title="Bôi đen để copy">${escaped}</div>
                                <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-icon-button-danger gesture-clipboard-item-remove" data-remove="${encoded}" aria-label="Xóa" title="Xóa">🗑</button>
                            </div>
                        `;
                    }).join('')
                    : `<div class="gesture-clipboard-empty">${emptyText}</div>`;

                return `
                    <section class="gesture-clipboard-group">
                        <h4 class="gesture-clipboard-group-title">${title}</h4>
                        ${rows}
                    </section>
                `;
            };

            const renderPanel = () => {
                if (!panelRef) {
                    return;
                }
                const { pinned, recent } = getPanelData();
                panelRef.element.hidden = !panelOpen || !activeTarget;
                if (panelRef.element.hidden) return;
                panelRef.element.innerHTML = `
                    <div class="gesture-clipboard-panel-header">
                        <span>Clipboard</span>
                        <span>${(config?.clipboard?.history || []).length} mục</span>
                    </div>
                    ${createGroupMarkup('Đã ghim', pinned, 'Chưa có mục nào được ghim')}
                    ${createGroupMarkup('Gần đây', recent, 'Chưa có nội dung nào được lưu')}
                `;
            };

            const positionUI = () => {
                cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(() => {
                    if (!triggerRef || !panelRef) {
                        return;
                    }
                     if (!config?.clipboard?.enabled || !activeTarget || !activeTarget.isConnected || !isEditableTarget(activeTarget)) {
                         triggerRef.hide();
                         panelRef.hide();
                         return;
                     }
                     if (!isDraggingTrigger && !panelOpen && document.activeElement !== activeTarget) {
                         triggerRef.hide();
                         panelRef.hide();
                         return;
                     }
const rect = activeTarget.getBoundingClientRect();
                    const buttonSize = 32;
                    const defaultTop = floating.clamp(rect.top + ((rect.height - buttonSize) / 2), 8, Math.max(8, window.innerHeight - 36));
                    const iconGap = 2;
                    const preferredLeft = rect.left - buttonSize - iconGap;
                    const fallbackRight = rect.right + iconGap;
                    const defaultLeft = preferredLeft >= 8
                        ? preferredLeft
                        : floating.clamp(fallbackRight, 8, Math.max(8, window.innerWidth - 36));
                    triggerAnchor = {
                        top: defaultTop,
                        left: defaultLeft
                    };
                    const hasCustomOffset = hasSavedTriggerOffset();
                    const nextTop = hasCustomOffset ? triggerOffset.y : defaultTop;
                    const nextLeft = hasCustomOffset ? triggerOffset.x : defaultLeft;
                    const triggerPosition = floating.clampFixedPosition({
                        left: nextLeft,
                        top: nextTop,
                        width: 32,
                        height: 32,
                        margin: 8
                    });
                    triggerRef.setPosition(triggerPosition.left, triggerPosition.top);
                    triggerRef.show();

                    if (!panelOpen) {
                        panelRef.hide();
                        return;
                    }

                    const panelPosition = floating.clampFixedPosition({
                        left: Math.max(8, triggerPosition.left - 280),
                        top: Math.min(window.innerHeight - 220, triggerPosition.top + 34),
                        width: Math.min(360, window.innerWidth - 24),
                        height: 220,
                        margin: 8
                    });
                    panelRef.setPosition(panelPosition.left, panelPosition.top);
                    panelRef.show();
                });
            };

            const syncConfigFromStorage = async () => {
                config = await storage.getConfig();
                const savedPosition = config?.clipboard?.triggerPosition;
                triggerOffset = savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
                    ? { x: savedPosition.x, y: savedPosition.y }
                    : { x: Number.NaN, y: Number.NaN };
                ensureTriggerOffsetInBounds();
                return config;
            };

            const updateCopiedTextCache = (text) => {
                copiedTextCache = typeof text === 'string' ? text.trim() : '';
            };

            const isExtensionContextInvalidated = (error) => {
                const message = String(error?.message || error || '').toLowerCase();
                return message.includes('extension context invalidated');
            };

            const saveCopiedText = async (text) => {
                const trimmed = typeof text === 'string' ? text.trim() : '';
                if (!trimmed) return;
                updateCopiedTextCache(trimmed);
                try {
                    config = await storage.saveClipboardHistory(trimmed) || config;
                    if (!config?.clipboard?.history?.length || config.clipboard.history[0] !== trimmed) {
                        await syncConfigFromStorage();
                    }
                    if (panelOpen) {
                        renderPanel();
                        positionUI();
                    }
                } catch (error) {
                    if (isExtensionContextInvalidated(error)) {
                        return;
                    }
                    console.error('[GestureExtension] save clipboard failed', error);
                }
            };

            const setPanelOpen = async (nextOpen) => {
                panelOpen = !!nextOpen;
                if (panelOpen) {
                    await syncConfigFromStorage();
                }
                renderPanel();
                positionUI();
            };

            const handleTriggerActivation = async (event) => {
                floating.stopFloatingEvent(event);
                if (!activeTarget) {
                    return;
                }
                suppressNextFocusReset = true;
                focusActiveTarget();
                await setPanelOpen(!panelOpen);
            };

            const bindFloatingUi = () => {
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
                    suppressNextFocusReset = true;
                });

                panelRef.element.addEventListener('click', (event) => {
                    floating.stopFloatingEvent(event);
                    const insertButton = event.target.closest('[data-paste]');
                    const pinButton = event.target.closest('[data-pin]');
                    const removeButton = event.target.closest('[data-remove]');
                    if (insertButton) {
                        const text = decodeAttribute(insertButton.getAttribute('data-paste') || '');
                        suppressNextFocusReset = true;
                        focusActiveTarget();
                        insertTextAtCaret(activeTarget, text);
                        // Không đóng panel theo yêu cầu mới
                        renderPanel();
                        positionUI();
                        return;
                    }
                    if (pinButton) {
                        const text = decodeAttribute(pinButton.getAttribute('data-pin') || '');
                        suppressNextFocusReset = true;
                        focusActiveTarget();
                        storage.togglePinItem(text).then((nextConfig) => {
                            config = nextConfig || config;
                            renderPanel();
                            positionUI();
                        }).catch((error) => {
                            console.error('[GestureExtension] toggle pin failed', error);
                        });
                        return;
                    }
                    if (removeButton) {
                        const text = decodeAttribute(removeButton.getAttribute('data-remove') || '');
                        suppressNextFocusReset = true;
                        focusActiveTarget();
                        storage.removeClipboardItem(text).then((nextConfig) => {
                            config = nextConfig || config;
                            renderPanel();
                            positionUI();
                        }).catch((error) => {
                            console.error('[GestureExtension] remove clipboard item failed', error);
                        });
                    }
                });

                triggerRef.element.addEventListener('click', (event) => {
                    if (triggerRef.element.dataset.dragMoved === 'true') {
                        triggerRef.element.dataset.dragMoved = 'false';
                        floating.stopFloatingEvent(event);
                        return;
                    }
                    handleTriggerActivation(event).catch((error) => {
                        console.error('[GestureExtension] trigger activation failed', error);
                    });
                }, true);

                removeDragBinding = floating.bindDragBehavior({
                    target: triggerRef.element,
                    threshold: 6,
                    getInitialPosition: () => ({
                        left: triggerOffset.x || triggerAnchor.left || triggerRef.element.offsetLeft,
                        top: triggerOffset.y || triggerAnchor.top || triggerRef.element.offsetTop
                    }),
                    onMove: ({ event, deltaX, deltaY, origin }) => {
                        isDraggingTrigger = true;
                        suppressNextFocusReset = true;
                        floating.stopFloatingEvent(event);
                        triggerRef.element.dataset.dragMoved = 'true';
                        const next = floating.clampFixedPosition({
                            left: origin.left + deltaX,
                            top: origin.top + deltaY,
                            width: 32,
                            height: 32,
                            margin: 8
                        });
                        triggerOffset = { x: next.left, y: next.top };
                        positionUI();
                    },
                    onClick: () => {
                        isDraggingTrigger = false;
                        triggerRef.element.dataset.dragMoved = 'false';
                    },
                    onDragEnd: () => {
                        isDraggingTrigger = false;
                        suppressNextFocusReset = true;
                        focusActiveTarget();
                        void saveTriggerOffset();
                        positionUI();
                    }
                });

                removeOutsideClick = floating.bindOutsideClickGuard({
                    isOpen: () => panelOpen,
                    containsTarget: (target) => target instanceof Node && (panelRef.element.contains(target) || triggerRef.element.contains(target)),
                    onOutside: () => {
                        panelOpen = false;
                        renderPanel();
                        positionUI();
                    },
                    eventName: 'pointerdown',
                    capture: true
                });
            };

            const onFocusIn = (event) => {
                const target = getEditableTarget(event.target);
                if (!target) {
                    return;
                }
                activeTarget = target;
                if (suppressNextFocusReset) {
                    suppressNextFocusReset = false;
                    positionUI();
                    return;
                }
                panelOpen = false;
                renderPanel();
                positionUI();
            };

            const onPointerDown = (event) => {
                if (panelRef?.element.contains(event.target) || triggerRef?.element.contains(event.target)) {
                    suppressNextFocusReset = true;
                    if (triggerRef?.element.contains(event.target)) {
                        isDraggingTrigger = true;
                    }
                    return;
                }
                const target = getEditableTarget(event.target);
                if (target) {
                    activeTarget = target;
                    panelOpen = false;
                    renderPanel();
                    positionUI();
                    return;
                }
                if (isDraggingTrigger) {
                    return;
                }
                activeTarget = null;
                panelOpen = false;
                renderPanel();
                positionUI();
            };

            const onCopy = async (event) => {
                const clipboardText = event.clipboardData?.getData('text/plain') || '';
                const eventTarget = event.target instanceof Element ? getEditableTarget(event.target) || event.target : null;
                const selectionSources = [
                    clipboardText,
                    getSelectionTextFromTarget(eventTarget),
                    getActiveSelectionText(),
                    copiedTextCache
                ];
                const text = selectionSources.find((value) => typeof value === 'string' && value.trim()) || '';
                await saveCopiedText(text);
            };

            const onKeyUp = () => {
                const selectionText = getActiveSelectionText();
                if (selectionText) {
                    updateCopiedTextCache(selectionText);
                }
            };

            const onClipboardChange = async () => {
                if (!navigator.clipboard?.readText) {
                    return;
                }
                try {
                    const text = await navigator.clipboard.readText();
                    if (text && text.trim() && text.trim() !== copiedTextCache) {
                        await saveCopiedText(text);
                    }
                } catch {
                    // Ignore permissions errors from sites that block async clipboard reads.
                }
            };

            const onSelectionChange = () => {
                const selectionText = getActiveSelectionText();
                if (selectionText) {
                    updateCopiedTextCache(selectionText);
                }
            };

            const onScrollOrResize = () => {
                ensureTriggerOffsetInBounds();
                positionUI();
            };

             void syncConfigFromStorage();
             bindFloatingUi();
             document.addEventListener('focusin', onFocusIn, true);
document.addEventListener('pointerdown', onPointerDown, true);
            document.addEventListener('copy', onCopy, true);
            document.addEventListener('keyup', onKeyUp, true);
            document.addEventListener('selectionchange', onSelectionChange, true);
            window.addEventListener('scroll', onScrollOrResize, true);
            window.addEventListener('resize', onScrollOrResize, true);
            if (window.location.protocol === 'chrome:' || window.location.protocol === 'chrome-extension:') {
                window.addEventListener('focus', onClipboardChange, true);
            }
            if (typeof MutationObserver === 'function') {
                mutationObserver = new MutationObserver(() => {
                    if (panelOpen && activeTarget?.isConnected) {
                        positionUI();
                    }
                });
                mutationObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });
            }

            return {
                onConfigChange(nextConfig) {
                    config = nextConfig;
                    const savedPosition = config?.clipboard?.triggerPosition;
                    triggerOffset = savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
                        ? { x: savedPosition.x, y: savedPosition.y }
                        : { x: Number.NaN, y: Number.NaN };
                    ensureTriggerOffsetInBounds();
                    if (!config?.clipboard?.enabled) {
                        activeTarget = null;
                        panelOpen = false;
                    }
                    renderPanel();
                    positionUI();
                },
                destroy() {
                    document.removeEventListener('focusin', onFocusIn, true);
                    document.removeEventListener('pointerdown', onPointerDown, true);
                    document.removeEventListener('copy', onCopy, true);
                    document.removeEventListener('keyup', onKeyUp, true);
                    document.removeEventListener('selectionchange', onSelectionChange, true);
                    window.removeEventListener('scroll', onScrollOrResize, true);
                    window.removeEventListener('resize', onScrollOrResize, true);
                    window.removeEventListener('focus', onClipboardChange, true);
                    mutationObserver?.disconnect();
                    removeDragBinding();
                    removeOutsideClick();
                    triggerRef?.destroy();
                    panelRef?.destroy();
                }
            };
        }
    };
})();