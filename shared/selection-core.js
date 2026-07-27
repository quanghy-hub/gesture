(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};

    ext.shared.selectionCore = {
        ...ext.shared.selectionQuery,
        ...ext.shared.selectionSnapshot,
        ...ext.shared.selectionModifier
    };
})();
