(() => {
    const ext = globalThis.GestureExtension;

    ext.features.youtubeSubtitles = {
        shouldRun: ({ runtime }) => runtime.isHttpPage() && /(^|\.)youtube\.com$/i.test(window.location.hostname),
        init: ({ getConfig, storage }) => {
            const body = document.body;
            if (window.top !== window || body?.dataset?.gestureYoutubeSubtitlesMounted === 'true') {
                return {
                    onConfigChange() { },
                    destroy() { }
                };
            }

            const controller = ext.youtubeSubtitles.createController({ getConfig, storage });
            const settings = controller.settings();

            if (!ext.youtubeSubtitles.isWatchPage()) {
                return controller;
            }

            if (body?.dataset) {
                body.dataset.gestureYoutubeSubtitlesMounted = 'true';
            }

            ext.youtubeSubtitles.dom.mountControlButtons({ onToggleTranslate: controller.toggleTranslationMode });
            ext.youtubeSubtitles.dom.applySettingsStyles(settings);

            if (settings.enabled) {
                controller.startTranslationMode();
            }

            const originalDestroy = controller.destroy.bind(controller);

            return {
                ...controller,
                destroy() {
                    if (document.body?.dataset) {
                        delete document.body.dataset.gestureYoutubeSubtitlesMounted;
                    }
                    originalDestroy();
                }
            };
        }
    };
})();
