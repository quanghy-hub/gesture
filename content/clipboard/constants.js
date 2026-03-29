(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = ext.clipboard = ext.clipboard || {};

    clipboard.UI = Object.freeze({
        triggerSize: 36,
        panelOffset: 8
    });
})();
