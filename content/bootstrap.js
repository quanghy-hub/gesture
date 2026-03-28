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

    const getFeatureName = (feature, index) => {
        if (!feature || typeof feature !== 'object') {
            return `unknown-${index}`;
        }
        return feature.name || feature.id || feature.key || feature.title || `feature-${index}`;
    };

    const activateFeatures = () => {
        const features = [
            ext.features.clipboardStyles,
            ext.features.clipboard,
            ext.features.googleSearch,
            ext.features.quickSearch,
            ext.features.inlineTranslate,
            ext.features.videoScreenshot,
            ext.features.trustedTypes,
            ext.features.youtubeSubtitles,
            ext.features.forum,
            ext.features.gesturesDesktop,
            ext.features.gesturesMobile
        ].filter(Boolean);

        features.forEach((feature, index) => {
            const featureName = getFeatureName(feature, index);
            try {
                const shouldRun = typeof feature.shouldRun === 'function' ? feature.shouldRun(context) : true;
                if (!shouldRun) return;

                if (typeof feature.init !== 'function') {
                    console.warn(`[GestureExtension] Feature ${featureName} has no init()`);
                    return;
                }

                const controller = feature.init(context);
                if (controller) controllers.push(controller);
            } catch (error) {
                console.error(`[GestureExtension] Failed to initialize feature: ${featureName}`, error);
            }
        });
    };

    ext.shared.storage.getConfig().then((config) => {
        state.config = config;
        activateFeatures();
    }).catch((error) => {
        console.error('[GestureExtension] Failed to load config', error);
        state.config = normalizeConfig();
        activateFeatures();
    });

    if (globalThis.chrome?.storage?.onChanged?.addListener) {
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
    }
})();
