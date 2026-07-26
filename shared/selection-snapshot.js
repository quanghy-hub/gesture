(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const query = ext.shared.selectionQuery;

    const EDITABLE_PANEL_OFFSET_Y = 10;

    const getNodePath = (node) => {
        let current = node instanceof Node ? node : null;
        const parts = [];
        while (current && current !== document.body && current !== document.documentElement) {
            const parent = current.parentNode;
            if (!parent) {
                break;
            }
            const index = Array.prototype.indexOf.call(parent.childNodes, current);
            parts.push(`${current.nodeName}:${index}`);
            current = parent;
        }
        return parts.reverse().join('/');
    };

    const getRangeRect = (range) => {
        if (!(range instanceof Range)) {
            return null;
        }
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
        if (rects.length) {
            return rects.reduce((lowest, rect) => (rect.bottom > lowest.bottom ? rect : lowest), rects[0]);
        }
        const fallbackRect = range.getBoundingClientRect();
        if (!fallbackRect || (fallbackRect.width <= 0 && fallbackRect.height <= 0)) {
            return null;
        }
        return fallbackRect;
    };

    const getControlAnchor = (target) => {
        const rect = target?.getBoundingClientRect?.();
        if (!rect) {
            return null;
        }
        return {
            x: rect.left + (rect.width / 2),
            y: rect.bottom + EDITABLE_PANEL_OFFSET_Y
        };
    };

    const getRangeAnchor = (range) => {
        const rect = getRangeRect(range);
        if (!rect) {
            return null;
        }
        return {
            x: rect.left + (rect.width / 2),
            y: rect.bottom + EDITABLE_PANEL_OFFSET_Y
        };
    };

    const getEditableSelectionKey = ({ target, kind, text, start, end, range }) => {
        if (kind === 'text-control') {
            return [
                kind,
                target?.tagName || '',
                start,
                end,
                target?.value?.length || 0,
                text
            ].join('|');
        }
        return [
            kind,
            text,
            getNodePath(range?.startContainer),
            range?.startOffset ?? 0,
            getNodePath(range?.endContainer),
            range?.endOffset ?? 0
        ].join('|');
    };

    const buildTextControlSelectionSnapshot = (target) => {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return null;
        }
        const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0;
        const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : 0;
        if (end <= start) {
            return null;
        }
        const text = target.value.slice(start, end);
        if (!String(text || '').trim()) {
            return null;
        }
        const anchor = getControlAnchor(target);
        if (!anchor) {
            return null;
        }
        return {
            target,
            kind: 'text-control',
            text,
            start,
            end,
            anchor,
            key: getEditableSelectionKey({ target, kind: 'text-control', text, start, end })
        };
    };

    const buildContentEditableSelectionSnapshot = (target) => {
        if (!target?.isContentEditable) {
            return null;
        }
        const selection = window.getSelection?.();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return null;
        }
        const range = selection.getRangeAt(0);
        if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) {
            return null;
        }
        const text = String(selection.toString() || '');
        if (!text.trim()) {
            return null;
        }
        const clonedRange = range.cloneRange();
        const anchor = getRangeAnchor(clonedRange);
        if (!anchor) {
            return null;
        }
        return {
            target,
            kind: 'contenteditable',
            text,
            range: clonedRange,
            anchor,
            key: getEditableSelectionKey({ target, kind: 'contenteditable', text, range: clonedRange })
        };
    };

    const getEditableSelectionSnapshot = (preferredTarget = null) => {
        const selection = window.getSelection?.();
        const target = query.isEditableTarget(preferredTarget)
            ? preferredTarget
            : query.getEditableTarget(document.activeElement)
                || query.getEditableTarget(selection?.anchorNode)
                || null;

        if (!target) {
            return null;
        }

        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            return buildTextControlSelectionSnapshot(target);
        }

        if (target.isContentEditable) {
            return buildContentEditableSelectionSnapshot(target);
        }

        return null;
    };

    const isSelectionSnapshotCurrent = (snapshot) => {
        if (!snapshot?.target?.isConnected) {
            return false;
        }
        const current = getEditableSelectionSnapshot(snapshot.target);
        return !!current
            && current.target === snapshot.target
            && current.key === snapshot.key
            && current.text === snapshot.text;
    };

    ext.shared.selectionSnapshot = {
        getEditableSelectionSnapshot,
        isSelectionSnapshotCurrent
    };
})();
