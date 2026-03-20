(() => {
    const ext = globalThis.GestureExtension || (globalThis.GestureExtension = {});
    ext.shared = ext.shared || {};
    ext.features = ext.features || {};
    ext.ui = ext.ui || {};
})();