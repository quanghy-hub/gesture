(() => {
    const ext = globalThis.GestureExtension;

    ext.features.inlineTranslate = {
        shouldRun: ({ getConfig, runtime }) => runtime.isHttpPage() && !!getConfig()?.inlineTranslate?.enabled,
        init: ({ getConfig }) => {
            const body = document.body;
            if (window.top !== window || body?.dataset?.gestureInlineTranslateMounted === 'true') {
                return {
                    onConfigChange() { },
                    destroy() { }
                };
            }

            if (body?.dataset) {
                body.dataset.gestureInlineTranslateMounted = 'true';
            }

            const controller = ext.inlineTranslate.createController({ getConfig });
            const originalDestroy = controller.destroy?.bind(controller);

            return {
                ...controller,
                destroy() {
                    originalDestroy?.();
                    if (body?.dataset) {
                        delete body.dataset.gestureInlineTranslateMounted;
                    }
                }
            };
        }
    };
})();
