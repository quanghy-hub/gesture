(() => {
    const ext = globalThis.GestureExtension;

    const isEditableTarget = (element) => {
        if (!(element instanceof Element)) return false;
        if (element instanceof HTMLInputElement) {
            const type = (element.type || 'text').toLowerCase();
            return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'password', 'radio', 'range', 'reset', 'submit'].includes(type);
        }
        return element instanceof HTMLTextAreaElement || element.isContentEditable;
    };

    const getEditableTarget = (node) => {
        if (!(node instanceof Element)) return null;
        const direct = node.closest('input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]');
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
        insertTextAtCaret
    };
})();
