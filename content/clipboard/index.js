(() => {
    const ext = globalThis.GestureExtension;

    const floating = ext.shared.floatingCore;
    const { getEditableTarget, isEditableTarget, getActiveSelectionText, getSelectionTextFromTarget, insertTextAtCaret } = ext.shared.selectionCore;
    const { escapeHtml, encodeAttribute, decodeAttribute } = ext.shared.domUtils;

    ext.features.clipboard = {
        shouldRun: ({ getConfig }) => !!getConfig()?.clipboard?.enabled,
        init: ({ getConfig, storage }) => {
            let config = getConfig();
            let activeTarget = null;
            let triggerRef = null;
            let panelRef = null;
            let panelOpen = false;
            let copiedTextCache = '';
            let removeDragBinding = () => { };
            let removeOutsideClick = () => { };
            let suppressNextFocusReset = false;

            const posStorage = floating.createPositionStorage('gesture_clipboard_icon_pos', { left: 20, top: 200 });

            const UI = { triggerSize: 36, panelOffset: 8 };

            // ─── Focus tracking (for paste target) ───────────────────────

            const focusActiveTarget = () => {
                if (!activeTarget?.isConnected || !isEditableTarget(activeTarget)) return;
                try { activeTarget.focus({ preventScroll: true }); } catch { activeTarget.focus(); }
            };

            // ─── Panel data ───────────────────────────────────────────────

            const getPanelData = () => {
                const clipboard = config?.clipboard || { history: [], pinned: [] };
                const pinned = Array.isArray(clipboard.pinned) ? clipboard.pinned.slice(0, 5) : [];
                const history = Array.isArray(clipboard.history) ? clipboard.history : [];
                const recent = history.filter((item) => !pinned.includes(item)).slice(0, 5);
                if (copiedTextCache && !pinned.includes(copiedTextCache) && !recent.includes(copiedTextCache)) {
                    recent.unshift(copiedTextCache);
                }
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
                if (!panelRef) return;
                panelRef.element.innerHTML = `
                    ${createGroupMarkup('Đã ghim', getPanelData().pinned, 'Chưa có mục nào được ghim')}
                    ${createGroupMarkup('Gần đây', getPanelData().recent, 'Chưa có nội dung nào được lưu')}
                `;
            };

            // ─── UI position (fixed, like google-search) ─────────────────

            const hasClipboardData = () => {
                const clipboard = config?.clipboard || {};
                return (Array.isArray(clipboard.pinned) && clipboard.pinned.length > 0) ||
                    (Array.isArray(clipboard.history) && clipboard.history.length > 0);
            };

            const updateTriggerVisibility = () => {
                if (!triggerRef) return;
                const isVisible = !!activeTarget && (hasClipboardData() || !!copiedTextCache);
                if (isVisible) triggerRef.show();
                else triggerRef.hide();
            };

            const updateUI = () => {
                updateTriggerVisibility();
                if (!panelOpen) {
                    panelRef.hide();
                    return;
                }
                renderPanel();
                panelRef.show('flex');
                const rect = triggerRef.element.getBoundingClientRect();
                const pPos = floating.clampFixedPosition({
                    left: rect.right + UI.panelOffset,
                    top: rect.top,
                    width: panelRef.element.offsetWidth || 320,
                    height: panelRef.element.offsetHeight || 300
                });
                panelRef.setPosition(pPos.left, pPos.top);
            };

            // ─── Storage ──────────────────────────────────────────────────

            const isExtensionContextInvalidated = (error) => {
                const message = String(error?.message || error || '').toLowerCase();
                return message.includes('extension context invalidated');
            };

            const syncConfig = async () => {
                config = await storage.getConfig();
            };

            const updateCopiedTextCache = (text) => {
                copiedTextCache = typeof text === 'string' ? text.trim() : '';
            };

            const saveCopiedText = async (text) => {
                const trimmed = typeof text === 'string' ? text.trim() : '';
                if (!trimmed) return;
                updateCopiedTextCache(trimmed);
                try {
                    config = await storage.saveClipboardHistory(trimmed) || config;
                    if (!config?.clipboard?.history?.length || config.clipboard.history[0] !== trimmed) {
                        await syncConfig();
                    }
                    if (panelOpen) updateUI();
                } catch (error) {
                    if (isExtensionContextInvalidated(error)) return;
                    console.error('[GestureExtension] save clipboard failed', error);
                }
            };

            // ─── Panel open/close ─────────────────────────────────────────

            const setPanelOpen = async (nextOpen) => {
                panelOpen = !!nextOpen;
                updateUI(); // show/hide immediately
                if (panelOpen) {
                    await syncConfig();
                    updateUI(); // re-render with fresh data
                }
            };

            // ─── Floating UI setup ────────────────────────────────────────

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
                        renderPanel();
                        return;
                    }
                    if (pinButton) {
                        const text = decodeAttribute(pinButton.getAttribute('data-pin') || '');
                        suppressNextFocusReset = true;
                        storage.togglePinItem(text).then((nextConfig) => {
                            config = nextConfig || config;
                            updateUI();
                        }).catch((error) => console.error('[GestureExtension] toggle pin failed', error));
                        return;
                    }
                    if (removeButton) {
                        const text = decodeAttribute(removeButton.getAttribute('data-remove') || '');
                        suppressNextFocusReset = true;
                        storage.removeClipboardItem(text).then((nextConfig) => {
                            config = nextConfig || config;
                            updateUI();
                        }).catch((error) => console.error('[GestureExtension] remove clipboard item failed', error));
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
                        if (panelOpen) updateUI();
                    },
                    onDragEnd: () => {
                        triggerRef.element.classList.remove('is-dragging');
                        posStorage.save(triggerRef.element.offsetLeft, triggerRef.element.offsetTop);
                    },
                    onClick: () => {
                        setPanelOpen(!panelOpen).catch((error) => {
                            console.error('[GestureExtension] toggle panel failed', error);
                        });
                    }
                });

                removeOutsideClick = floating.bindOutsideClickGuard({
                    isOpen: () => panelOpen,
                    containsTarget: (target) =>
                        target instanceof Node &&
                        (panelRef.element.contains(target) || triggerRef.element.contains(target)),
                    onOutside: () => {
                        panelOpen = false;
                        updateUI();
                    },
                    eventName: 'pointerdown',
                    capture: true
                });

                // Chống mất focus (native dom focus)
                triggerRef.element.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, true);
                triggerRef.element.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }, false);

                // Chặn nổi bọt từ nội bộ clipboard để các floating panel khác không xử lý
                // click ở pha bubble, nhưng không chặn event click tại target của panel.
                panelRef.element.addEventListener('mousedown', (e) => e.stopPropagation(), true);
                triggerRef.element.addEventListener('click', (e) => e.stopPropagation(), true);

                posStorage.load().then(({ left, top }) => {
                    const pos = floating.clampFixedPosition({ left, top, width: UI.triggerSize, height: UI.triggerSize, margin: 8 });
                    triggerRef.setPosition(pos.left, pos.top);
                    updateUI(); // gọi update để set visibility dựa trên focus
                });
            };

            // ─── Event listeners ──────────────────────────────────────────

            const onPointerDown = (event) => {
                // Nếu click vào nội bộ clipboard thì bỏ qua
                if (panelRef?.element.contains(event.target) || triggerRef?.element.contains(event.target)) {
                    suppressNextFocusReset = true;
                    return;
                }
                const target = getEditableTarget(event.target);
                if (target) {
                    activeTarget = target;
                    panelOpen = false;
                    updateUI();
                    return;
                }
                // Click ra ngoài input và ngoài clipboard -> xóa focus, ẩn icon
                activeTarget = null;
                panelOpen = false;
                updateUI();
            };

            const onFocusIn = (event) => {
                const target = getEditableTarget(event.target);
                if (!target) return;
                if (suppressNextFocusReset) {
                    suppressNextFocusReset = false;
                    return;
                }
                activeTarget = target;
                updateUI();
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
                if (selectionText) updateCopiedTextCache(selectionText);
            };

            const onSelectionChange = () => {
                const selectionText = getActiveSelectionText();
                if (selectionText) updateCopiedTextCache(selectionText);
                if (panelOpen) updateUI();
            };

            const onClipboardChange = async () => {
                if (!navigator.clipboard?.readText) return;
                try {
                    const text = await navigator.clipboard.readText();
                    if (text && text.trim() && text.trim() !== copiedTextCache) {
                        await saveCopiedText(text);
                    }
                } catch {
                    // Ignore permissions errors
                }
            };

            // ─── Init ─────────────────────────────────────────────────────

            bindFloatingUi();
            document.addEventListener('focusin', onFocusIn, true);
            document.addEventListener('pointerdown', onPointerDown, true);
            document.addEventListener('copy', onCopy, true);
            document.addEventListener('cut', onCopy, true);
            document.addEventListener('keyup', onKeyUp, true);
            document.addEventListener('selectionchange', onSelectionChange, true);
            window.addEventListener('focus', onClipboardChange, true);
            document.addEventListener('visibilitychange', onClipboardChange, true);
            return {
                onConfigChange(nextConfig) {
                    config = nextConfig;
                    if (!config?.clipboard?.enabled) panelOpen = false;
                    if (panelOpen) updateUI();
                },
                destroy() {
                    document.removeEventListener('focusin', onFocusIn, true);
                    document.removeEventListener('pointerdown', onPointerDown, true);
                    document.removeEventListener('copy', onCopy, true);
                    document.removeEventListener('cut', onCopy, true);
                    document.removeEventListener('keyup', onKeyUp, true);
                    document.removeEventListener('selectionchange', onSelectionChange, true);
                    window.removeEventListener('focus', onClipboardChange, true);
                    document.removeEventListener('visibilitychange', onClipboardChange, true);

                    removeDragBinding();
                    removeOutsideClick();
                    triggerRef?.destroy();
                    panelRef?.destroy();
                }
            };
        }
    };
})();
