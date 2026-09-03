(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    // Dùng chung cho desktop và mobile: quản lý vòng đời long-press và tap
    // bằng cách thao tác trực tiếp lên state của controller đang chạy.
    const createLongPressManager = (state) => {
        return {
            cancelLongPress: () => {
                clearTimeout(state.lp.timer);
                state.lp.timer = null;
                state.lp.active = false;
            }
        };
    };

    const createTapManager = (state) => {
        return {
            clearTapStart: () => {
                state.tap.start = null;
            }
        };
    };

    ext.gestures.stateManagers = {
        createLongPressManager,
        createTapManager
    };
})();
