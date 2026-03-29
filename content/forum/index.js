(() => {
    const ext = globalThis.GestureExtension;
    const { isHttpPage } = ext.shared.runtime;

    ext.features.forum = {
        shouldRun() {
            return isHttpPage();
        },

        init(context) {
            return ext.forum.createController(context);
        }
    };
})();
