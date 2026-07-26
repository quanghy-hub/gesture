(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const EDITABLE_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

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

    ext.shared.selectionQuery = {
        EDITABLE_SELECTOR,
        isEditableTarget,
        getEditableTarget,
        getSelectionTextFromTarget,
        getActiveSelectionText
    };
})();
