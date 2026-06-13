(() => {
    const ext = globalThis.GestureExtension;
    const { DEFAULT_POPUP_PANEL_ORDER } = ext.shared.config;

    const getPanelOrder = (popupRoot) => Array.from(popupRoot.querySelectorAll('.card[data-panel-id]'))
        .map((card) => card.dataset.panelId)
        .filter((value) => typeof value === 'string' && value);

    const getOrderedPanelCards = (order, panelCards) => {
        const requestedOrder = Array.isArray(order) && order.length ? order : DEFAULT_POPUP_PANEL_ORDER;
        const usedPanelIds = new Set();
        const orderedCards = requestedOrder
            .map((panelId) => panelCards.find((entry) => entry.dataset.panelId === panelId))
            .filter((card) => {
                const panelId = card?.dataset?.panelId;
                if (!panelId || usedPanelIds.has(panelId)) {
                    return false;
                }
                usedPanelIds.add(panelId);
                return true;
            });
        const missingCards = panelCards.filter((card) => !usedPanelIds.has(card.dataset.panelId));
        return [...orderedCards, ...missingCards];
    };

    const applyPanelOrder = (order, popupRoot, panelCards) => {
        const orderedCards = getOrderedPanelCards(order, panelCards);
        const currentCards = Array.from(popupRoot.querySelectorAll('.card[data-panel-id]'));
        const isAlreadyApplied = orderedCards.length === currentCards.length
            && orderedCards.every((card, index) => card === currentCards[index]);
        if (isAlreadyApplied) {
            return;
        }
        orderedCards.forEach((card) => popupRoot.appendChild(card));
    };

    const savePanelOrder = (config, popupRoot, panelCards, scheduleAutoSave) => {
        if (!config) return;
        config.runtime = config.runtime || {};
        config.runtime.popupPanelOrder = getPanelOrder(popupRoot);
        scheduleAutoSave();
    };

    /**
     * Wire drag-and-drop reorder for panel cards.
     * @param {object} deps
     * @param {HTMLElement} deps.popupRoot
     * @param {HTMLElement[]} deps.panelCards
     * @param {HTMLElement[]} deps.dragHandles
     * @param {() => object|null} deps.getConfig
     * @param {() => void} deps.scheduleAutoSave
     * @returns {{ applyPanelOrder: (order: string[]) => void }}
     */
    const initPanelReorder = ({ popupRoot, panelCards, dragHandles, getConfig, scheduleAutoSave }) => {
        let draggingCard = null;

        panelCards.forEach((card) => {
            card.draggable = false;

            card.addEventListener('dragstart', (event) => {
                draggingCard = card;
                card.classList.add('is-dragging');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', card.dataset.panelId || '');
            });

            card.addEventListener('dragover', (event) => {
                if (!draggingCard || draggingCard === card) return;
                event.preventDefault();
                const bounds = card.getBoundingClientRect();
                const before = event.clientY < bounds.top + bounds.height / 2;

                const nextSibling = before ? card : card.nextSibling;
                if (draggingCard.nextSibling !== nextSibling && draggingCard !== nextSibling) {
                    popupRoot.insertBefore(draggingCard, nextSibling);
                }
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('is-dragging');
                draggingCard = null;
                card.draggable = false;
                savePanelOrder(getConfig(), popupRoot, panelCards, scheduleAutoSave);
            });
        });

        dragHandles.forEach((handle) => {
            const card = handle.closest('.card[data-panel-id]');
            if (!card) return;

            handle.addEventListener('pointerdown', () => {
                card.draggable = true;
            });

            const resetDraggable = () => {
                if (!draggingCard) {
                    card.draggable = false;
                }
            };

            handle.addEventListener('pointerup', resetDraggable);
            handle.addEventListener('pointercancel', resetDraggable);
        });

        return {
            applyPanelOrder: (order) => applyPanelOrder(order, popupRoot, panelCards)
        };
    };

    ext.ui = ext.ui || {};
    ext.ui.popupPanelReorder = { initPanelReorder };
})();
