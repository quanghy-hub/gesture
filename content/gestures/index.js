(() => {
    const ext = globalThis.GestureExtension;
    const { isHttpPage } = ext.shared.runtime;

    ext.features.gesturesDesktop = {
        shouldRun() {
            return isHttpPage();
        },

        init(context) {
            return ext.gestures.createDesktopController(context);
        }
    };

    ext.features.gesturesMobile = {
        shouldRun() {
            return isHttpPage();
        },

        init(context) {
            return ext.gestures.createMobileController(context);
        }
    };
})();
