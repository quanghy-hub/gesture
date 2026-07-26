(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const createLongPressManager = (state) => {
        return {
            cancelLongPress: () => {
                clearTimeout(state.lp.timer);
                state.lp.timer = null;
                state.lp.active = false;
            }
        };
    };

    ext.gestures.desktopLongPress = {
        createLongPressManager
    };
})();
