(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    
    ext.shared.floatingCore = {
        ...ext.shared.floatingUtils,
        ...ext.shared.floatingBehavior,
        ...ext.shared.floatingUI
    };
})();
