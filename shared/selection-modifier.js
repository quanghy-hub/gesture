(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const snapshotManager = ext.shared.selectionSnapshot;

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
        if (!snapshot || !String(nextText || '') || !snapshotManager.isSelectionSnapshotCurrent(snapshot)) {
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

    ext.shared.selectionModifier = {
        replaceSelectionSnapshot
    };
})();
