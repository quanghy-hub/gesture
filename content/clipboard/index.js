(() => {
    const ext = globalThis.GestureExtension;

    ext.features.clipboard = {
        shouldRun: ({ getConfig }) => !!getConfig()?.clipboard?.enabled,
        init: ({ getConfig, storage }) => ext.clipboard.createController({ getConfig, storage })
    };
})();
