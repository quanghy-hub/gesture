(() => {
    const ext = globalThis.GestureExtension;
    const { deepClone, mergeObjects, clampNumber, normalizeMode, normalizeSide, normalizeExcludedHosts, normalizeProviderSettings } =
        ext.shared.configUtils;
    const { DEFAULT_POPUP_PANEL_ORDER, DEFAULT_CONFIG } = ext.shared.configSchema;
    const apiServicesUtils = ext.shared.apiServices || {};
    const DEFAULT_API_SERVICES = apiServicesUtils.DEFAULT_API_SERVICES || {
        translate: {
            activeProvider: 'google',
            fallbackEnabled: true,
            fallbackProvider: 'mymemory',
            providers: {
                google: { enabled: true, apiKey: '', endpoint: '' },
                mymemory: { enabled: true, apiKey: '', endpoint: '' },
                deepl: { enabled: false, apiKey: '', endpoint: '' }
            }
        },
        ocr: {
            activeProvider: 'ocrspace',
            fallbackEnabled: false,
            fallbackProvider: 'ocrspace-alt',
            providers: {
                ocrspace: { enabled: true, apiKey: 'helloworld', endpoint: '' },
                'ocrspace-alt': { enabled: false, apiKey: '', endpoint: '' }
            }
        }
    };
    const getDefaultProviderId =
        apiServicesUtils.getDefaultProviderId || ((serviceType) => (serviceType === 'ocr' ? 'ocrspace' : 'google'));
    const getDefaultFallbackProviderId =
        apiServicesUtils.getDefaultFallbackProviderId || ((serviceType) => (serviceType === 'translate' ? 'mymemory' : ''));

    const normalizePopupPanelOrder = (value) => {
        const incoming = Array.isArray(value) ? value : [];
        const allowed = new Set(DEFAULT_POPUP_PANEL_ORDER);
        const result = [];
        incoming.forEach((entry) => {
            if (typeof entry !== 'string') return;
            const normalized = entry.trim();
            if (!allowed.has(normalized) || result.includes(normalized)) return;
            result.push(normalized);
        });
        DEFAULT_POPUP_PANEL_ORDER.forEach((entry) => {
            if (!result.includes(entry)) {
                result.push(entry);
            }
        });
        return result;
    };

    const normalizeApiServiceConfig = (serviceType, value) => {
        const defaults = DEFAULT_API_SERVICES[serviceType] || {
            activeProvider: getDefaultProviderId(serviceType),
            fallbackEnabled: false,
            fallbackProvider: getDefaultFallbackProviderId(serviceType),
            providers: {}
        };
        const next = value && typeof value === 'object' ? value : {};
        const providerDefaults = defaults.providers && typeof defaults.providers === 'object' ? defaults.providers : {};
        const providers = {};

        for (const providerId of Object.keys(providerDefaults)) {
            providers[providerId] = normalizeProviderSettings(next.providers?.[providerId], providerDefaults[providerId]);
        }

        if (next.providers && typeof next.providers === 'object') {
            for (const [providerId, providerValue] of Object.entries(next.providers)) {
                if (providers[providerId]) continue;
                providers[providerId] = normalizeProviderSettings(providerValue, { enabled: true, apiKey: '', endpoint: '' });
            }
        }

        const activeProvider =
            typeof next.activeProvider === 'string' && providers[next.activeProvider]
                ? next.activeProvider
                : defaults.activeProvider || getDefaultProviderId(serviceType);

        const fallbackProvider =
            typeof next.fallbackProvider === 'string' && providers[next.fallbackProvider]
                ? next.fallbackProvider
                : defaults.fallbackProvider || getDefaultFallbackProviderId(serviceType);

        return {
            activeProvider,
            fallbackEnabled: next.fallbackEnabled !== false && !!fallbackProvider,
            fallbackProvider,
            providers
        };
    };

    const normalizeConfig = (rawConfig) => {
        if (rawConfig && rawConfig._isNormalized) {
            return rawConfig;
        }
        const merged = mergeObjects(DEFAULT_CONFIG, rawConfig || {});
        const config = deepClone(merged);

        config.version = 1;

        // clipboard
        config.clipboard = config.clipboard && typeof config.clipboard === 'object' ? config.clipboard : {};
        config.clipboard.enabled = config.clipboard.enabled !== false;
        config.clipboard.maxHistory = clampNumber(config.clipboard.maxHistory, 5, 1, 20);
        config.clipboard.history = Array.isArray(config.clipboard.history)
            ? config.clipboard.history.filter((s) => typeof s === 'string' && s.length > 0).slice(0, 20)
            : [];
        config.clipboard.pinned = Array.isArray(config.clipboard.pinned)
            ? config.clipboard.pinned.filter((s) => typeof s === 'string' && s.length > 0)
            : [];
        delete config.clipboard.triggerPosition;

        config.unblockCopy = config.unblockCopy && typeof config.unblockCopy === 'object' ? config.unblockCopy : {};
        config.unblockCopy.enabled = config.unblockCopy.enabled !== false;

        config.googleSearch = config.googleSearch && typeof config.googleSearch === 'object' ? config.googleSearch : {};
        config.googleSearch.enabled = config.googleSearch.enabled !== false;

        config.quickSearch = config.quickSearch && typeof config.quickSearch === 'object' ? config.quickSearch : {};
        config.quickSearch.enabled = config.quickSearch.enabled !== false;
        config.quickSearch.enabledProviderIds = Array.isArray(config.quickSearch.enabledProviderIds)
            ? config.quickSearch.enabledProviderIds
                  .filter((value) => typeof value === 'string' && value.trim())
                  .map((value) => value.trim())
            : ['google', 'perplexity', 'chatgpt', 'gemini', 'claude', 'copilot', 'bing', 'duckduckgo', 'youtube', 'google-images'];
        config.quickSearch.selectionDelay = clampNumber(config.quickSearch.selectionDelay, 300, 100, 1000);
        config.quickSearch.columns = clampNumber(config.quickSearch.columns, 5, 3, 8);
        config.quickSearch.imageSearchEnabled = config.quickSearch.imageSearchEnabled !== false;
        config.quickSearch.imageLongPressMs = clampNumber(config.quickSearch.imageLongPressMs, 320, 150, 1000);

        // videoFloating
        config.videoFloating = config.videoFloating && typeof config.videoFloating === 'object' ? config.videoFloating : {};
        config.videoFloating.enabled = config.videoFloating.enabled !== false;
        config.videoFloating.swipeLong = clampNumber(config.videoFloating.swipeLong, 0.3, 0.05, 1);
        config.videoFloating.swipeShort = clampNumber(config.videoFloating.swipeShort, 0.15, 0.05, 1);
        config.videoFloating.shortThreshold = clampNumber(config.videoFloating.shortThreshold, 200, 50, 1000);
        config.videoFloating.minSwipeDistance = clampNumber(config.videoFloating.minSwipeDistance, 30, 10, 200);
        config.videoFloating.verticalTolerance = clampNumber(config.videoFloating.verticalTolerance, 80, 20, 300);
        config.videoFloating.diagonalThreshold = clampNumber(config.videoFloating.diagonalThreshold, 1.5, 0.5, 5);
        config.videoFloating.realtimePreview = config.videoFloating.realtimePreview !== false;
        config.videoFloating.throttle = clampNumber(config.videoFloating.throttle, 15, 0, 100);
        config.videoFloating.forwardStep = clampNumber(config.videoFloating.forwardStep, 5, 1, 60);
        config.videoFloating.hotkeys = config.videoFloating.hotkeys !== false;
        delete config.videoFloating.boost;
        delete config.videoFloating.boostLevel;
        delete config.videoFloating.maxBoost;
        config.videoFloating.noticeFontSize = clampNumber(config.videoFloating.noticeFontSize, 14, 8, 48);
        config.videoFloating.backgroundSeekExcludedHosts = normalizeExcludedHosts(config.videoFloating.backgroundSeekExcludedHosts);
        config.videoFloating.layout =
            config.videoFloating.layout && typeof config.videoFloating.layout === 'object' ? config.videoFloating.layout : null;
        delete config.videoFloating.iconPos;

        config.videoScreenshot = config.videoScreenshot && typeof config.videoScreenshot === 'object' ? config.videoScreenshot : {};
        config.videoScreenshot.enabled = config.videoScreenshot.enabled !== false;

        config.inlineTranslate = config.inlineTranslate && typeof config.inlineTranslate === 'object' ? config.inlineTranslate : {};
        config.inlineTranslate.enabled = config.inlineTranslate.enabled !== false;
        config.inlineTranslate.provider =
            typeof config.inlineTranslate.provider === 'string' && config.inlineTranslate.provider.trim()
                ? config.inlineTranslate.provider.trim().toLowerCase()
                : 'google';
        config.inlineTranslate.selectionTranslateEnabled = config.inlineTranslate.selectionTranslateEnabled !== false;
        config.inlineTranslate.hotkeyEnabled = config.inlineTranslate.hotkeyEnabled !== false;
        config.inlineTranslate.hotkey = ['ctrl+d', 'f2'].includes(String(config.inlineTranslate.hotkey || '').toLowerCase())
            ? String(config.inlineTranslate.hotkey).toLowerCase()
            : 'ctrl+d';
        config.inlineTranslate.swipeEnabled = config.inlineTranslate.swipeEnabled !== false;
        config.inlineTranslate.swipeDir = ['left', 'right', 'both'].includes(config.inlineTranslate.swipeDir)
            ? config.inlineTranslate.swipeDir
            : 'both';
        config.inlineTranslate.swipePx = clampNumber(config.inlineTranslate.swipePx, 60, 20, 240);
        config.inlineTranslate.swipeMaxDurationMs = clampNumber(config.inlineTranslate.swipeMaxDurationMs, 500, 100, 1500);
        config.inlineTranslate.swipeSlopeMax = clampNumber(config.inlineTranslate.swipeSlopeMax, 0.4, 0.1, 1);
        config.inlineTranslate.fontScale = clampNumber(config.inlineTranslate.fontScale, 0.95, 0.5, 2);
        config.inlineTranslate.mutedColor =
            typeof config.inlineTranslate.mutedColor === 'string' && config.inlineTranslate.mutedColor.trim()
                ? config.inlineTranslate.mutedColor.trim()
                : '#00bfff';
        config.inlineTranslate.dedupeSeconds = clampNumber(config.inlineTranslate.dedupeSeconds, 0.7, 0.1, 10);

        config.youtubeSubtitles = config.youtubeSubtitles && typeof config.youtubeSubtitles === 'object' ? config.youtubeSubtitles : {};
        config.youtubeSubtitles.targetLang =
            typeof config.youtubeSubtitles.targetLang === 'string' && config.youtubeSubtitles.targetLang.trim()
                ? config.youtubeSubtitles.targetLang.trim()
                : 'vi';
        config.youtubeSubtitles.fontSize = clampNumber(config.youtubeSubtitles.fontSize, 16, 12, 32);
        config.youtubeSubtitles.translatedFontSize = clampNumber(config.youtubeSubtitles.translatedFontSize, 16, 12, 32);
        config.youtubeSubtitles.originalColor =
            typeof config.youtubeSubtitles.originalColor === 'string' && config.youtubeSubtitles.originalColor.trim()
                ? config.youtubeSubtitles.originalColor.trim()
                : '#ffffff';
        config.youtubeSubtitles.translatedColor =
            typeof config.youtubeSubtitles.translatedColor === 'string' && config.youtubeSubtitles.translatedColor.trim()
                ? config.youtubeSubtitles.translatedColor.trim()
                : '#0e8cef';
        delete config.youtubeSubtitles.displayMode;
        config.youtubeSubtitles.showOriginal = config.youtubeSubtitles.showOriginal !== false;
        config.youtubeSubtitles.containerPosition =
            config.youtubeSubtitles.containerPosition && typeof config.youtubeSubtitles.containerPosition === 'object'
                ? config.youtubeSubtitles.containerPosition
                : {};
        config.youtubeSubtitles.containerPosition.x =
            typeof config.youtubeSubtitles.containerPosition.x === 'string' && config.youtubeSubtitles.containerPosition.x.trim()
                ? config.youtubeSubtitles.containerPosition.x.trim()
                : '5%';
        config.youtubeSubtitles.containerPosition.y =
            typeof config.youtubeSubtitles.containerPosition.y === 'string' && config.youtubeSubtitles.containerPosition.y.trim()
                ? config.youtubeSubtitles.containerPosition.y.trim()
                : '70px';
        config.youtubeSubtitles.containerAlignment = ['left', 'center', 'right'].includes(config.youtubeSubtitles.containerAlignment)
            ? config.youtubeSubtitles.containerAlignment
            : 'left';
        config.youtubeSubtitles.enabled = !!config.youtubeSubtitles.enabled;

        config.apiServices = config.apiServices && typeof config.apiServices === 'object' ? config.apiServices : {};
        config.apiServices.translate = normalizeApiServiceConfig('translate', config.apiServices.translate);
        config.apiServices.ocr = normalizeApiServiceConfig('ocr', config.apiServices.ocr);
        if (config.inlineTranslate.provider && config.apiServices.translate.providers[config.inlineTranslate.provider]) {
            config.apiServices.translate.activeProvider = config.inlineTranslate.provider;
        }
        config.inlineTranslate.provider = config.apiServices.translate.activeProvider || 'google';

        config.forum.defaults.enabled = !!config.forum.defaults.enabled;
        config.forum.defaults.wide = !!config.forum.defaults.wide;
        config.forum.defaults.minWidth = clampNumber(config.forum.defaults.minWidth, 1000, 0, 4000);
        config.forum.defaults.gap = clampNumber(config.forum.defaults.gap, 1, 0, 24);
        config.forum.defaults.fadeTime = clampNumber(config.forum.defaults.fadeTime, 150, 0, 1000);
        config.forum.defaults.initDelay = clampNumber(config.forum.defaults.initDelay, 100, 0, 1000);

        const normalizedHosts = {};
        const hosts = config.forum.hosts && typeof config.forum.hosts === 'object' ? config.forum.hosts : {};
        for (const [host, values] of Object.entries(hosts)) {
            normalizedHosts[host] = {
                enabled: values?.enabled === true,
                wide: values?.wide ?? config.forum.defaults.wide,
                minWidth: clampNumber(values?.minWidth, config.forum.defaults.minWidth, 0, 4000),
                gap: clampNumber(values?.gap, config.forum.defaults.gap, 0, 24),
                fadeTime: clampNumber(values?.fadeTime, config.forum.defaults.fadeTime, 0, 1000),
                initDelay: clampNumber(values?.initDelay, config.forum.defaults.initDelay, 0, 1000)
            };
        }
        config.forum.hosts = normalizedHosts;

        config.runtime = config.runtime && typeof config.runtime === 'object' ? config.runtime : {};
        config.runtime.excludedHosts = normalizeExcludedHosts(config.runtime.excludedHosts);
        config.runtime.popupPanelOrder = normalizePopupPanelOrder(config.runtime.popupPanelOrder);

        config.gestures = config.gestures && typeof config.gestures === 'object' ? config.gestures : {};
        config.gestures.excludedHosts = normalizeExcludedHosts(config.gestures.excludedHosts);

        config.gestures.desktop = config.gestures.desktop && typeof config.gestures.desktop === 'object' ? config.gestures.desktop : {};
        config.gestures.desktop.enabled = !!config.gestures.desktop.enabled;
        config.gestures.desktop.lpress.enabled = !!config.gestures.desktop.lpress.enabled;
        config.gestures.desktop.lpress.mode = normalizeMode(config.gestures.desktop.lpress.mode, 'bg');
        config.gestures.desktop.lpress.ms = clampNumber(config.gestures.desktop.lpress.ms, 500, 200, 2000);
        config.gestures.desktop.rclick.enabled = !!config.gestures.desktop.rclick.enabled;
        config.gestures.desktop.rclick.mode = normalizeMode(config.gestures.desktop.rclick.mode, 'fg');
        config.gestures.desktop.closeTab.enabled = !!config.gestures.desktop.closeTab.enabled;
        config.gestures.desktop.closeTab.ms = clampNumber(config.gestures.desktop.closeTab.ms, 150, 50, 1000);
        delete config.gestures.desktop.dblRight;
        delete config.gestures.desktop.fastScroll;
        config.gestures.desktop.pager.enabled = !!config.gestures.desktop.pager.enabled;
        config.gestures.desktop.pager.hops = clampNumber(config.gestures.desktop.pager.hops, 3, 1, 5);

        config.gestures.mobile = config.gestures.mobile && typeof config.gestures.mobile === 'object' ? config.gestures.mobile : {};
        config.gestures.mobile.enabled = !!config.gestures.mobile.enabled;
        config.gestures.mobile.lpress.enabled = !!config.gestures.mobile.lpress.enabled;
        config.gestures.mobile.lpress.mode = normalizeMode(config.gestures.mobile.lpress.mode, 'bg');
        config.gestures.mobile.lpress.ms = clampNumber(config.gestures.mobile.lpress.ms, 500, 200, 2000);
        config.gestures.mobile.closeTab.enabled = !!config.gestures.mobile.closeTab.enabled;
        config.gestures.mobile.closeTab.ms = clampNumber(config.gestures.mobile.closeTab.ms, 150, 50, 1000);
        delete config.gestures.mobile.dblTap;
        delete config.gestures.mobile.fastScroll;
        config.gestures.mobile.edge.enabled = !!config.gestures.mobile.edge.enabled;
        config.gestures.mobile.edge.width = clampNumber(config.gestures.mobile.edge.width, 40, 20, 120);
        config.gestures.mobile.edge.speed = clampNumber(config.gestures.mobile.edge.speed, 3, 1, 10);
        config.gestures.mobile.edge.side = normalizeSide(config.gestures.mobile.edge.side);

        config._isNormalized = true;
        return config;
    };

    ext.shared.configNormalize = {
        normalizePopupPanelOrder,
        normalizeApiServiceConfig,
        normalizeConfig
    };
})();
