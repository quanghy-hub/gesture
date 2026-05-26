(() => {
    const ext = globalThis.GestureExtension;

    ext.features.videoScreenshot = {
        shouldRun: ({ runtime }) => runtime.isHttpPage() && runtime.isHtmlDocument(),
        init: (context) => {
            return ext.videoScreenshot.createController(context);
        }
    };
})();
