(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const viewport = ext.shared.viewportCore;
    const EDITABLE_SELECTION_PANEL_MARGIN = 8;

    let editableSelectionPanel = null;
    let editableSelectionPanelMeta = null;
    let editableSelectionPanelText = null;
    let editableSelectionApplyHandler = null;

    const applyEditableSelectionPanelPosition = (anchor) => {
        if (!editableSelectionPanel || !anchor) {
            return;
        }
        const width = editableSelectionPanel.offsetWidth;
        const height = editableSelectionPanel.offsetHeight;
        const centeredLeft = anchor.x - width / 2;
        const next = viewport?.fitPanelToViewport?.({
            preferredLeft: centeredLeft,
            preferredTop: anchor.y,
            panelWidth: width,
            panelHeight: height,
            margin: EDITABLE_SELECTION_PANEL_MARGIN
        }) || {
            left: Math.max(
                EDITABLE_SELECTION_PANEL_MARGIN,
                Math.min(centeredLeft, window.innerWidth - width - EDITABLE_SELECTION_PANEL_MARGIN)
            ),
            top: Math.max(
                EDITABLE_SELECTION_PANEL_MARGIN,
                Math.min(anchor.y, window.innerHeight - height - EDITABLE_SELECTION_PANEL_MARGIN)
            )
        };

        editableSelectionPanel.style.left = `${next.left}px`;
        editableSelectionPanel.style.top = `${next.top}px`;
    };

    const ensureEditableSelectionPanel = () => {
        if (editableSelectionPanel?.isConnected) {
            return editableSelectionPanel;
        }

        editableSelectionPanel = document.createElement('div');
        editableSelectionPanel.className = 'gesture-inline-translate-selection-panel';
        editableSelectionPanel.setAttribute('role', 'button');
        editableSelectionPanel.tabIndex = -1;

        editableSelectionPanelMeta = document.createElement('div');
        editableSelectionPanelMeta.className = 'gesture-inline-translate-selection-meta';
        editableSelectionPanelText = document.createElement('div');
        editableSelectionPanelText.className = 'gesture-inline-translate-selection-text';
        editableSelectionPanel.append(editableSelectionPanelMeta, editableSelectionPanelText);

        const keepSelectionStable = (event) => {
            event.preventDefault();
        };

        editableSelectionPanel.addEventListener('pointerdown', keepSelectionStable);
        editableSelectionPanel.addEventListener('mousedown', keepSelectionStable);
        editableSelectionPanel.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (editableSelectionPanel.dataset.mode === 'result' && typeof editableSelectionApplyHandler === 'function') {
                editableSelectionApplyHandler();
            }
        });
        editableSelectionPanel.addEventListener('keydown', (event) => {
            if (editableSelectionPanel.dataset.mode !== 'result') {
                return;
            }
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            editableSelectionApplyHandler?.();
        });

        document.documentElement.appendChild(editableSelectionPanel);
        return editableSelectionPanel;
    };

    const setEditableSelectionPanelState = ({ mode, anchor, meta, text, onApply }) => {
        const panel = ensureEditableSelectionPanel();
        editableSelectionApplyHandler = typeof onApply === 'function' ? onApply : null;
        panel.dataset.mode = mode;
        panel.tabIndex = mode === 'result' ? 0 : -1;
        panel.setAttribute('aria-disabled', mode === 'result' ? 'false' : 'true');
        editableSelectionPanelMeta.textContent = meta;
        editableSelectionPanelMeta.style.display = meta ? 'block' : 'none';
        editableSelectionPanelText.textContent = text;
        panel.style.display = 'block';
        applyEditableSelectionPanelPosition(anchor);
    };

    inlineTranslate.editableSelectionPanel = {
        showEditableSelectionLoading(anchor) {
            setEditableSelectionPanelState({
                mode: 'loading',
                anchor,
                meta: 'Đang dịch sang tiếng Anh',
                text: 'Đang xử lý vùng bôi đen…'
            });
        },
        showEditableSelectionResult({ anchor, text, onApply }) {
            setEditableSelectionPanelState({
                mode: 'result',
                anchor,
                meta: '',
                text,
                onApply
            });
        },
        showEditableSelectionError({ anchor, message }) {
            setEditableSelectionPanelState({
                mode: 'error',
                anchor,
                meta: 'Không dịch được',
                text: String(message || 'Lỗi dịch tạm thời').slice(0, 140)
            });
        },
        repositionEditableSelectionPanel(anchor) {
            if (editableSelectionPanel?.style.display === 'block') {
                applyEditableSelectionPanelPosition(anchor);
            }
        },
        hideEditableSelectionPanel() {
            editableSelectionApplyHandler = null;
            if (editableSelectionPanel) {
                editableSelectionPanel.style.display = 'none';
                editableSelectionPanel.dataset.mode = '';
                editableSelectionPanel.tabIndex = -1;
            }
        },
        isEventInsideEditableSelectionPanel(event) {
            if (!editableSelectionPanel?.isConnected) {
                return false;
            }
            const path = event.composedPath?.();
            if (Array.isArray(path) && path.includes(editableSelectionPanel)) {
                return true;
            }
            return event.target instanceof Node && editableSelectionPanel.contains(event.target);
        }
    };
})();
