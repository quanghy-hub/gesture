(() => {
    const ext = globalThis.GestureExtension;
    const { STORAGE_KEY, normalizeConfig } = ext.shared.config;

    const controllers = [];
    const state = {
        config: null
    };

    const context = {
        getConfig: () => state.config,
        storage: ext.shared.storage,
        runtime: ext.shared.runtime,
        tabActions: ext.shared.tabActions,
        configUtils: ext.shared.config
    };

    const activateFeatures = () => {
        const features = [
            ext.features.forum,
            ext.features.gesturesDesktop,
            ext.features.gesturesMobile
        ].filter(Boolean);

        for (const feature of features) {
            try {
                if (!feature.shouldRun?.(context)) continue;
                const controller = feature.init?.(context);
                if (controller) controllers.push(controller);
            } catch (error) {
                console.error('[GestureExtension] Failed to initialize feature', feature, error);
            }
        }
    };

    ext.shared.storage.getConfig().then((config) => {
        state.config = config;
        activateFeatures();
    }).catch((error) => {
        console.error('[GestureExtension] Failed to load config', error);
        state.config = normalizeConfig();
        activateFeatures();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
        state.config = normalizeConfig(changes[STORAGE_KEY].newValue);

        for (const controller of controllers) {
            try {
                controller.onConfigChange?.(state.config);
            } catch (error) {
                console.error('[GestureExtension] Failed to refresh feature config', error);
            }
        }
    });
})();