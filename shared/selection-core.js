(() => {
    const ext = globalThis.GestureExtension;
    const EDITABLE_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';
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

    const isEditableTarget = (element) => {
        if (!(element instanceof Element)) return false;
        if (element instanceof HTMLInputElement) {
            const type = (element.type || 'text').toLowerCase();
            return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'password', 'radio', 'range', 'reset', 'submit'].includes(type);
        }
        return element instanceof HTMLTextAreaElement || element.isContentEditable;
    };

    const getEditableTarget = (node) => {
        const element = node instanceof Element ? node : node?.parentElement;
        if (!(element instanceof Element)) return null;
        const direct = element.closest(EDITABLE_SELECTOR);
        return isEditableTarget(direct) ? direct : null;
    };

    const getSelectionTextFromTarget = (target) => {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0;
            const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : 0;
            return target.value.slice(start, end);
        }
        return document.getSelection()?.toString() || '';
    };

    const getActiveSelectionText = () => {
        const focusedTarget = getEditableTarget(document.activeElement);
        return [
            getSelectionTextFromTarget(focusedTarget),
            document.getSelection()?.toString() || ''
        ].find((value) => typeof value === 'string' && value.trim()) || '';
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
        const target = isEditableTarget(preferredTarget)
            ? preferredTarget
            : getEditableTarget(document.activeElement)
                || getEditableTarget(selection?.anchorNode)
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

    const replaceTextControlSelection = (snapshot, nextText) => {
        const { target, start, end } = snapshot;
        const safeText = String(nextText || '');
        const nextValue = `${target.value.slice(0, start)}${safeText}${target.value.slice(end)}`;
        target.focus({ preventScroll: true });
        target.value = nextValue;
        const caret = start + safeText.length;
        if (typeof target.setSelectionRange === 'function') {
            target.setSelectionRange(caret, caret);
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    };

    const replaceContentEditableSelection = (snapshot, nextText) => {
        const { target } = snapshot;
        const safeText = String(nextText || '');
        const selection = window.getSelection?.();
        if (!selection) {
            return false;
        }

        target.focus({ preventScroll: true });
        selection.removeAllRanges();
        selection.addRange(snapshot.range.cloneRange());

        if (document.execCommand) {
            const inserted = document.execCommand('insertText', false, safeText);
            if (inserted) {
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        }

        if (!selection.rangeCount) {
            return false;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(safeText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    };

    const replaceSelectionSnapshot = (snapshot, nextText) => {
        if (!snapshot || !String(nextText || '') || !isSelectionSnapshotCurrent(snapshot)) {
            return false;
        }
        if (snapshot.kind === 'text-control') {
            return replaceTextControlSelection(snapshot, nextText);
        }
        if (snapshot.kind === 'contenteditable') {
            return replaceContentEditableSelection(snapshot, nextText);
        }
        return false;
    };

    const insertIntoInput = (target, text) => {
        const start = typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length;
        const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : target.value.length;
        const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
        target.focus({ preventScroll: true });
        target.value = nextValue;
        const caret = start + text.length;
        if (typeof target.setSelectionRange === 'function') {
            target.setSelectionRange(caret, caret);
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const insertIntoContentEditable = (target, text) => {
        target.focus({ preventScroll: true });
        const selection = window.getSelection();
        if (!selection) return;

        if (!selection.rangeCount || !target.contains(selection.anchorNode)) {
            const range = document.createRange();
            range.selectNodeContents(target);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        if (document.execCommand) {
            const inserted = document.execCommand('insertText', false, text);
            if (inserted) {
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        }

        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        target.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const insertTextAtCaret = (target, text) => {
        if (!target || !text) return;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            insertIntoInput(target, text);
            return;
        }
        if (target.isContentEditable) {
            insertIntoContentEditable(target, text);
        }
    };

    ext.shared.selectionCore = {
        isEditableTarget,
        getEditableTarget,
        getSelectionTextFromTarget,
        getActiveSelectionText,
        getEditableSelectionSnapshot,
        isSelectionSnapshotCurrent,
        replaceSelectionSnapshot,
        insertTextAtCaret
    };
})();
