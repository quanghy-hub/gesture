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

    ext.shared.selectionModifier = {
        replaceSelectionSnapshot,
        insertTextAtCaret
    };
})();
