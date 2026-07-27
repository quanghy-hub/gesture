(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.core = videoFloating.core || {};

    const configUtils = ext?.shared?.config;
    const storage = ext?.shared?.storage;
    const floating = ext?.shared?.floatingCore;

    const CONFIG_STORAGE_KEY = configUtils?.STORAGE_KEY || 'gesture_extension_config_v1';
    const LAYOUT_KEY = 'fvp_layout';

    let cfgCache = null;
    let layoutCache = null;
    let layoutReadyPromise = null;

    const getFeatureConfig = () => ({ ...videoFloating.DEFAULT_VIDEO_FLOATING_CONFIG, ...(cfgCache?.videoFloating || {}) });
    const isFeatureEnabled = () => getFeatureConfig().enabled !== false;
    const isBackgroundSeekExcluded = () => configUtils?.isVideoFloatingBackgroundSeekExcluded?.(cfgCache, location.hostname) === true;

    const loadLayout = () => {
        if (layoutCache) return layoutCache;
        if (cfgCache?.videoFloating?.layout) return cfgCache.videoFloating.layout;
        try {
            return JSON.parse(localStorage.getItem(LAYOUT_KEY));
        } catch {
            /* ignore */
        }
        return null;
    };

    const saveLayout = (layout) => {
        layoutCache = layout;
        if (cfgCache?.videoFloating) cfgCache.videoFloating.layout = layout;
        try {
            localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
        } catch {
            /* ignore */
        }
        if (storage?.saveVideoLayout) storage.saveVideoLayout(layout);
    };

    const iconPosStorage = floating?.createPositionStorage
        ? floating.createPositionStorage('fvp_icon_pos', { left: 56, top: 200 })
        : {
              get() {
                  return { left: 56, top: 200 };
              },
              set() {}
          };

    const loadCfgAsync = async () => {
        if (storage?.getConfig) {
            try {
                cfgCache = await storage.getConfig();
            } catch {
                /* ignore */
            }
        }
    };

    const ensureLayoutReady = () => {
        if (layoutReadyPromise) return layoutReadyPromise;
        layoutReadyPromise = (async () => {
            if (storage?.getConfig) {
                try {
                    cfgCache = await storage.getConfig();
                    const saved = cfgCache?.videoFloating?.layout;
                    if (saved) {
                        layoutCache = saved;
                        return saved;
                    }
                } catch {
                    /* ignore */
                }
            }
            const fallback = loadLayout();
            if (fallback) layoutCache = fallback;
            return fallback;
        })();
        return layoutReadyPromise;
    };

    const bindStorageListener = (onChange) => {
        if (!globalThis.chrome?.storage?.onChanged?.addListener) {
            return () => {};
        }
        const handler = (changes, areaName) => {
            if (areaName !== 'local' || !changes?.[CONFIG_STORAGE_KEY]) return;
            try {
                cfgCache = configUtils?.normalizeConfig?.(changes[CONFIG_STORAGE_KEY].newValue) || cfgCache;
            } catch {
                /* ignore */
            }
            onChange?.();
        };
        chrome.storage.onChanged.addListener(handler);
        return () => chrome.storage.onChanged.removeListener(handler);
    };

    videoFloating.core.config = {
        CONFIG_STORAGE_KEY,
        VIDEO_CHECK_INTERVAL: videoFloating.VIDEO_CHECK_INTERVAL,
        getFeatureConfig,
        isFeatureEnabled,
        isBackgroundSeekExcluded,
        loadLayout,
        saveLayout,
        iconPosStorage,
        loadCfgAsync,
        ensureLayoutReady,
        bindStorageListener
    };
})();
