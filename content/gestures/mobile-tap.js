(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const createTapManager = (state) => {
        return {
            clearTapStart: () => {
                state.tap.start = null;
            }
        };
    };

    ext.gestures.mobileTap = {
        createTapManager
    };
})();
