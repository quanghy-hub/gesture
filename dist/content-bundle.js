/**
 * Gesture Extension Bundle: content-bundle.js
 * Generated: 2026-08-12T12:42:58.135Z
 */

/* --- Source: shared/namespace.js --- */
(() => {
    const ext = globalThis.GestureExtension || (globalThis.GestureExtension = {});
    ext.shared = ext.shared || {};
    ext.features = ext.features || {};
    ext.ui = ext.ui || {};
})();


/* --- Source: shared/messaging.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const sendRuntimeMessage = (type, payload = {}, options = {}) =>
        new Promise((resolve, reject) => {
            const { alwaysResolve = false, unwrapResult = false } = options;
            try {
                chrome.runtime.sendMessage({ type, payload }, (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        if (alwaysResolve) {
                            resolve({ ok: false, error: lastError.message });
                        } else {
                            reject(new Error(lastError.message));
                        }
                        return;
                    }
                    if (response?.ok === false && !alwaysResolve) {
                        reject(new Error(response.error || 'Unknown runtime messaging error'));
                        return;
                    }
                    if (unwrapResult && response?.ok !== false) {
                        resolve(response?.result ?? response);
                    } else {
                        resolve(response || (alwaysResolve ? { ok: false, error: 'No response' } : null));
                    }
                });
            } catch (error) {
                if (alwaysResolve) {
                    resolve({ ok: false, error: error?.message || String(error) });
                } else {
                    reject(error);
                }
            }
        });

    ext.shared = ext.shared || {};
    ext.shared.messaging = { sendRuntimeMessage };
})();


/* --- Source: shared/api-services.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const apiServices = (ext.shared.apiServices = ext.shared.apiServices || {});

    const TRANSLATE_PROVIDER_OPTIONS = Object.freeze([
        { id: 'google', label: 'Google Translate' },
        { id: 'mymemory', label: 'MyMemory' },
        { id: 'deepl', label: 'DeepL' }
    ]);

    const OCR_PROVIDER_OPTIONS = Object.freeze([
        { id: 'ocrspace', label: 'OCR.Space' },
        { id: 'ocrspace-alt', label: 'OCR.Space Alt' }
    ]);

    const DEFAULT_API_SERVICES = Object.freeze({
        translate: {
            activeProvider: 'google',
            fallbackEnabled: true,
            fallbackProvider: 'mymemory',
            providers: {
                google: {
                    enabled: true,
                    apiKey: '',
                    endpoint: ''
                },
                mymemory: {
                    enabled: true,
                    apiKey: '',
                    endpoint: ''
                },
                deepl: {
                    enabled: false,
                    apiKey: '',
                    endpoint: ''
                }
            }
        },
        ocr: {
            activeProvider: 'ocrspace',
            fallbackEnabled: false,
            fallbackProvider: 'ocrspace-alt',
            providers: {
                ocrspace: {
                    enabled: true,
                    apiKey: 'helloworld',
                    endpoint: ''
                },
                'ocrspace-alt': {
                    enabled: false,
                    apiKey: '',
                    endpoint: ''
                }
            }
        }
    });

    const getDefaultProviderId = (serviceType) => (serviceType === 'ocr' ? 'ocrspace' : 'google');

    const getDefaultFallbackProviderId = (serviceType) => {
        if (serviceType === 'translate') return 'mymemory';
        if (serviceType === 'ocr') return 'ocrspace-alt';
        return '';
    };

    apiServices.TRANSLATE_PROVIDER_OPTIONS = TRANSLATE_PROVIDER_OPTIONS;
    apiServices.OCR_PROVIDER_OPTIONS = OCR_PROVIDER_OPTIONS;
    apiServices.DEFAULT_API_SERVICES = DEFAULT_API_SERVICES;
    apiServices.getDefaultProviderId = getDefaultProviderId;
    apiServices.getDefaultFallbackProviderId = getDefaultFallbackProviderId;
})();


/* --- Source: shared/config-utils.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const deepClone = (value) => JSON.parse(JSON.stringify(value));

    const mergeObjects = (defaults, incoming) => {
        if (Array.isArray(defaults)) {
            return Array.isArray(incoming) ? incoming.slice() : defaults.slice();
        }

        if (!defaults || typeof defaults !== 'object') {
            return incoming === undefined ? defaults : incoming;
        }

        const result = {};
        const source = incoming && typeof incoming === 'object' ? incoming : {};

        for (const key of Object.keys(defaults)) {
            result[key] = mergeObjects(defaults[key], source[key]);
        }

        for (const key of Object.keys(source)) {
            if (!(key in result)) {
                result[key] = source[key];
            }
        }

        return result;
    };

    const clampNumber = (value, fallback, min, max) => {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    };

    const normalizeMode = (value, fallback) => (value === 'fg' || value === 'bg' ? value : fallback);
    const normalizeSide = (value) => (value === 'left' || value === 'right' || value === 'both' ? value : 'both');
    const normalizeHost = (value) => {
        if (typeof value !== 'string') return '';
        let host = value.trim().toLowerCase();
        if (!host) return '';
        host = host
            .replace(/^https?:\/\//, '')
            .replace(/^(\*\.)+/, '')
            .replace(/[/?#].*$/, '')
            .replace(/:\d+$/, '');
        host = host.replace(/^\.+|\.+$/g, '').replace(/\.+/g, '.');
        if (host.startsWith('www.') && host.split('.').length > 2) {
            host = host.slice(4);
        }
        if (!host || !host.includes('.') || !/^[a-z0-9.-]+$/.test(host)) {
            return '';
        }
        return host;
    };
    const normalizeExcludedHosts = (value) => {
        const list = Array.isArray(value) ? value : [];
        return [...new Set(list.map(normalizeHost).filter(Boolean))];
    };
    const normalizeProviderSettings = (value, fallback) => ({
        enabled: value?.enabled !== false,
        apiKey: typeof value?.apiKey === 'string' ? value.apiKey.trim() : fallback?.apiKey || '',
        endpoint: typeof value?.endpoint === 'string' ? value.endpoint.trim() : fallback?.endpoint || ''
    });

    ext.shared.configUtils = {
        deepClone,
        mergeObjects,
        clampNumber,
        normalizeMode,
        normalizeSide,
        normalizeHost,
        normalizeExcludedHosts,
        normalizeProviderSettings
    };
})();


/* --- Source: shared/config-schema.js --- */
(() => {
    const ext = globalThis.GestureExtension;
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

    const STORAGE_KEY = 'gesture_extension_config_v1';
    const DEFAULT_POPUP_PANEL_ORDER = Object.freeze([
        'host-blacklist',
        'unblock-copy',
        'gestures',
        'clipboard',
        'floating-video',
        'video-screenshot',
        'quick-search',
        'inline-translate',
        'youtube-subtitles',
        'api-services',
        'backup',
        'forum'
    ]);

    const DEFAULT_CONFIG = Object.freeze({
        version: 1,
        clipboard: {
            enabled: true,
            maxHistory: 5,
            history: [],
            pinned: []
        },
        unblockCopy: {
            enabled: true
        },
        googleSearch: {
            enabled: true
        },
        videoFloating: {
            enabled: true,
            swipeLong: 0.3,
            swipeShort: 0.15,
            shortThreshold: 200,
            minSwipeDistance: 30,
            verticalTolerance: 80,
            diagonalThreshold: 1.5,
            realtimePreview: true,
            throttle: 15,
            forwardStep: 5,
            hotkeys: true,
            noticeFontSize: 14,
            backgroundSeekExcludedHosts: [],
            layout: null
        },
        videoScreenshot: {
            enabled: true
        },
        quickSearch: {
            enabled: true,
            enabledProviderIds: [
                'google',
                'perplexity',
                'chatgpt',
                'gemini',
                'claude',
                'copilot',
                'bing',
                'duckduckgo',
                'youtube',
                'google-images'
            ],
            columns: 5,
            imageSearchEnabled: true,
            selectionDelay: 300,
            imageLongPressMs: 320
        },
        inlineTranslate: {
            enabled: true,
            provider: 'google',
            selectionTranslateEnabled: true,
            hotkeyEnabled: true,
            hotkey: 'ctrl+d',
            swipeEnabled: true,
            swipeDir: 'both',
            swipePx: 60,
            swipeMaxDurationMs: 500,
            swipeSlopeMax: 0.4,
            fontScale: 0.95,
            mutedColor: '#00bfff',
            dedupeSeconds: 0.7
        },
        youtubeSubtitles: {
            targetLang: 'vi',
            fontSize: 16,
            translatedFontSize: 16,
            originalColor: '#ffffff',
            translatedColor: '#0e8cef',
            showOriginal: true,
            containerPosition: { x: '5%', y: '70px' },
            containerAlignment: 'left',
            enabled: false
        },
        apiServices: DEFAULT_API_SERVICES,
        forum: {
            defaults: {
                enabled: false,
                wide: true,
                minWidth: 1000,
                gap: 1,
                fadeTime: 150,
                initDelay: 100
            },
            hosts: {}
        },
        runtime: {
            excludedHosts: ['ajog.org'],
            popupPanelOrder: DEFAULT_POPUP_PANEL_ORDER
        },
        gestures: {
            excludedHosts: [],
            desktop: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                rclick: { enabled: true, mode: 'fg' },
                closeTab: { enabled: false, ms: 150 },
                pager: { enabled: true, hops: 3 }
            },
            mobile: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                closeTab: { enabled: false, ms: 150 },
                edge: { enabled: false, width: 40, speed: 3, side: 'both' }
            }
        }
    });

    ext.shared.configSchema = {
        STORAGE_KEY,
        DEFAULT_POPUP_PANEL_ORDER,
        DEFAULT_CONFIG
    };
})();


/* --- Source: shared/config-normalize.js --- */
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


/* --- Source: shared/config.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const { deepClone, normalizeHost, normalizeExcludedHosts } = ext.shared.configUtils;
    const { STORAGE_KEY, DEFAULT_CONFIG, DEFAULT_POPUP_PANEL_ORDER } = ext.shared.configSchema;
    const { normalizeConfig } = ext.shared.configNormalize;

    const isHostExcluded = (configOrHosts, host) => {
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) return false;
        const excludedHosts = Array.isArray(configOrHosts)
            ? normalizeExcludedHosts(configOrHosts)
            : normalizeExcludedHosts(configOrHosts?.runtime?.excludedHosts);
        return excludedHosts.some((entry) => normalizedHost === entry || normalizedHost.endsWith(`.${entry}`));
    };
    const setHostExcluded = (config, host, excluded) => {
        const next = normalizeConfig(config);
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) return next;
        const current = new Set(normalizeExcludedHosts(next.runtime?.excludedHosts));
        if (excluded) {
            current.add(normalizedHost);
        } else {
            current.delete(normalizedHost);
        }
        next.runtime.excludedHosts = [...current];
        return normalizeConfig(next);
    };
    const getVideoFloatingBackgroundSeekExcludedHosts = (config) =>
        normalizeExcludedHosts(config?.videoFloating?.backgroundSeekExcludedHosts);
    const isVideoFloatingBackgroundSeekExcluded = (config, host) => {
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) return false;
        return getVideoFloatingBackgroundSeekExcludedHosts(config).some(
            (entry) => normalizedHost === entry || normalizedHost.endsWith(`.${entry}`)
        );
    };
    const setVideoFloatingBackgroundSeekExcluded = (config, host, excluded) => {
        const next = normalizeConfig(config);
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) return next;
        next.videoFloating = next.videoFloating && typeof next.videoFloating === 'object' ? next.videoFloating : {};
        const current = new Set(getVideoFloatingBackgroundSeekExcludedHosts(next));
        if (excluded) {
            current.add(normalizedHost);
        } else {
            current.delete(normalizedHost);
        }
        next.videoFloating.backgroundSeekExcludedHosts = [...current];
        return normalizeConfig(next);
    };
    const getGestureExcludedHosts = (config) => normalizeExcludedHosts(config?.gestures?.excludedHosts);
    const isGestureHostExcluded = (config, host) => {
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) return false;
        return getGestureExcludedHosts(config).some((entry) => normalizedHost === entry || normalizedHost.endsWith(`.${entry}`));
    };
    const setGestureHostExcluded = (config, host, excluded) => {
        const next = normalizeConfig(config);
        const normalizedHost = normalizeHost(host);
        if (!normalizedHost) return next;
        next.gestures = next.gestures && typeof next.gestures === 'object' ? next.gestures : {};
        const current = new Set(getGestureExcludedHosts(next));
        if (excluded) {
            current.add(normalizedHost);
        } else {
            current.delete(normalizedHost);
        }
        next.gestures.excludedHosts = [...current];
        return normalizeConfig(next);
    };
    const getExcludedMatchPatterns = (excludedHosts) => {
        return normalizeExcludedHosts(excludedHosts).flatMap((host) => [`*://${host}/*`, `*://*.${host}/*`]);
    };

    const getForumConfig = (config, host) => {
        const normalized = normalizeConfig(config);
        return {
            ...normalized.forum.defaults,
            ...(host ? normalized.forum.hosts[host] || {} : {})
        };
    };

    const updateForumHostConfig = (config, host, patch) => {
        const next = deepClone(normalizeConfig(config));
        next.forum.hosts[host] = {
            ...getForumConfig(next, host),
            ...(patch || {})
        };
        next._isNormalized = true;
        return next;
    };

    const getGestureSettings = (config) => {
        const normalized = normalizeConfig(config);
        return {
            enabled: !!(normalized.gestures.desktop.enabled || normalized.gestures.mobile.enabled),
            longPress: {
                enabled: !!(normalized.gestures.desktop.lpress.enabled || normalized.gestures.mobile.lpress.enabled),
                mode: normalized.gestures.desktop.lpress.mode || normalized.gestures.mobile.lpress.mode || 'bg',
                ms: normalized.gestures.desktop.lpress.ms || normalized.gestures.mobile.lpress.ms || 500
            },
            rightClick: {
                enabled: !!normalized.gestures.desktop.rclick.enabled,
                mode: normalized.gestures.desktop.rclick.mode
            },
            closeTab: {
                enabled: !!(normalized.gestures.desktop.closeTab?.enabled || normalized.gestures.mobile.closeTab?.enabled),
                ms: normalized.gestures.desktop.closeTab?.ms || normalized.gestures.mobile.closeTab?.ms || 150
            },
            edgeSwipe: {
                enabled: !!normalized.gestures.mobile.edge.enabled,
                side: normalized.gestures.mobile.edge.side,
                width: normalized.gestures.mobile.edge.width,
                speed: normalized.gestures.mobile.edge.speed
            },
            pager: {
                enabled: !!normalized.gestures.desktop.pager.enabled,
                hops: normalized.gestures.desktop.pager.hops
            }
        };
    };

    const applyGestureSettings = (config, patch) => {
        const next = deepClone(normalizeConfig(config));
        const current = getGestureSettings(next);
        const merged = {
            ...current,
            ...(patch || {}),
            longPress: {
                ...current.longPress,
                ...(patch?.longPress || {})
            },
            rightClick: {
                ...current.rightClick,
                ...(patch?.rightClick || {})
            },
            closeTab: {
                ...current.closeTab,
                ...(patch?.closeTab || {})
            },
            edgeSwipe: {
                ...current.edgeSwipe,
                ...(patch?.edgeSwipe || {})
            },
            pager: {
                ...current.pager,
                ...(patch?.pager || {})
            }
        };

        next.gestures.desktop.enabled = !!merged.enabled;
        next.gestures.mobile.enabled = !!merged.enabled;

        next.gestures.desktop.lpress = {
            enabled: !!merged.longPress.enabled,
            mode: merged.longPress.mode,
            ms: merged.longPress.ms
        };
        next.gestures.mobile.lpress = {
            enabled: !!merged.longPress.enabled,
            mode: merged.longPress.mode,
            ms: merged.longPress.ms
        };

        next.gestures.desktop.rclick = {
            enabled: !!merged.rightClick.enabled,
            mode: merged.rightClick.mode
        };
        next.gestures.desktop.closeTab = {
            enabled: !!merged.closeTab.enabled,
            ms: merged.closeTab.ms
        };
        next.gestures.mobile.closeTab = {
            enabled: !!merged.closeTab.enabled,
            ms: merged.closeTab.ms
        };
        delete next.gestures.desktop.dblRight;
        delete next.gestures.desktop.fastScroll;
        delete next.gestures.mobile.dblTap;
        delete next.gestures.mobile.fastScroll;
        next.gestures.mobile.edge = {
            enabled: !!merged.edgeSwipe.enabled,
            side: merged.edgeSwipe.side,
            width: merged.edgeSwipe.width,
            speed: merged.edgeSwipe.speed
        };
        next.gestures.desktop.pager = {
            enabled: !!merged.pager.enabled,
            hops: merged.pager.hops
        };

        next._isNormalized = true;
        return next;
    };

    ext.shared.config = {
        STORAGE_KEY,
        DEFAULT_CONFIG,
        DEFAULT_POPUP_PANEL_ORDER,
        deepClone,
        normalizeConfig,
        getForumConfig,
        updateForumHostConfig,
        normalizeHost,
        normalizeExcludedHosts,
        isHostExcluded,
        setHostExcluded,
        getVideoFloatingBackgroundSeekExcludedHosts,
        isVideoFloatingBackgroundSeekExcluded,
        setVideoFloatingBackgroundSeekExcluded,
        isGestureHostExcluded,
        setGestureHostExcluded,
        getExcludedMatchPatterns,
        getGestureSettings,
        applyGestureSettings
    };
})();


/* --- Source: shared/storage.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const { STORAGE_KEY, normalizeConfig, deepClone } = ext.shared.config;
    let memoryStore = {};

    const hasStorageApi = () => !!globalThis.chrome?.storage?.local;

    const getRuntimeErrorMessage = () => globalThis.chrome?.runtime?.lastError?.message;

    const getLocal = (keys) =>
        new Promise((resolve, reject) => {
            if (!hasStorageApi()) {
                const list = Array.isArray(keys) ? keys : [keys];
                const result = {};
                list.filter((key) => typeof key === 'string').forEach((key) => {
                    if (Object.prototype.hasOwnProperty.call(memoryStore, key)) {
                        result[key] = memoryStore[key];
                    }
                });
                resolve(result);
                return;
            }

            chrome.storage.local.get(keys, (result) => {
                const runtimeError = getRuntimeErrorMessage();
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve(result || {});
            });
        });

    const setLocal = (payload) =>
        new Promise((resolve, reject) => {
            if (!hasStorageApi()) {
                memoryStore = {
                    ...memoryStore,
                    ...(payload && typeof payload === 'object' ? payload : {})
                };
                resolve();
                return;
            }

            chrome.storage.local.set(payload, () => {
                const runtimeError = getRuntimeErrorMessage();
                if (runtimeError) {
                    reject(new Error(runtimeError));
                    return;
                }
                resolve();
            });
        });

    const getConfig = async () => {
        const result = await getLocal([STORAGE_KEY]);
        return normalizeConfig(result[STORAGE_KEY]);
    };

    const saveConfig = async (config) => {
        const normalized = normalizeConfig(config);
        await setLocal({ [STORAGE_KEY]: normalized });
        try {
            const activeProfileResult = await getLocal(['gestureSyncProfile', 'gestureSyncProfiles']);
            const activeProfile = activeProfileResult.gestureSyncProfile || 'macbook';
            const profiles = activeProfileResult.gestureSyncProfiles || {};
            profiles[activeProfile] = {
                settings: {
                    schema: 1,
                    config: normalized
                }
            };
            await setLocal({ gestureSyncProfiles: profiles });
        } catch (error) {
            console.error('[GestureExtension][storage] Failed to cache profile settings', error);
        }
        return normalized;
    };

    const updateConfig = async (updater) => {
        const current = await getConfig();
        const draft = deepClone(current);
        const nextValue = typeof updater === 'function' ? updater(draft) : updater;
        return saveConfig(nextValue || draft);
    };

    const saveClipboardHistory = async (text) => {
        if (!text || typeof text !== 'string') return;
        const trimmed = text.trim();
        if (!trimmed) return;
        return updateConfig((draft) => {
            draft.clipboard = draft.clipboard || { history: [], pinned: [] };
            draft.clipboard.history = draft.clipboard.history || [];
            const cb = draft.clipboard;
            const max = cb.maxHistory || 5;
            cb.history = [trimmed, ...cb.history.filter((s) => s !== trimmed)].slice(0, max);
            return draft;
        });
    };

    const togglePinItem = async (text) => {
        if (!text || typeof text !== 'string') return;
        const trimmed = text.trim();
        if (!trimmed) return;
        return updateConfig((draft) => {
            draft.clipboard = draft.clipboard || { history: [], pinned: [] };
            draft.clipboard.pinned = draft.clipboard.pinned || [];
            const cb = draft.clipboard;
            const idx = cb.pinned.indexOf(trimmed);
            if (idx === -1) {
                cb.pinned = [trimmed, ...cb.pinned.filter((s) => s !== trimmed)].slice(0, 5);
            } else {
                cb.pinned = cb.pinned.filter((s) => s !== trimmed);
            }
            return draft;
        });
    };

    const removeClipboardItem = async (text) => {
        if (!text || typeof text !== 'string') return;
        const trimmed = text.trim();
        if (!trimmed) return;
        return updateConfig((draft) => {
            if (!draft.clipboard) return draft;
            if (draft.clipboard.history) draft.clipboard.history = draft.clipboard.history.filter((s) => s !== trimmed);
            if (draft.clipboard.pinned) draft.clipboard.pinned = draft.clipboard.pinned.filter((s) => s !== trimmed);
            return draft;
        });
    };

    const clearClipboardHistory = async () => {
        return updateConfig((draft) => {
            if (draft.clipboard) draft.clipboard.history = [];
            return draft;
        });
    };

    const saveVideoLayout = async (layout) => {
        if (!layout || typeof layout !== 'object') return;
        return updateConfig((draft) => {
            draft.videoFloating = draft.videoFloating || {};
            draft.videoFloating.layout = {
                top: layout.top,
                left: layout.left,
                width: layout.width,
                height: layout.height,
                borderRadius: layout.borderRadius
            };
            return draft;
        });
    };

    ext.shared.storage = {
        getLocal,
        setLocal,
        getConfig,
        saveConfig,
        updateConfig,
        saveClipboardHistory,
        togglePinItem,
        removeClipboardItem,
        clearClipboardHistory,
        saveVideoLayout
    };
})();


/* --- Source: shared/runtime.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const debounce = (fn, wait) => {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    };

    const isHttpPage = () => location.protocol === 'http:' || location.protocol === 'https:';
    const isMacOS = () => {
        const platform = navigator.userAgentData?.platform || navigator.platform || '';
        return /mac/i.test(platform);
    };
    const isHtmlDocument = () => {
        const root = document.documentElement;
        if (!root) {
            return false;
        }
        const contentType = String(document.contentType || '').toLowerCase();
        if (contentType.includes('html')) {
            return true;
        }
        return root.namespaceURI === 'http://www.w3.org/1999/xhtml';
    };

    ext.shared.runtime = {
        debounce,
        isMacOS,
        isHttpPage,
        isHtmlDocument
    };
})();


/* --- Source: shared/tab-actions-client.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const send = (type, payload = {}) => ext.shared.messaging.sendRuntimeMessage(type, payload, { alwaysResolve: true });

    ext.shared.tabActions = {
        openTab(url, mode = 'bg') {
            return send('gesture-ext/open-tab', { url, mode });
        },
        openNewTab() {
            return send('gesture-ext/open-new-tab');
        },
        closeCurrentTab() {
            return send('gesture-ext/close-current-tab');
        },
        downloadDataUrl(url, filename) {
            return send('gesture-ext/download-data-url', { url, filename });
        },
        captureVisibleTab() {
            return send('gesture-ext/capture-visible-tab');
        }
    };
})();


/* --- Source: shared/extension-ui-guard.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const BASE_EXTENSION_UI_SELECTORS = [
        '#fvp-master-icon',
        '#fvp-menu',
        '#fvp-container',
        '.gesture-clipboard-trigger',
        '.gesture-clipboard-panel',
        '.gesture-google-search-trigger',
        '.gesture-google-search-panel',
        '#gesture-quick-search-ui-host',
        '.gesture-quick-search-bubble'
    ];

    const getSelectorList = (extraSelectors = []) => [...new Set([...BASE_EXTENSION_UI_SELECTORS, ...extraSelectors].filter(Boolean))];

    const matchesExtensionUi = (node, selector) => node instanceof Element && !!node.closest?.(selector);

    const isExtensionUiTarget = (eventOrTarget, extraSelectors = []) => {
        const selector = getSelectorList(extraSelectors).join(', ');
        if (!selector) return false;

        if (typeof eventOrTarget?.composedPath === 'function') {
            return eventOrTarget.composedPath().some((node) => matchesExtensionUi(node, selector));
        }

        return matchesExtensionUi(eventOrTarget, selector);
    };

    const containsExtensionUi = (root, extraSelectors = []) => {
        if (!(root instanceof Element || root instanceof Document || root instanceof ShadowRoot)) return false;
        const selector = getSelectorList(extraSelectors).join(', ');
        return !!selector && !!root.querySelector?.(selector);
    };

    ext.shared.extensionUiGuard = {
        BASE_EXTENSION_UI_SELECTORS,
        containsExtensionUi,
        getSelectorList,
        isExtensionUiTarget
    };
})();


/* --- Source: shared/viewport-core.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const parsePx = (value, fallbackValue) => {
        const parsed = parseFloat(String(value ?? ''));
        return Number.isFinite(parsed) ? parsed : fallbackValue;
    };

    const clampFixedPosition = ({ left = 0, top = 0, width = 0, height = 0, margin = 8 }) => ({
        left: clamp(left, margin, Math.max(margin, window.innerWidth - width - margin)),
        top: clamp(top, margin, Math.max(margin, window.innerHeight - height - margin))
    });

    const getCenteredRect = ({ width = 0, height = 0, margin = 8 }) => {
        const safeWidth = Math.min(Math.max(width, 0), Math.max(0, window.innerWidth - margin * 2));
        const safeHeight = Math.min(Math.max(height, 0), Math.max(0, window.innerHeight - margin * 2));
        const pos = clampFixedPosition({
            left: Math.round((window.innerWidth - safeWidth) / 2),
            top: Math.round((window.innerHeight - safeHeight) / 2),
            width: safeWidth,
            height: safeHeight,
            margin
        });
        return { left: pos.left, top: pos.top, width: safeWidth, height: safeHeight };
    };

    const normalizeFixedLayout = ({
        layout,
        fallbackLayout,
        minWidth = 0,
        minHeight = 0,
        maxWidth = Math.max(minWidth, window.innerWidth),
        maxHeight = Math.max(minHeight, window.innerHeight),
        margin = 8
    }) => {
        const fallbackWidth = parsePx(fallbackLayout?.width, minWidth);
        const fallbackHeight = parsePx(fallbackLayout?.height, minHeight);
        const width = clamp(parsePx(layout?.width, fallbackWidth), minWidth, Math.max(minWidth, maxWidth));
        const height = clamp(parsePx(layout?.height, fallbackHeight), minHeight, Math.max(minHeight, maxHeight));
        const pos = clampFixedPosition({
            left: parsePx(layout?.left, parsePx(fallbackLayout?.left, margin)),
            top: parsePx(layout?.top, parsePx(fallbackLayout?.top, margin)),
            width,
            height,
            margin
        });

        return {
            width: `${Math.round(width)}px`,
            height: `${Math.round(height)}px`,
            left: `${Math.round(pos.left)}px`,
            top: `${Math.round(pos.top)}px`
        };
    };

    const fitPanelToViewport = ({
        anchorLeft = 0,
        anchorTop = 0,
        panelWidth = 0,
        panelHeight = 0,
        preferredLeft = anchorLeft,
        preferredTop = anchorTop,
        margin = 8
    }) =>
        clampFixedPosition({
            left: preferredLeft,
            top: preferredTop,
            width: panelWidth,
            height: panelHeight,
            margin
        });

    ext.shared.viewportCore = {
        clamp,
        clampFixedPosition,
        fitPanelToViewport,
        getCenteredRect,
        normalizeFixedLayout,
        parsePx
    };
})();


/* --- Source: shared/floating-utils.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const viewport = ext.shared.viewportCore;
    const runtime = ext.shared.runtime;
    const hasStorageApi = () => !!globalThis.chrome?.storage?.local;
    const positionMemoryStore = {};

    const isNodeLike = (value) => value instanceof Node;
    const hasStyleApi = (value) => !!value && typeof value === 'object' && !!value.style;
    const isHtmlDocument = () => runtime?.isHtmlDocument?.() ?? false;
    const getFloatingRoot = () => document.documentElement || document.body || null;
    const isExtensionContextInvalidated = (error) => /Extension context invalidated/i.test(String(error?.message || error || ''));

    const appendHtmlFragment = (element, htmlContent) => {
        if (!element || !htmlContent) {
            return;
        }
        const trimmed = String(htmlContent).trim();
        if (!trimmed) {
            element.textContent = '';
            return;
        }
        if (isHtmlDocument()) {
            const template = document.createElement('template');
            if ('content' in template && typeof element.replaceChildren === 'function') {
                template.innerHTML = trimmed;
                element.replaceChildren(template.content.cloneNode(true));
                return;
            }
        }
        element.textContent = trimmed;
    };

    ext.shared.floatingUtils = {
        isNodeLike,
        hasStyleApi,
        isHtmlDocument,
        getFloatingRoot,
        isExtensionContextInvalidated,
        appendHtmlFragment,
        clamp: (value, min, max) => viewport?.clamp?.(value, min, max) ?? Math.min(max, Math.max(min, value)),
        clampFixedPosition: (rect) =>
            viewport?.clampFixedPosition?.(rect) ?? {
                left: Math.min(
                    Math.max(rect?.margin ?? 8, rect?.left ?? 0),
                    Math.max(rect?.margin ?? 8, window.innerWidth - (rect?.width ?? 0) - (rect?.margin ?? 8))
                ),
                top: Math.min(
                    Math.max(rect?.margin ?? 8, rect?.top ?? 0),
                    Math.max(rect?.margin ?? 8, window.innerHeight - (rect?.height ?? 0) - (rect?.margin ?? 8))
                )
            },
        stopFloatingEvent: (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        },
        createPositionStorage: (storageKey, defaultPos = { left: 20, top: 20 }) => ({
            load: () =>
                new Promise((resolve) => {
                    if (!hasStorageApi()) {
                        const v = positionMemoryStore[storageKey];
                        resolve(v && typeof v === 'object' ? v : defaultPos);
                        return;
                    }
                    try {
                        chrome.storage.local.get([storageKey], (result) => {
                            if (chrome.runtime?.lastError && isExtensionContextInvalidated(chrome.runtime.lastError)) {
                                const v = positionMemoryStore[storageKey];
                                resolve(v && typeof v === 'object' ? v : defaultPos);
                                return;
                            }
                            const v = result?.[storageKey];
                            resolve(v && typeof v === 'object' ? v : defaultPos);
                        });
                    } catch (error) {
                        if (isExtensionContextInvalidated(error)) {
                            const v = positionMemoryStore[storageKey];
                            resolve(v && typeof v === 'object' ? v : defaultPos);
                            return;
                        }
                        resolve(defaultPos);
                    }
                }),
            save: (left, top) => {
                positionMemoryStore[storageKey] = { left, top };
                if (!hasStorageApi()) {
                    return Promise.resolve();
                }
                return new Promise((resolve) => {
                    try {
                        chrome.storage.local.set({ [storageKey]: { left, top } }, () => {
                            if (chrome.runtime?.lastError && isExtensionContextInvalidated(chrome.runtime.lastError)) {
                                resolve(false);
                                return;
                            }
                            resolve(true);
                        });
                    } catch (error) {
                        if (isExtensionContextInvalidated(error)) {
                            resolve(false);
                            return;
                        }
                        resolve(false);
                    }
                });
            }
        })
    };
})();


/* --- Source: shared/floating-behavior.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const utils = ext.shared.floatingUtils;

    ext.shared.floatingBehavior = {
        bindDragBehavior: ({ target, threshold = 6, getInitialPosition, onMove, onClick, onDragEnd }) => {
            if (!target || typeof target.addEventListener !== 'function' || typeof target.removeEventListener !== 'function') {
                return () => {};
            }

            let pointerId = null;
            let startX = 0;
            let startY = 0;
            let dragging = false;
            let origin = { left: 0, top: 0 };

            const reset = () => {
                pointerId = null;
                dragging = false;
            };

            const onPointerMove = (event) => {
                if (event.pointerId !== pointerId) return;
                const deltaX = event.clientX - startX;
                const deltaY = event.clientY - startY;
                if (!dragging && Math.hypot(deltaX, deltaY) >= threshold) {
                    dragging = true;
                }
                if (!dragging) return;
                onMove?.({ event, deltaX, deltaY, origin });
            };

            const onPointerUp = (event) => {
                if (event.pointerId !== pointerId) return;
                if (dragging) onDragEnd?.({ event, origin });
                else onClick?.({ event, origin });
                reset();
            };

            const onPointerCancel = (event) => {
                if (event.pointerId !== pointerId) return;
                reset();
            };

            const onPointerDown = (event) => {
                if (event.button !== 0) return;
                pointerId = event.pointerId;
                startX = event.clientX;
                startY = event.clientY;
                origin = getInitialPosition?.() || { left: 0, top: 0 };
                dragging = false;
                try {
                    target.setPointerCapture(event.pointerId);
                } catch {
                    // Pointer capture is optional on some embedded surfaces.
                }
            };

            target.addEventListener('pointerdown', onPointerDown, true);
            target.addEventListener('pointermove', onPointerMove, true);
            target.addEventListener('pointerup', onPointerUp, true);
            target.addEventListener('pointercancel', onPointerCancel, true);

            return () => {
                target.removeEventListener('pointerdown', onPointerDown, true);
                target.removeEventListener('pointermove', onPointerMove, true);
                target.removeEventListener('pointerup', onPointerUp, true);
                target.removeEventListener('pointercancel', onPointerCancel, true);
            };
        },
        bindOutsideClickGuard: ({ isOpen, containsTarget, onOutside, eventName = 'pointerdown', capture = true }) => {
            const handler = (event) => {
                if (!isOpen?.()) return;
                const path = event.composedPath?.() || [event.target];
                if (path.some((t) => utils.isNodeLike(t) && containsTarget?.(t))) return;
                onOutside?.(event);
            };
            document.addEventListener(eventName, handler, capture);
            return () => document.removeEventListener(eventName, handler, capture);
        }
    };
})();


/* --- Source: shared/floating-ui.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const utils = ext.shared.floatingUtils;

    const SHARED_ACTION_STYLE_ID = 'gesture-shared-floating-action-style';
    const SHARED_ICONS = Object.freeze({
        camera: `
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 4H6a2 2 0 0 0-2 2v2"></path>
                <path d="M16 4h2a2 2 0 0 1 2 2v2"></path>
                <path d="M20 16v2a2 2 0 0 1-2 2h-2"></path>
                <path d="M8 20H6a2 2 0 0 1-2-2v-2"></path>
                <rect x="7" y="7" width="10" height="10" rx="2"></rect>
                <circle cx="12" cy="12" r="2.5"></circle>
            </svg>
        `,
        translate: `
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 6h8"></path>
                <path d="M8 4v2"></path>
                <path d="M6 6c0 2.8-1.2 5.2-3.5 7.1"></path>
                <path d="M4.8 10.2c1 1.3 2.3 2.4 4 3.3"></path>
                <path d="M13 8h7"></path>
                <path d="M16.5 5v3"></path>
                <path d="M14.5 19 17 12l2.5 7"></path>
                <path d="M15.4 16.6h3.2"></path>
                <path d="M10.5 17.5 12 19l2.5-2.5"></path>
            </svg>
        `,
        translateActive: `
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 6h8"></path>
                <path d="M8 4v2"></path>
                <path d="M6 6c0 2.8-1.2 5.2-3.5 7.1"></path>
                <path d="M4.8 10.2c1 1.3 2.3 2.4 4 3.3"></path>
                <path d="M13 8h7"></path>
                <path d="M16.5 5v3"></path>
                <path d="M14.5 19 17 12l2.5 7"></path>
                <path d="M15.4 16.6h3.2"></path>
                <path d="M10.5 17.5 12 19l2.5-2.5"></path>
            </svg>
        `
    });

    const ensureSharedActionButtonStyles = () => {
        if (document.getElementById(SHARED_ACTION_STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = SHARED_ACTION_STYLE_ID;
        style.textContent = `
            .gesture-floating-action-button {
                width: 46px;
                height: 46px;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: 0;
                background: transparent;
                color: #fff;
                box-shadow: none;
                cursor: pointer;
                transition: transform 0.15s ease, opacity 0.2s ease, filter 0.15s ease, color 0.15s ease;
                touch-action: manipulation;
                outline: none;
            }
            .gesture-floating-action-button:hover {
                transform: scale(1.04);
                filter: brightness(1.08);
            }
            .gesture-floating-action-button:active,
            .gesture-floating-action-button.is-dragging {
                transform: scale(0.96);
            }
            .gesture-floating-action-button svg {
                display: block;
                flex: 0 0 auto;
                overflow: visible;
                filter:
                    drop-shadow(0 2px 8px rgba(0, 0, 0, 0.55))
                    drop-shadow(0 0 1px rgba(0, 0, 0, 0.7));
            }
            .gesture-floating-action-button.is-active {
                color: #5bb8ff;
            }
        `;
        utils.getFloatingRoot()?.appendChild(style);
    };

    const createFloatingElementApi = (element) => ({
        element,
        show(display) {
            if (!element) {
                return;
            }
            element.hidden = false;
            if (!utils.hasStyleApi(element)) {
                return;
            }
            if (display) {
                element.style.display = display;
            } else {
                // Fallback to a sensible default if it was hidden via inline style
                if (element.style.display === 'none') {
                    const isPanel =
                        element.tagName === 'DIV' || element.classList.contains('gesture-panel') || element.className.includes('panel');
                    if (isPanel) {
                        element.style.display = 'flex';
                        element.style.flexDirection = 'column';
                    } else {
                        element.style.display = 'block';
                    }
                }
            }
        },
        hide() {
            if (!element) {
                return;
            }
            element.hidden = true;
            if (utils.hasStyleApi(element)) {
                element.style.display = 'none';
            }
        },
        setPosition(left, top) {
            if (!utils.hasStyleApi(element)) {
                return;
            }
            element.style.left = typeof left === 'number' ? `${left}px` : left;
            element.style.top = typeof top === 'number' ? `${top}px` : top;
        },
        setOpacity(value) {
            if (!utils.hasStyleApi(element)) {
                return;
            }
            element.style.opacity = value;
        },
        setBadge(text) {
            if (!element || typeof element.querySelector !== 'function') {
                return;
            }
            let badge = element.querySelector('.gesture-floating-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'gesture-floating-badge';
                element.appendChild(badge);
            }
            badge.textContent = text;
            if (utils.hasStyleApi(badge)) {
                badge.style.display = text ? 'flex' : 'none';
            }
        },
        setActive(value) {
            element?.classList?.toggle?.('is-active', !!value);
        },
        destroy() {
            element?.remove?.();
        }
    });

    const createTriggerElement = ({ className, textContent, htmlContent, hidden = false }) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = className;
        if (htmlContent) utils.appendHtmlFragment(element, htmlContent);
        else if (textContent) element.textContent = textContent;
        element.hidden = hidden;
        if (hidden && utils.hasStyleApi(element)) element.style.display = 'none';
        if (utils.hasStyleApi(element)) {
            element.style.position = 'fixed';
            element.style.zIndex = '2147483646';
        }
        utils.getFloatingRoot()?.appendChild(element);
        return createFloatingElementApi(element);
    };

    const createActionButton = ({
        id,
        className = '',
        title = '',
        ariaLabel = '',
        htmlContent = '',
        hidden = false,
        parent,
        position = 'fixed',
        zIndex = '2147483646'
    }) => {
        ensureSharedActionButtonStyles();
        const element = document.createElement('button');
        element.type = 'button';
        if (id) {
            element.id = id;
        }
        element.className = `gesture-floating-action-button ${className}`.trim();
        if (title) {
            element.title = title;
        }
        if (ariaLabel) {
            element.setAttribute('aria-label', ariaLabel);
        }
        if (htmlContent) {
            utils.appendHtmlFragment(element, htmlContent);
        }
        element.hidden = hidden;
        if (hidden && utils.hasStyleApi(element)) {
            element.style.display = 'none';
        }
        if (utils.hasStyleApi(element)) {
            element.style.position = position;
            element.style.zIndex = zIndex;
        }
        (parent || utils.getFloatingRoot())?.appendChild(element);
        return createFloatingElementApi(element);
    };

    const createPanelRoot = ({ className, hidden = false }) => {
        const element = document.createElement('div');
        element.className = className;
        element.hidden = hidden;
        if (hidden && utils.hasStyleApi(element)) element.style.display = 'none';
        if (utils.hasStyleApi(element)) {
            element.style.position = 'fixed';
            element.style.zIndex = '2147483645';
        }
        utils.getFloatingRoot()?.appendChild(element);
        return createFloatingElementApi(element);
    };

    ext.shared.floatingUI = {
        icons: SHARED_ICONS,
        ensureSharedActionButtonStyles,
        createFloatingElementApi,
        createTriggerElement,
        createActionButton,
        createPanelRoot
    };
})();


/* --- Source: shared/floating-core.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};

    ext.shared.floatingCore = {
        ...ext.shared.floatingUtils,
        ...ext.shared.floatingBehavior,
        ...ext.shared.floatingUI
    };
})();


/* --- Source: shared/touch-core.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const uiGuard = ext.shared.extensionUiGuard;

    const getPrimaryPoint = (event) => {
        const point = event?.touches?.[0] || event?.changedTouches?.[0] || event;
        return point ? { x: point.clientX, y: point.clientY } : { x: 0, y: 0 };
    };

    const getDistance = (pointA, pointB) => Math.hypot((pointA?.x || 0) - (pointB?.x || 0), (pointA?.y || 0) - (pointB?.y || 0));

    const isTouchLikeEvent = (event) => !!(event?.touches || event?.changedTouches);

    const preventCancelable = (event) => {
        if (event?.cancelable) {
            event.preventDefault();
        }
    };

    const isExtensionUiTarget = (eventOrTarget, extraSelectors = []) =>
        uiGuard?.isExtensionUiTarget?.(eventOrTarget, extraSelectors) || false;

    const createLongPress = () => {
        let timer = 0;
        let active = false;

        return {
            start(delay, callback) {
                this.cancel();
                active = true;
                timer = window.setTimeout(() => {
                    if (!active) return;
                    active = false;
                    timer = 0;
                    callback?.();
                }, delay);
            },
            cancel() {
                if (timer) {
                    window.clearTimeout(timer);
                    timer = 0;
                }
                active = false;
            },
            isActive() {
                return active;
            }
        };
    };

    ext.shared.touchCore = {
        createLongPress,
        getDistance,
        getPrimaryPoint,
        isExtensionUiTarget,
        isTouchLikeEvent,
        preventCancelable
    };
})();


/* --- Source: shared/toast-core.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    let toastContainer = null;
    let toastTimer = null;

    ext.shared.toastCore = {
        ensureToastStyle: () => {
            if (document.getElementById('gesture-toast-style')) return;
            const style = document.createElement('style');
            style.id = 'gesture-toast-style';
            style.textContent = `
                .gesture-shared-toast {
                    position: fixed;
                    z-index: 2147483647;
                    padding: 6px 12px;
                    border-radius: 6px;
                    background: #222;
                    color: #fff;
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                    font-size: 12px;
                    line-height: 1.4;
                    pointer-events: none;
                    max-width: 320px;
                    word-break: break-word;
                    white-space: pre-wrap;
                    transition: opacity 0.2s ease, transform 0.2s ease;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        },
        createToast: (message, x, y, duration = 2400) => {
            ext.shared.toastCore.ensureToastStyle();

            if (toastContainer) {
                toastContainer.remove();
                clearTimeout(toastTimer);
                toastContainer = null;
            }
            if (!message) return;

            const toast = document.createElement('div');
            toast.className = 'gesture-shared-toast';
            toast.textContent = message;
            document.documentElement.appendChild(toast);

            const rect = toast.getBoundingClientRect();
            toast.style.left = `${Math.min(Math.max(8, x - rect.width / 2), window.innerWidth - rect.width - 8)}px`;
            toast.style.top = `${Math.min(Math.max(8, y - rect.height - 12), window.innerHeight - rect.height - 8)}px`;

            toastContainer = toast;

            toastTimer = window.setTimeout(() => {
                if (toastContainer === toast) {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(10px)';
                    setTimeout(() => toast.remove(), 300);
                    toastContainer = null;
                } else {
                    toast.remove();
                }
            }, duration);
        }
    };
})();


/* --- Source: shared/selection-query.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const EDITABLE_SELECTOR = 'input, textarea, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]';

    const isEditableTarget = (element) => {
        if (!(element instanceof Element)) return false;
        if (element instanceof HTMLInputElement) {
            const type = (element.type || 'text').toLowerCase();
            return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'password', 'radio', 'range', 'reset', 'submit'].includes(
                type
            );
        }
        return element instanceof HTMLTextAreaElement || element.isContentEditable;
    };

    const getEditableTarget = (node) => {
        const element = node instanceof Element ? node : node?.parentElement;
        if (!(element instanceof Element)) return null;
        const direct = element.closest(EDITABLE_SELECTOR);
        return isEditableTarget(direct) ? direct : null;
    };

    const getSelectionTextFromTarget = (target) => {
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0;
            const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : 0;
            return target.value.slice(start, end);
        }
        return document.getSelection()?.toString() || '';
    };

    const getActiveSelectionText = () => {
        const focusedTarget = getEditableTarget(document.activeElement);
        return (
            [getSelectionTextFromTarget(focusedTarget), document.getSelection()?.toString() || ''].find(
                (value) => typeof value === 'string' && value.trim()
            ) || ''
        );
    };

    ext.shared.selectionQuery = {
        EDITABLE_SELECTOR,
        isEditableTarget,
        getEditableTarget,
        getSelectionTextFromTarget,
        getActiveSelectionText
    };
})();


/* --- Source: shared/selection-snapshot.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const query = ext.shared.selectionQuery;

    const EDITABLE_PANEL_OFFSET_Y = 10;

    const getNodePath = (node) => {
        let current = node instanceof Node ? node : null;
        const parts = [];
        while (current && current !== document.body && current !== document.documentElement) {
            const parent = current.parentNode;
            if (!parent) {
                break;
            }
            const index = Array.prototype.indexOf.call(parent.childNodes, current);
            parts.push(`${current.nodeName}:${index}`);
            current = parent;
        }
        return parts.reverse().join('/');
    };

    const getRangeRect = (range) => {
        if (!(range instanceof Range)) {
            return null;
        }
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
        if (rects.length) {
            return rects.reduce((lowest, rect) => (rect.bottom > lowest.bottom ? rect : lowest), rects[0]);
        }
        const fallbackRect = range.getBoundingClientRect();
        if (!fallbackRect || (fallbackRect.width <= 0 && fallbackRect.height <= 0)) {
            return null;
        }
        return fallbackRect;
    };

    const getControlAnchor = (target) => {
        const rect = target?.getBoundingClientRect?.();
        if (!rect) {
            return null;
        }
        return {
            x: rect.left + rect.width / 2,
            y: rect.bottom + EDITABLE_PANEL_OFFSET_Y
        };
    };

    const getRangeAnchor = (range) => {
        const rect = getRangeRect(range);
        if (!rect) {
            return null;
        }
        return {
            x: rect.left + rect.width / 2,
            y: rect.bottom + EDITABLE_PANEL_OFFSET_Y
        };
    };

    const getEditableSelectionKey = ({ target, kind, text, start, end, range }) => {
        if (kind === 'text-control') {
            return [kind, target?.tagName || '', start, end, target?.value?.length || 0, text].join('|');
        }
        return [
            kind,
            text,
            getNodePath(range?.startContainer),
            range?.startOffset ?? 0,
            getNodePath(range?.endContainer),
            range?.endOffset ?? 0
        ].join('|');
    };

    const buildTextControlSelectionSnapshot = (target) => {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return null;
        }
        const start = typeof target.selectionStart === 'number' ? target.selectionStart : 0;
        const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : 0;
        if (end <= start) {
            return null;
        }
        const text = target.value.slice(start, end);
        if (!String(text || '').trim()) {
            return null;
        }
        const anchor = getControlAnchor(target);
        if (!anchor) {
            return null;
        }
        return {
            target,
            kind: 'text-control',
            text,
            start,
            end,
            anchor,
            key: getEditableSelectionKey({ target, kind: 'text-control', text, start, end })
        };
    };

    const buildContentEditableSelectionSnapshot = (target) => {
        if (!target?.isContentEditable) {
            return null;
        }
        const selection = window.getSelection?.();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return null;
        }
        const range = selection.getRangeAt(0);
        if (!target.contains(range.startContainer) || !target.contains(range.endContainer)) {
            return null;
        }
        const text = String(selection.toString() || '');
        if (!text.trim()) {
            return null;
        }
        const clonedRange = range.cloneRange();
        const anchor = getRangeAnchor(clonedRange);
        if (!anchor) {
            return null;
        }
        return {
            target,
            kind: 'contenteditable',
            text,
            range: clonedRange,
            anchor,
            key: getEditableSelectionKey({ target, kind: 'contenteditable', text, range: clonedRange })
        };
    };

    const getEditableSelectionSnapshot = (preferredTarget = null) => {
        const selection = window.getSelection?.();
        const target = query.isEditableTarget(preferredTarget)
            ? preferredTarget
            : query.getEditableTarget(document.activeElement) || query.getEditableTarget(selection?.anchorNode) || null;

        if (!target) {
            return null;
        }

        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            return buildTextControlSelectionSnapshot(target);
        }

        if (target.isContentEditable) {
            return buildContentEditableSelectionSnapshot(target);
        }

        return null;
    };

    const isSelectionSnapshotCurrent = (snapshot) => {
        if (!snapshot?.target?.isConnected) {
            return false;
        }
        const current = getEditableSelectionSnapshot(snapshot.target);
        return !!current && current.target === snapshot.target && current.key === snapshot.key && current.text === snapshot.text;
    };

    ext.shared.selectionSnapshot = {
        getEditableSelectionSnapshot,
        isSelectionSnapshotCurrent
    };
})();


/* --- Source: shared/selection-modifier.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const snapshotManager = ext.shared.selectionSnapshot;

    const replaceTextControlSelection = (snapshot, nextText) => {
        const { target, start, end } = snapshot;
        const safeText = String(nextText || '');
        const nextValue = `${target.value.slice(0, start)}${safeText}${target.value.slice(end)}`;
        target.focus({ preventScroll: true });
        target.value = nextValue;
        const caret = start + safeText.length;
        if (typeof target.setSelectionRange === 'function') {
            target.setSelectionRange(caret, caret);
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    };

    const replaceContentEditableSelection = (snapshot, nextText) => {
        const { target } = snapshot;
        const safeText = String(nextText || '');
        const selection = window.getSelection?.();
        if (!selection) {
            return false;
        }

        target.focus({ preventScroll: true });
        selection.removeAllRanges();
        selection.addRange(snapshot.range.cloneRange());

        if (document.execCommand) {
            const inserted = document.execCommand('insertText', false, safeText);
            if (inserted) {
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return true;
            }
        }

        if (!selection.rangeCount) {
            return false;
        }
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(safeText);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
    };

    const replaceSelectionSnapshot = (snapshot, nextText) => {
        if (!snapshot || !String(nextText || '') || !snapshotManager.isSelectionSnapshotCurrent(snapshot)) {
            return false;
        }
        if (snapshot.kind === 'text-control') {
            return replaceTextControlSelection(snapshot, nextText);
        }
        if (snapshot.kind === 'contenteditable') {
            return replaceContentEditableSelection(snapshot, nextText);
        }
        return false;
    };

    const insertIntoInput = (target, text) => {
        const start = typeof target.selectionStart === 'number' ? target.selectionStart : target.value.length;
        const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : target.value.length;
        const nextValue = `${target.value.slice(0, start)}${text}${target.value.slice(end)}`;
        target.focus({ preventScroll: true });
        target.value = nextValue;
        const caret = start + text.length;
        if (typeof target.setSelectionRange === 'function') {
            target.setSelectionRange(caret, caret);
        }
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const insertIntoContentEditable = (target, text) => {
        target.focus({ preventScroll: true });
        const selection = window.getSelection();
        if (!selection) return;

        if (!selection.rangeCount || !target.contains(selection.anchorNode)) {
            const range = document.createRange();
            range.selectNodeContents(target);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        if (document.execCommand) {
            const inserted = document.execCommand('insertText', false, text);
            if (inserted) {
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        }

        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        target.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const insertTextAtCaret = (target, text) => {
        if (!target || !text) return;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            insertIntoInput(target, text);
            return;
        }
        if (target.isContentEditable) {
            insertIntoContentEditable(target, text);
        }
    };

    ext.shared.selectionModifier = {
        replaceSelectionSnapshot,
        insertTextAtCaret
    };
})();


/* --- Source: shared/selection-core.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};

    ext.shared.selectionCore = {
        ...ext.shared.selectionQuery,
        ...ext.shared.selectionSnapshot,
        ...ext.shared.selectionModifier
    };
})();


/* --- Source: shared/dom-utils.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const permissionsPolicy = document.permissionsPolicy || document.featurePolicy;
    const allowsFeature = (feature) =>
        typeof permissionsPolicy?.allowsFeature === 'function' ? permissionsPolicy.allowsFeature(feature) : true;
    const queryAllDeep = (selector, root = document) => {
        const visited = new Set();
        const resultSet = new Set();

        const visit = (node) => {
            if (!node || visited.has(node)) {
                return;
            }
            visited.add(node);

            if (typeof node.querySelectorAll === 'function') {
                for (const match of node.querySelectorAll(selector)) {
                    resultSet.add(match);
                }
            }

            const children =
                node instanceof Document
                    ? [node.documentElement]
                    : node instanceof ShadowRoot
                      ? Array.from(node.children)
                      : Array.from(node.children || []);

            for (const child of children) {
                if (child?.shadowRoot) {
                    visit(child.shadowRoot);
                }
                visit(child);
            }
        };

        visit(root);
        return Array.from(resultSet);
    };

    ext.shared.domUtils = {
        escapeHtml: (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
        encodeAttribute: (text) => encodeURIComponent(text),
        decodeAttribute: (text) => {
            try {
                return decodeURIComponent(text || '');
            } catch {
                return text || '';
            }
        },
        previewText: (text, max = 140) => (text.length > max ? `${text.slice(0, max - 3)}...` : text),
        sanitizeFilename: (input) =>
            input
                .replace(/[<>:"/\\|?*]+/g, '_')
                .replace(/\s+/g, ' ')
                .trim(),
        copyText: async (value) => {
            try {
                if (allowsFeature('clipboard-write') && navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(value);
                    return true;
                }
            } catch {
                // Fall through to execCommand fallback below.
            }
            const textarea = document.createElement('textarea');
            textarea.value = value;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            return true;
        },
        isVisible: (element) => {
            if (!(element instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.pointerEvents !== 'none' &&
                rect.width > 0 &&
                rect.height > 0
            );
        },
        hasVisibleSize: (node) => {
            if (!node) return false;
            const rect = node.getBoundingClientRect?.() || { width: 0, height: 0 };
            const width = Math.max(node.offsetWidth || 0, node.clientWidth || 0, rect.width || 0);
            const height = Math.max(node.offsetHeight || 0, node.clientHeight || 0, rect.height || 0);
            return width > 0 && height > 0;
        },
        queryAllDeep,
        queryDeep: (selector, root = document) => queryAllDeep(selector, root)[0] || null
    };
})();


/* --- Source: shared/ocr-core.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const sendRuntimeMessage = (type, payload = {}) => ext.shared.messaging.sendRuntimeMessage(type, payload);

    ext.shared.ocrCore = {
        /**
         * Chích xuất chữ từ ảnh và chép vào clipboard
         * @param {string} imageUrl URL của ảnh
         * @param {number} x Tọa độ X để hiển thị toast
         * @param {number} y Tọa độ Y để hiển thị toast
         */
        extractText: async (imageUrl, x, y) => {
            const toast = ext.shared.toastCore;
            toast.createToast('Đang nhận diện chữ...', x, y, 3000);

            try {
                const response = await sendRuntimeMessage('gesture-ext/perform-ocr', { imageUrl });

                if (response && response.ok) {
                    const text = response.text.trim();
                    if (text) {
                        await ext.shared.domUtils.copyText(text);
                        // Lưu vào lịch sử clipboard của extension
                        if (ext.shared.storage?.saveClipboardHistory) {
                            await ext.shared.storage.saveClipboardHistory(text);
                        }
                        toast.createToast('Đã chép văn bản vào clipboard', x, y, 2000);
                    } else {
                        toast.createToast('Không nhận diện được chữ', x, y, 1800);
                    }
                }
            } catch {
                toast.createToast('OCR không khả dụng cho ảnh này', x, y, 1800);
            }
        }
    };
})();


/* --- Source: content/unblock-copy/index.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const unblockCopy = (ext.unblockCopy = ext.unblockCopy || {});
    const UI_GUARD = ext.shared.extensionUiGuard;

    const STYLE_ID = 'gesture-unblock-copy-style';
    const WINDOW_BLOCKED_EVENT_NAMES = ['contextmenu', 'selectstart', 'dragstart'];
    const DOCUMENT_BLOCKED_EVENT_NAMES = [...WINDOW_BLOCKED_EVENT_NAMES, 'copy', 'cut', 'beforecopy', 'beforecut'];
    const BLOCKED_HANDLER_NAMES = ['oncontextmenu', 'oncopy', 'oncut', 'onbeforecopy', 'onbeforecut', 'onselectstart', 'ondragstart'];

    const canPatchNode = (node) => node instanceof Element || node instanceof Document || node instanceof Window;

    const clearBlockingHandlers = (root) => {
        if (!root) return;
        const nodes = [];
        if (canPatchNode(root)) nodes.push(root);
        if (root instanceof Element || root instanceof Document) {
            for (const name of BLOCKED_HANDLER_NAMES) {
                const selector = `[${name}]`;
                root.querySelectorAll?.(selector).forEach((node) => nodes.push(node));
            }
        }

        for (const node of nodes) {
            if (UI_GUARD?.isExtensionUiTarget?.(node)) continue;
            for (const name of BLOCKED_HANDLER_NAMES) {
                try {
                    if (node instanceof Element && node.hasAttribute(name)) {
                        node.removeAttribute(name);
                    }
                    if (name in node && node[name]) {
                        node[name] = null;
                    }
                } catch {
                    // Some native objects expose read-only handler properties.
                }
            }
        }
    };

    const ensureStyle = () => {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            html.gesture-unblock-copy,
            html.gesture-unblock-copy body,
            html.gesture-unblock-copy body * {
                -webkit-user-select: text !important;
                user-select: text !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    const setActiveClass = (enabled) => {
        document.documentElement?.classList.toggle('gesture-unblock-copy', enabled);
    };

    unblockCopy.createController = ({ getConfig }) => {
        const listeners = [];
        let observer = null;
        let active = false;

        const isEnabled = () => getConfig()?.unblockCopy?.enabled !== false;

        const addListener = (target, event, handler, options) => {
            target.addEventListener(event, handler, options);
            listeners.push(() => target.removeEventListener(event, handler, options));
        };

        const shouldAllow = (event) => {
            if (!active || !isEnabled()) return false;
            return !UI_GUARD?.isExtensionUiTarget?.(event);
        };

        const unblockEvent = (event) => {
            if (!shouldAllow(event)) return;
            clearBlockingHandlers(event.target);
            event.stopImmediatePropagation();
        };

        const unblockCopyShortcut = (event) => {
            if (!shouldAllow(event)) return;
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
            const key = String(event.key || '').toLowerCase();
            if (key !== 'c' && key !== 'x' && key !== 'a') return;
            clearBlockingHandlers(event.target);
            event.stopImmediatePropagation();
        };

        const startObserver = () => {
            if (observer || !document.documentElement) return;
            observer = new MutationObserver((records) => {
                if (!active || !isEnabled()) return;
                for (const record of records) {
                    if (record.type === 'attributes') {
                        clearBlockingHandlers(record.target);
                        continue;
                    }
                    record.addedNodes.forEach((node) => clearBlockingHandlers(node));
                }
            });
            observer.observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: BLOCKED_HANDLER_NAMES
            });
        };

        const refresh = () => {
            active = isEnabled();
            ensureStyle();
            setActiveClass(active);
            if (active) {
                clearBlockingHandlers(window);
                clearBlockingHandlers(document);
                clearBlockingHandlers(document.documentElement);
                startObserver();
            }
        };

        WINDOW_BLOCKED_EVENT_NAMES.forEach((eventName) => {
            addListener(window, eventName, unblockEvent, { capture: true, passive: true });
        });
        DOCUMENT_BLOCKED_EVENT_NAMES.forEach((eventName) => {
            addListener(document, eventName, unblockEvent, { capture: true, passive: true });
        });
        addListener(window, 'keydown', unblockCopyShortcut, true);
        addListener(document, 'keydown', unblockCopyShortcut, true);

        refresh();

        return {
            onConfigChange() {
                refresh();
            },
            destroy() {
                active = false;
                setActiveClass(false);
                observer?.disconnect();
                observer = null;
                listeners.splice(0).forEach((remove) => remove());
            }
        };
    };

    ext.features.unblockCopy = {
        shouldRun: ({ runtime }) => runtime.isHttpPage() && runtime.isHtmlDocument(),
        init: ({ getConfig }) => unblockCopy.createController({ getConfig })
    };
})();


/* --- Source: content/forum/styles.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    ext.features.forumStyles = {
        css: `
html.fs-wide .p-body-inner,html.fs-wide .p-pageWrapper,html.fs-wide .pageWidth,
html.fs-wide #content,html.fs-wide .container,html.fs-wide .wrap,html.fs-wide main{max-width:100%!important;width:100%!important;margin-inline:auto!important}
html.fs-active .p-body-sidebar,html.fs-active aside.p-body-sidebar,html.fs-active .block--category-boxes{display:none!important}
html.fs-active{overflow-x:hidden!important}
html.fs-active .p-body-inner{max-width:100%!important;width:100%!important;padding:0!important}
html.fs-active .p-body-main,html.fs-active .p-body-main--withSidebar{display:block!important}
html.fs-active .p-body-content{width:100%!important;max-width:100%!important}
.fs-wrapper{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:var(--fs-gap,1px);align-items:flex-start;max-width:calc(100% - var(--fs-overflow-fix,0px) - 4px)!important;width:calc(100% - var(--fs-overflow-fix,0px) - 4px)!important;margin-inline:auto!important;overflow-x:hidden;overflow-y:hidden;box-sizing:border-box}
.fs-column{min-width:0;display:flex;flex-direction:column;gap:var(--fs-gap,1px);overflow:hidden;word-break:break-word;box-sizing:border-box}
.fs-column>*{margin:0!important;width:100%!important;max-width:100%!important;overflow:hidden;box-sizing:border-box}
.fs-wrapper *{min-width:0!important;overflow-wrap:break-word!important}
.fs-wrapper img{display:block;max-width:100%!important}
.fs-wrapper video,.fs-wrapper iframe{display:block;max-width:100%!important;width:auto!important}
.fs-wrapper video{height:auto!important}
.fs-wrapper pre,.fs-wrapper code{white-space:pre-wrap!important;word-break:break-all!important;overflow:auto!important}
.fs-wrapper table,.fs-wrapper blockquote{overflow:auto!important}
.fs-original-hidden{display:none!important}`
    };
})();


/* --- Source: content/forum/layout.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const SELECTORS = [
        { container: '.block-body.js-replyNewMessageContainer', items: 'article.message--post, article.message' },
        { container: '.structItemContainer-group.js-threadList', items: '.structItem--thread, .structItem' },
        { container: '.structItemContainer', items: '.structItem--thread, .structItem' }
    ];

    const fitWrapperToViewport = (wrapper) => {
        if (!wrapper?.isConnected) return;

        wrapper.style.removeProperty('--fs-overflow-fix');

        const rect = wrapper.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth || innerWidth || 0;
        const overflowLeft = Math.max(0, -rect.left);
        const overflowRight = Math.max(0, rect.right - viewportWidth);
        const overflow = Math.ceil(overflowLeft + overflowRight);

        if (overflow > 0) {
            wrapper.style.setProperty('--fs-overflow-fix', `${overflow}px`);
        }
    };

    const getDirectItems = (container, itemSelector) => {
        const scopedSelector = itemSelector
            .split(',')
            .map((selector) => selector.trim())
            .filter(Boolean)
            .map((selector) => `:scope > ${selector}`)
            .join(', ');

        return scopedSelector ? Array.from(container.querySelectorAll(scopedSelector)) : [];
    };

    const createMasonry = (container, itemSelector, gap) => {
        const items = getDirectItems(container, itemSelector);
        if (items.length < 3) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'fs-wrapper';
        wrapper.style.setProperty('--fs-gap', `${gap}px`);

        const left = document.createElement('div');
        const right = document.createElement('div');
        left.className = 'fs-column';
        right.className = 'fs-column';
        wrapper.append(left, right);

        container.parentNode?.insertBefore(wrapper, container);
        items.forEach((item) => {
            (left.offsetHeight <= right.offsetHeight ? left : right).appendChild(item);
        });

        const scheduleFit = () => requestAnimationFrame(() => fitWrapperToViewport(wrapper));
        scheduleFit();

        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => scheduleFit());
            resizeObserver.observe(wrapper);
            resizeObserver.observe(left);
            resizeObserver.observe(right);
        }

        container.classList.add('fs-original-hidden');
        return { wrapper, container, items, resizeObserver };
    };

    const destroyMasonry = (instance) => {
        if (!instance) return;
        instance.resizeObserver?.disconnect();
        instance.items.forEach((item) => instance.container.appendChild(item));
        instance.container.classList.remove('fs-original-hidden');
        instance.wrapper.remove();
    };

    ext.features.forumLayout = {
        selectors: SELECTORS,
        createMasonry,
        destroyMasonry,
        fitWrapperToViewport
    };
})();


/* --- Source: content/forum/cache.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const forumCache = (ext.forumCache = ext.forumCache || {});

    forumCache.FORUM_CACHE_PREFIX = 'gesture_extension_forum_cache_v1:';

    forumCache.read = (host) => {
        try {
            const raw = localStorage.getItem(forumCache.FORUM_CACHE_PREFIX + host);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    };

    forumCache.write = (host, config) => {
        try {
            if (!config?.enabled) {
                localStorage.removeItem(forumCache.FORUM_CACHE_PREFIX + host);
                return;
            }

            localStorage.setItem(
                forumCache.FORUM_CACHE_PREFIX + host,
                JSON.stringify({
                    enabled: !!config.enabled,
                    wide: !!config.wide,
                    minWidth: Number(config.minWidth) || 1000,
                    gap: Number(config.gap) || 1,
                    fadeTime: Number(config.fadeTime) || 150,
                    initDelay: Number(config.initDelay) || 100
                })
            );
        } catch {
            // Ignore cache write errors.
        }
    };
})();


/* --- Source: content/forum/early-style.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const forumEarlyStyle = (ext.forumEarlyStyle = ext.forumEarlyStyle || {});
    const { isHttpPage } = ext.shared.runtime;

    forumEarlyStyle.EARLY_STYLE_ID = 'gesture-ext-forum-early-style';

    forumEarlyStyle.inject = (fadeTime) => {
        if (document.getElementById(forumEarlyStyle.EARLY_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = forumEarlyStyle.EARLY_STYLE_ID;
        style.textContent = `html.fs-loading body{opacity:0!important}html.fs-ready body{opacity:1;transition:opacity ${fadeTime}ms ease-out}`;
        (document.head || document.documentElement).appendChild(style);
    };

    forumEarlyStyle.remove = () => {
        document.getElementById(forumEarlyStyle.EARLY_STYLE_ID)?.remove();
    };

    forumEarlyStyle.getCachedConfig = () => {
        if (!isHttpPage()) {
            return null;
        }
        return ext.forumCache.read(location.host);
    };

    const cachedForumConfig = forumEarlyStyle.getCachedConfig();
    if (cachedForumConfig?.enabled) {
        forumEarlyStyle.inject(cachedForumConfig.fadeTime || 150);
        document.documentElement.classList.add('fs-loading');
    }
})();


/* --- Source: content/forum/controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const forum = (ext.forum = ext.forum || {});
    const { debounce } = ext.shared.runtime;
    const { getForumConfig } = ext.shared.config;
    const { createMasonry, destroyMasonry, selectors } = ext.features.forumLayout;

    forum.createController = ({ getConfig }) => {
        const html = document.documentElement;
        const cachedForumConfig = ext.forumEarlyStyle.getCachedConfig();
        let currentConfig = getForumConfig(getConfig(), location.host);
        let activeWrappers = [];
        let styleNode = null;
        let observer = null;
        let initialized = false;
        let revealTimer = null;
        let earlyStyleRemovalTimer = null;
        let startTimer = null;
        let domReadyHandler = null;
        let loadHandler = null;
        let resizeBound = false;
        let observerActive = false;

        const isXenForoDocument = () => {
            const generator = document.querySelector('meta[name="generator" i]')?.getAttribute('content') || '';
            if (/xenforo/i.test(generator)) {
                return true;
            }
            return Boolean(
                document.querySelector(
                    '.p-pageWrapper, .p-body-inner, .structItemContainer, article.message--post, article.message, [data-template]'
                )
            );
        };

        const injectStyles = () => {
            if (styleNode) return;
            styleNode = document.createElement('style');
            styleNode.id = 'gesture-ext-forum-styles';
            styleNode.textContent = ext.features.forumStyles.css;
            (document.head || document.documentElement).appendChild(styleNode);
        };

        const syncCache = () => {
            ext.forumCache.write(location.host, currentConfig);
        };

        const showContent = () => {
            clearTimeout(revealTimer);
            revealTimer = null;

            if (!html.classList.contains('fs-loading')) return;
            html.classList.remove('fs-loading');
            html.classList.add('fs-ready');

            clearTimeout(earlyStyleRemovalTimer);
            earlyStyleRemovalTimer = window.setTimeout(() => {
                earlyStyleRemovalTimer = null;
                ext.forumEarlyStyle.remove();
            }, currentConfig.fadeTime + 50);
        };

        const scheduleRevealFallback = () => {
            if (!html.classList.contains('fs-loading') || revealTimer) return;
            revealTimer = window.setTimeout(
                () => {
                    revealTimer = null;
                    showContent();
                },
                Math.max(350, currentConfig.initDelay + currentConfig.fadeTime + 500)
            );
        };

        const shouldActivate = () => currentConfig.enabled && innerWidth > innerHeight && innerWidth >= currentConfig.minWidth;

        const canMutationAffectForumLayout = (node) => {
            if (!(node instanceof Element)) return false;
            return selectors.some(({ container, items }) => {
                if (node.matches?.(container) || node.matches?.(items)) return true;
                return !!node.querySelector?.(container) || !!node.querySelector?.(items);
            });
        };

        const setObserverActive = (enabled) => {
            if (!observer) return;
            if (enabled && !observerActive && document.body) {
                observer.observe(document.body, { childList: true, subtree: true });
                observerActive = true;
                return;
            }
            if (!enabled && observerActive) {
                observer.disconnect();
                observerActive = false;
            }
        };

        const removeMasonry = () => {
            activeWrappers.forEach(destroyMasonry);
            activeWrappers = [];
            html.classList.remove('fs-active', 'fs-wide');
        };

        const applyMasonry = () => {
            if (!shouldActivate()) return false;

            injectStyles();
            html.classList.add('fs-active');
            html.classList.toggle('fs-wide', !!currentConfig.wide);

            let applied = false;

            selectors.forEach(({ container, items }) => {
                document.querySelectorAll(container).forEach((element) => {
                    if (element.classList.contains('fs-original-hidden')) return;
                    const instance = createMasonry(element, items, currentConfig.gap);
                    if (instance) {
                        activeWrappers.push(instance);
                        applied = true;
                    }
                });
            });

            return applied;
        };

        const refresh = () => {
            removeMasonry();
            syncCache();

            if (!shouldActivate()) {
                setObserverActive(false);
                showContent();
                return false;
            }

            const applied = applyMasonry();
            setObserverActive(true);
            if (applied || document.readyState === 'complete') {
                showContent();
            } else {
                scheduleRevealFallback();
            }

            return applied;
        };

        const debouncedRefresh = debounce(refresh, 180);
        const debouncedApply = debounce(() => {
            if (!shouldActivate()) {
                setObserverActive(false);
                showContent();
                return;
            }

            const applied = applyMasonry();
            setObserverActive(true);
            if (applied) {
                showContent();
            } else {
                scheduleRevealFallback();
            }
        }, 250);

        const ensureObserver = () => {
            if (observer || !document.body) return;
            observer = new MutationObserver((mutations) => {
                if (!shouldActivate()) return;
                const hasRelevantMutation = mutations.some((mutation) => {
                    if (canMutationAffectForumLayout(mutation.target)) return true;
                    return [...mutation.addedNodes, ...mutation.removedNodes].some((node) => canMutationAffectForumLayout(node));
                });
                if (hasRelevantMutation) {
                    debouncedApply();
                }
            });
            setObserverActive(shouldActivate());
        };

        const removeLifecycleListeners = () => {
            if (domReadyHandler) {
                document.removeEventListener('DOMContentLoaded', domReadyHandler);
                domReadyHandler = null;
            }
            if (loadHandler) {
                window.removeEventListener('load', loadHandler);
                loadHandler = null;
            }
            if (resizeBound) {
                window.removeEventListener('resize', debouncedRefresh);
                resizeBound = false;
            }
        };

        const start = () => {
            if (initialized) return;
            initialized = true;

            if (!isXenForoDocument()) {
                ext.forumEarlyStyle.remove();
                return;
            }

            syncCache();
            if (cachedForumConfig?.enabled) {
                injectStyles();
                scheduleRevealFallback();
                loadHandler = showContent;
                window.addEventListener('load', loadHandler, { once: true });
            }

            startTimer = window.setTimeout(() => {
                startTimer = null;
                refresh();
                ensureObserver();
            }, currentConfig.initDelay);

            if (!resizeBound) {
                window.addEventListener('resize', debouncedRefresh, { passive: true });
                resizeBound = true;
            }
        };

        if (document.readyState === 'loading') {
            domReadyHandler = () => {
                domReadyHandler = null;
                start();
            };
            document.addEventListener('DOMContentLoaded', domReadyHandler, { once: true });
        } else {
            start();
        }

        return {
            onConfigChange(nextConfig) {
                currentConfig = getForumConfig(nextConfig, location.host);
                syncCache();
                refresh();
            },
            destroy() {
                clearTimeout(revealTimer);
                clearTimeout(earlyStyleRemovalTimer);
                clearTimeout(startTimer);
                removeLifecycleListeners();
                removeMasonry();
                setObserverActive(false);
                observer?.disconnect();
                observer = null;
            }
        };
    };
})();


/* --- Source: content/forum/index.js --- */
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


/* --- Source: content/gestures/gesture-utils.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const gestures = (ext.gestures = ext.gestures || {});
    const touch = ext.shared.touchCore;

    const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

    const isEditable = (el) => el && (EDITABLE_TAGS.has(el.tagName) || el.isContentEditable);

    const isInteractive = (el) =>
        el instanceof Element &&
        !!el.closest('a[href], button, input, textarea, select, summary, video, audio, [role="button"], [role="link"]');

    const getValidLink = (event) => {
        for (const node of event.composedPath?.() || []) {
            if (node?.tagName === 'A' && node.href && !/^(javascript|mailto|tel|sms|#):/i.test(node.href)) {
                return node;
            }
        }
        return null;
    };

    const dist = (x1, y1, x2, y2) => touch.getDistance({ x: x1, y: y1 }, { x: x2, y: y2 });

    const openTab = async (url, mode, context, suppress) => {
        const response = await context.tabActions.openTab(url, mode);
        if (!response?.ok) {
            window.open(url, '_blank', mode === 'fg' ? '' : 'noopener');
        }
        suppress(800);
    };

    const closeCurrentTab = async (context, suppress) => {
        suppress(800);
        await context.tabActions.closeCurrentTab();
    };

    const addListenerHelper = (listeners, target, event, handler, options) => {
        target.addEventListener(event, handler, options);
        listeners.push(() => target.removeEventListener(event, handler, options));
    };

    gestures.gestureUtils = {
        isEditable,
        isInteractive,
        getValidLink,
        dist,
        openTab,
        closeCurrentTab,
        addListenerHelper
    };
})();


/* --- Source: content/gestures/desktop-pager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const findLink = (keywords, relType) => {
        if (relType) {
            const rel = document.querySelector(`a[rel="${relType}"], link[rel="${relType}"]`);
            if (rel?.href) return rel.href;
        }

        for (const anchor of document.querySelectorAll('a[href]')) {
            const text = (anchor.innerText || anchor.getAttribute('aria-label') || '').toLowerCase();
            if (keywords.some((keyword) => text.includes(keyword))) return anchor.href;
        }

        return null;
    };

    const goPage = (dir, hops = 1, isMax = false) => {
        if (isMax) {
            const href = findLink(dir > 0 ? ['last', 'cuối', '末'] : ['first', 'đầu', '首'], dir > 0 ? 'last' : 'first');
            if (href) location.href = href;
            return;
        }

        const href = findLink(
            dir > 0 ? ['next', 'tiếp', 'sau', '»', '›', '下一'] : ['prev', 'trước', 'lùi', '«', '‹', '上一'],
            dir > 0 ? 'next' : 'prev'
        );
        if (!href) return;
        if (hops <= 1) {
            location.href = href;
            return;
        }

        try {
            const current = new URL(location.href);
            const next = new URL(href, location.href);

            for (const [key, value] of next.searchParams) {
                if (!/^\d+$/.test(value)) continue;
                const currentValue = current.searchParams.get(key);
                if (currentValue === value) continue;

                const currentNumber = currentValue !== null && /^\d+$/.test(currentValue) ? +currentValue : +value - dir;
                const step = +value - currentNumber;
                if (!step) continue;

                next.searchParams.set(key, Math.max(step > 0 ? 1 : 0, currentNumber + step * hops));
                location.href = next.href;
                return;
            }

            const currentParts = current.pathname.split('/');
            const nextParts = next.pathname.split('/');
            const numberAtEnd = (segment) => {
                const match = segment.match(/(\d+)$/);
                return match ? +match[1] : null;
            };

            for (let i = 0; i < Math.max(currentParts.length, nextParts.length); i += 1) {
                const currentPart = currentParts[i] || '';
                const nextPart = nextParts[i] || '';
                if (currentPart === nextPart) continue;

                const nextNumber = numberAtEnd(nextPart);
                if (nextNumber === null) continue;

                const currentNumber = numberAtEnd(currentPart);
                const startValue = currentNumber !== null ? currentNumber : nextNumber - dir;
                const step = nextNumber - startValue;
                if (!step) continue;

                nextParts[i] = nextPart.replace(/\d+$/, Math.max(step > 0 ? 1 : 0, startValue + step * hops));
                next.pathname = nextParts.join('/');
                location.href = next.href;
                return;
            }
        } catch {
            location.href = href;
        }
    };

    const ensurePagerStyles = () => {
        if (document.getElementById('gesture-ext-pager-style')) return;
        const style = document.createElement('style');
        style.id = 'gesture-ext-pager-style';
        style.textContent =
            '#gesture-ext-pager{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1ae6;color:#fff;padding:8px 16px;border-radius:20px;font:13px/1.4 system-ui;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .2s}#gesture-ext-pager.show{opacity:1}';
        (document.head || document.documentElement).appendChild(style);
    };

    ext.gestures.desktopPager = {
        findLink,
        goPage,
        ensurePagerStyles
    };
})();


/* --- Source: content/gestures/desktop-long-press.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const createLongPressManager = (state) => {
        return {
            cancelLongPress: () => {
                clearTimeout(state.lp.timer);
                state.lp.timer = null;
                state.lp.active = false;
            }
        };
    };

    ext.gestures.desktopLongPress = {
        createLongPressManager
    };
})();


/* --- Source: content/gestures/desktop.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const gestures = (ext.gestures = ext.gestures || {});
    const touch = ext.shared.touchCore;
    const { isEditable, isInteractive, getValidLink, dist, openTab, closeCurrentTab, addListenerHelper } = gestures.gestureUtils;
    const pager = gestures.desktopPager;
    const longPress = gestures.desktopLongPress;

    gestures.createDesktopController = (context) => {
        const TOLERANCE = { move: 20 };
        const state = {
            suppressUntil: 0,
            lpFired: false,
            rcHandled: false,
            closeClick: { last: null },
            lp: { timer: null, active: false, x: 0, y: 0 },
            pager: { acc: 0, timer: null, dir: 0, hops: 0 },
            pointer: { active: false, x: 0, y: 0 },
            pointerIndicator: null,
            pagerIndicator: null
        };
        const listeners = [];

        const addListener = (target, event, handler, options) => {
            addListenerHelper(listeners, target, event, handler, options);
        };

        const getConfig = () => {
            const cfg = context.getConfig().gestures.desktop;
            if (ext.shared.config.isGestureHostExcluded?.(context.getConfig(), location.hostname)) {
                return { ...cfg, enabled: false };
            }
            return cfg;
        };
        const getForumConfig = () => ext.shared.config.getForumConfig(context.getConfig(), location.host);
        const suppress = (ms = 500) => {
            state.suppressUntil = Date.now() + ms;
        };
        const shouldRunPagerForForum = () => {
            const forumConfig = getForumConfig();
            return forumConfig.enabled;
        };
        const updatePointerPosition = (event) => {
            state.pointer.active = true;
            state.pointer.x = event.clientX || 0;
            state.pointer.y = event.clientY || 0;
        };
        const isVideoAtPointer = () => {
            if (!state.pointer.active) return false;
            const helpers = globalThis.GestureExtension?.videoFloating?.helpers;
            return !!helpers?.getSeekableVideoAtPoint?.(state.pointer.x, state.pointer.y, { includeFloating: true });
        };

        const showPagerIcon = (dir, hops, maxHops) => {
            if (!state.pagerIndicator) {
                state.pagerIndicator = document.createElement('div');
                state.pagerIndicator.id = 'gesture-ext-pager';
                (document.body || document.documentElement).appendChild(state.pagerIndicator);
            }

            const isMax = hops > maxHops;
            const icon = isMax ? (dir > 0 ? '⏭' : '⏮') : dir > 0 ? '▶' : '◀';
            const label = isMax ? (dir > 0 ? 'Cuối' : 'Đầu') : `${hops} trang`;
            state.pagerIndicator.textContent = `${icon} ${label}`;
            state.pagerIndicator.classList.add('show');
        };

        const hidePagerIcon = () => {
            state.pagerIndicator?.classList.remove('show');
        };

        const guard = (event) => {
            if (Date.now() < state.suppressUntil) {
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            return false;
        };

        const { cancelLongPress } = longPress.createLongPressManager(state);

        pager.ensurePagerStyles();

        ['click', 'auxclick'].forEach((eventName) => {
            addListener(
                window,
                eventName,
                (event) => {
                    guard(event);
                },
                true
            );
        });

        addListener(
            window,
            'contextmenu',
            (event) => {
                if (guard(event)) return;
                if (state.lpFired || state.lp.active) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            },
            true
        );

        addListener(
            window,
            'keydown',
            (event) => {
                const cfg = getConfig();
                if (!cfg.enabled || !cfg.pager.enabled) return;
                if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                if (!shouldRunPagerForForum()) return;
                if (touch.isExtensionUiTarget(event) || isEditable(event.target)) return;
                if (event.target instanceof Element && event.target.closest('#fvp-container')) return;
                if (isVideoAtPointer()) return;

                const dir = event.key === 'ArrowRight' ? 1 : -1;
                const maxHops = Math.max(1, Number(cfg.pager.hops) || 3);

                event.preventDefault();
                event.stopPropagation();
                clearTimeout(state.pager.timer);
                state.pager.hops = dir !== state.pager.dir ? 1 : state.pager.hops + 1;
                state.pager.dir = dir;
                showPagerIcon(dir, state.pager.hops, maxHops);

                const currentDir = dir;
                const currentHops = state.pager.hops;
                state.pager.timer = window.setTimeout(() => {
                    hidePagerIcon();
                    if (state.pager.dir === currentDir && state.pager.hops === currentHops) {
                        state.pager.dir = 0;
                        state.pager.hops = 0;
                    }
                }, 180);

                pager.goPage(dir, Math.min(currentHops, maxHops), currentHops > maxHops);
            },
            true
        );

        addListener(
            window,
            'pointerdown',
            (event) => {
                updatePointerPosition(event);
                state.lpFired = false;
                const cfg = getConfig();
                if (event.pointerType && event.pointerType !== 'mouse') return;
                if (event.button !== 0) return;
                if (!cfg.enabled || !cfg.lpress.enabled || isEditable(event.target)) return;

                const link = getValidLink(event);
                if (!link) return;

                state.lp = { timer: null, active: true, x: event.clientX, y: event.clientY };
                state.lp.timer = setTimeout(() => {
                    if (!state.lp.active) return;
                    state.lp.active = false;
                    state.lpFired = true;
                    openTab(link.href, getConfig().lpress.mode, context, suppress);
                }, getConfig().lpress.ms);
            },
            true
        );

        addListener(
            window,
            'pointermove',
            (event) => {
                updatePointerPosition(event);
                if (state.lp.active && dist(event.clientX, event.clientY, state.lp.x, state.lp.y) > TOLERANCE.move) {
                    cancelLongPress();
                }
            },
            true
        );

        ['pointerup', 'pointercancel'].forEach((eventName) => {
            addListener(window, eventName, cancelLongPress, true);
        });

        addListener(
            window,
            'click',
            (event) => {
                if (!state.lpFired) return;
                event.preventDefault();
                event.stopPropagation();
                state.lpFired = false;
            },
            true
        );

        addListener(
            window,
            'click',
            (event) => {
                const cfg = getConfig();
                if (!cfg.enabled || !cfg.closeTab?.enabled) return;
                if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                if (touch.isExtensionUiTarget(event) || isEditable(event.target) || isInteractive(event.target)) return;

                const now = Date.now();
                const lastClick = state.closeClick.last;
                const maxMs = Number(cfg.closeTab.ms) || 150;
                if (lastClick && now - lastClick.time <= maxMs && dist(event.clientX, event.clientY, lastClick.x, lastClick.y) <= 32) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.closeClick.last = null;
                    closeCurrentTab(context, suppress);
                    return;
                }

                state.closeClick.last = { x: event.clientX, y: event.clientY, time: now };
            },
            true
        );

        const pageLoadTime = Date.now();
        addListener(
            window,
            'mousedown',
            (event) => {
                state.rcHandled = false;
                if (event.button !== 2 || isEditable(event.target)) return;
                if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

                const cfg = getConfig();
                const now = Date.now();
                if (now - pageLoadTime < 1000) return;

                const link = getValidLink(event);
                if (link && cfg.enabled && cfg.rclick.enabled) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.rcHandled = true;
                    openTab(link.href, cfg.rclick.mode, context, suppress);
                    return;
                }
            },
            true
        );

        addListener(
            window,
            'contextmenu',
            (event) => {
                if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

                if (state.rcHandled || guard(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                const cfg = getConfig();
                if (!cfg.enabled || !cfg.rclick.enabled) return;

                const link = getValidLink(event);
                if (!link) return;

                event.preventDefault();
                event.stopPropagation();
                state.rcHandled = true;
                openTab(link.href, cfg.rclick.mode, context, suppress);
            },
            true
        );

        return {
            destroy() {
                cancelLongPress();
                clearTimeout(state.pager.timer);
                hidePagerIcon();
                state.pagerIndicator?.remove();
                listeners.splice(0).forEach((remove) => remove());
            }
        };
    };
})();


/* --- Source: content/gestures/mobile-scroll.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const clampScrollTop = (value, element) => Math.max(0, Math.min(value, element.scrollHeight - element.clientHeight));

    const getEdgeStrength = (x, widthConfig, sideConfig) => {
        const width = Math.max(widthConfig, 1);

        if (sideConfig === 'left') {
            return Math.max(0, 1 - x / width);
        }
        if (sideConfig === 'right') {
            return Math.max(0, 1 - (innerWidth - x) / width);
        }

        if (x <= width) {
            return Math.max(0, 1 - x / width);
        }
        if (x >= innerWidth - width) {
            return Math.max(0, 1 - (innerWidth - x) / width);
        }
        return 0;
    };

    const createScrollManager = (state) => {
        const requestEdgeRender = () => {
            if (state.edge.renderRAF) return;

            const step = (time) => {
                const element = document.scrollingElement || document.documentElement;
                const target = clampScrollTop(state.edge.targetScrollTop, element);
                const current = element.scrollTop;
                const delta = target - current;

                if (Math.abs(delta) < 0.5) {
                    if (current !== target) {
                        element.scrollTop = target;
                    }
                    state.edge.renderRAF = null;
                    state.edge.renderTime = 0;
                    return;
                }

                const deltaTime = state.edge.renderTime ? Math.min(Math.max(time - state.edge.renderTime, 8), 32) : 16;
                state.edge.renderTime = time;
                const follow = state.edge.active ? 0.95 : 0.35;
                const maxStep = Math.max(12, deltaTime * 2.8);
                const next =
                    current + Math.sign(delta) * Math.min(Math.abs(delta) * follow, Math.abs(delta), maxStep + Math.abs(delta) * 0.25);
                element.scrollTop = next;
                state.edge.renderRAF = requestAnimationFrame(step);
            };

            state.edge.renderRAF = requestAnimationFrame(step);
        };

        const stopEdgeRender = () => {
            cancelAnimationFrame(state.edge.renderRAF);
            state.edge.renderRAF = null;
            state.edge.renderTime = 0;
        };

        const stopMomentum = () => {
            cancelAnimationFrame(state.momentumRAF);
            state.momentumRAF = null;
            state.momentumTime = 0;
        };

        const startMomentum = (velocity) => {
            stopMomentum();
            stopEdgeRender();
            const element = document.scrollingElement || document.documentElement;
            const decayPerFrame = 0.94;
            const minVelocity = 8;

            const step = (time) => {
                const deltaTime = state.momentumTime ? Math.min(Math.max(time - state.momentumTime, 8), 34) : 16;
                state.momentumTime = time;
                const decay = Math.pow(decayPerFrame, deltaTime / 16);
                velocity *= decay;
                if (Math.abs(velocity) < minVelocity) {
                    state.momentumRAF = null;
                    state.momentumTime = 0;
                    return;
                }
                const previous = element.scrollTop;
                element.scrollTop = clampScrollTop(previous + (velocity * deltaTime) / 1000, element);
                if (element.scrollTop === previous) {
                    state.momentumRAF = null;
                    state.momentumTime = 0;
                    return;
                }
                state.momentumRAF = requestAnimationFrame(step);
            };

            state.momentumRAF = requestAnimationFrame(step);
        };

        return {
            requestEdgeRender,
            stopEdgeRender,
            startMomentum,
            stopMomentum
        };
    };

    ext.gestures.mobileScroll = {
        clampScrollTop,
        getEdgeStrength,
        createScrollManager
    };
})();


/* --- Source: content/gestures/mobile-long-press.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const createLongPressManager = (state) => {
        return {
            cancelLongPress: () => {
                clearTimeout(state.lp.timer);
                state.lp.timer = null;
                state.lp.active = false;
            }
        };
    };

    ext.gestures.mobileLongPress = {
        createLongPressManager
    };
})();


/* --- Source: content/gestures/mobile-tap.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const createTapManager = (state) => {
        return {
            clearTapStart: () => {
                state.tap.start = null;
            }
        };
    };

    ext.gestures.mobileTap = {
        createTapManager
    };
})();


/* --- Source: content/gestures/mobile.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const gestures = (ext.gestures = ext.gestures || {});
    const touch = ext.shared.touchCore;
    const { isEditable, isInteractive, getValidLink, dist, openTab, closeCurrentTab, addListenerHelper } = gestures.gestureUtils;
    const scroll = gestures.mobileScroll;
    const tapManager = gestures.mobileTap;
    const longPressManager = gestures.mobileLongPress;

    gestures.createMobileController = (context) => {
        const TOLERANCE = { move: 20 };
        const listeners = [];
        const state = {
            suppressUntil: 0,
            lpFired: false,
            lp: { timer: null, active: false, x: 0, y: 0 },
            tap: { start: null, last: null },
            edge: {
                active: false,
                lastY: 0,
                lastTime: 0,
                velocity: 0,
                targetScrollTop: 0,
                renderRAF: null,
                renderTime: 0
            },
            momentumRAF: null,
            momentumTime: 0
        };

        const addListener = (target, event, handler, options) => {
            addListenerHelper(listeners, target, event, handler, options);
        };

        const getConfig = () => {
            const cfg = context.getConfig().gestures.mobile;
            if (ext.shared.config.isGestureHostExcluded?.(context.getConfig(), location.hostname)) {
                return { ...cfg, enabled: false };
            }
            return cfg;
        };
        const suppress = (ms = 500) => {
            state.suppressUntil = Date.now() + ms;
        };
        const preventDefaultIfCancelable = (event) => {
            if (event.cancelable) {
                event.preventDefault();
            }
        };

        const guard = (event) => {
            if (Date.now() < state.suppressUntil) {
                preventDefaultIfCancelable(event);
                event.stopPropagation();
                return true;
            }
            return false;
        };

        const { stopMomentum, stopEdgeRender, requestEdgeRender, startMomentum } = scroll.createScrollManager(state);
        const { clearTapStart } = tapManager.createTapManager(state);
        const { cancelLongPress } = longPressManager.createLongPressManager(state);

        ['click', 'auxclick'].forEach((eventName) => {
            addListener(window, eventName, guard, true);
        });

        addListener(
            window,
            'contextmenu',
            (event) => {
                if (state.lpFired || state.lp.active || Date.now() < state.suppressUntil) {
                    preventDefaultIfCancelable(event);
                    event.stopPropagation();
                }
            },
            true
        );

        addListener(
            window,
            'touchstart',
            (event) => {
                const cfg = getConfig();
                state.lpFired = false;
                stopMomentum();
                if (touch.isExtensionUiTarget(event)) {
                    cancelLongPress();
                    state.edge.active = false;
                    return;
                }
                if (!cfg.enabled || isEditable(event.target)) return;

                if (!event.touches || event.touches.length !== 1) {
                    cancelLongPress();
                    clearTapStart();
                    return;
                }

                const touchPoint = event.touches[0];
                state.tap.start = {
                    x: touchPoint.clientX,
                    y: touchPoint.clientY,
                    time: Date.now(),
                    target: event.target,
                    cancelled: false
                };
                const edgeStrength = cfg.edge.enabled ? scroll.getEdgeStrength(touchPoint.clientX, cfg.edge.width, cfg.edge.side) : 0;
                if (edgeStrength > 0) {
                    const element = document.scrollingElement || document.documentElement;
                    state.edge.active = true;
                    state.edge.lastY = touchPoint.clientY;
                    state.edge.lastTime = Date.now();
                    state.edge.velocity = 0;
                    state.edge.targetScrollTop = element.scrollTop;
                }

                if (!cfg.lpress.enabled) return;
                const link = getValidLink(event);
                if (!link) return;

                state.lp = { timer: null, active: true, x: touchPoint.clientX, y: touchPoint.clientY };
                state.lp.timer = setTimeout(() => {
                    if (!state.lp.active) return;
                    state.lp.active = false;
                    state.lpFired = true;
                    openTab(link.href, getConfig().lpress.mode, context, suppress);
                }, cfg.lpress.ms);
            },
            { capture: true, passive: false }
        );

        addListener(
            window,
            'touchmove',
            (event) => {
                if (touch.isExtensionUiTarget(event)) {
                    cancelLongPress();
                    state.edge.active = false;
                    clearTapStart();
                    return;
                }
                if (!event.touches) {
                    clearTapStart();
                    return;
                }

                if (state.lp.active && event.touches.length === 1) {
                    const touchPoint = event.touches[0];
                    if (dist(touchPoint.clientX, touchPoint.clientY, state.lp.x, state.lp.y) > TOLERANCE.move) {
                        cancelLongPress();
                    }
                }

                if (!state.edge.active || event.touches.length !== 1) {
                    clearTapStart();
                    return;
                }

                const touchPoint = event.touches[0];
                const deltaY = state.edge.lastY - touchPoint.clientY;
                const now = Date.now();
                const deltaTime = Math.max(1, now - state.edge.lastTime);

                const cfg = getConfig();
                const strength = scroll.getEdgeStrength(touchPoint.clientX, cfg.edge.width, cfg.edge.side);
                if (strength <= 0) {
                    state.edge.active = false;
                    clearTapStart();
                    return;
                }

                const speedMultiplier = Math.max(1, Number(cfg.edge.speed) || 3);
                const scrollDelta = deltaY * strength * speedMultiplier;
                state.edge.targetScrollTop += scrollDelta;
                requestEdgeRender();

                state.edge.velocity = (scrollDelta * 1000) / deltaTime;
                state.edge.lastY = touchPoint.clientY;
                state.edge.lastTime = now;

                if (state.tap.start && dist(touchPoint.clientX, touchPoint.clientY, state.tap.start.x, state.tap.start.y) > 12) {
                    state.tap.start.cancelled = true;
                }

                preventDefaultIfCancelable(event);
            },
            { capture: true, passive: false }
        );

        addListener(
            window,
            'touchend',
            (event) => {
                cancelLongPress();
                if (state.edge.active) {
                    state.edge.active = false;
                    if (Math.abs(state.edge.velocity) > 120) {
                        startMomentum(state.edge.velocity);
                    }
                }

                const start = state.tap.start;
                clearTapStart();
                if (!start || start.cancelled || Date.now() - start.time > 250) {
                    return;
                }

                const cfg = getConfig();
                if (!cfg.enabled || !cfg.closeTab?.enabled) return;

                const target = start.target;
                if (isEditable(target) || isInteractive(target)) {
                    return;
                }

                const now = Date.now();
                const lastTap = state.tap.last;
                const maxMs = Number(cfg.closeTab.ms) || 150;
                if (lastTap && now - lastTap.time <= maxMs && dist(start.x, start.y, lastTap.x, lastTap.y) <= 40) {
                    preventDefaultIfCancelable(event);
                    event.stopPropagation();
                    state.tap.last = null;
                    closeCurrentTab(context, suppress);
                    return;
                }

                state.tap.last = { x: start.x, y: start.y, time: now };
            },
            { capture: true, passive: false }
        );

        addListener(
            window,
            'touchcancel',
            () => {
                cancelLongPress();
                state.edge.active = false;
                clearTapStart();
            },
            { capture: true, passive: false }
        );

        return {
            destroy() {
                cancelLongPress();
                stopMomentum();
                stopEdgeRender();
                clearTapStart();
                listeners.splice(0).forEach((remove) => remove());
            }
        };
    };
})();


/* --- Source: content/gestures/index.js --- */
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


/* --- Source: content/clipboard/constants.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = (ext.clipboard = ext.clipboard || {});

    clipboard.UI = Object.freeze({
        triggerSize: 36,
        panelOffset: 8
    });
})();


/* --- Source: content/clipboard/panel-data.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = (ext.clipboard = ext.clipboard || {});
    const { escapeHtml, encodeAttribute } = ext.shared.domUtils;

    const getPanelData = (config, copiedTextCache) => {
        const clipboardConfig = config?.clipboard || { history: [], pinned: [] };
        const pinned = Array.isArray(clipboardConfig.pinned) ? clipboardConfig.pinned.slice(0, 5) : [];
        const history = Array.isArray(clipboardConfig.history) ? clipboardConfig.history : [];
        const recent = history.filter((item) => !pinned.includes(item)).slice(0, 5);
        if (copiedTextCache && !pinned.includes(copiedTextCache) && !recent.includes(copiedTextCache)) {
            recent.unshift(copiedTextCache);
        }
        return { pinned, recent };
    };

    const createGroupMarkup = (title, items, emptyText) => {
        const rows = items.length
            ? items
                  .map((item) => {
                      const escaped = escapeHtml(item);
                      const encoded = encodeAttribute(item);
                      const pinLabel = title === 'Đã ghim' ? 'Bỏ ghim' : 'Ghim';
                      return `
                    <div class="gesture-clipboard-item">
                        <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-item-pin" data-pin="${encoded}" aria-label="${pinLabel}" title="${pinLabel}">📌</button>
                        <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-item-paste" data-paste="${encoded}" aria-label="Paste" title="Dán nội dung">⚡</button>
                        <div class="gesture-clipboard-item-text" title="Bôi đen để copy">${escaped}</div>
                        <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-icon-button-danger gesture-clipboard-item-remove" data-remove="${encoded}" aria-label="Xóa" title="Xóa">🗑</button>
                    </div>
                `;
                  })
                  .join('')
            : `<div class="gesture-clipboard-empty">${emptyText}</div>`;

        return `
            <section class="gesture-clipboard-group">
                <h4 class="gesture-clipboard-group-title">${title}</h4>
                ${rows}
            </section>
        `;
    };

    clipboard.panelData = {
        getPanelMarkup(config, copiedTextCache) {
            const panelData = getPanelData(config, copiedTextCache);
            return `
                ${createGroupMarkup('Đã ghim', panelData.pinned, 'Chưa có mục nào được ghim')}
                ${createGroupMarkup('Gần đây', panelData.recent, 'Chưa có nội dung nào được lưu')}
            `;
        },
        hasClipboardData(config) {
            const clipboardConfig = config?.clipboard || {};
            return (
                (Array.isArray(clipboardConfig.pinned) && clipboardConfig.pinned.length > 0) ||
                (Array.isArray(clipboardConfig.history) && clipboardConfig.history.length > 0)
            );
        }
    };
})();


/* --- Source: content/clipboard/actions.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = (ext.clipboard = ext.clipboard || {});

    clipboard.createActions = ({
        storage,
        syncConfig,
        isExtensionContextInvalidated,
        updateUI,
        setConfig,
        getConfig,
        setCopiedTextCache
    }) => ({
        async saveCopiedText(text) {
            const trimmed = typeof text === 'string' ? text.trim() : '';
            if (!trimmed) {
                return;
            }
            setCopiedTextCache(trimmed);
            try {
                const nextConfig = await storage.saveClipboardHistory(trimmed);
                setConfig(nextConfig || getConfig());
                if (!getConfig()?.clipboard?.history?.length || getConfig().clipboard.history[0] !== trimmed) {
                    setConfig(await syncConfig());
                }
                updateUI();
            } catch (error) {
                if (isExtensionContextInvalidated(error)) {
                    return;
                }
                console.error('[GestureExtension] save clipboard failed', error);
            }
        },
        async togglePin(text) {
            try {
                const nextConfig = await storage.togglePinItem(text);
                setConfig(nextConfig || getConfig());
                updateUI();
            } catch (error) {
                console.error('[GestureExtension] toggle pin failed', error);
            }
        },
        async removeItem(text) {
            try {
                const nextConfig = await storage.removeClipboardItem(text);
                setConfig(nextConfig || getConfig());
                updateUI();
            } catch (error) {
                console.error('[GestureExtension] remove clipboard item failed', error);
            }
        }
    });
})();


/* --- Source: content/clipboard/ui.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = (ext.clipboard = ext.clipboard || {});
    const floating = ext.shared.floatingCore;
    const { UI } = clipboard;

    clipboard.createUi = ({ onTogglePanel, onPanelPaste, onPanelPin, onPanelRemove, onSuppressFocus, onPanelOpenChange }) => {
        const posStorage = floating.createPositionStorage('gesture_clipboard_icon_pos', { left: 20, top: 200 });
        let triggerRef = null;
        let panelRef = null;
        let removeDragBinding = () => {};
        let removeOutsideClick = () => {};

        const renderPanel = (markup) => {
            if (panelRef) {
                panelRef.element.innerHTML = markup;
            }
        };

        const updatePanelPosition = () => {
            if (!triggerRef || !panelRef) {
                return;
            }
            const rect = triggerRef.element.getBoundingClientRect();
            const pPos = floating.clampFixedPosition({
                left: rect.right + UI.panelOffset,
                top: rect.top,
                width: panelRef.element.offsetWidth || 320,
                height: panelRef.element.offsetHeight || 300
            });
            panelRef.setPosition(pPos.left, pPos.top);
        };

        const bind = () => {
            triggerRef = floating.createTriggerElement({
                className: 'gesture-clipboard-trigger',
                textContent: '📋',
                hidden: true
            });
            panelRef = floating.createPanelRoot({
                className: 'gesture-clipboard-panel',
                hidden: true
            });

            panelRef.element.addEventListener('pointerdown', (event) => {
                event.stopPropagation();
                onSuppressFocus();
            });

            panelRef.element.addEventListener('click', (event) => {
                floating.stopFloatingEvent(event);
                const insertButton = event.target.closest('[data-paste]');
                const pinButton = event.target.closest('[data-pin]');
                const removeButton = event.target.closest('[data-remove]');

                if (insertButton) {
                    onSuppressFocus();
                    onPanelPaste(insertButton.getAttribute('data-paste') || '');
                    return;
                }
                if (pinButton) {
                    onSuppressFocus();
                    onPanelPin(pinButton.getAttribute('data-pin') || '');
                    return;
                }
                if (removeButton) {
                    onSuppressFocus();
                    onPanelRemove(removeButton.getAttribute('data-remove') || '');
                }
            });

            removeDragBinding = floating.bindDragBehavior({
                target: triggerRef.element,
                threshold: 6,
                getInitialPosition: () => ({
                    left: triggerRef.element.offsetLeft,
                    top: triggerRef.element.offsetTop
                }),
                onMove: ({ deltaX, deltaY, origin }) => {
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: UI.triggerSize,
                        height: UI.triggerSize,
                        margin: 8
                    });
                    triggerRef.setPosition(next.left, next.top);
                    triggerRef.element.classList.add('is-dragging');
                    updatePanelPosition();
                },
                onDragEnd: () => {
                    triggerRef.element.classList.remove('is-dragging');
                    posStorage.save(triggerRef.element.offsetLeft, triggerRef.element.offsetTop);
                },
                onClick: () => {
                    onTogglePanel();
                }
            });

            removeOutsideClick = floating.bindOutsideClickGuard({
                isOpen: onPanelOpenChange.isOpen,
                containsTarget: (target) =>
                    target instanceof Node && (panelRef.element.contains(target) || triggerRef.element.contains(target)),
                onOutside: () => {
                    onPanelOpenChange.close();
                },
                eventName: 'pointerdown',
                capture: true
            });

            triggerRef.element.addEventListener(
                'mousedown',
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                },
                true
            );
            triggerRef.element.addEventListener(
                'pointerdown',
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                },
                false
            );
            panelRef.element.addEventListener('mousedown', (event) => event.stopPropagation(), true);
            triggerRef.element.addEventListener('click', (event) => event.stopPropagation(), true);

            posStorage.load().then(({ left, top }) => {
                const pos = floating.clampFixedPosition({ left, top, width: UI.triggerSize, height: UI.triggerSize, margin: 8 });
                triggerRef.setPosition(pos.left, pos.top);
            });
        };

        return {
            bind,
            renderPanel,
            updatePanelPosition,
            setTriggerVisible(visible) {
                if (!triggerRef) {
                    return;
                }
                if (visible) {
                    triggerRef.show();
                } else {
                    triggerRef.hide();
                }
            },
            setPanelVisible(visible) {
                if (!panelRef) {
                    return;
                }
                if (visible) {
                    panelRef.show('flex');
                    updatePanelPosition();
                } else {
                    panelRef.hide();
                }
            },
            containsNode(node) {
                return (
                    node instanceof Node &&
                    !!((panelRef?.element && panelRef.element.contains(node)) || (triggerRef?.element && triggerRef.element.contains(node)))
                );
            },
            focusTriggerAndPanel() {
                return { triggerRef, panelRef };
            },
            destroy() {
                removeDragBinding();
                removeOutsideClick();
                triggerRef?.destroy();
                panelRef?.destroy();
            }
        };
    };
})();


/* --- Source: content/clipboard/controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = (ext.clipboard = ext.clipboard || {});
    const { getEditableTarget, isEditableTarget, getActiveSelectionText, getSelectionTextFromTarget, insertTextAtCaret } =
        ext.shared.selectionCore;
    const { decodeAttribute } = ext.shared.domUtils;

    clipboard.createController = ({ getConfig, storage }) => {
        let config = getConfig();
        let activeTarget = null;
        let panelOpen = false;
        let copiedTextCache = '';
        let suppressNextFocusReset = false;

        const isExtensionContextInvalidated = (error) => {
            const message = String(error?.message || error || '').toLowerCase();
            return message.includes('extension context invalidated');
        };

        const syncConfig = async () => {
            config = await storage.getConfig();
            return config;
        };

        const setConfig = (nextConfig) => {
            config = nextConfig;
        };

        const setCopiedTextCache = (text) => {
            copiedTextCache = typeof text === 'string' ? text.trim() : '';
        };

        const ui = clipboard.createUi({
            onTogglePanel: () => {
                setPanelOpen(!panelOpen).catch((error) => {
                    console.error('[GestureExtension] toggle panel failed', error);
                });
            },
            onPanelPaste: (encodedText) => {
                const text = decodeAttribute(encodedText);
                focusActiveTarget();
                insertTextAtCaret(activeTarget, text);
                updateUI();
            },
            onPanelPin: (encodedText) => {
                actions.togglePin(decodeAttribute(encodedText));
            },
            onPanelRemove: (encodedText) => {
                actions.removeItem(decodeAttribute(encodedText));
            },
            onSuppressFocus: () => {
                suppressNextFocusReset = true;
            },
            onPanelOpenChange: {
                isOpen: () => panelOpen,
                close: () => {
                    panelOpen = false;
                    updateUI();
                }
            }
        });

        const actions = clipboard.createActions({
            storage,
            syncConfig,
            isExtensionContextInvalidated,
            updateUI: () => updateUI(),
            setConfig,
            getConfig: () => config,
            setCopiedTextCache
        });

        const isClipboardUiNode = (node) => ui.containsNode(node);

        const isClipboardUiSelection = () => {
            const selection = document.getSelection();
            if (!selection) {
                return false;
            }
            return isClipboardUiNode(selection.anchorNode) || isClipboardUiNode(selection.focusNode);
        };

        const focusActiveTarget = () => {
            if (!activeTarget?.isConnected || !isEditableTarget(activeTarget)) {
                return;
            }
            try {
                activeTarget.focus({ preventScroll: true });
            } catch {
                activeTarget.focus();
            }
        };

        const renderPanel = () => {
            ui.renderPanel(clipboard.panelData.getPanelMarkup(config, copiedTextCache));
        };

        const updateTriggerVisibility = () => {
            const isVisible = !!activeTarget && (clipboard.panelData.hasClipboardData(config) || !!copiedTextCache);
            ui.setTriggerVisible(isVisible);
        };

        const updateUI = () => {
            updateTriggerVisibility();
            if (!panelOpen) {
                ui.setPanelVisible(false);
                return;
            }
            renderPanel();
            ui.setPanelVisible(true);
        };

        const setPanelOpen = async (nextOpen) => {
            panelOpen = !!nextOpen;
            updateUI();
            if (panelOpen) {
                await syncConfig();
                updateUI();
            }
        };

        const onPointerDown = (event) => {
            const targetNode = event.target instanceof Node ? event.target : null;
            if (targetNode && ui.containsNode(targetNode)) {
                suppressNextFocusReset = true;
                return;
            }
            const target = getEditableTarget(event.target);
            if (target) {
                activeTarget = target;
                panelOpen = false;
                updateUI();
                return;
            }
            activeTarget = null;
            panelOpen = false;
            updateUI();
        };

        const onFocusIn = (event) => {
            const target = getEditableTarget(event.target);
            if (!target) {
                return;
            }
            if (suppressNextFocusReset) {
                suppressNextFocusReset = false;
                return;
            }
            activeTarget = target;
            updateUI();
        };

        const onCopy = async (event) => {
            if (isClipboardUiNode(event.target) || isClipboardUiSelection()) {
                return;
            }
            const clipboardText = event.clipboardData?.getData('text/plain') || '';
            const eventTarget = event.target instanceof Element ? getEditableTarget(event.target) || event.target : null;
            const selectionSources = [clipboardText, getSelectionTextFromTarget(eventTarget), getActiveSelectionText(), copiedTextCache];
            const text = selectionSources.find((value) => typeof value === 'string' && value.trim()) || '';
            await actions.saveCopiedText(text);
        };

        const onKeyUp = () => {
            if (isClipboardUiSelection()) {
                return;
            }
            const selectionText = getActiveSelectionText();
            if (selectionText) {
                setCopiedTextCache(selectionText);
            }
        };

        const onSelectionChange = () => {
            if (isClipboardUiSelection()) {
                return;
            }
            const selectionText = getActiveSelectionText();
            if (selectionText) {
                setCopiedTextCache(selectionText);
            }
            if (panelOpen) {
                updateUI();
            }
        };

        ui.bind();
        updateUI();

        document.addEventListener('focusin', onFocusIn, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('copy', onCopy, true);
        document.addEventListener('cut', onCopy, true);
        document.addEventListener('keyup', onKeyUp, true);
        document.addEventListener('selectionchange', onSelectionChange, true);
        return {
            onConfigChange(nextConfig) {
                config = nextConfig;
                if (!config?.clipboard?.enabled) {
                    panelOpen = false;
                }
                if (panelOpen) {
                    updateUI();
                } else {
                    updateTriggerVisibility();
                }
            },
            destroy() {
                document.removeEventListener('focusin', onFocusIn, true);
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('copy', onCopy, true);
                document.removeEventListener('cut', onCopy, true);
                document.removeEventListener('keyup', onKeyUp, true);
                document.removeEventListener('selectionchange', onSelectionChange, true);
                ui.destroy();
            }
        };
    };
})();


/* --- Source: content/clipboard/index.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    ext.features.clipboard = {
        shouldRun: ({ getConfig, runtime }) => runtime.isHttpPage() && runtime.isHtmlDocument() && !!getConfig()?.clipboard?.enabled,
        init: ({ getConfig, storage }) => ext.clipboard.createController({ getConfig, storage })
    };
})();


/* --- Source: content/google-search/index.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const floating = ext.shared.floatingCore;

    const UI = {
        triggerSize: 36,
        panelOffset: 8,
        defaultPosition: { top: 130, left: 160 }
    };

    const FILTERS = [
        { name: 'Hour', unit: 'h', values: [1, 2, 3, 4, 6, 12] },
        { name: 'Day', unit: 'd', values: [1, 2, 3, 4, 5, 6, 7] },
        { name: 'Week', unit: 'w', values: [1, 2, 3, 4] },
        { name: 'Month', unit: 'm', values: [1, 2, 3, 6, 9, 12] },
        { name: 'Year', unit: 'y', values: [1, 2, 3, 4, 5] },
        { name: 'File', unit: 'file', values: ['PDF', 'DOC', 'XLS', 'PPT', 'TXT'] },
        { name: 'Tools', unit: 'tool', values: ['OCR'] }
    ];

    const posStorage = floating.createPositionStorage('gesture_google_search_position_v1', UI.defaultPosition);

    const createFilterPanel = ({ onApplyTime, onApplyFile }) => {
        const panel = document.createElement('div');
        panel.className = 'grid';

        FILTERS.forEach((filter) => {
            const header = document.createElement('div');
            header.className = 'header';
            header.textContent = filter.name;
            panel.appendChild(header);

            filter.values.forEach((value) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'cell';
                if (filter.unit === 'tool' && value === 'OCR') {
                    button.textContent = 'OCR';
                } else {
                    button.textContent = filter.unit === 'file' ? value : `${value}${filter.unit.toUpperCase()}`;
                }
                button.addEventListener('click', (event) => {
                    floating.stopFloatingEvent(event);
                    if (filter.unit === 'file') onApplyFile(value);
                    else if (filter.unit === 'tool' && value === 'OCR') {
                        ext.shared.toastCore.createToast('Di chuột vào ảnh để dùng OCR', event.clientX, event.clientY, 2000);
                    } else onApplyTime(filter.unit, value);
                });
                panel.appendChild(button);
            });
        });

        return panel;
    };

    const isGoogleSearchPage = () => {
        const host = window.location.hostname.toLowerCase();
        return (host === 'www.google.com' || host === 'google.com') && /^https?:$/i.test(window.location.protocol);
    };

    ext.features.googleSearch = {
        shouldRun: ({ getConfig }) => {
            const config = getConfig();
            return isGoogleSearchPage() && config?.googleSearch?.enabled !== false;
        },
        init: ({ getConfig }) => {
            const configState = getConfig();
            if (configState?.googleSearch?.enabled === false) {
                return {
                    onConfigChange() {},
                    destroy() {}
                };
            }

            let config = { left: 0, top: 0, open: false };

            const triggerRef = floating.createTriggerElement({
                className: 'gesture-google-search-trigger',
                textContent: '🔍',
                hidden: true
            });

            const panelRef = floating.createPanelRoot({
                className: 'gesture-google-search-panel',
                hidden: true
            });

            const applyTimeFilter = (period, amount) => {
                const url = new URL(window.location.href);
                url.searchParams.set('tbs', `qdr:${period}${amount > 1 ? amount : ''}`);
                window.location.assign(url.toString());
            };

            const applyFileFilter = (type) => {
                const input = document.querySelector('textarea[name="q"], input[name="q"]');
                const url = new URL(window.location.href);
                const currentQuery = (input?.value || url.searchParams.get('q') || '').replace(/\s*filetype:\w+/gi, '').trim();
                url.searchParams.set('q', [currentQuery, `filetype:${String(type).toLowerCase()}`].filter(Boolean).join(' '));
                window.location.assign(url.toString());
            };

            const filterGrid = createFilterPanel({ onApplyTime: applyTimeFilter, onApplyFile: applyFileFilter });
            panelRef.element.appendChild(filterGrid);

            const updateUI = () => {
                triggerRef.setPosition(config.left, config.top);
                triggerRef.element.classList.toggle('is-active', config.open);

                if (config.open) {
                    panelRef.show('block');
                    const rect = triggerRef.element.getBoundingClientRect();
                    const pPos = floating.clampFixedPosition({
                        left: rect.left,
                        top: rect.bottom + UI.panelOffset,
                        width: panelRef.element.offsetWidth || 220,
                        height: panelRef.element.offsetHeight || 300
                    });
                    panelRef.setPosition(pPos.left, pPos.top);
                    panelRef.element.classList.add('is-visible');
                } else {
                    panelRef.hide();
                    panelRef.element.classList.remove('is-visible');
                }
            };

            const unbindDrag = floating.bindDragBehavior({
                target: triggerRef.element,
                getInitialPosition: () => ({ left: config.left, top: config.top }),
                onMove: ({ deltaX, deltaY, origin }) => {
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: UI.triggerSize,
                        height: UI.triggerSize,
                        margin: 8
                    });
                    config.left = next.left;
                    config.top = next.top;
                    triggerRef.element.classList.add('is-dragging');
                    updateUI();
                },
                onDragEnd: () => {
                    triggerRef.element.classList.remove('is-dragging');
                    posStorage.save(config.left, config.top);
                },
                onClick: () => {
                    config.open = !config.open;
                    updateUI();
                }
            });

            const unbindOutside = floating.bindOutsideClickGuard({
                isOpen: () => config.open,
                containsTarget: (t) => triggerRef.element.contains(t) || panelRef.element.contains(t),
                onOutside: () => {
                    config.open = false;
                    updateUI();
                }
            });

            posStorage.load().then((pos) => {
                const initial = floating.clampFixedPosition({
                    left: pos.left,
                    top: pos.top,
                    width: UI.triggerSize,
                    height: UI.triggerSize,
                    margin: 8
                });
                config.left = initial.left;
                config.top = initial.top;
                triggerRef.show();
                updateUI();
            });

            return {
                onConfigChange() {},
                destroy() {
                    unbindDrag();
                    unbindOutside();
                    triggerRef.destroy();
                    panelRef.destroy();
                }
            };
        }
    };
})();


/* --- Source: content/quick-search/constants.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.IS_ANDROID = /Android/i.test(navigator.userAgent || '');

    quickSearch.CONFIG = Object.freeze({
        maxProviders: 10,
        textBubbleOffsetY: 36,
        imageBubbleOffsetY: 8,
        hoverDelay: 120,
        hideDelay: 220,
        minImageSidePx: 72,
        minImageAreaPx: 9000,
        minNaturalImageSidePx: 96,
        suppressSelectionMs: 900,
        selectionCleanupDelayMs: 32,
        selectionCleanupRetryMs: 180
    });

    quickSearch.DEFAULT_SETTINGS = Object.freeze({
        providers: [
            { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={{q}}', icon: 'https://www.google.com/favicon.ico' },
            {
                id: 'perplexity',
                name: 'Perplexity',
                url: 'https://www.perplexity.ai/search?q={{q}}',
                icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32'
            },
            {
                id: 'chatgpt',
                name: 'ChatGPT',
                url: 'https://chatgpt.com/?q={{q}}',
                icon: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=32'
            },
            {
                id: 'gemini',
                name: 'Gemini',
                url: 'https://gemini.google.com/app?q={{q}}',
                icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=32'
            },
            {
                id: 'claude',
                name: 'Claude',
                url: 'https://claude.ai/new?q={{q}}',
                icon: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=32'
            },
            {
                id: 'copilot',
                name: 'Copilot',
                url: 'https://copilot.microsoft.com/?q={{q}}',
                icon: 'https://www.google.com/s2/favicons?domain=copilot.microsoft.com&sz=32'
            },
            { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={{q}}', icon: 'https://www.bing.com/favicon.ico' },
            { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={{q}}', icon: 'https://duckduckgo.com/favicon.ico' },
            {
                id: 'youtube',
                name: 'YouTube',
                url: 'https://www.youtube.com/results?search_query={{q}}',
                icon: 'https://www.youtube.com/favicon.ico'
            },
            {
                id: 'google-images',
                name: 'Ảnh Google',
                url: 'https://www.google.com/search?tbm=isch&q={{q}}',
                icon: 'https://www.google.com/favicon.ico'
            }
        ],
        imageProviders: [
            {
                id: 'google-lens',
                name: 'Google Lens',
                url: 'https://lens.google.com/uploadbyurl?url={{img}}',
                icon: 'https://www.google.com/favicon.ico'
            },
            {
                id: 'bing-visual',
                name: 'Bing Visual',
                url: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIDP&q=imgurl:{{img}}',
                icon: 'https://www.bing.com/favicon.ico'
            },
            {
                id: 'yandex-images',
                name: 'Yandex Images',
                url: 'https://yandex.com/images/search?rpt=imageview&url={{img}}',
                icon: 'https://yandex.com/favicon.ico'
            }
        ]
    });

    quickSearch.QUICK_GLYPHS = Object.freeze({
        copy: '⧉',
        selectAll: '⊞',
        translate: '文',
        saveImage: '↓',
        ocr: 'T',
        copyImage: '▣'
    });

    quickSearch.encodeQuery = (value) =>
        encodeURIComponent(
            String(value || '')
                .trim()
                .replace(/\s+/g, ' ')
        );
    quickSearch.buildProviderUrl = (template, { text, imageUrl }) =>
        String(template || '')
            .replaceAll('{{q}}', quickSearch.encodeQuery(text || ''))
            .replaceAll('{{img}}', encodeURIComponent(imageUrl || ''));
})();


/* --- Source: content/quick-search/ui.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});
    const viewport = ext.shared.viewportCore;

    let uiHost;
    let uiShadow;
    let uiLayer;

    const createFallbackIcon = (label) => {
        const fallback = document.createElement('span');
        fallback.className = 'gesture-quick-search-glyph';
        fallback.textContent = label?.trim()?.[0] || '🔗';
        return fallback;
    };

    const createIconElement = (item) => {
        if (item.glyph) {
            return createFallbackIcon(item.glyph);
        }

        if (item.icon) {
            const image = document.createElement('img');
            image.src = item.icon;
            image.alt = '';
            image.addEventListener(
                'error',
                () => {
                    image.replaceWith(createFallbackIcon(item.label));
                },
                { once: true }
            );
            return image;
        }

        return createFallbackIcon(item.label);
    };

    const ensureUiRoot = () => {
        if (uiLayer?.isConnected) {
            return uiLayer;
        }

        uiHost = document.createElement('div');
        uiHost.id = 'gesture-quick-search-ui-host';
        uiShadow = uiHost.attachShadow({ mode: 'open' });

        const style = document.createElement('style');
        style.textContent = `
            :host { all: initial; }
            .gesture-quick-search-ui-root {
                position: fixed;
                inset: 0;
                z-index: 2147483646;
                pointer-events: none;
                font-family: Inter, Arial, sans-serif;
                color: #eee;
                line-height: 1;
                text-transform: none;
                letter-spacing: normal;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
            }
            .gesture-quick-search-ui-root,
            .gesture-quick-search-ui-root *,
            .gesture-quick-search-ui-root *::before,
            .gesture-quick-search-ui-root *::after {
                box-sizing: border-box;
            }
            .gesture-quick-search-bubble {
                position: fixed;
                z-index: 1;
                display: none;
                padding: 1px;
                border-radius: 8px;
                background: #1a1a1a;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.5);
                pointer-events: auto;
            }
            .gesture-quick-search-grid {
                display: grid;
                gap: 1px;
            }
            .gesture-quick-search-item {
                appearance: none;
                -webkit-appearance: none;
                width: 28px;
                height: 28px;
                min-width: 28px;
                min-height: 28px;
                margin: 0;
                padding: 0;
                border: none;
                border-radius: 5px;
                background: transparent;
                color: #eee;
                display: flex;
                align-items: center;
                justify-content: center;
                font: inherit;
                line-height: 1;
                text-align: center;
                vertical-align: middle;
                cursor: pointer;
                transition: background 0.15s ease;
            }
            .gesture-quick-search-item:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            .gesture-quick-search-item img {
                width: 18px;
                height: 18px;
                display: block;
                flex: 0 0 auto;
                object-fit: contain;
                margin: 0;
                padding: 0;
                border: 0;
                vertical-align: middle;
            }
            .gesture-quick-search-glyph {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 18px;
                height: 18px;
                flex: 0 0 auto;
                color: #eee;
                font-family: 'Segoe UI Symbol', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
                font-size: 18px;
                font-weight: 400;
                line-height: 1;
                text-align: center;
                letter-spacing: 0;
            }
        `;

        uiLayer = document.createElement('div');
        uiLayer.className = 'gesture-quick-search-ui-root';
        uiShadow.append(style, uiLayer);
        document.documentElement.appendChild(uiHost);
        return uiLayer;
    };

    const applyBubblePosition = (bubble, x, y) => {
        const width = bubble.offsetWidth;
        const height = bubble.offsetHeight;
        const centeredLeft = x - width / 2;
        const next = viewport?.fitPanelToViewport?.({
            preferredLeft: centeredLeft,
            preferredTop: y,
            panelWidth: width,
            panelHeight: height,
            margin: 6
        }) || {
            left: Math.max(6, Math.min(centeredLeft, window.innerWidth - width - 6)),
            top: Math.max(6, Math.min(y, window.innerHeight - height - 6))
        };

        bubble.style.left = `${next.left}px`;
        bubble.style.top = `${next.top}px`;
    };

    quickSearch.ui = {
        createBubble(type) {
            const root = ensureUiRoot();
            const bubble = document.createElement('div');
            bubble.className = `gesture-quick-search-bubble gesture-quick-search-bubble-${type}`;
            const grid = document.createElement('div');
            grid.className = 'gesture-quick-search-grid';
            bubble.appendChild(grid);
            root.appendChild(bubble);

            return {
                bubble,
                show(items, x, y, columns = 4) {
                    grid.replaceChildren();
                    const columnCount = Math.max(1, Math.min(columns, Math.ceil(items.length / 2)));
                    grid.style.gridTemplateColumns = `repeat(${columnCount}, 28px)`;
                    items.forEach((item) => {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.className = 'gesture-quick-search-item';
                        button.title = item.title || '';
                        button.appendChild(createIconElement(item));
                        button.addEventListener('click', (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            item.onClick();
                        });
                        grid.appendChild(button);
                    });
                    bubble.style.display = 'block';
                    applyBubblePosition(bubble, x, y);
                },
                reposition(x, y) {
                    if (bubble.style.display === 'block') {
                        applyBubblePosition(bubble, x, y);
                    }
                },
                hide() {
                    bubble.style.display = 'none';
                }
            };
        },
        teardown() {
            uiHost?.remove();
            uiHost = null;
            uiShadow = null;
            uiLayer = null;
        }
    };
})();


/* --- Source: content/quick-search/text-session.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});
    const { textBubbleOffsetY } = quickSearch.CONFIG;

    const getNodePath = (node) => {
        let current = node instanceof Node ? node : null;
        const parts = [];
        while (current && current !== document.body && current !== document.documentElement) {
            const parent = current.parentNode;
            if (!parent) {
                break;
            }
            const index = Array.prototype.indexOf.call(parent.childNodes, current);
            parts.push(`${current.nodeName}:${index}`);
            current = parent;
        }
        return parts.reverse().join('/');
    };

    const getSelectionKey = (range, text) => {
        if (!range || !text) {
            return '';
        }
        return [text, getNodePath(range.startContainer), range.startOffset, getNodePath(range.endContainer), range.endOffset].join('|');
    };

    const getRangeAnchor = (range) => {
        if (!range) {
            return null;
        }
        const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 || rect.height > 0);
        const anchorRect = rects.length
            ? rects.reduce((lowest, rect) => (rect.bottom > lowest.bottom ? rect : lowest), rects[0])
            : range.getBoundingClientRect();
        if (!anchorRect || (anchorRect.width <= 0 && anchorRect.height <= 0)) {
            return null;
        }
        return {
            x: anchorRect.left + (anchorRect.width || 0) / 2,
            y: anchorRect.bottom + textBubbleOffsetY
        };
    };

    quickSearch.textSession = {
        getSelectionSnapshot() {
            try {
                const selection = window.getSelection?.();
                if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
                    return null;
                }
                const text = String(selection.toString() || '').trim();
                if (!text) {
                    return null;
                }
                const range = selection.getRangeAt(0);
                const anchor = getRangeAnchor(range);
                if (!anchor) {
                    return null;
                }
                return {
                    range,
                    text,
                    key: getSelectionKey(range, text),
                    x: anchor.x,
                    y: anchor.y
                };
            } catch {
                // Some pages mutate selection/ranges during layout updates; skip this snapshot.
                return null;
            }
        },
        selectAllPageText() {
            const activeElement = document.activeElement;
            if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
                activeElement.focus();
                activeElement.select();
                return;
            }
            const selection = window.getSelection?.();
            const range = document.createRange();
            range.selectNodeContents(document.body);
            selection?.removeAllRanges();
            selection?.addRange(range);
        }
    };
})();


/* --- Source: content/quick-search/image-session.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});
    const { imageBubbleOffsetY, minImageSidePx, minImageAreaPx, minNaturalImageSidePx } = quickSearch.CONFIG;

    const IMAGE_UI_HINT_RE = /\b(icon|logo|avatar|emoji|badge|sprite|thumbnail|thumb|favicon|mask)\b/i;

    const getPositiveNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    const hasUiImageHints = (image) => {
        const text = [
            image.className,
            image.id,
            image.getAttribute('alt'),
            image.getAttribute('aria-label'),
            image.getAttribute('data-icon'),
            image.getAttribute('itemprop')
        ]
            .filter(Boolean)
            .join(' ');
        return IMAGE_UI_HINT_RE.test(text);
    };

    quickSearch.imageSession = {
        getImageElement(target) {
            if (!(target instanceof Element) || target.closest('.gesture-quick-search-bubble')) {
                return null;
            }
            if (target instanceof HTMLImageElement) {
                return target;
            }
            return target.closest('picture')?.querySelector('img') ?? null;
        },
        getImageAnchor(image, event = null) {
            if (!(image instanceof HTMLImageElement)) {
                return null;
            }
            const rect = image.getBoundingClientRect();
            if (!rect || (rect.width <= 0 && rect.height <= 0)) {
                return event ? { x: event.clientX + 6, y: event.clientY + 6 } : null;
            }
            return {
                x: rect.left + rect.width / 2,
                y: rect.bottom + imageBubbleOffsetY
            };
        },
        isSearchableImage(image) {
            if (!(image instanceof HTMLImageElement) || !image.isConnected) {
                return false;
            }

            const rect = image.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) {
                return false;
            }

            const width = rect.width;
            const height = rect.height;
            const area = width * height;
            const naturalWidth = getPositiveNumber(image.naturalWidth);
            const naturalHeight = getPositiveNumber(image.naturalHeight);
            const smallestSide = Math.min(width, height);
            const smallestNaturalSide = Math.min(naturalWidth || width, naturalHeight || height);

            if (smallestSide < minImageSidePx || area < minImageAreaPx) {
                return false;
            }

            if (smallestNaturalSide < minNaturalImageSidePx) {
                return false;
            }

            if (hasUiImageHints(image) && area < minImageAreaPx * 3) {
                return false;
            }

            if (image.closest('button, a[role="button"], [role="button"], .icon, .btn, .button')) {
                return false;
            }

            return true;
        },
        resolveImageUrl(image) {
            if (!(image instanceof HTMLImageElement)) {
                return '';
            }
            const candidates = [
                image.currentSrc,
                image.src,
                image.getAttribute('data-src'),
                image.getAttribute('data-lazy-src'),
                image.getAttribute('data-original'),
                image.getAttribute('data-url')
            ];
            const preferred = candidates.find(
                (url) => typeof url === 'string' && url && !url.startsWith('data:') && !url.startsWith('blob:')
            );
            return preferred || candidates.find((url) => typeof url === 'string' && url) || '';
        }
    };
})();


/* --- Source: content/quick-search/bubble-manager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createBubbleManager = (ui, getConfig, onImageHoverTimerReset, onImageHoverHideTimerStart) => {
        let textBubble;
        let imageBubble;

        const ensureTextBubble = () => {
            if (!textBubble) {
                textBubble = ui.createBubble('text');
            }
            return textBubble;
        };

        const hideTextBubble = () => {
            textBubble?.hide();
        };

        const ensureImageBubble = () => {
            if (!imageBubble) {
                imageBubble = ui.createBubble('image');
                imageBubble.bubble.addEventListener('mouseenter', () => {
                    onImageHoverTimerReset?.();
                });
                imageBubble.bubble.addEventListener('mouseleave', () => {
                    onImageHoverHideTimerStart?.(imageBubble);
                });
            }
            return imageBubble;
        };

        const hideImageBubble = () => {
            imageBubble?.hide();
        };

        const hideAllBubbles = () => {
            hideTextBubble();
            hideImageBubble();
        };

        const isEventInsideBubble = (event, bubbleInstance) => {
            if (!bubbleInstance?.bubble) {
                return false;
            }
            const path = event.composedPath?.();
            if (Array.isArray(path) && path.includes(bubbleInstance.bubble)) {
                return true;
            }
            return event.target instanceof Node && bubbleInstance.bubble.contains(event.target);
        };

        return {
            ensureTextBubble,
            hideTextBubble,
            ensureImageBubble,
            hideImageBubble,
            hideAllBubbles,
            isEventInsideTextBubble: (event) => isEventInsideBubble(event, textBubble),
            isEventInsideImageBubble: (event) => isEventInsideBubble(event, imageBubble),
            getTextBubble: () => textBubble,
            getImageBubble: () => imageBubble
        };
    };
})();


/* --- Source: content/quick-search/action-menu.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createActionMenu = ({
        CONFIG,
        DEFAULT_SETTINGS,
        QUICK_GLYPHS,
        buildProviderUrl,
        getFeatureConfig,
        actions,
        sessionManager,
        bubbleManager
    }) => {
        const getEnabledTextProviders = () => {
            const config = getFeatureConfig();
            const enabledProviderIds = Array.isArray(config.enabledProviderIds) ? config.enabledProviderIds : [];
            return DEFAULT_SETTINGS.providers.filter((provider) => enabledProviderIds.includes(provider.id)).slice(0, CONFIG.maxProviders);
        };

        const getImageProviders = () => DEFAULT_SETTINGS.imageProviders.slice(0, CONFIG.maxProviders);

        const showTextActions = (session) => {
            const config = getFeatureConfig();
            const items = [
                {
                    label: 'Copy',
                    title: 'Copy',
                    glyph: QUICK_GLYPHS.copy,
                    onClick: () => {
                        actions.copyText(session.text).then(() => {
                            ext.shared.toastCore.createToast('Đã chép', session.x, session.y, 1200);
                        });
                        sessionManager.suppressSelectionFor(session.key);
                        sessionManager.hideTextBubble();
                    }
                },
                {
                    label: 'Dịch',
                    title: 'Dịch văn bản đã chọn',
                    glyph: QUICK_GLYPHS.translate,
                    onClick: () => {
                        actions.translateSelectedText(session);
                        sessionManager.suppressSelectionFor(session.key);
                        sessionManager.hideTextBubble();
                    }
                },
                {
                    label: 'Select All',
                    title: 'Select All',
                    glyph: QUICK_GLYPHS.selectAll,
                    onClick: () => {
                        sessionManager.suppressSelectionFor('*');
                        quickSearch.textSession.selectAllPageText();
                        ext.shared.toastCore.createToast('Đã chọn hết', session.x, session.y, 1200);
                        sessionManager.hideTextBubble();
                    }
                },
                ...getEnabledTextProviders().map((provider) => ({
                    label: provider.name,
                    title: provider.name,
                    icon: provider.icon,
                    onClick: () => {
                        actions.openSearchTab(buildProviderUrl(provider.url, { text: session.text }));
                    }
                }))
            ];

            bubbleManager.ensureTextBubble().show(items, session.x, session.y, config.columns || 5);
        };

        const showImageActions = (session) => {
            const config = getFeatureConfig();
            if (config.imageSearchEnabled === false) {
                return;
            }
            const items = [
                {
                    label: 'Save',
                    title: 'Save image',
                    glyph: QUICK_GLYPHS.saveImage,
                    onClick: () => {
                        actions.downloadImage(session.url, session.x, session.y);
                        sessionManager.hideImageBubble();
                    }
                },
                {
                    label: 'OCR',
                    title: 'Trích xuất văn bản từ ảnh',
                    glyph: QUICK_GLYPHS.ocr,
                    onClick: () => {
                        actions.runOcr(session.url, session.x, session.y);
                        sessionManager.hideImageBubble();
                    }
                },
                {
                    label: 'Copy',
                    title: 'Copy image',
                    glyph: QUICK_GLYPHS.copyImage,
                    onClick: () => {
                        actions
                            .copyImage(session.image, session.url)
                            .then(() => {
                                ext.shared.toastCore.createToast('Đã chép ảnh', session.x, session.y, 1200);
                            })
                            .catch(() => {
                                ext.shared.toastCore.createToast('Không chép được ảnh', session.x, session.y, 1500);
                            });
                        sessionManager.hideImageBubble();
                    }
                },
                ...getImageProviders().map((provider) => ({
                    label: provider.name,
                    title: provider.name,
                    icon: provider.icon,
                    onClick: () => {
                        actions.openSearchTab(buildProviderUrl(provider.url, { imageUrl: session.url }));
                    }
                }))
            ];

            bubbleManager.ensureImageBubble().show(items, session.x, session.y, config.columns || 5);
        };

        return {
            showTextActions,
            showImageActions
        };
    };
})();


/* --- Source: content/quick-search/session-manager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createSessionManager = ({
        CONFIG,
        IS_ANDROID,
        getFeatureConfig,
        textSessionApi,
        imageSessionApi,
        selectionCore,
        bubbleManager,
        actionMenu
    }) => {
        const state = {
            textSession: null,
            imageSession: null,
            hoverImage: null,
            touchCandidate: null,
            suppressSelectionKey: '',
            suppressSelectionUntil: 0
        };

        const timers = {
            selection: 0,
            hover: 0,
            hide: 0,
            longPress: 0,
            selectionCleanup: 0
        };

        const suppressSelectionFor = (selectionKey, ms = CONFIG.suppressSelectionMs) => {
            state.suppressSelectionKey = selectionKey || '';
            state.suppressSelectionUntil = Date.now() + ms;
        };

        const clearSuppressedSelectionIfExpired = () => {
            if (state.suppressSelectionUntil && state.suppressSelectionUntil <= Date.now()) {
                state.suppressSelectionKey = '';
                state.suppressSelectionUntil = 0;
            }
        };

        const runSelectionCleanup = () => {
            try {
                const activeElement = document.activeElement;
                if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
                    const hasRange = typeof activeElement.selectionStart === 'number' && typeof activeElement.selectionEnd === 'number';
                    if (hasRange && activeElement.selectionStart !== activeElement.selectionEnd) {
                        activeElement.setSelectionRange(activeElement.selectionEnd, activeElement.selectionEnd);
                    }
                }
                if (activeElement instanceof HTMLElement && typeof activeElement.blur === 'function' && !activeElement.isContentEditable) {
                    activeElement.blur();
                }
                window.getSelection?.()?.removeAllRanges();
                document.getSelection?.()?.removeAllRanges();
            } catch {
                // Ignore selection cleanup failures on restrictive pages.
            }
        };

        const clearActiveSelection = () => {
            window.clearTimeout(timers.selectionCleanup);
            runSelectionCleanup();
            timers.selectionCleanup = window.setTimeout(() => {
                runSelectionCleanup();
                timers.selectionCleanup = window.setTimeout(() => {
                    runSelectionCleanup();
                }, CONFIG.selectionCleanupRetryMs);
            }, CONFIG.selectionCleanupDelayMs);
        };

        const hideTextBubble = () => {
            window.clearTimeout(timers.selection);
            bubbleManager.hideTextBubble();
            state.textSession = null;
        };

        const hideImageBubble = () => {
            window.clearTimeout(timers.hover);
            window.clearTimeout(timers.hide);
            bubbleManager.hideImageBubble();
            state.imageSession = null;
        };

        const hideAllBubbles = () => {
            hideTextBubble();
            hideImageBubble();
        };

        const resetHoverTimer = () => {
            window.clearTimeout(timers.hide);
        };

        const startHoverHideTimer = (imageBubbleInstance) => {
            timers.hide = window.setTimeout(() => {
                if (!state.hoverImage?.matches(':hover')) {
                    hideImageBubble();
                }
            }, CONFIG.hideDelay);
        };

        const startHoverHideTimerByImage = () => {
            if (state.imageSession) {
                window.clearTimeout(timers.hide);
                timers.hide = window.setTimeout(() => {
                    if (!bubbleManager.getImageBubble()?.bubble?.matches(':hover')) {
                        hideImageBubble();
                    }
                }, CONFIG.hideDelay);
            }
        };

        const updateTextSession = (snapshot) => {
            if (!snapshot?.text) {
                hideTextBubble();
                return;
            }

            clearSuppressedSelectionIfExpired();
            if (
                state.suppressSelectionUntil > Date.now() &&
                (state.suppressSelectionKey === '*' || (snapshot.key && state.suppressSelectionKey === snapshot.key))
            ) {
                hideTextBubble();
                return;
            }

            state.textSession = { text: snapshot.text, key: snapshot.key, x: snapshot.x, y: snapshot.y };
            actionMenu.showTextActions(state.textSession);
        };

        const syncTextBubbleToSelection = () => {
            const session = state.textSession;
            if (!session) {
                return;
            }
            const snapshot = textSessionApi.getSelectionSnapshot();
            if (!snapshot || snapshot.key !== session.key || snapshot.text !== session.text) {
                hideTextBubble();
                return;
            }
            state.textSession = { ...session, x: snapshot.x, y: snapshot.y };
            bubbleManager.getTextBubble()?.reposition(snapshot.x, snapshot.y);
        };

        const updateImageSession = (image, anchor, url) => {
            if (!(image instanceof HTMLImageElement) || !url || !anchor) {
                hideImageBubble();
                return;
            }
            state.imageSession = { image, url, x: anchor.x, y: anchor.y };
            actionMenu.showImageActions(state.imageSession);
        };

        const syncImageBubble = () => {
            const session = state.imageSession;
            if (!session?.image?.isConnected) {
                hideImageBubble();
                return;
            }
            const anchor = imageSessionApi.getImageAnchor(session.image);
            const url = imageSessionApi.resolveImageUrl(session.image);
            if (!anchor || !url) {
                hideImageBubble();
                return;
            }
            state.imageSession = { ...session, url, x: anchor.x, y: anchor.y };
            bubbleManager.getImageBubble()?.reposition(anchor.x, anchor.y);
        };

        const evaluateSelection = () => {
            if (selectionCore.isEditableTarget(document.activeElement)) {
                hideTextBubble();
                return;
            }
            const snapshot = textSessionApi.getSelectionSnapshot();
            if (!snapshot) {
                state.suppressSelectionKey = '';
                state.suppressSelectionUntil = 0;
                hideTextBubble();
                return;
            }
            updateTextSession(snapshot);
        };

        const scheduleSelectionEvaluation = (delay = getFeatureConfig().selectionDelay || 120) => {
            window.clearTimeout(timers.selection);
            timers.selection = window.setTimeout(evaluateSelection, delay);
        };

        const scheduleSelectionEvaluationSoon = (delay = 80) => {
            scheduleSelectionEvaluation(IS_ANDROID ? 0 : delay);
        };

        const evaluateImageCandidate = (image, event = null) => {
            if (getFeatureConfig().imageSearchEnabled === false) {
                hideImageBubble();
                return;
            }
            if (!imageSessionApi.isSearchableImage(image)) {
                hideImageBubble();
                return;
            }
            const url = imageSessionApi.resolveImageUrl(image);
            const anchor = imageSessionApi.getImageAnchor(image, event);
            if (!url || !anchor) {
                hideImageBubble();
                return;
            }
            updateImageSession(image, anchor, url);
        };

        const scheduleImageEvaluation = (image, event) => {
            window.clearTimeout(timers.hover);
            timers.hover = window.setTimeout(
                () => {
                    evaluateImageCandidate(image, event);
                },
                IS_ANDROID ? 0 : CONFIG.hoverDelay
            );
        };

        const clearTouchLongPress = () => {
            window.clearTimeout(timers.longPress);
            state.touchCandidate = null;
        };

        const setHoverImage = (image) => {
            state.hoverImage = image;
        };

        const getHoverImage = () => state.hoverImage;

        const clearHoverTimer = () => {
            window.clearTimeout(timers.hover);
        };

        const setTouchCandidate = (candidate) => {
            state.touchCandidate = candidate;
        };

        const getTouchCandidate = () => state.touchCandidate;

        const setLongPressTimer = (handler, ms) => {
            timers.longPress = window.setTimeout(handler, ms);
        };

        const getCurrentSelectionKey = () => state.textSession?.key || '';

        const destroy = () => {
            window.clearTimeout(timers.selection);
            window.clearTimeout(timers.hover);
            window.clearTimeout(timers.hide);
            window.clearTimeout(timers.longPress);
            window.clearTimeout(timers.selectionCleanup);
        };

        return {
            suppressSelectionFor,
            clearActiveSelection,
            hideTextBubble,
            hideImageBubble,
            hideAllBubbles,
            resetHoverTimer,
            startHoverHideTimer,
            startHoverHideTimerByImage,
            syncTextBubbleToSelection,
            syncImageBubble,
            scheduleSelectionEvaluation,
            scheduleSelectionEvaluationSoon,
            evaluateImageCandidate,
            scheduleImageEvaluation,
            clearTouchLongPress,
            setHoverImage,
            getHoverImage,
            clearHoverTimer,
            setTouchCandidate,
            getTouchCandidate,
            setLongPressTimer,
            getCurrentSelectionKey,
            destroy
        };
    };
})();


/* --- Source: content/quick-search/actions.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createActions = ({
        tabActions,
        hideAllBubbles,
        clearActiveSelection,
        suppressSelectionFor,
        getSelectionSnapshot,
        getCurrentSelectionKey
    }) => ({
        async openSearchTab(url) {
            if (!url) {
                return;
            }
            const selectionSnapshot = getSelectionSnapshot();
            suppressSelectionFor(selectionSnapshot?.key || getCurrentSelectionKey() || '');
            clearActiveSelection();
            hideAllBubbles();
            const result = await tabActions.openTab(url, 'fg');
            if (!result?.ok) {
                window.open(url, '_blank', 'noopener');
            }
        },
        async downloadImage(url, x, y) {
            try {
                const a = document.createElement('a');
                a.href = url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.download = `image_${Date.now()}.jpg`;
                a.click();
                ext.shared.toastCore.createToast('Đang tải ảnh...', x, y, 1200);
            } catch {
                await this.openSearchTab(url);
                ext.shared.toastCore.createToast('Mở tab mới để lưu', x, y, 1200);
            }
        },
        async translateSelectedText(session) {
            const { translate } = ext.shared.translateCore;
            const text = session.text;
            if (!text) {
                return;
            }

            const selection = window.getSelection();
            const anchorNode = selection?.anchorNode;
            const targetNode = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
            if (!targetNode) {
                return;
            }

            try {
                const result = await translate(text, { cleanResult: true });
                if (!result || result === text) {
                    return;
                }

                const existing =
                    targetNode.querySelector('.gesture-inline-translate-box') ||
                    (targetNode.nextElementSibling?.classList.contains('gesture-inline-translate-box')
                        ? targetNode.nextElementSibling
                        : null);
                existing?.remove();

                const box = document.createElement('div');
                box.className = 'gesture-inline-translate-box';
                const content = document.createElement('div');
                content.className = 'gesture-inline-translate-text';
                content.textContent = result;
                box.appendChild(content);
                targetNode.insertAdjacentElement('afterend', box);
            } catch {
                // Ignore translation failures and keep the selection flow uninterrupted.
            }
        },
        async copyText(value) {
            await ext.shared.domUtils.copyText(value);
            if (ext.shared.storage?.saveClipboardHistory) {
                await ext.shared.storage.saveClipboardHistory(value);
            }
        },
        async copyImage(image, url) {
            const copyBlob = async (blob) => {
                if (!blob?.type?.startsWith('image/')) {
                    throw new Error('Clipboard item is not an image');
                }
                if (!navigator.clipboard?.write || typeof ClipboardItem !== 'function') {
                    throw new Error('Image clipboard is not supported');
                }
                const pngBlob = blob.type === 'image/png' ? blob : await convertBlobToPng(blob);
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            };

            const convertBlobToPng = async (blob) => {
                const bitmap = await createImageBitmap(blob);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = bitmap.width;
                    canvas.height = bitmap.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(bitmap, 0, 0);
                    return await new Promise((resolve, reject) => {
                        canvas.toBlob((nextBlob) => {
                            if (nextBlob) resolve(nextBlob);
                            else reject(new Error('Unable to convert image to PNG'));
                        }, 'image/png');
                    });
                } finally {
                    bitmap.close?.();
                }
            };

            const copyFromUrl = async (imageUrl) => {
                const isDataUrl = String(imageUrl || '').startsWith('data:');
                const response = await fetch(imageUrl, isDataUrl ? undefined : { credentials: 'include', cache: 'force-cache' });
                if (!response.ok) {
                    throw new Error(`Image request failed: ${response.status}`);
                }
                await copyBlob(await response.blob());
            };

            const copyFromBackground = async () => {
                const response = await ext.shared.messaging.sendRuntimeMessage(
                    'gesture-ext/fetch-image-data-url',
                    { url },
                    { alwaysResolve: true }
                );
                if (!response?.ok || !response.dataUrl) {
                    throw new Error(response?.error || 'Unable to fetch image');
                }
                await copyFromUrl(response.dataUrl);
            };

            const copyFromCanvas = async () => {
                if (!(image instanceof HTMLImageElement)) {
                    throw new Error('No image element');
                }
                const canvas = document.createElement('canvas');
                canvas.width = image.naturalWidth || image.width;
                canvas.height = image.naturalHeight || image.height;
                if (!canvas.width || !canvas.height) {
                    throw new Error('Image has no size');
                }
                const ctx = canvas.getContext('2d');
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
                await copyBlob(blob);
            };

            try {
                await copyFromUrl(url);
                return;
            } catch {
                try {
                    await copyFromBackground();
                } catch {
                    await copyFromCanvas();
                }
            }
        },
        runOcr(url, x, y) {
            ext.shared.ocrCore.extractText(url, x, y);
        }
    });
})();


/* --- Source: content/quick-search/event-manager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createEventManager = (handlers) => {
        const {
            onPointerUp,
            onPointerMove,
            onPointerDown,
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onTouchCancel,
            onSelectionChange,
            onKeyDown,
            onPageShow,
            onScrollOrResize
        } = handlers;

        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('touchstart', onTouchStart, true);
        document.addEventListener('touchmove', onTouchMove, true);
        document.addEventListener('touchend', onTouchEnd, true);
        document.addEventListener('touchcancel', onTouchCancel, true);
        document.addEventListener('selectionchange', onSelectionChange, true);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('pageshow', onPageShow, true);
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize, true);

        return {
            destroy() {
                document.removeEventListener('pointerup', onPointerUp, true);
                document.removeEventListener('pointermove', onPointerMove, true);
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('touchstart', onTouchStart, true);
                document.removeEventListener('touchmove', onTouchMove, true);
                document.removeEventListener('touchend', onTouchEnd, true);
                document.removeEventListener('touchcancel', onTouchCancel, true);
                document.removeEventListener('selectionchange', onSelectionChange, true);
                document.removeEventListener('keydown', onKeyDown, true);
                window.removeEventListener('pageshow', onPageShow, true);
                window.removeEventListener('scroll', onScrollOrResize, true);
                window.removeEventListener('resize', onScrollOrResize, true);
            }
        };
    };
})();


/* --- Source: content/quick-search/controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createController = ({ tabActions, getConfig }) => {
        const touch = ext.shared.touchCore;
        const selectionCore = ext.shared.selectionCore;
        const { CONFIG, DEFAULT_SETTINGS, QUICK_GLYPHS, IS_ANDROID, buildProviderUrl } = quickSearch;
        const textSessionApi = quickSearch.textSession;
        const imageSessionApi = quickSearch.imageSession;
        const ui = quickSearch.ui;

        let featureConfig = (window.__gestureQuickSearchConfig = getConfig()?.quickSearch || {});

        const getFeatureConfig = () => featureConfig;

        let sessionManager;

        const bubbleManager = quickSearch.createBubbleManager(
            ui,
            getConfig,
            () => sessionManager?.resetHoverTimer(),
            (bubble) => sessionManager?.startHoverHideTimer(bubble)
        );

        const actions = quickSearch.createActions({
            tabActions,
            hideAllBubbles: bubbleManager.hideAllBubbles,
            clearActiveSelection: () => sessionManager?.clearActiveSelection(),
            suppressSelectionFor: (key, ms) => sessionManager?.suppressSelectionFor(key, ms),
            getSelectionSnapshot: textSessionApi.getSelectionSnapshot,
            getCurrentSelectionKey: () => sessionManager?.getCurrentSelectionKey() || ''
        });

        const actionMenu = quickSearch.createActionMenu({
            CONFIG,
            DEFAULT_SETTINGS,
            QUICK_GLYPHS,
            buildProviderUrl,
            getFeatureConfig,
            actions,
            sessionManager: {
                suppressSelectionFor: (key, ms) => sessionManager?.suppressSelectionFor(key, ms),
                hideTextBubble: bubbleManager.hideTextBubble,
                hideImageBubble: bubbleManager.hideImageBubble
            },
            bubbleManager
        });

        sessionManager = quickSearch.createSessionManager({
            CONFIG,
            IS_ANDROID,
            getFeatureConfig,
            textSessionApi,
            imageSessionApi,
            selectionCore,
            bubbleManager,
            actionMenu
        });

        const onPointerUp = () => {
            if (!IS_ANDROID) {
                sessionManager.scheduleSelectionEvaluation();
            }
        };

        const onPointerMove = (event) => {
            const image = imageSessionApi.getImageElement(event.target);
            if (image !== sessionManager.getHoverImage()) {
                if (!image && bubbleManager.getImageBubble()) {
                    sessionManager.startHoverHideTimerByImage();
                }
                sessionManager.setHoverImage(image);
                sessionManager.clearHoverTimer();
            }
            if (!image || featureConfig.imageSearchEnabled === false) {
                return;
            }
            sessionManager.scheduleImageEvaluation(image, event);
        };

        const onPointerDown = (event) => {
            if (!bubbleManager.isEventInsideTextBubble(event)) {
                sessionManager.hideTextBubble();
            }
            if (!bubbleManager.isEventInsideImageBubble(event)) {
                sessionManager.hideImageBubble();
            }
        };

        const onScrollOrResize = () => {
            sessionManager.syncTextBubbleToSelection();
            sessionManager.syncImageBubble();
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                sessionManager.hideAllBubbles();
            }
        };

        const onTouchStart = (event) => {
            if (
                bubbleManager.isEventInsideTextBubble(event) ||
                bubbleManager.isEventInsideImageBubble(event) ||
                !event.touches ||
                event.touches.length !== 1
            ) {
                return;
            }
            const point = touch.getPrimaryPoint(event);
            const image = imageSessionApi.getImageElement(event.target);
            sessionManager.setTouchCandidate({ x: point.x, y: point.y, image });
            if (
                featureConfig.imageSearchEnabled === false ||
                !(image instanceof HTMLImageElement) ||
                !imageSessionApi.isSearchableImage(image)
            ) {
                return;
            }
            sessionManager.setLongPressTimer(
                () => {
                    const candidate = sessionManager.getTouchCandidate();
                    if (candidate?.image?.isConnected) {
                        sessionManager.evaluateImageCandidate(candidate.image, { clientX: candidate.x, clientY: candidate.y });
                    }
                },
                IS_ANDROID ? 160 : featureConfig.imageLongPressMs || 320
            );
        };

        const onTouchMove = (event) => {
            if (!sessionManager.getTouchCandidate() || !event.touches || event.touches.length !== 1) {
                sessionManager.clearTouchLongPress();
                return;
            }
            const point = touch.getPrimaryPoint(event);
            if (touch.getDistance(point, sessionManager.getTouchCandidate()) > 18) {
                sessionManager.clearTouchLongPress();
            }
        };

        const onTouchEnd = () => {
            sessionManager.clearTouchLongPress();
            if (!IS_ANDROID) {
                sessionManager.scheduleSelectionEvaluationSoon(140);
            }
        };

        const onSelectionChange = () => {
            sessionManager.scheduleSelectionEvaluationSoon(120);
        };

        const onPageShow = () => {
            sessionManager.clearTouchLongPress();
            sessionManager.hideAllBubbles();
            sessionManager.clearActiveSelection();
        };

        const eventManager = quickSearch.createEventManager({
            onPointerUp,
            onPointerMove,
            onPointerDown,
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onTouchCancel: sessionManager.clearTouchLongPress,
            onSelectionChange,
            onKeyDown,
            onPageShow,
            onScrollOrResize
        });

        return {
            onConfigChange(nextConfig) {
                featureConfig = window.__gestureQuickSearchConfig = nextConfig?.quickSearch || featureConfig;
                if (featureConfig.imageSearchEnabled === false) {
                    sessionManager.hideImageBubble();
                }
                sessionManager.scheduleSelectionEvaluationSoon(0);
            },
            destroy() {
                sessionManager.destroy();
                eventManager.destroy();
                ui.teardown();
                window.__gestureQuickSearchMounted = false;
            }
        };
    };
})();


/* --- Source: content/quick-search/index.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    ext.features.quickSearch = {
        shouldRun: ({ runtime, getConfig }) => window.top === window && runtime.isHttpPage() && getConfig()?.quickSearch?.enabled !== false,
        init: ({ tabActions, getConfig }) => {
            if (window.__gestureQuickSearchMounted) {
                return {
                    onConfigChange(nextConfig) {
                        window.__gestureQuickSearchConfig = nextConfig?.quickSearch || window.__gestureQuickSearchConfig || {};
                    },
                    destroy() {}
                };
            }

            window.__gestureQuickSearchMounted = true;
            return ext.quickSearch.createController({ tabActions, getConfig });
        }
    };
})();


/* --- Source: shared/translate-core.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    const createMemoryCache = ({ maxSize = 200 } = {}) => {
        const store = new Map();
        const trim = () => {
            if (store.size <= maxSize) return;
            const oldestKeys = [...store.entries()]
                .sort((a, b) => (a[1]?.ts ?? 0) - (b[1]?.ts ?? 0))
                .slice(0, store.size - maxSize)
                .map(([key]) => key);
            oldestKeys.forEach((key) => store.delete(key));
        };
        return {
            get(key) {
                return store.get(key);
            },
            set(key, value) {
                store.set(key, { ...value, ts: value?.ts ?? Date.now() });
                trim();
            },
            delete(key) {
                store.delete(key);
            },
            clear() {
                store.clear();
            }
        };
    };

    const sendRuntimeMessage = (type, payload = {}) => ext.shared.messaging.sendRuntimeMessage(type, payload, { unwrapResult: true });

    const translateDetailed = async (text, { cache, provider, targetLanguage, cleanResult = false } = {}) => {
        const key = String(text || '').trim();
        if (!key) {
            return {
                text: '',
                translatedText: '',
                provider: provider || '',
                sourceLanguage: 'auto',
                targetLanguage: targetLanguage || '',
                fallbackReason: '',
                error: ''
            };
        }

        if (cache) {
            const cached = cache.get(key);
            if (cached?.result) {
                return {
                    text: key,
                    translatedText: cached.result,
                    provider: cached.provider || provider || '',
                    sourceLanguage: cached.sourceLanguage || 'auto',
                    targetLanguage: cached.targetLanguage || targetLanguage || '',
                    fallbackReason: cached.fallbackReason || '',
                    error: ''
                };
            }
        }

        const payload = await sendRuntimeMessage('gesture-ext/translate-text', {
            text: key,
            ...(provider ? { provider } : {}),
            ...(targetLanguage ? { targetLanguage } : {})
        });

        let result = payload?.translatedText ?? '';

        if (cleanResult && result) {
            result = String(result)
                .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gmu, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        if (cache && result) {
            cache.set(key, {
                result,
                provider: payload?.provider || provider || '',
                sourceLanguage: payload?.sourceLanguage || 'auto',
                targetLanguage: payload?.targetLanguage || targetLanguage || '',
                fallbackReason: payload?.fallbackReason || '',
                ts: Date.now()
            });
        }

        return {
            text: key,
            translatedText: result,
            provider: payload?.provider || provider || '',
            sourceLanguage: payload?.sourceLanguage || 'auto',
            targetLanguage: payload?.targetLanguage || targetLanguage || '',
            fallbackReason: payload?.fallbackReason || '',
            error: result ? '' : 'Khong co noi dung dich tra ve'
        };
    };

    const translate = async (text, options = {}) => {
        const result = await translateDetailed(text, options);
        return result.translatedText || '';
    };

    ext.shared.translateCore = { createMemoryCache, sendRuntimeMessage, translate, translateDetailed };
})();


/* --- Source: content/inline-translate/constants.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});

    inlineTranslate.JUNK = /[\s\d\p{P}\p{S}\p{M}\p{C}\u200B-\u200D\uFEFF]/gu;
    inlineTranslate.TRANSLATION_PENDING = Symbol('translation-pending');
    inlineTranslate.IS_REDDIT = window.location.hostname.includes('reddit.com');
    inlineTranslate.REDDIT_SELECTORS = Object.freeze([
        'div[id$="-post-rtjson-content"]',
        '.md',
        '[data-post-click-location="text-body"] > div',
        '[slot="text-body"] div',
        '[slot="text-body"]'
    ]);
    inlineTranslate.REDDIT_TITLE_SELECTORS = Object.freeze(['[slot="title"]', 'a[slot="title"]', 'h1', 'h2', 'h3']);
    inlineTranslate.VALID_TAGS =
        /^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|DIV|SPAN|A|ARTICLE|LABEL|SECTION|ASIDE|FIGURE|DETAILS|SUMMARY|CODE|NAV|HEADER|FOOTER|MAIN|MARK)$/;
    inlineTranslate.PARAGRAPH_TAGS = /^(P|LI|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|SUMMARY)$/;
    inlineTranslate.HEADING_TAGS = /^(H[1-6])$/;
    inlineTranslate.CONTAINER_FALLBACK_TAGS = /^(DIV|ARTICLE|SECTION|ASIDE|FIGURE|DETAILS|MAIN)$/;
    inlineTranslate.VIETNAMESE_CHAR_PATTERN = /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i;
})();


/* --- Source: content/inline-translate/text-block-detector.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const { JUNK, IS_REDDIT, REDDIT_SELECTORS, REDDIT_TITLE_SELECTORS, VALID_TAGS, PARAGRAPH_TAGS, HEADING_TAGS, CONTAINER_FALLBACK_TAGS } =
        inlineTranslate;

    const hasMeaningfulText = (text) => text.replace(JUNK, '').length > 0;
    const normalizeBlockText = (text) =>
        String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    const getTextKey = (text) => normalizeBlockText(text).slice(0, 240);
    const getElementText = (element) => normalizeBlockText(element?.innerText || '');

    const getMeaningfulChildBlocks = (element) =>
        [...(element?.children || [])].filter((child) => {
            if (!(child instanceof HTMLElement) || child.classList.contains('gesture-inline-translate-box')) {
                return false;
            }
            const text = getElementText(child);
            return hasMeaningfulText(text) && text.length >= 24;
        });

    const isParagraphLikeCandidate = (element, text) => {
        if (!(element instanceof HTMLElement) || !VALID_TAGS.test(element.tagName)) return false;
        if (!hasMeaningfulText(text) || text.length > 2200) return false;
        if (PARAGRAPH_TAGS.test(element.tagName)) return text.length >= 20;
        if (HEADING_TAGS.test(element.tagName)) return text.length >= 60;
        if (!CONTAINER_FALLBACK_TAGS.test(element.tagName)) return false;

        const childBlocks = getMeaningfulChildBlocks(element);
        const childCount = childBlocks.length;
        const textNodes = [...element.childNodes].filter(
            (node) => node.nodeType === Node.TEXT_NODE && normalizeBlockText(node.textContent || '').length >= 20
        );
        const ownParagraphChildren = childBlocks.filter((child) => PARAGRAPH_TAGS.test(child.tagName) || HEADING_TAGS.test(child.tagName));

        if (childCount === 0) return text.length >= 30;
        if (childCount === 1) return getElementText(childBlocks[0]) === text;
        if (textNodes.length > 0 && childCount <= 2) return text.length >= 40;
        if (ownParagraphChildren.length === 1 && childCount <= 2 && text.length <= 700) return true;
        return false;
    };

    const pickBetterBlock = (currentBest, candidate, candidateText, depth) => {
        const normalizedText = candidateText.slice(0, 2000);
        if (!currentBest) {
            return { text: normalizedText, node: candidate, depth };
        }

        const bestIsParagraph = PARAGRAPH_TAGS.test(currentBest.node.tagName) || HEADING_TAGS.test(currentBest.node.tagName);
        const nextIsParagraph = PARAGRAPH_TAGS.test(candidate.tagName) || HEADING_TAGS.test(candidate.tagName);

        if (nextIsParagraph && !bestIsParagraph) {
            return { text: normalizedText, node: candidate, depth };
        }
        if (nextIsParagraph === bestIsParagraph) {
            const depthDelta = currentBest.depth - depth;
            if (Math.abs(depthDelta) <= 1) {
                if (Math.abs(normalizedText.length - 280) < Math.abs(currentBest.text.length - 280)) {
                    return { text: normalizedText, node: candidate, depth };
                }
            } else if (depth < currentBest.depth) {
                return { text: normalizedText, node: candidate, depth };
            }
        }

        return currentBest;
    };

    const isClippedContainer = (element) => {
        for (
            let current = element, depth = 0;
            current && current !== document.body && depth < 3;
            current = current.parentElement, depth += 1
        ) {
            const style = window.getComputedStyle(current);
            if (/hidden|scroll|auto|clip/.test(`${style.overflow}${style.overflowY}`)) {
                return true;
            }
            if (style.maxHeight && style.maxHeight !== 'none') {
                return true;
            }
        }
        return false;
    };

    const pointInElement = (element, x, y) => {
        if (!(element instanceof Element)) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    const getTextBlock = (element, x = 0, y = 0) => {
        if (!element || element === document.body) {
            return null;
        }

        if (IS_REDDIT) {
            const post = element.closest('shreddit-post');
            if (post) {
                for (const selector of REDDIT_TITLE_SELECTORS) {
                    for (const candidate of post.querySelectorAll(selector)) {
                        if (!pointInElement(candidate, x, y)) continue;
                        const titleText = candidate.innerText?.trim() || '';
                        if (hasMeaningfulText(titleText)) {
                            return { text: titleText, node: candidate };
                        }
                    }
                }
            }
            const comment = element.closest('shreddit-comment');
            if (comment) {
                const candidate = comment.querySelector('.md, [slot="comment"], [id$="-rtjson-content"], [id$="-post-rtjson-content"]');
                if (candidate?.innerText.trim()) {
                    return { text: candidate.innerText.trim(), node: candidate };
                }
            }
            if (post) {
                const body = post.querySelector('shreddit-post-text-body');
                if (body) {
                    for (const selector of REDDIT_SELECTORS) {
                        const candidate = body.querySelector(selector);
                        if (candidate?.innerText.trim()) {
                            return { text: candidate.innerText.trim(), node: candidate };
                        }
                    }
                }
            }
        }

        let current = element;
        let best = null;
        let depth = 0;
        while (current && current !== document.body) {
            if (window.getComputedStyle(current).display === 'none') {
                current = current.parentElement;
                continue;
            }
            const text = getElementText(current);
            if (isParagraphLikeCandidate(current, text)) {
                best = pickBetterBlock(best, current, text, depth);
                if (PARAGRAPH_TAGS.test(current.tagName)) {
                    break;
                }
            }
            depth += 1;
            current = current.parentElement;
        }
        return best ? { text: best.text, node: best.node } : null;
    };

    const hitTestTextBlock = (x, y) => {
        for (const element of document.elementsFromPoint(x, y)) {
            if (element.closest('.gesture-inline-translate-box')) {
                continue;
            }
            const block = getTextBlock(element, x, y);
            if (block) {
                return block;
            }
        }
        return null;
    };

    const isInVideoZone = (x, y) => {
        const inRect = (element) => {
            const rect = element.getBoundingClientRect();
            return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
        };
        return (
            [...document.querySelectorAll('video')].some((video) => video.offsetWidth && inRect(video)) ||
            [...document.querySelectorAll('iframe')].some(
                (frame) => frame.offsetWidth && inRect(frame) && /youtube|vimeo|dailymotion|twitch|facebook.*video|tiktok/i.test(frame.src)
            ) ||
            document
                .elementsFromPoint(x, y)
                .some((element) => element.closest?.('video, .html5-video-player, .jwplayer, .vjs-tech, .plyr, .flowplayer'))
        );
    };

    inlineTranslate.textBlockDetector = {
        hasMeaningfulText,
        normalizeBlockText,
        getTextKey,
        getElementText,
        getMeaningfulChildBlocks,
        isParagraphLikeCandidate,
        pickBetterBlock,
        isClippedContainer,
        pointInElement,
        getTextBlock,
        hitTestTextBlock,
        isInVideoZone
    };
})();


/* --- Source: content/inline-translate/editable-selection-panel.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const viewport = ext.shared.viewportCore;
    const EDITABLE_SELECTION_PANEL_MARGIN = 8;

    let editableSelectionPanel = null;
    let editableSelectionPanelMeta = null;
    let editableSelectionPanelText = null;
    let editableSelectionApplyHandler = null;

    const applyEditableSelectionPanelPosition = (anchor) => {
        if (!editableSelectionPanel || !anchor) {
            return;
        }
        const width = editableSelectionPanel.offsetWidth;
        const height = editableSelectionPanel.offsetHeight;
        const centeredLeft = anchor.x - width / 2;
        const next = viewport?.fitPanelToViewport?.({
            preferredLeft: centeredLeft,
            preferredTop: anchor.y,
            panelWidth: width,
            panelHeight: height,
            margin: EDITABLE_SELECTION_PANEL_MARGIN
        }) || {
            left: Math.max(
                EDITABLE_SELECTION_PANEL_MARGIN,
                Math.min(centeredLeft, window.innerWidth - width - EDITABLE_SELECTION_PANEL_MARGIN)
            ),
            top: Math.max(
                EDITABLE_SELECTION_PANEL_MARGIN,
                Math.min(anchor.y, window.innerHeight - height - EDITABLE_SELECTION_PANEL_MARGIN)
            )
        };

        editableSelectionPanel.style.left = `${next.left}px`;
        editableSelectionPanel.style.top = `${next.top}px`;
    };

    const ensureEditableSelectionPanel = () => {
        if (editableSelectionPanel?.isConnected) {
            return editableSelectionPanel;
        }

        editableSelectionPanel = document.createElement('div');
        editableSelectionPanel.className = 'gesture-inline-translate-selection-panel';
        editableSelectionPanel.setAttribute('role', 'button');
        editableSelectionPanel.tabIndex = -1;

        editableSelectionPanelMeta = document.createElement('div');
        editableSelectionPanelMeta.className = 'gesture-inline-translate-selection-meta';
        editableSelectionPanelText = document.createElement('div');
        editableSelectionPanelText.className = 'gesture-inline-translate-selection-text';
        editableSelectionPanel.append(editableSelectionPanelMeta, editableSelectionPanelText);

        const keepSelectionStable = (event) => {
            event.preventDefault();
        };

        editableSelectionPanel.addEventListener('pointerdown', keepSelectionStable);
        editableSelectionPanel.addEventListener('mousedown', keepSelectionStable);
        editableSelectionPanel.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (editableSelectionPanel.dataset.mode === 'result' && typeof editableSelectionApplyHandler === 'function') {
                editableSelectionApplyHandler();
            }
        });
        editableSelectionPanel.addEventListener('keydown', (event) => {
            if (editableSelectionPanel.dataset.mode !== 'result') {
                return;
            }
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            editableSelectionApplyHandler?.();
        });

        document.documentElement.appendChild(editableSelectionPanel);
        return editableSelectionPanel;
    };

    const setEditableSelectionPanelState = ({ mode, anchor, meta, text, onApply }) => {
        const panel = ensureEditableSelectionPanel();
        editableSelectionApplyHandler = typeof onApply === 'function' ? onApply : null;
        panel.dataset.mode = mode;
        panel.tabIndex = mode === 'result' ? 0 : -1;
        panel.setAttribute('aria-disabled', mode === 'result' ? 'false' : 'true');
        editableSelectionPanelMeta.textContent = meta;
        editableSelectionPanelMeta.style.display = meta ? 'block' : 'none';
        editableSelectionPanelText.textContent = text;
        panel.style.display = 'block';
        applyEditableSelectionPanelPosition(anchor);
    };

    inlineTranslate.editableSelectionPanel = {
        showEditableSelectionLoading(anchor) {
            setEditableSelectionPanelState({
                mode: 'loading',
                anchor,
                meta: 'Đang dịch sang tiếng Anh',
                text: 'Đang xử lý vùng bôi đen…'
            });
        },
        showEditableSelectionResult({ anchor, text, onApply }) {
            setEditableSelectionPanelState({
                mode: 'result',
                anchor,
                meta: '',
                text,
                onApply
            });
        },
        showEditableSelectionError({ anchor, message }) {
            setEditableSelectionPanelState({
                mode: 'error',
                anchor,
                meta: 'Không dịch được',
                text: String(message || 'Lỗi dịch tạm thời').slice(0, 140)
            });
        },
        repositionEditableSelectionPanel(anchor) {
            if (editableSelectionPanel?.style.display === 'block') {
                applyEditableSelectionPanelPosition(anchor);
            }
        },
        hideEditableSelectionPanel() {
            editableSelectionApplyHandler = null;
            if (editableSelectionPanel) {
                editableSelectionPanel.style.display = 'none';
                editableSelectionPanel.dataset.mode = '';
                editableSelectionPanel.tabIndex = -1;
            }
        },
        isEventInsideEditableSelectionPanel(event) {
            if (!editableSelectionPanel?.isConnected) {
                return false;
            }
            const path = event.composedPath?.();
            if (Array.isArray(path) && path.includes(editableSelectionPanel)) {
                return true;
            }
            return event.target instanceof Node && editableSelectionPanel.contains(event.target);
        }
    };
})();


/* --- Source: content/inline-translate/dom.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const { IS_REDDIT } = inlineTranslate;
    const detector = inlineTranslate.textBlockDetector;
    const selectionPanel = inlineTranslate.editableSelectionPanel;

    const { normalizeBlockText, getTextKey, isClippedContainer } = detector;

    const collectTextTypography = (element, bucket) => {
        if (!(element instanceof Element)) {
            return;
        }

        const style = window.getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize);
        const lineHeight = parseFloat(style.lineHeight);
        const text = normalizeBlockText(element.textContent || '');

        if (text) {
            bucket.push({
                element,
                textLength: text.length,
                fontSize: Number.isFinite(fontSize) ? fontSize : null,
                lineHeight: Number.isFinite(lineHeight) ? lineHeight : null
            });
        }

        for (const child of element.children) {
            collectTextTypography(child, bucket);
        }
    };

    const getSourceTypography = (element) => {
        if (!(element instanceof Element)) {
            return null;
        }

        const preferred = element.matches?.(
            '#content-text, yt-formatted-string, [id="content-text"], [class*="comment"], [class*="content"]'
        )
            ? element
            : element.querySelector?.('#content-text, yt-formatted-string');

        const candidates = [];
        collectTextTypography(preferred || element, candidates);

        if (candidates.length === 0) {
            const style = window.getComputedStyle(element);
            const fontSize = parseFloat(style.fontSize);
            const lineHeight = parseFloat(style.lineHeight);
            return {
                fontSize: Number.isFinite(fontSize) ? fontSize : null,
                lineHeight: Number.isFinite(lineHeight) ? lineHeight : null
            };
        }

        candidates.sort((left, right) => {
            if ((right.fontSize || 0) !== (left.fontSize || 0)) {
                return (right.fontSize || 0) - (left.fontSize || 0);
            }
            return right.textLength - left.textLength;
        });

        const best = candidates[0];
        return {
            fontSize: best.fontSize,
            lineHeight: best.lineHeight
        };
    };

    const getSafeTranslationAnchor = (node) => {
        if (!node?.parentElement) {
            return { host: node, mode: 'append' };
        }
        if (IS_REDDIT) {
            if (node.closest('h1, h2, h3, h4, [slot="title"]')) {
                return { host: node, mode: 'append' };
            }
            return { host: node, mode: 'afterend' };
        }
        if (isClippedContainer(node)) {
            return { host: node, mode: 'afterend' };
        }

        const nodeStyle = window.getComputedStyle(node);
        const parent = node.parentElement;
        const parentStyle = window.getComputedStyle(parent);
        const hasMultiElementContent = node.children.length > 1;
        const isInlineLike = /^(inline|contents)$/i.test(nodeStyle.display);
        const isFlexRow = parentStyle.display === 'flex' && !/^column/i.test(parentStyle.flexDirection || 'row');
        const isGridParent = parentStyle.display === 'grid' || parentStyle.display === 'inline-grid';

        if (isInlineLike || isFlexRow || isGridParent || hasMultiElementContent) {
            return { host: node, mode: 'afterend' };
        }
        return { host: node, mode: 'append' };
    };

    inlineTranslate.dom = {
        hasMeaningfulText: detector.hasMeaningfulText,
        normalizeBlockText: detector.normalizeBlockText,
        getTextKey: detector.getTextKey,
        applyInlineTranslateCssVars(nextSettings) {
            const rootStyle = document.documentElement.style;
            rootStyle.setProperty('--gesture-ilt-fs', `${nextSettings.fontScale}em`);
            rootStyle.setProperty('--gesture-ilt-fg', nextSettings.mutedColor);
        },
        ensureStyles() {
            if (document.getElementById('gesture-inline-translate-style')) {
                return;
            }
            const style = document.createElement('style');
            style.id = 'gesture-inline-translate-style';
            style.textContent = `
                :root {
                    --gesture-ilt-fs: 0.95em;
                    --gesture-ilt-fg: #00bfff;
                }
                .gesture-inline-translate-box {
                    display: block;
                    width: 100%;
                    clear: both;
                    margin: 8px 0 0;
                    padding-top: 6px;
                    box-sizing: border-box;
                    animation: gesture-inline-translate-fade-in 0.2s ease;
                }
                .gesture-inline-translate-text {
                    color: var(--gesture-ilt-fg);
                    white-space: pre-wrap;
                    font: italic var(--gesture-ilt-fs)/1.6 system-ui;
                    padding: 6px 12px;
                }
                .gesture-inline-translate-meta {
                    opacity: 0.6;
                    font-size: 0.75em;
                    animation: gesture-inline-translate-pulse 1s infinite;
                }
                .gesture-inline-translate-selection-panel {
                    position: fixed;
                    display: none;
                    min-width: 180px;
                    max-width: min(360px, calc(100vw - 16px));
                    padding: 10px 12px;
                    border-radius: 12px;
                    background: rgba(15, 23, 42, 0.98);
                    color: #f8fafc;
                    box-shadow: 0 14px 36px rgba(2, 6, 23, 0.35);
                    z-index: 2147483647;
                    pointer-events: auto;
                    user-select: none;
                    animation: gesture-inline-translate-fade-in 0.16s ease;
                }
                .gesture-inline-translate-selection-panel[data-mode="result"] {
                    cursor: pointer;
                }
                .gesture-inline-translate-selection-meta {
                    margin-bottom: 6px;
                    font: 600 11px/1.25 system-ui;
                    letter-spacing: 0.02em;
                    color: rgba(148, 163, 184, 0.95);
                }
                .gesture-inline-translate-selection-panel[data-mode="result"] .gesture-inline-translate-selection-meta {
                    color: rgba(125, 211, 252, 0.95);
                }
                .gesture-inline-translate-selection-panel[data-mode="loading"] .gesture-inline-translate-selection-meta {
                    color: #facc15;
                }
                .gesture-inline-translate-selection-panel[data-mode="error"] .gesture-inline-translate-selection-meta {
                    color: #fca5a5;
                }
                .gesture-inline-translate-selection-text {
                    white-space: pre-wrap;
                    font: 500 13px/1.45 system-ui;
                    color: #f8fafc;
                    word-break: break-word;
                }
                @keyframes gesture-inline-translate-fade-in {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes gesture-inline-translate-pulse {
                    0%, 100% { opacity: 0.6; }
                    50% { opacity: 0.2; }
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        },
        createTranslationBox(text = '', targetNode = null) {
            const wrapper = document.createElement('div');
            wrapper.className = 'gesture-inline-translate-box';
            wrapper.dataset.textKey = text ? getTextKey(text) : '';
            if (IS_REDDIT) {
                const slot = targetNode?.getAttribute('slot') || 'text-body';
                wrapper.setAttribute('slot', slot);
            }
            const content = document.createElement('div');
            content.className = 'gesture-inline-translate-text';
            const typography = getSourceTypography(targetNode);
            if (typography?.fontSize) {
                content.style.fontSize = `${Math.max(typography.fontSize * 0.95, 12)}px`;
            }
            if (typography?.lineHeight) {
                content.style.lineHeight = `${Math.max(typography.lineHeight * 0.98, typography.fontSize || 0)}px`;
            }
            if (text) {
                content.textContent = text;
            } else {
                const meta = document.createElement('span');
                meta.className = 'gesture-inline-translate-meta';
                meta.textContent = 'đang dịch…';
                content.appendChild(meta);
            }
            wrapper.appendChild(content);
            return wrapper;
        },
        insertTranslationBox(node, box) {
            const anchor = getSafeTranslationAnchor(node);
            box.__gestureSourceNode = node;
            if (anchor.mode === 'afterend') {
                anchor.host.insertAdjacentElement('afterend', box);
            } else {
                anchor.host.appendChild(box);
            }
        },
        findTranslationBox(node) {
            return (
                node.querySelector(':scope > .gesture-inline-translate-box') ||
                (node.nextElementSibling?.classList.contains('gesture-inline-translate-box') ? node.nextElementSibling : null)
            );
        },
        findRelatedTranslationBox(node, textKey) {
            const direct = this.findTranslationBox(node);
            if (direct) return direct;
            if (!textKey) return null;
            for (const box of document.querySelectorAll(`.gesture-inline-translate-box[data-text-key="${CSS.escape(textKey)}"]`)) {
                const sourceNode = box.__gestureSourceNode;
                if (!(sourceNode instanceof Node) || !(node instanceof Node)) continue;
                if (sourceNode === node || sourceNode.contains(node) || node.contains(sourceNode)) {
                    return box;
                }
            }
            return null;
        },
        showEditableSelectionLoading: selectionPanel.showEditableSelectionLoading.bind(selectionPanel),
        showEditableSelectionResult: selectionPanel.showEditableSelectionResult.bind(selectionPanel),
        showEditableSelectionError: selectionPanel.showEditableSelectionError.bind(selectionPanel),
        repositionEditableSelectionPanel: selectionPanel.repositionEditableSelectionPanel.bind(selectionPanel),
        hideEditableSelectionPanel: selectionPanel.hideEditableSelectionPanel.bind(selectionPanel),
        isEventInsideEditableSelectionPanel: selectionPanel.isEventInsideEditableSelectionPanel.bind(selectionPanel),
        getTextBlock: detector.getTextBlock,
        hitTestTextBlock: detector.hitTestTextBlock,
        isInVideoZone: detector.isInVideoZone
    };
})();


/* --- Source: content/inline-translate/actions.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const { TRANSLATION_PENDING } = inlineTranslate;
    const { createMemoryCache, translate: coreTranslate } = ext.shared.translateCore;

    const cache = createMemoryCache({ maxSize: 200 });

    inlineTranslate.createActions = ({ getSettings }) => ({
        async translateText(text) {
            const settings = getSettings();
            const cached = cache.get(text);
            const now = Date.now();

            if (cached?.result) {
                if (now - cached.ts < settings.dedupeSeconds * 1000) {
                    return cached.result;
                }
                cache.set(text, { result: cached.result, ts: now });
                return cached.result;
            }

            if (cached && now - cached.ts < settings.dedupeSeconds * 1000) {
                return TRANSLATION_PENDING;
            }

            cache.set(text, { result: null, ts: now });

            const translatedText = await coreTranslate(text, {
                cache: null,
                provider: settings.provider,
                cleanResult: true
            });

            if (!translatedText) {
                throw new Error('Không có nội dung dịch trả về');
            }

            cache.set(text, { result: translatedText, ts: Date.now() });
            return translatedText;
        }
    });
})();


/* --- Source: content/inline-translate/editable-selection-manager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const selectionCore = ext.shared.selectionCore;
    const { VIETNAMESE_CHAR_PATTERN } = inlineTranslate;

    inlineTranslate.createEditableSelectionManager = (deps) => {
        const { getSettings, dom, hideEditableSelectionPanelRef, getEditableSelectionState } = deps;

        const isVietnameseSelection = (text) => VIETNAMESE_CHAR_PATTERN.test(String(text || ''));

        const areSameEditableSnapshots = (left, right) => {
            return !!left && !!right && left.target === right.target && left.key === right.key && left.text === right.text;
        };

        const hideEditableSelectionPanel = ({ invalidateRequest = true } = {}) => {
            const state = getEditableSelectionState();
            if (invalidateRequest) {
                state.editableSelectionRequestId += 1;
            }
            state.snapshot = null;
            state.translatedText = '';
            state.error = '';
            dom.hideEditableSelectionPanel();
        };

        // Export this so others can use it
        hideEditableSelectionPanelRef.current = hideEditableSelectionPanel;

        const applyEditableSelectionTranslation = () => {
            const state = getEditableSelectionState();
            const snapshot = state.snapshot;
            const translatedText = state.translatedText;
            if (!snapshot || !translatedText || !selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                hideEditableSelectionPanel();
                return;
            }
            selectionCore.replaceSelectionSnapshot(snapshot, translatedText);
            hideEditableSelectionPanel();
        };

        const syncEditableSelectionPanel = () => {
            const state = getEditableSelectionState();
            const snapshot = state.snapshot;
            if (!snapshot) {
                return;
            }
            const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
            if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                hideEditableSelectionPanel();
                return;
            }
            state.snapshot = currentSnapshot;
            if (state.translatedText) {
                dom.showEditableSelectionResult({
                    anchor: currentSnapshot.anchor,
                    text: state.translatedText,
                    onApply: applyEditableSelectionTranslation
                });
                return;
            }
            if (state.error) {
                dom.showEditableSelectionError({
                    anchor: currentSnapshot.anchor,
                    message: state.error
                });
                return;
            }
            dom.repositionEditableSelectionPanel(currentSnapshot.anchor);
        };

        const evaluateEditableSelection = async () => {
            const state = getEditableSelectionState();
            window.clearTimeout(state.editableSelectionTimer);
            const settings = getSettings();

            if (!settings.selectionTranslateEnabled) {
                hideEditableSelectionPanel();
                return;
            }

            const snapshot = selectionCore.getEditableSelectionSnapshot();
            const trimmedText = String(snapshot?.text || '').trim();
            if (!snapshot || !trimmedText || !isVietnameseSelection(trimmedText)) {
                hideEditableSelectionPanel();
                return;
            }

            if (areSameEditableSnapshots(state.snapshot, snapshot)) {
                state.snapshot = snapshot;
                syncEditableSelectionPanel();
                return;
            }

            hideEditableSelectionPanel();
            state.snapshot = snapshot;
            dom.showEditableSelectionLoading(snapshot.anchor);

            const requestId = ++state.editableSelectionRequestId;
            try {
                const result = await ext.shared.translateCore.translateDetailed(trimmedText, {
                    provider: settings.provider,
                    targetLanguage: 'en',
                    cleanResult: true
                });

                if (requestId !== state.editableSelectionRequestId) {
                    return;
                }
                if (!selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                const translatedText = String(result?.translatedText || '').trim();
                if (!translatedText || translatedText === trimmedText) {
                    hideEditableSelectionPanel();
                    return;
                }

                const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                state.snapshot = currentSnapshot;
                state.translatedText = translatedText;
                state.error = '';
                dom.showEditableSelectionResult({
                    anchor: currentSnapshot.anchor,
                    text: translatedText,
                    onApply: applyEditableSelectionTranslation
                });
            } catch (error) {
                if (requestId !== state.editableSelectionRequestId) {
                    return;
                }
                if (!selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                state.snapshot = currentSnapshot;
                state.translatedText = '';
                state.error = String(error?.message || 'Lỗi dịch tạm thời');
                dom.showEditableSelectionError({
                    anchor: currentSnapshot.anchor,
                    message: state.error
                });
            }
        };

        const scheduleEditableSelectionEvaluation = (delay = 80) => {
            const state = getEditableSelectionState();
            window.clearTimeout(state.editableSelectionTimer);
            state.editableSelectionTimer = window.setTimeout(() => {
                evaluateEditableSelection().catch(() => {
                    hideEditableSelectionPanel();
                });
            }, delay);
        };

        return {
            hideEditableSelectionPanel,
            syncEditableSelectionPanel,
            applyEditableSelectionTranslation,
            evaluateEditableSelection,
            scheduleEditableSelectionEvaluation
        };
    };
})();


/* --- Source: content/inline-translate/block-translation-manager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const { TRANSLATION_PENDING } = inlineTranslate;

    inlineTranslate.createBlockTranslationManager = (deps) => {
        const { dom, actions } = deps;

        const toggleTranslationAtPoint = async (x, y) => {
            const hit = dom.hitTestTextBlock(x, y);
            if (!hit || !dom.hasMeaningfulText(hit.text)) {
                return;
            }

            const textKey = dom.getTextKey(hit.text);
            const existing = dom.findRelatedTranslationBox(hit.node, textKey);
            if (existing) {
                existing.remove();
                return;
            }

            const box = dom.createTranslationBox(hit.text, hit.node);
            dom.insertTranslationBox(hit.node, box);

            try {
                const translatedText = await actions.translateText(hit.text);
                if (translatedText === TRANSLATION_PENDING) {
                    box.firstElementChild.textContent = '⏳ Đang dịch, thử lại sau';
                    box.firstElementChild.style.color = '#ffd166';
                    box.firstElementChild.style.fontStyle = 'normal';
                    box.firstElementChild.style.fontSize = '0.8em';
                    window.setTimeout(() => box.remove(), 1500);
                    return;
                }

                if (!translatedText) {
                    box.firstElementChild.textContent = '⚠ Không có nội dung dịch';
                    box.firstElementChild.style.color = '#ff6b6b';
                    box.firstElementChild.style.fontStyle = 'normal';
                    box.firstElementChild.style.fontSize = '0.8em';
                    window.setTimeout(() => box.remove(), 3000);
                    return;
                }

                box.firstElementChild.textContent = translatedText;
            } catch (error) {
                box.firstElementChild.textContent = `⚠ ${String(error.message || 'Unknown error').slice(0, 80)}`;
                box.firstElementChild.style.color = '#ff6b6b';
                box.firstElementChild.style.fontStyle = 'normal';
                box.firstElementChild.style.fontSize = '0.8em';
                window.setTimeout(() => box.remove(), 5000);
            }
        };

        return {
            toggleTranslationAtPoint
        };
    };
})();


/* --- Source: content/inline-translate/event-handler.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const touch = ext.shared.touchCore;
    const THREE_TOUCH_TRANSLATE_MS = 550;

    inlineTranslate.createEventHandler = (deps) => {
        const { dom, getSettings, editableSelectionManager, blockTranslationManager } = deps;

        let lastPointer = { x: 0, y: 0 };
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let startedInVideo = false;
        let threeTouchTimer = 0;

        const onMouseMove = (event) => {
            lastPointer = touch.getPrimaryPoint(event);
        };

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                editableSelectionManager.hideEditableSelectionPanel();
                return;
            }

            const settings = getSettings();
            if (!settings.hotkeyEnabled) {
                return;
            }

            const activeElement = document.activeElement;
            if (
                activeElement instanceof HTMLElement &&
                (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
            ) {
                return;
            }

            const hotkey = settings.hotkey;
            const matches =
                hotkey === 'ctrl+d'
                    ? event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.code === 'KeyD'
                    : hotkey === 'f2' && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && event.code === 'F2';

            if (!matches) {
                return;
            }

            event.preventDefault();
            blockTranslationManager.toggleTranslationAtPoint(lastPointer.x, lastPointer.y);
        };

        const onSelectionChange = () => {
            editableSelectionManager.scheduleEditableSelectionEvaluation();
        };

        const onPointerDown = (event) => {
            if (!dom.isEventInsideEditableSelectionPanel(event)) {
                editableSelectionManager.hideEditableSelectionPanel();
            }
        };

        const onMouseDown = (event) => {
            lastPointer = touch.getPrimaryPoint(event);
            if (dom.isEventInsideEditableSelectionPanel(event)) {
                return;
            }
        };

        const onMouseUp = (event) => {
            editableSelectionManager.scheduleEditableSelectionEvaluation();
        };

        const onKeyUp = () => {
            editableSelectionManager.scheduleEditableSelectionEvaluation();
        };

        const onScrollOrResize = () => {
            editableSelectionManager.syncEditableSelectionPanel();
        };

        const clearThreeTouchTimer = () => {
            window.clearTimeout(threeTouchTimer);
            threeTouchTimer = 0;
        };

        const onTouchStart = (event) => {
            clearThreeTouchTimer();
            const settings = getSettings();
            if (event.touches && event.touches.length === 3) {
                const points = [...event.touches];
                const x = points.reduce((sum, point) => sum + point.clientX, 0) / points.length;
                const y = points.reduce((sum, point) => sum + point.clientY, 0) / points.length;
                if (!dom.isInVideoZone(x, y)) {
                    if (event.cancelable) {
                        event.preventDefault();
                    }
                    threeTouchTimer = window.setTimeout(() => {
                        threeTouchTimer = 0;
                        blockTranslationManager.toggleTranslationAtPoint(x, y);
                    }, THREE_TOUCH_TRANSLATE_MS);
                }
                return;
            }

            if (!settings.swipeEnabled || !event.touches || event.touches.length !== 1) {
                return;
            }
            const point = touch.getPrimaryPoint(event);
            startX = point.x;
            startY = point.y;
            startTime = Date.now();
            startedInVideo = dom.isInVideoZone(startX, startY);
        };

        const onTouchEnd = (event) => {
            clearThreeTouchTimer();
            const settings = getSettings();
            if (!settings.swipeEnabled || !startX || Date.now() - startTime > settings.swipeMaxDurationMs) {
                startX = 0;
                return;
            }

            const point = touch.getPrimaryPoint(event);
            const endX = point.x;
            const endY = point.y;

            if (startedInVideo || dom.isInVideoZone(endX, endY)) {
                startX = 0;
                return;
            }

            const deltaX = endX - startX;
            const deltaY = endY - startY;
            startX = 0;

            const validDirection =
                settings.swipeDir === 'both' ||
                (settings.swipeDir === 'right' && deltaX > 0) ||
                (settings.swipeDir === 'left' && deltaX < 0);

            if (Math.abs(deltaX) > settings.swipePx && Math.abs(deltaY) < Math.abs(deltaX) * settings.swipeSlopeMax && validDirection) {
                blockTranslationManager.toggleTranslationAtPoint(endX - deltaX / 2, endY - deltaY / 2);
            }

            editableSelectionManager.scheduleEditableSelectionEvaluation(0);
        };

        const onTouchCancel = () => {
            clearThreeTouchTimer();
            startX = 0;
        };

        const install = () => {
            document.addEventListener('mousemove', onMouseMove, { passive: true });
            window.addEventListener('mousedown', onMouseDown, true);
            window.addEventListener('mouseup', onMouseUp, true);
            document.addEventListener('keydown', onKeyDown, true);
            document.addEventListener('keyup', onKeyUp, true);
            document.addEventListener('pointerdown', onPointerDown, true);
            document.addEventListener('selectionchange', onSelectionChange, true);
            document.addEventListener('touchstart', onTouchStart, { passive: false });
            document.addEventListener('touchend', onTouchEnd, { passive: true });
            document.addEventListener('touchcancel', onTouchCancel, { passive: true });
            window.addEventListener('scroll', onScrollOrResize, true);
            window.addEventListener('resize', onScrollOrResize, true);

            return () => {
                clearThreeTouchTimer();
                document.removeEventListener('mousemove', onMouseMove, { passive: true });
                window.removeEventListener('mousedown', onMouseDown, true);
                window.removeEventListener('mouseup', onMouseUp, true);
                document.removeEventListener('keydown', onKeyDown, true);
                document.removeEventListener('keyup', onKeyUp, true);
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('selectionchange', onSelectionChange, true);
                document.removeEventListener('touchstart', onTouchStart, { passive: false });
                document.removeEventListener('touchend', onTouchEnd, { passive: true });
                document.removeEventListener('touchcancel', onTouchCancel, { passive: true });
                window.removeEventListener('scroll', onScrollOrResize, true);
                window.removeEventListener('resize', onScrollOrResize, true);
            };
        };

        return { install };
    };
})();


/* --- Source: content/inline-translate/controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});

    inlineTranslate.createController = ({ getConfig }) => {
        let settings = getConfig().inlineTranslate;
        const dom = inlineTranslate.dom;
        const actions = inlineTranslate.createActions({
            getSettings: () => settings
        });

        const state = {
            editableSelectionTimer: 0,
            editableSelectionRequestId: 0,
            snapshot: null,
            translatedText: '',
            error: ''
        };

        const hideEditableSelectionPanelRef = { current: null };

        const editableSelectionManager = inlineTranslate.createEditableSelectionManager({
            getSettings: () => settings,
            dom,
            hideEditableSelectionPanelRef,
            getEditableSelectionState: () => state
        });

        const blockTranslationManager = inlineTranslate.createBlockTranslationManager({
            dom,
            actions
        });

        const eventHandler = inlineTranslate.createEventHandler({
            dom,
            getSettings: () => settings,
            editableSelectionManager,
            blockTranslationManager
        });

        dom.ensureStyles();
        dom.applyInlineTranslateCssVars(settings);

        const uninstallEvents = eventHandler.install();

        return {
            onConfigChange(nextConfig) {
                settings = nextConfig.inlineTranslate;
                dom.applyInlineTranslateCssVars(settings);
                if (!settings.selectionTranslateEnabled) {
                    editableSelectionManager.hideEditableSelectionPanel();
                    return;
                }
                editableSelectionManager.scheduleEditableSelectionEvaluation(0);
            },
            destroy() {
                window.clearTimeout(state.editableSelectionTimer);
                if (hideEditableSelectionPanelRef.current) {
                    hideEditableSelectionPanelRef.current();
                }
                uninstallEvents();
            }
        };
    };
})();


/* --- Source: content/inline-translate/index.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    ext.features.inlineTranslate = {
        shouldRun: ({ getConfig, runtime }) => runtime.isHttpPage() && !!getConfig()?.inlineTranslate?.enabled,
        init: ({ getConfig }) => {
            const body = document.body;
            if (window.top !== window || body?.dataset?.gestureInlineTranslateMounted === 'true') {
                return {
                    onConfigChange() {},
                    destroy() {}
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


/* --- Source: content/video-screenshot/constants.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});
    const floating = ext.shared.floatingCore;

    videoScreenshot.CONFIG = Object.freeze({
        minVideoWidth: 200,
        minVideoHeight: 150,
        shortcutKey: 's',
        regionShortcutCode: 'F4',
        recordShortcutCode: 'F8',
        triggerSize: 46,
        triggerMargin: 12,
        minRegionSize: 8,
        minRecordWidth: 48,
        minRecordHeight: 48,
        recordControlGap: 8,
        recordControlSize: 34
    });

    videoScreenshot.ICON = floating.icons.camera;

    videoScreenshot.getDefaultTriggerPosition = () => ({
        left: Math.max(videoScreenshot.CONFIG.triggerMargin, window.innerWidth - videoScreenshot.CONFIG.triggerSize - 18),
        top: Math.max(videoScreenshot.CONFIG.triggerMargin, window.innerHeight - videoScreenshot.CONFIG.triggerSize - 96)
    });

    videoScreenshot.buildFilename = () => {
        const base = ext.shared.domUtils.sanitizeFilename(document.title || 'screenshot') || 'screenshot';
        return `${base}_${Date.now()}.png`;
    };

    videoScreenshot.buildRecordingFilename = () => {
        const base = ext.shared.domUtils.sanitizeFilename(document.title || 'screen-recording') || 'screen-recording';
        return `${base}_${Date.now()}.webm`;
    };

    videoScreenshot.fallbackDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };
})();


/* --- Source: content/video-screenshot/ui.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});
    const floating = ext.shared.floatingCore;

    videoScreenshot.ensureStyles = () => {
        if (document.getElementById('gesture-video-screenshot-style')) {
            return;
        }
        floating.ensureSharedActionButtonStyles();
        const style = document.createElement('style');
        style.id = 'gesture-video-screenshot-style';
        style.textContent = `
            .gesture-video-screenshot-trigger {
                width: 46px;
                height: 46px;
                touch-action: none;
            }
            .gesture-video-screenshot-trigger svg {
                width: 28px !important;
                height: 28px !important;
            }
            .gesture-screen-screenshot-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                cursor: crosshair;
                user-select: none;
                touch-action: none;
            }
            .gesture-screen-screenshot-shade {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, .32);
            }
            .gesture-screen-screenshot-box {
                position: absolute;
                display: none;
                border: 2px solid #2f8cff;
                background: rgba(47, 140, 255, .16);
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, .2);
                box-sizing: border-box;
            }
            .gesture-screen-screenshot-hint {
                position: absolute;
                left: 50%;
                top: 18px;
                transform: translateX(-50%);
                padding: 7px 10px;
                border-radius: 6px;
                background: rgba(18, 22, 30, .92);
                color: #fff;
                font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                white-space: nowrap;
                pointer-events: none;
            }
            .gesture-screen-record-badge {
                position: fixed;
                left: 50%;
                top: 18px;
                z-index: 2147483646;
                transform: translateX(-50%);
                padding: 7px 10px;
                border-radius: 6px;
                background: rgba(185, 28, 28, .94);
                color: #fff;
                font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                pointer-events: none;
                user-select: none;
            }
            .gesture-screen-record-border {
                position: fixed;
                z-index: 2147483646;
                pointer-events: none;
                outline: 2px solid #ef4444;
                outline-offset: 0;
                box-shadow: 0 0 0 1px rgba(255, 255, 255, .9), 0 0 0 9999px rgba(0, 0, 0, .08);
            }
            .gesture-screen-record-control {
                position: fixed;
                z-index: 2147483646;
                display: flex;
                gap: 6px;
                padding: 4px;
                border-radius: 6px;
                background: rgba(18, 22, 30, .92);
                box-shadow: 0 2px 10px rgba(0, 0, 0, .35);
                touch-action: none;
            }
            .gesture-screen-record-button {
                position: relative;
                width: 34px;
                height: 34px;
                border: 0;
                border-radius: 5px;
                background: rgba(185, 28, 28, .94);
                cursor: pointer;
                touch-action: none;
            }
            .gesture-screen-record-button::before,
            .gesture-screen-record-button::after {
                content: "";
                position: absolute;
                background: #fff;
            }
            .gesture-screen-record-stop::before {
                left: 10px;
                top: 10px;
                width: 14px;
                height: 14px;
                border-radius: 2px;
            }
            .gesture-screen-record-pause::before,
            .gesture-screen-record-pause::after {
                top: 9px;
                width: 5px;
                height: 16px;
                border-radius: 1px;
            }
            .gesture-screen-record-pause::before {
                left: 10px;
            }
            .gesture-screen-record-pause::after {
                right: 10px;
            }
            .gesture-screen-record-pause.is-paused::before {
                left: 12px;
                top: 8px;
                width: 0;
                height: 0;
                border-top: 9px solid transparent;
                border-bottom: 9px solid transparent;
                border-left: 13px solid #fff;
                border-radius: 0;
                background: transparent;
            }
            .gesture-screen-record-pause.is-paused::after {
                display: none;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };
})();


/* --- Source: content/video-screenshot/trigger.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});
    const floating = ext.shared.floatingCore;

    videoScreenshot.createTrigger = (ctx, captureVideo) => {
        const { CONFIG, ICON, getDefaultTriggerPosition } = videoScreenshot;

        let triggerRef = null;
        let removeDragBinding = () => {};

        const posStorage = floating.createPositionStorage('gesture_video_screenshot_trigger_pos_v1', getDefaultTriggerPosition());

        const ensureTrigger = () => {
            if (triggerRef) {
                return triggerRef;
            }

            triggerRef = floating.createActionButton({
                className: 'gesture-video-screenshot-trigger',
                htmlContent: ICON,
                title: 'Chụp màn hình video (S)',
                ariaLabel: 'Chụp màn hình video',
                hidden: true,
                position: 'fixed',
                zIndex: '2147483646'
            });
            triggerRef.element.style.touchAction = 'none';

            removeDragBinding = floating.bindDragBehavior({
                target: triggerRef.element,
                threshold: 4,
                getInitialPosition: () => ({
                    left: triggerRef.element.getBoundingClientRect().left,
                    top: triggerRef.element.getBoundingClientRect().top
                }),
                onMove: ({ event, deltaX, deltaY, origin }) => {
                    floating.stopFloatingEvent(event);
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: CONFIG.triggerSize,
                        height: CONFIG.triggerSize,
                        margin: CONFIG.triggerMargin
                    });
                    triggerRef.setPosition(next.left, next.top);
                    triggerRef.element.classList.add('is-dragging');
                },
                onDragEnd: () => {
                    triggerRef.element.classList.remove('is-dragging');
                    const rect = triggerRef.element.getBoundingClientRect();
                    posStorage.save(rect.left, rect.top);
                },
                onClick: ({ event }) => {
                    floating.stopFloatingEvent(event);
                    captureVideo.captureActiveVideo();
                }
            });

            triggerRef.element.addEventListener(
                'pointerdown',
                (event) => {
                    floating.stopFloatingEvent(event);
                },
                true
            );

            posStorage.load().then(({ left, top }) => {
                const pos = floating.clampFixedPosition({
                    left,
                    top,
                    width: CONFIG.triggerSize,
                    height: CONFIG.triggerSize,
                    margin: CONFIG.triggerMargin
                });
                triggerRef?.setPosition(pos.left, pos.top);
            });

            return triggerRef;
        };

        const syncTrigger = () => {
            const hasVideo = !!captureVideo.findActiveVideo();
            const trigger = ensureTrigger();
            if (ctx.isFeatureEnabled() && hasVideo) {
                trigger.show('inline-flex');
            } else {
                trigger.hide();
            }
        };

        const destroy = () => {
            removeDragBinding();
            triggerRef?.destroy();
            triggerRef = null;
        };

        return {
            ensureTrigger,
            syncTrigger,
            destroy
        };
    };
})();


/* --- Source: content/video-screenshot/capture-video.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});
    const { queryAllDeep } = ext.shared.domUtils;

    videoScreenshot.createCaptureVideo = (ctx) => {
        const { CONFIG, buildFilename, fallbackDownload } = videoScreenshot;

        const isEligibleVideo = (video) =>
            Boolean(
                video &&
                video.isConnected &&
                video.videoWidth &&
                video.videoHeight &&
                video.getBoundingClientRect &&
                video.getBoundingClientRect().width >= CONFIG.minVideoWidth &&
                video.getBoundingClientRect().height >= CONFIG.minVideoHeight
            );

        const findActiveVideo = () => {
            const candidates = queryAllDeep('video')
                .filter((video) => isEligibleVideo(video))
                .map((video) => ({ video, rect: video.getBoundingClientRect() }))
                .filter(({ rect }) => rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0)
                .sort((left, right) => right.rect.width * right.rect.height - left.rect.width * left.rect.height);
            return candidates[0]?.video || null;
        };

        const captureVideoFrame = async (video) => {
            if (!video?.videoWidth || !video?.videoHeight) {
                return false;
            }

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const canvasContext = canvas.getContext('2d');
            if (!canvasContext) {
                throw new Error('Canvas 2D context unavailable');
            }
            canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL('image/png');
            const filename = buildFilename();

            try {
                const response = await ext.shared.tabActions.downloadDataUrl(url, filename);
                if (response?.ok) {
                    return true;
                }
            } catch {
                // Fall through to anchor download below.
            }

            fallbackDownload(url, filename);
            return true;
        };

        const captureActiveVideo = () => {
            if (!ctx.isFeatureEnabled()) {
                return;
            }
            const activeVideo = findActiveVideo();
            if (!activeVideo) {
                return;
            }
            captureVideoFrame(activeVideo).catch((error) => {
                console.error('[GestureExtension] Capture failed', error);
            });
        };

        return {
            findActiveVideo,
            captureActiveVideo
        };
    };
})();


/* --- Source: content/video-screenshot/capture-region.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});

    videoScreenshot.createCaptureRegion = (ctx) => {
        const { CONFIG, buildFilename, fallbackDownload } = videoScreenshot;

        let regionModeActive = false;
        let regionDragging = false;
        let regionStart = null;
        let regionOverlay = null;
        let regionShade = null;
        let regionBox = null;
        let regionHint = null;
        let regionCompleteHandler = null;

        const canUseRegionScreenshot = () => window.top === window;

        const waitForNextPaint = () =>
            new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

        const createImageFromUrl = (url) =>
            new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Cannot load captured screenshot'));
                image.src = url;
            });

        const normalizeRegion = (start, end) => {
            const left = Math.max(0, Math.min(start.x, end.x));
            const top = Math.max(0, Math.min(start.y, end.y));
            const right = Math.min(window.innerWidth, Math.max(start.x, end.x));
            const bottom = Math.min(window.innerHeight, Math.max(start.y, end.y));
            return {
                left,
                top,
                width: Math.max(0, right - left),
                height: Math.max(0, bottom - top)
            };
        };

        const updateRegionBox = (region) => {
            if (!regionBox) {
                return;
            }
            regionBox.style.display = region.width && region.height ? 'block' : 'none';
            regionBox.style.left = `${region.left}px`;
            regionBox.style.top = `${region.top}px`;
            regionBox.style.width = `${region.width}px`;
            regionBox.style.height = `${region.height}px`;
        };

        const removeRegionOverlay = () => {
            regionOverlay?.remove();
            regionOverlay = null;
            regionShade = null;
            regionBox = null;
            regionHint = null;
            regionModeActive = false;
            regionDragging = false;
            regionStart = null;
            regionCompleteHandler = null;
        };

        const downloadRegion = async (region) => {
            if (region.width < CONFIG.minRegionSize || region.height < CONFIG.minRegionSize) {
                return;
            }

            await waitForNextPaint();
            const response = await ext.shared.tabActions.captureVisibleTab();
            if (!response?.ok || !response.url) {
                throw new Error(response?.error || 'Capture visible tab failed');
            }

            const image = await createImageFromUrl(response.url);
            const scaleX = image.naturalWidth / window.innerWidth;
            const scaleY = image.naturalHeight / window.innerHeight;
            const sx = Math.round(region.left * scaleX);
            const sy = Math.round(region.top * scaleY);
            const sw = Math.max(1, Math.round(region.width * scaleX));
            const sh = Math.max(1, Math.round(region.height * scaleY));

            const canvas = document.createElement('canvas');
            canvas.width = sw;
            canvas.height = sh;
            const canvasContext = canvas.getContext('2d');
            if (!canvasContext) {
                throw new Error('Canvas 2D context unavailable');
            }

            canvasContext.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
            const url = canvas.toDataURL('image/png');
            const filename = buildFilename();

            try {
                const downloadResponse = await ext.shared.tabActions.downloadDataUrl(url, filename);
                if (downloadResponse?.ok) {
                    return;
                }
            } catch {
                // Fall through to anchor download below.
            }

            fallbackDownload(url, filename);
        };

        const startRegionMode = ({ hintText, onComplete }) => {
            if (!ctx.isFeatureEnabled() || !canUseRegionScreenshot() || regionModeActive) {
                return;
            }

            regionModeActive = true;
            regionCompleteHandler = typeof onComplete === 'function' ? onComplete : null;
            regionOverlay = document.createElement('div');
            regionOverlay.className = 'gesture-screen-screenshot-overlay';
            regionShade = document.createElement('div');
            regionShade.className = 'gesture-screen-screenshot-shade';
            regionBox = document.createElement('div');
            regionBox.className = 'gesture-screen-screenshot-box';
            regionHint = document.createElement('div');
            regionHint.className = 'gesture-screen-screenshot-hint';
            regionHint.textContent = hintText || 'Giữ chuột trái và kéo để chọn vùng';

            regionOverlay.append(regionShade, regionBox, regionHint);
            document.documentElement.appendChild(regionOverlay);

            regionOverlay.addEventListener('pointerdown', onRegionPointerDown, true);
            regionOverlay.addEventListener('pointermove', onRegionPointerMove, true);
            regionOverlay.addEventListener('pointerup', onRegionPointerUp, true);
            regionOverlay.addEventListener('pointercancel', onRegionPointerCancel, true);
        };

        const onRegionPointerDown = (event) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            regionDragging = true;
            regionStart = { x: event.clientX, y: event.clientY };
            regionHint?.remove();
            regionHint = null;
            regionOverlay?.setPointerCapture?.(event.pointerId);
            updateRegionBox({ left: event.clientX, top: event.clientY, width: 0, height: 0 });
        };

        const onRegionPointerMove = (event) => {
            if (!regionDragging || !regionStart) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            updateRegionBox(normalizeRegion(regionStart, { x: event.clientX, y: event.clientY }));
        };

        const onRegionPointerUp = (event) => {
            if (!regionDragging || !regionStart || event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            const region = normalizeRegion(regionStart, { x: event.clientX, y: event.clientY });
            const onComplete = regionCompleteHandler;
            removeRegionOverlay();
            onComplete?.(region);
        };

        const onRegionPointerCancel = (event) => {
            event.preventDefault();
            event.stopPropagation();
            removeRegionOverlay();
        };

        const isRegionModeActive = () => regionModeActive;

        return {
            startRegionMode,
            downloadRegion,
            removeRegionOverlay,
            canUseRegionScreenshot,
            isRegionModeActive
        };
    };
})();


/* --- Source: content/video-screenshot/screen-recorder.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});

    videoScreenshot.createScreenRecorder = (ctx, regionCapture) => {
        const { CONFIG, buildRecordingFilename, fallbackDownload } = videoScreenshot;

        let recorder = null;
        let recorderStream = null;
        let recorderChunks = [];
        let recorderBadge = null;
        let recorderCanvas = null;
        let recorderContext = null;
        let recorderVideo = null;
        let recorderFrameId = 0;
        let recorderControl = null;
        let recorderPauseButton = null;
        let recorderStopButton = null;
        let recorderBorder = null;

        const canUseScreenRecorder = () =>
            window.top === window && !!navigator.mediaDevices?.getDisplayMedia && typeof MediaRecorder !== 'undefined';

        const getRecorderMimeType = () => {
            const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
            return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
        };

        const showRecorderBadge = () => {
            if (recorderBadge) {
                return;
            }
            recorderBadge = document.createElement('div');
            recorderBadge.className = 'gesture-screen-record-badge';
            recorderBadge.textContent = 'Đang ghi hình - F8 để dừng';
            document.documentElement.appendChild(recorderBadge);
        };

        const hideRecorderBadge = () => {
            recorderBadge?.remove();
            recorderBadge = null;
        };

        const hideRecorderControl = () => {
            recorderControl?.remove();
            recorderControl = null;
            recorderPauseButton = null;
            recorderStopButton = null;
        };

        const hideRecorderBorder = () => {
            recorderBorder?.remove();
            recorderBorder = null;
        };

        const showRecorderBorder = (region) => {
            hideRecorderBorder();
            recorderBorder = document.createElement('div');
            recorderBorder.className = 'gesture-screen-record-border';
            recorderBorder.style.left = `${region.left}px`;
            recorderBorder.style.top = `${region.top}px`;
            recorderBorder.style.width = `${region.width}px`;
            recorderBorder.style.height = `${region.height}px`;
            document.documentElement.appendChild(recorderBorder);
        };

        const getRecorderControlPosition = (region) => {
            const width = CONFIG.recordControlSize * 2 + 14;
            const height = CONFIG.recordControlSize + 8;
            const gap = CONFIG.recordControlGap;
            const centeredLeft = region.left + (region.width - width) / 2;
            if (region.top >= height + gap) {
                return {
                    left: Math.min(window.innerWidth - width, Math.max(0, centeredLeft)),
                    top: region.top - height - gap
                };
            }
            if (window.innerHeight - region.top - region.height >= height + gap) {
                return {
                    left: Math.min(window.innerWidth - width, Math.max(0, centeredLeft)),
                    top: region.top + region.height + gap
                };
            }
            if (window.innerWidth - region.left - region.width >= width + gap) {
                return {
                    left: region.left + region.width + gap,
                    top: Math.min(window.innerHeight - height, Math.max(0, region.top))
                };
            }
            if (region.left >= width + gap) {
                return {
                    left: region.left - width - gap,
                    top: Math.min(window.innerHeight - height, Math.max(0, region.top))
                };
            }
            return {
                left: Math.min(window.innerWidth - width, Math.max(0, centeredLeft)),
                top: 0
            };
        };

        const syncRecorderPauseButton = () => {
            if (!recorderPauseButton || !recorder) {
                return;
            }
            const paused = recorder.state === 'paused';
            recorderPauseButton.classList.toggle('is-paused', paused);
            recorderPauseButton.title = paused ? 'Tiếp tục ghi hình' : 'Tạm dừng ghi hình';
            recorderPauseButton.setAttribute('aria-label', paused ? 'Tiếp tục ghi hình' : 'Tạm dừng ghi hình');
            if (recorderBadge) {
                recorderBadge.textContent = paused ? 'Đang tạm dừng - F8 để dừng' : 'Đang ghi hình - F8 để dừng';
            }
        };

        const showRecorderControl = (region) => {
            hideRecorderControl();
            const position = getRecorderControlPosition(region);
            recorderControl = document.createElement('div');
            recorderControl.className = 'gesture-screen-record-control';
            recorderControl.style.left = `${position.left}px`;
            recorderControl.style.top = `${position.top}px`;

            recorderPauseButton = document.createElement('button');
            recorderPauseButton.type = 'button';
            recorderPauseButton.className = 'gesture-screen-record-button gesture-screen-record-pause';
            recorderStopButton = document.createElement('button');
            recorderStopButton.type = 'button';
            recorderStopButton.className = 'gesture-screen-record-button gesture-screen-record-stop';
            recorderStopButton.title = 'Dừng ghi hình (F8)';
            recorderStopButton.setAttribute('aria-label', 'Dừng ghi hình');

            recorderControl.addEventListener(
                'pointerdown',
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                },
                true
            );
            recorderPauseButton.addEventListener(
                'click',
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleScreenRecordingPause();
                },
                true
            );
            recorderStopButton.addEventListener(
                'click',
                (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    stopScreenRecording();
                },
                true
            );
            recorderControl.append(recorderPauseButton, recorderStopButton);
            document.documentElement.appendChild(recorderControl);
            syncRecorderPauseButton();
        };

        const downloadRecording = (blob) => {
            if (!blob?.size) {
                return;
            }
            const url = URL.createObjectURL(blob);
            fallbackDownload(url, buildRecordingFilename());
            window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        };

        const cleanupRecorder = () => {
            recorderStream?.getTracks?.().forEach((track) => {
                try {
                    track.stop();
                } catch {
                    // Track may already be stopped by the browser UI.
                }
            });
            if (recorderFrameId) {
                cancelAnimationFrame(recorderFrameId);
            }
            recorder = null;
            recorderStream = null;
            recorderChunks = [];
            recorderCanvas = null;
            recorderContext = null;
            recorderVideo = null;
            recorderFrameId = 0;
            hideRecorderBadge();
            hideRecorderControl();
            hideRecorderBorder();
        };

        const stopScreenRecording = () => {
            if (!recorder) {
                cleanupRecorder();
                return;
            }
            if (recorder.state !== 'inactive') {
                try {
                    recorder.requestData();
                } catch {
                    // Some engines throw if no data is currently buffered.
                }
                recorder.stop();
                return;
            }
            cleanupRecorder();
        };

        const toggleScreenRecordingPause = () => {
            if (!recorder) {
                return;
            }
            if (recorder.state === 'recording') {
                recorder.pause();
            } else if (recorder.state === 'paused') {
                recorder.resume();
            }
            syncRecorderPauseButton();
        };

        const startScreenRecording = async (region) => {
            if (!ctx.isFeatureEnabled() || !canUseScreenRecorder() || recorder) {
                return;
            }
            if (region.width < CONFIG.minRecordWidth || region.height < CONFIG.minRecordHeight) {
                return;
            }

            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    displaySurface: 'browser',
                    frameRate: 30
                },
                preferCurrentTab: true,
                audio: false
            });
            const mimeType = getRecorderMimeType();
            const options = mimeType ? { mimeType } : undefined;
            recorderStream = stream;
            recorderChunks = [];
            recorderVideo = document.createElement('video');
            recorderVideo.muted = true;
            recorderVideo.playsInline = true;
            recorderVideo.srcObject = stream;
            await new Promise((resolve, reject) => {
                recorderVideo.onloadedmetadata = resolve;
                recorderVideo.onerror = () => reject(new Error('Cannot load screen recording stream'));
            });
            await recorderVideo.play();

            const scaleX = recorderVideo.videoWidth / window.innerWidth;
            const scaleY = recorderVideo.videoHeight / window.innerHeight;
            const sx = Math.round(region.left * scaleX);
            const sy = Math.round(region.top * scaleY);
            const sw = Math.max(1, Math.round(region.width * scaleX));
            const sh = Math.max(1, Math.round(region.height * scaleY));
            recorderCanvas = document.createElement('canvas');
            recorderCanvas.width = sw;
            recorderCanvas.height = sh;
            recorderContext = recorderCanvas.getContext('2d');
            if (!recorderContext) {
                throw new Error('Canvas 2D context unavailable');
            }

            const drawFrame = () => {
                if (!recorderVideo || !recorderContext || !recorderCanvas) {
                    return;
                }
                recorderContext.drawImage(recorderVideo, sx, sy, sw, sh, 0, 0, recorderCanvas.width, recorderCanvas.height);
                recorderFrameId = requestAnimationFrame(drawFrame);
            };
            drawFrame();

            recorder = new MediaRecorder(recorderCanvas.captureStream(30), options);

            recorder.addEventListener('dataavailable', (event) => {
                if (event.data?.size) {
                    recorderChunks.push(event.data);
                }
            });
            recorder.addEventListener(
                'stop',
                () => {
                    const blob = new Blob(recorderChunks, { type: mimeType || 'video/webm' });
                    cleanupRecorder();
                    downloadRecording(blob);
                },
                { once: true }
            );
            recorder.addEventListener('pause', syncRecorderPauseButton);
            recorder.addEventListener('resume', syncRecorderPauseButton);
            stream.getTracks().forEach((track) => {
                track.addEventListener('ended', stopScreenRecording, { once: true });
            });

            recorder.start(1000);
            showRecorderBadge();
            showRecorderBorder(region);
            showRecorderControl(region);
        };

        const startRecordRegionMode = () => {
            if (!ctx.isFeatureEnabled() || !canUseScreenRecorder() || recorder || regionCapture.isRegionModeActive()) {
                return;
            }
            regionCapture.startRegionMode({
                hintText: 'Giữ chuột trái và kéo để chọn vùng ghi hình',
                onComplete: (region) => {
                    startScreenRecording(region).catch((error) => {
                        cleanupRecorder();
                        console.error('[GestureExtension] Screen recording failed', error);
                    });
                }
            });
        };

        const toggleScreenRecording = () => {
            if (recorder) {
                stopScreenRecording();
                return;
            }
            startRecordRegionMode();
        };

        const isRecording = () => !!recorder;

        return {
            toggleScreenRecording,
            stopScreenRecording,
            canUseScreenRecorder,
            isRecording
        };
    };
})();


/* --- Source: content/video-screenshot/interactions.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});

    videoScreenshot.createInteractions = (ctx, captureVideo, captureRegion, screenRecorder) => {
        const { CONFIG } = videoScreenshot;

        const bindKeyboardShortcut = () => {
            const onKeyDown = (event) => {
                if (captureRegion.isRegionModeActive() && event.key === 'Escape') {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    captureRegion.removeRegionOverlay();
                    return;
                }
                if (screenRecorder.isRecording() && event.code === CONFIG.recordShortcutCode) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    screenRecorder.stopScreenRecording();
                    return;
                }

                const target = event.target;
                if (
                    !(target instanceof HTMLElement) ||
                    target.tagName === 'INPUT' ||
                    target.tagName === 'TEXTAREA' ||
                    target.isContentEditable ||
                    event.ctrlKey ||
                    event.altKey ||
                    event.metaKey
                ) {
                    return;
                }
                if (event.code === CONFIG.regionShortcutCode) {
                    if (!ctx.isFeatureEnabled() || !captureRegion.canUseRegionScreenshot()) {
                        return;
                    }
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    captureRegion.startRegionMode({
                        hintText: 'Giữ chuột trái và kéo để chụp vùng',
                        onComplete: (region) => {
                            captureRegion.downloadRegion(region).catch((error) => {
                                console.error('[GestureExtension] Region capture failed', error);
                            });
                        }
                    });
                    return;
                }
                if (event.code === CONFIG.recordShortcutCode) {
                    if (!ctx.isFeatureEnabled() || !screenRecorder.canUseScreenRecorder()) {
                        return;
                    }
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    screenRecorder.toggleScreenRecording();
                    return;
                }
                if (event.key.toLowerCase() !== CONFIG.shortcutKey) {
                    return;
                }
                if (!ctx.isFeatureEnabled()) {
                    return;
                }
                if (!captureVideo.findActiveVideo()) {
                    return;
                }
                event.preventDefault();
                captureVideo.captureActiveVideo();
            };
            document.addEventListener('keydown', onKeyDown, true);
            return () => document.removeEventListener('keydown', onKeyDown, true);
        };

        return {
            bindKeyboardShortcut
        };
    };
})();


/* --- Source: content/video-screenshot/controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});

    videoScreenshot.createController = (context) => {
        const { ensureStyles } = videoScreenshot;

        let observer = null;
        let removeShortcutListener = () => {};
        let syncTimer = 0;

        const isFeatureEnabled = () => context?.getConfig?.()?.videoScreenshot?.enabled !== false;

        // Pass a proxy context to modules so they can always check feature flag
        const ctx = {
            isFeatureEnabled
        };

        const isExcludedPage = () => /(^|\.)tiktok\.com$/i.test(window.location.hostname);

        if (isExcludedPage()) {
            return {
                onConfigChange() {},
                destroy() {}
            };
        }

        const captureVideo = videoScreenshot.createCaptureVideo(ctx);
        const captureRegion = videoScreenshot.createCaptureRegion(ctx);
        const screenRecorder = videoScreenshot.createScreenRecorder(ctx, captureRegion);
        const trigger = videoScreenshot.createTrigger(ctx, captureVideo);
        const interactions = videoScreenshot.createInteractions(ctx, captureVideo, captureRegion, screenRecorder);

        const queueSyncTrigger = () => {
            if (syncTimer) {
                return;
            }
            syncTimer = window.setTimeout(() => {
                syncTimer = 0;
                trigger.syncTrigger();
            }, 80);
        };

        const startObserver = () => {
            observer = new MutationObserver(() => {
                queueSyncTrigger();
            });
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        };

        ensureStyles();
        trigger.ensureTrigger();
        trigger.syncTrigger();

        removeShortcutListener = interactions.bindKeyboardShortcut();
        window.addEventListener('resize', queueSyncTrigger);
        window.addEventListener('scroll', queueSyncTrigger, true);

        if (document.body) {
            startObserver();
        } else {
            window.addEventListener(
                'DOMContentLoaded',
                () => {
                    trigger.syncTrigger();
                    startObserver();
                },
                { once: true }
            );
        }

        return {
            onConfigChange() {
                if (!isFeatureEnabled()) {
                    captureRegion.removeRegionOverlay();
                    screenRecorder.stopScreenRecording();
                }
                queueSyncTrigger();
            },
            destroy() {
                observer?.disconnect();
                removeShortcutListener();
                captureRegion.removeRegionOverlay();
                screenRecorder.stopScreenRecording();
                window.removeEventListener('resize', queueSyncTrigger);
                window.removeEventListener('scroll', queueSyncTrigger, true);
                window.clearTimeout(syncTimer);
                trigger.destroy();
            }
        };
    };
})();


/* --- Source: content/video-screenshot/index.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    ext.features.videoScreenshot = {
        shouldRun: ({ runtime }) => runtime.isHttpPage() && runtime.isHtmlDocument(),
        init: (context) => {
            return ext.videoScreenshot.createController(context);
        }
    };
})();


/* --- Source: content/video-floating/constants.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.FVP_IFRAME_BRIDGE = 'fvp-page-bridge';
    videoFloating.FIT_MODES = Object.freeze(['contain', 'cover', 'fill']);
    videoFloating.FIT_ICONS = Object.freeze(['⤢', '🔍', '↔']);
    videoFloating.ZOOM_LEVELS = Object.freeze([1, 1.5, 2, 3]);
    videoFloating.ZOOM_ICONS = Object.freeze(['+', '++', '+++', '-']);
    videoFloating.VIDEO_CHECK_INTERVAL = 2000;
    videoFloating.WHEEL_GESTURE = Object.freeze({
        switchThreshold: 24,
        switchCooldownMs: 90,
        idleMs: 180,
        seekSecondsPerPixel: 0.07
    });
    videoFloating.VIDEO_IFRAME_PATTERN =
        /youtube\.com|youtu\.be|youtube-nocookie\.com|player\.vimeo\.com|vimeo\.com|dailymotion\.com|twitch\.tv|tiktok\.com|facebook\.com|jwplayer|brightcove|wistia|v\.redd\.it|redditmedia\.com|reddit\.com\/media|embed|player|video/i;
    videoFloating.DEFAULT_VIDEO_FLOATING_CONFIG = Object.freeze({
        enabled: true,
        swipeLong: 0.3,
        swipeShort: 0.15,
        shortThreshold: 200,
        minSwipeDistance: 30,
        verticalTolerance: 80,
        diagonalThreshold: 1.5,
        realtimePreview: true,
        throttle: 15,
        forwardStep: 5,
        hotkeys: true,
        noticeFontSize: 14,
        backgroundSeekExcludedHosts: []
    });
})();


/* --- Source: content/video-floating/core/state.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.core = videoFloating.core || {};

    videoFloating.core.createContext = () => {
        const ctx = {
            ui: {
                box: null,
                iconRef: null,
                menuRef: null
            },
            floating: {
                curVid: null,
                origPar: null,
                ph: null,
                videoSequence: [],
                fitIdx: 0,
                zoomIdx: 0,
                rotationAngle: 0
            },
            iframe: {
                floatedIframe: null,
                origPar: null,
                ph: null,
                origStyle: '',
                statePollTimer: 0,
                videoMap: new Map(),
                playbackState: {
                    hasVideo: false,
                    paused: true,
                    muted: false,
                    volume: 1,
                    playbackRate: 1,
                    currentTime: 0,
                    duration: 0,
                    bufferedEnd: 0,
                    fitIdx: 0,
                    zoomIdx: 0,
                    rotationAngle: 0
                }
            },
            fitIdx: 0,
            zoomIdx: 0,
            rotationAngle: 0,
            state: {
                isDrag: false,
                isResize: false,
                startX: 0,
                startY: 0,
                initX: 0,
                initY: 0,
                initW: 0,
                initH: 0,
                resizeDir: '',
                idleTimer: null,
                rafId: null,
                isSeeking: false,
                seekDragActive: false,
                seekApplyRaf: 0,
                pendingSeekRatio: null,
                seekPreviewRatio: null,
                lastSeekCommitAt: 0,
                isSwitchingVideo: false,
                switchTransition: null,
                transitionTimer: 0
            },
            cleanup: []
        };

        Object.defineProperties(ctx, {
            box: {
                get() {
                    return ctx.ui.box;
                },
                set(value) {
                    ctx.ui.box = value;
                }
            },
            iconRef: {
                get() {
                    return ctx.ui.iconRef;
                },
                set(value) {
                    ctx.ui.iconRef = value;
                }
            },
            menuRef: {
                get() {
                    return ctx.ui.menuRef;
                },
                set(value) {
                    ctx.ui.menuRef = value;
                }
            },
            curVid: {
                get() {
                    return ctx.floating.curVid;
                },
                set(value) {
                    ctx.floating.curVid = value;
                }
            },
            origPar: {
                get() {
                    return ctx.floating.origPar;
                },
                set(value) {
                    ctx.floating.origPar = value;
                }
            },
            ph: {
                get() {
                    return ctx.floating.ph;
                },
                set(value) {
                    ctx.floating.ph = value;
                }
            },
            videoSequence: {
                get() {
                    return ctx.floating.videoSequence;
                },
                set(value) {
                    ctx.floating.videoSequence = value;
                }
            },
            fitIdx: {
                get() {
                    return ctx.floating.fitIdx;
                },
                set(value) {
                    ctx.floating.fitIdx = value;
                }
            },
            zoomIdx: {
                get() {
                    return ctx.floating.zoomIdx;
                },
                set(value) {
                    ctx.floating.zoomIdx = value;
                }
            },
            rotationAngle: {
                get() {
                    return ctx.floating.rotationAngle;
                },
                set(value) {
                    ctx.floating.rotationAngle = value;
                }
            },
            floatedIframe: {
                get() {
                    return ctx.iframe.floatedIframe;
                },
                set(value) {
                    ctx.iframe.floatedIframe = value;
                }
            },
            iframeOrigPar: {
                get() {
                    return ctx.iframe.origPar;
                },
                set(value) {
                    ctx.iframe.origPar = value;
                }
            },
            iframePh: {
                get() {
                    return ctx.iframe.ph;
                },
                set(value) {
                    ctx.iframe.ph = value;
                }
            },
            iframeOrigStyle: {
                get() {
                    return ctx.iframe.origStyle;
                },
                set(value) {
                    ctx.iframe.origStyle = value;
                }
            },
            iframeStatePollTimer: {
                get() {
                    return ctx.iframe.statePollTimer;
                },
                set(value) {
                    ctx.iframe.statePollTimer = value;
                }
            },
            iframeVideoMap: {
                get() {
                    return ctx.iframe.videoMap;
                }
            },
            iframePlaybackState: {
                get() {
                    return ctx.iframe.playbackState;
                }
            }
        });

        return ctx;
    };
})();


/* --- Source: content/video-floating/core/utils.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.core = videoFloating.core || {};

    const viewport = ext?.shared?.viewportCore;
    const touch = ext?.shared?.touchCore;

    const el = (tag, cls, html) => {
        const element = document.createElement(tag);
        if (cls) element.className = cls;
        if (html) element.innerHTML = html;
        return element;
    };

    const $ = (id) => document.getElementById(id);

    const getCoord = (event) => touch?.getPrimaryPoint?.(event) || { x: 0, y: 0 };

    const formatTime = (seconds) => `${Math.floor(seconds / 60)}.${(Math.floor(seconds) % 60).toString().padStart(2, '0')}`;

    const clamp = (value, min, max) => viewport?.clamp?.(value, min, max) ?? Math.max(min, Math.min(max, value));

    const getRect = (node) => node?.getBoundingClientRect?.() || { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };

    const queryAllDeep = (selector, root = document) => {
        const results = [];
        const visited = new Set();
        const walk = (currentRoot) => {
            if (!currentRoot || visited.has(currentRoot)) {
                return;
            }
            visited.add(currentRoot);

            if (typeof currentRoot.querySelectorAll === 'function') {
                for (const node of currentRoot.querySelectorAll(selector)) {
                    results.push(node);
                }
                for (const host of currentRoot.querySelectorAll('*')) {
                    if (host.shadowRoot) {
                        walk(host.shadowRoot);
                    }
                }
            }
        };

        walk(root);
        return results;
    };

    const getViewportIntersection = (rect) => {
        if (!rect?.width || !rect?.height) {
            return { area: 0, ratio: 0 };
        }
        const left = Math.max(0, rect.left);
        const right = Math.min(window.innerWidth || 0, rect.right);
        const top = Math.max(0, rect.top);
        const bottom = Math.min(window.innerHeight || 0, rect.bottom);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        const area = width * height;
        return {
            area,
            ratio: area / Math.max(1, rect.width * rect.height)
        };
    };

    const getViewportCenterDistance = (rect) => {
        const centerX = (window.innerWidth || 0) / 2;
        const centerY = (window.innerHeight || 0) / 2;
        const videoX = rect.left + rect.width / 2;
        const videoY = rect.top + rect.height / 2;
        return Math.hypot(videoX - centerX, videoY - centerY);
    };

    const getTopVideoAtPoint = (x, y) => {
        if (typeof document.elementsFromPoint === 'function') {
            for (const node of document.elementsFromPoint(x, y)) {
                if (!(node instanceof Element)) continue;
                const video = node.tagName === 'VIDEO' || node.tagName === 'AUDIO' ? node : node.closest?.('video, audio');
                if (video?.isConnected && !video.closest('#fvp-wrapper')) return video;
            }
        }
        return null;
    };

    const isPointInFloatingUI = (x, y) => {
        for (const id of ['fvp-container', 'fvp-master-icon', 'fvp-menu']) {
            const node = $(id);
            if (node?.isConnected) {
                const rect = getRect(node);
                if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return true;
                }
            }
        }
        return false;
    };

    const getFullscreenEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    videoFloating.core.utils = {
        el,
        $,
        getCoord,
        formatTime,
        clamp,
        getRect,
        queryAllDeep,
        getViewportIntersection,
        getViewportCenterDistance,
        getTopVideoAtPoint,
        isPointInFloatingUI,
        getFullscreenEl
    };
})();


/* --- Source: content/video-floating/core/config.js --- */
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
        TOUCH_SWITCH_VIDEO_EVENT: 'fvp-touch-switch-video',
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


/* --- Source: content/video-floating/media/detector.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.media = videoFloating.media || {};

    const { getRect, getViewportIntersection, getViewportCenterDistance, getTopVideoAtPoint, queryAllDeep, getFullscreenEl } =
        videoFloating.core.utils || {};
    const { hasVisibleSize } = ext?.shared?.domUtils || {};

    const isTopVideoCandidate = (video, rect = getRect(video)) => {
        if (!rect?.width || !rect?.height) return false;
        const points = [
            [rect.left + rect.width / 2, rect.top + rect.height / 2],
            [rect.left + rect.width / 2, rect.top + Math.min(rect.height * 0.35, rect.height - 1)],
            [rect.left + rect.width / 2, rect.top + Math.min(rect.height * 0.65, rect.height - 1)]
        ];
        return points.some(([x, y]) => {
            if (x < 0 || y < 0 || x > (window.innerWidth || 0) || y > (window.innerHeight || 0)) return false;
            return getTopVideoAtPoint(x, y) === video;
        });
    };

    const isVideoActivelyPlaying = (video) => !!(video && !video.paused && !video.ended && video.readyState > 1);

    const getVideoPriority = (video) => {
        const rect = getRect(video);
        const viewport = getViewportIntersection(rect);
        const visibleArea = viewport.area || Math.max(0, rect.width * rect.height);
        const fullscreenEl = getFullscreenEl();
        let score = visibleArea;

        if (isVideoActivelyPlaying(video)) score += 1000000000;
        else if (video?.paused === false) score += 500000000;
        if (video === document.pictureInPictureElement) score += 900000000;
        if (fullscreenEl && (fullscreenEl === video || fullscreenEl.contains?.(video))) score += 900000000;
        if (isTopVideoCandidate(video, rect)) score += 120000000;
        score += viewport.ratio * 80000000;
        if (video?.currentTime > 0) score += 10000000;
        if (video?.readyState > 0) score += video.readyState * 1000000;
        score -= getViewportCenterDistance(rect) * 1000;
        return score;
    };

    const compareVideoPriority = (left, right) => getVideoPriority(right) - getVideoPriority(left);

    const isDetectableVideo = (video) => {
        if (!video || !video.isConnected) return false;
        if (video.tagName === 'AUDIO') return true;
        if (location.hostname.includes('music.youtube.com')) return true;
        if (video.currentTime > 0 || (Number.isFinite(video.duration) && video.duration > 0 && !video.paused)) return true;
        if (hasVisibleSize) return hasVisibleSize(video);
        const rect = getRect(video);
        return rect.width > 0 && rect.height > 0;
    };

    const AUTO_SYNC_MIN_VISIBLE_AREA = 42000;
    const AUTO_SYNC_MIN_SHORT_SIDE = 128;
    const AUTO_SYNC_MIN_LONG_SIDE = 220;
    const AUTO_SYNC_REFERENCE_AREA_RATIO = 0.45;
    const AUTO_SYNC_REFERENCE_AREA_FLOOR = 90000;

    const isVideoAutoSyncCandidate = (video, { referenceRect = null } = {}) => {
        if (!isDetectableVideo(video)) return false;
        try {
            const style = window.getComputedStyle(video);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        } catch {
            /* ignore */
        }

        const rect = getRect(video);
        const elementArea = Math.max(0, rect.width * rect.height);
        const viewport = getViewportIntersection(rect);
        const visibleArea = viewport.area || (viewport.ratio > 0 ? elementArea : 0);
        const shortSide = Math.min(rect.width, rect.height);
        const longSide = Math.max(rect.width, rect.height);
        if (visibleArea < AUTO_SYNC_MIN_VISIBLE_AREA || shortSide < AUTO_SYNC_MIN_SHORT_SIDE || longSide < AUTO_SYNC_MIN_LONG_SIDE)
            return false;

        const referenceArea = referenceRect?.width && referenceRect?.height ? Math.max(0, referenceRect.width * referenceRect.height) : 0;
        if (referenceArea && visibleArea < AUTO_SYNC_REFERENCE_AREA_FLOOR && visibleArea < referenceArea * AUTO_SYNC_REFERENCE_AREA_RATIO) {
            return false;
        }

        return true;
    };

    const getVideoSourceCandidate = (video) => {
        const source = video?.querySelector?.('source[src], source[data-source], source[data-src], source[data-video-src]');
        return (
            video?.currentSrc ||
            video?.src ||
            video?.getAttribute?.('src') ||
            video?.dataset?.source ||
            video?.dataset?.src ||
            video?.dataset?.videoSrc ||
            video?.getAttribute?.('data-source') ||
            video?.getAttribute?.('data-src') ||
            video?.getAttribute?.('data-video-src') ||
            source?.src ||
            source?.dataset?.source ||
            source?.dataset?.src ||
            source?.dataset?.videoSrc ||
            source?.getAttribute?.('data-source') ||
            source?.getAttribute?.('data-src') ||
            source?.getAttribute?.('data-video-src') ||
            ''
        );
    };

    const getDirectVideoKey = (video, rect = getRect(video), sourceCandidate = getVideoSourceCandidate(video)) =>
        [sourceCandidate, Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)].join('|');

    const collectDirectVideos = () => {
        const unique = new Map();
        for (const video of queryAllDeep('video, audio')) {
            if (!video?.isConnected || video.closest('#fvp-wrapper')) continue;

            if (!isDetectableVideo(video)) continue;

            try {
                const style = window.getComputedStyle(video);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
            } catch {
                /* ignore */
            }

            const isYouTube = location.hostname.includes('youtube.com') || location.hostname.includes('youtube-nocookie.com');
            if (isYouTube) {
                const isMainPlayer = video.classList.contains('html5-main-video') || video.closest('#movie_player');
                if (!isMainPlayer) continue;
            }

            const rect = getRect(video);
            const sourceCandidate = getVideoSourceCandidate(video);
            const hasMediaSource = Boolean(sourceCandidate);
            const hasPlaybackState = Number.isFinite(video.duration) || video.readyState > 0 || video.currentTime > 0;
            const largeEnough = rect.width >= 160 && rect.height >= 90;
            if (!(hasMediaSource || hasPlaybackState || largeEnough)) continue;

            const key = getDirectVideoKey(video, rect, sourceCandidate);
            if (!unique.has(key)) {
                unique.set(key, video);
            }
        }

        return [...unique.values()];
    };

    const getDirectVideoSequence = () => collectDirectVideos();
    const getDirectVideos = () => collectDirectVideos().sort(compareVideoPriority);

    const getOverlapRatio = (firstRect, secondRect) => {
        const left = Math.max(firstRect.left, secondRect.left);
        const right = Math.min(firstRect.right, secondRect.right);
        const top = Math.max(firstRect.top, secondRect.top);
        const bottom = Math.min(firstRect.bottom, secondRect.bottom);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        const overlapArea = width * height;
        const baseArea = Math.max(1, firstRect.width * firstRect.height);
        return overlapArea / baseArea;
    };

    const isVisibleIframe = (iframe) => {
        if (!iframe?.isConnected || iframe.closest('#fvp-wrapper')) return false;
        const rect = getRect(iframe);
        return rect.width >= 160 && rect.height >= 90;
    };

    const getIframeSrc = (iframe) => {
        const raw = iframe?.src || iframe?.getAttribute?.('src') || '';
        if (!raw) return '';
        try {
            return new URL(raw, location.href).href;
        } catch {
            return raw;
        }
    };

    const isRedundantIframeCandidate = (iframe, directVideos = getDirectVideos()) => {
        if (!iframe?.isConnected || !directVideos.length) return false;

        let host = '';
        try {
            host = new URL(getIframeSrc(iframe)).hostname;
        } catch {
            /* ignore */
        }

        const iframeRect = getRect(iframe);
        if (!iframeRect.width || !iframeRect.height) return true;

        return directVideos.some((video) => {
            const videoRect = getRect(video);
            if (!videoRect.width || !videoRect.height) return false;

            const samePlatform =
                (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(host) && /(^|\.)youtube\.com$/i.test(location.hostname)) ||
                (/redditmedia\.com|v\.redd\.it|reddit\.com/i.test(host) && /(^|\.)reddit\.com$/i.test(location.hostname));

            return samePlatform && getOverlapRatio(iframeRect, videoRect) >= 0.6;
        });
    };

    const isLikelyVideoIframe = (iframe) => {
        if (!isVisibleIframe(iframe)) return false;
        const src = getIframeSrc(iframe);
        if (!src || src === 'about:blank') return false;
        const attrs = [
            src,
            iframe.title || '',
            iframe.getAttribute?.('aria-label') || '',
            iframe.getAttribute?.('name') || '',
            iframe.id || '',
            iframe.className || ''
        ].join(' ');
        return videoFloating.VIDEO_IFRAME_PATTERN.test(attrs);
    };

    const getTrackedIframeEntries = (map) => {
        const directVideos = getDirectVideos();
        return [...map.entries()].filter(([iframe, count]) => {
            if (!iframe?.isConnected || !(count > 0)) return false;
            if (!isLikelyVideoIframe(iframe)) return false;
            if (isRedundantIframeCandidate(iframe, directVideos)) return false;
            return true;
        });
    };

    videoFloating.media.detector = {
        isDetectableVideo,
        getDirectVideoSequence,
        getDirectVideos,
        isVisibleIframe,
        getIframeSrc,
        isLikelyVideoIframe,
        getTrackedIframeEntries,
        compareVideoPriority,
        isVideoActivelyPlaying,
        isVideoAutoSyncCandidate
    };
})();


/* --- Source: content/video-floating/media/auto-sync.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.media = videoFloating.media || {};

    videoFloating.media.createAutoSync = (ctx) => {
        const { getRect, $ } = videoFloating.core.utils;

        let floatingSession = null;
        let lastAutoSyncAt = 0;

        const setFloatingSession = (fs) => {
            floatingSession = fs;
        };

        const canAutoSyncFloatingVideo = () =>
            videoFloating.core.config.isFeatureEnabled() &&
            !ctx.floatedIframe &&
            !!ctx.curVid &&
            ctx.box?.style.display !== 'none' &&
            !ctx.state.isSwitchingVideo &&
            !ctx.state.isDrag &&
            !ctx.state.isResize &&
            !ctx.state.isSeeking &&
            !ctx.state.seekDragActive;

        const getFloatingSyncReferenceRect = () => {
            const wrapper = $('fvp-wrapper');
            const wrapperRect = wrapper ? getRect(wrapper) : null;
            if (wrapperRect?.width && wrapperRect?.height) return wrapperRect;
            return ctx.curVid ? getRect(ctx.curVid) : null;
        };

        const syncFloatingWithPlayingDirectVideo = (candidate = null) => {
            if (!canAutoSyncFloatingVideo()) return;
            if (candidate && (!candidate.isConnected || candidate.closest?.('#fvp-wrapper'))) return;

            const detector = videoFloating.media.detector;
            const preferredVideo = candidate || detector.getDirectVideos()[0];

            if (!preferredVideo || preferredVideo === ctx.curVid) return;
            if (!detector.isDetectableVideo(preferredVideo)) return;
            if (!detector.isVideoActivelyPlaying(preferredVideo)) return;

            // isVideoAutoSyncCandidate requires implementation!
            // Wait, isVideoAutoSyncCandidate is in helpers.js. Let's move it to detector.js.
            if (!detector.isVideoAutoSyncCandidate?.(preferredVideo, { referenceRect: getFloatingSyncReferenceRect() })) return;

            const now = performance.now();
            if (now - lastAutoSyncAt < 350) return;
            lastAutoSyncAt = now;

            floatingSession.float(preferredVideo);
        };

        const getPlaybackEventVideo = (event) => {
            const directTarget = event.target instanceof HTMLVideoElement ? event.target : null;
            if (directTarget) return directTarget;
            const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
            return path.find((node) => node instanceof HTMLVideoElement) || null;
        };

        const onDirectVideoPlayback = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            const video = getPlaybackEventVideo(event);
            if (!video || !video.isConnected || video.closest('#fvp-wrapper')) return;
            window.setTimeout(() => syncFloatingWithPlayingDirectVideo(video), 80);
        };

        const bindEvents = () => {
            ['play', 'playing'].forEach((eventName) => {
                window.addEventListener(eventName, onDirectVideoPlayback, true);
                ctx.cleanup.push(() => window.removeEventListener(eventName, onDirectVideoPlayback, true));
            });

            const autoSyncTimer = window.setInterval(() => syncFloatingWithPlayingDirectVideo(), 750);
            ctx.cleanup.push(() => window.clearInterval(autoSyncTimer));

            return {
                syncFloatingWithPlayingDirectVideo
            };
        };

        return { bindEvents, syncFloatingWithPlayingDirectVideo, setFloatingSession };
    };
})();


/* --- Source: content/video-floating/ui/layout.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.ui = videoFloating.ui || {};

    videoFloating.ui.createLayoutManager = (ctx) => {
        const { $ } = videoFloating.core.utils;

        const MOBILE_VIEWPORT_MAX_WIDTH = 640;
        const MOBILE_EDGE_OVERSCAN = 2;

        const isMobileViewport = () => window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH;

        const getBoxViewportInsets = () => ({
            horizontal: isMobileViewport() ? 0 : 8,
            vertical: 8
        });

        const getMaxBoxWidth = () => {
            const { horizontal } = getBoxViewportInsets();
            return Math.max(200, window.innerWidth - horizontal * 2 + (isMobileViewport() ? MOBILE_EDGE_OVERSCAN : 0));
        };

        const expandMobileEdgeWidth = (width) =>
            isMobileViewport() && width >= window.innerWidth - MOBILE_EDGE_OVERSCAN ? getMaxBoxWidth() : width;

        const clampBoxPosition = ({ left = 0, top = 0, width = 0, height = 0 }) => {
            const { horizontal, vertical } = getBoxViewportInsets();
            const minLeft = isMobileViewport() && width >= window.innerWidth ? -Math.ceil(MOBILE_EDGE_OVERSCAN / 2) : horizontal;
            return {
                left: Math.min(Math.max(minLeft, left), Math.max(minLeft, window.innerWidth - width - horizontal)),
                top: Math.min(Math.max(vertical, top), Math.max(vertical, window.innerHeight - height - vertical))
            };
        };

        const getDefaultLayout = () => {
            const { horizontal, vertical } = getBoxViewportInsets();
            const preferredWidth =
                window.innerWidth <= 640 ? window.innerWidth - horizontal * 2 + MOBILE_EDGE_OVERSCAN : Math.round(window.innerWidth * 0.88);
            const width = Math.min(Math.max(preferredWidth, 260), Math.max(260, Math.min(680, getMaxBoxWidth())));
            const height = Math.min(Math.max(Math.round((width * 9) / 16), 160), Math.max(160, window.innerHeight - vertical * 2));
            const centered = {
                left: Math.max(
                    isMobileViewport() ? -Math.ceil(MOBILE_EDGE_OVERSCAN / 2) : horizontal,
                    Math.round((window.innerWidth - width) / 2)
                ),
                top: Math.max(vertical, Math.round((window.innerHeight - height) / 2))
            };
            return {
                width: `${width}px`,
                height: `${height}px`,
                left: `${centered.left}px`,
                top: `${centered.top}px`,
                borderRadius: '12px'
            };
        };

        const getNormalizedLayout = (layout) => {
            const fallback = getDefaultLayout();
            const parsePx = (value, fallbackNumber) =>
                ext.shared.viewportCore?.parsePx?.(value, fallbackNumber) ??
                (() => {
                    const parsed = parseFloat(String(value || ''));
                    return Number.isFinite(parsed) ? parsed : fallbackNumber;
                })();
            const fallbackWidth = parsePx(fallback.width, 320);
            const fallbackHeight = parsePx(fallback.height, 180);
            const { horizontal, vertical } = getBoxViewportInsets();
            const normalized = ext.shared.viewportCore?.normalizeFixedLayout?.({
                layout,
                fallbackLayout: fallback,
                minWidth: 200,
                minHeight: 120,
                maxWidth: getMaxBoxWidth(),
                maxHeight: Math.max(120, window.innerHeight - vertical * 2),
                margin: Math.min(horizontal, vertical)
            });
            if (normalized) {
                const width = expandMobileEdgeWidth(parsePx(normalized.width, fallbackWidth));
                const height = parsePx(normalized.height, fallbackHeight);
                const pos = clampBoxPosition({
                    left: parsePx(normalized.left, parsePx(fallback.left, horizontal)),
                    top: parsePx(normalized.top, parsePx(fallback.top, vertical)),
                    width,
                    height
                });
                return {
                    width: `${Math.round(width)}px`,
                    height: `${Math.round(height)}px`,
                    left: `${Math.round(pos.left)}px`,
                    top: `${Math.round(pos.top)}px`,
                    borderRadius: layout?.borderRadius || fallback.borderRadius || '12px'
                };
            }
            const width = expandMobileEdgeWidth(Math.min(Math.max(parsePx(layout?.width, fallbackWidth), 200), getMaxBoxWidth()));
            const height = Math.min(
                Math.max(parsePx(layout?.height, fallbackHeight), 120),
                Math.max(120, window.innerHeight - vertical * 2)
            );
            const pos = clampBoxPosition({
                left: parsePx(layout?.left, parsePx(fallback.left, horizontal)),
                top: parsePx(layout?.top, parsePx(fallback.top, vertical)),
                width,
                height
            });
            return {
                width: `${Math.round(width)}px`,
                height: `${Math.round(height)}px`,
                left: `${Math.round(pos.left)}px`,
                top: `${Math.round(pos.top)}px`,
                borderRadius: layout?.borderRadius || fallback.borderRadius
            };
        };

        const updateLeftPanelLayout = () => {
            const panel = $('fvp-left-panel');
            if (!panel || !ctx.box || ctx.box.style.display === 'none') return;
            const visibleItems = [...panel.children].filter((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.id === 'fvp-res-popup') return false;
                const style = getComputedStyle(node);
                return style.display !== 'none' && style.position !== 'absolute';
            });
            const itemCount = visibleItems.length;
            if (!itemCount) return;

            const panelStyle = getComputedStyle(panel);
            const rowGap = parseFloat(panelStyle.rowGap || '4') || 4;
            const cellHeight = parseFloat(panelStyle.gridAutoRows || '30') || 30;
            const reservedTop = 12;
            const reservedBottom = 68;
            const availableHeight = Math.max(cellHeight, ctx.box.clientHeight - reservedTop - reservedBottom);
            const rows = Math.max(1, Math.min(itemCount, Math.floor((availableHeight + rowGap) / (cellHeight + rowGap))));

            panel.style.gridAutoFlow = 'column';
            panel.style.gridTemplateRows = `repeat(${rows}, ${cellHeight}px)`;
            panel.style.gridAutoColumns = `${cellHeight}px`;
            panel.style.columnGap = `${rowGap}px`;
        };

        const applyBoxLayout = (layout) => {
            if (!ctx.box) return;
            const next = getNormalizedLayout(layout);
            ctx.box.style.width = next.width;
            ctx.box.style.height = next.height;
            ctx.box.style.left = next.left;
            ctx.box.style.top = next.top;
            ctx.box.style.borderRadius = next.borderRadius;
            updateLeftPanelLayout();
            return next;
        };

        const persistCurrentBoxLayout = () => {
            if (!ctx.box) return;
            videoFloating.core.config.saveLayout({
                top: ctx.box.style.top,
                left: ctx.box.style.left,
                width: ctx.box.style.width,
                height: ctx.box.style.height,
                borderRadius: ctx.box.style.borderRadius
            });
        };

        return {
            getMaxBoxWidth,
            getBoxViewportInsets,
            clampBoxPosition,
            getNormalizedLayout,
            updateLeftPanelLayout,
            applyBoxLayout,
            persistCurrentBoxLayout
        };
    };
})();


/* --- Source: content/video-floating/ui/shell.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.ui = videoFloating.ui || {};

    videoFloating.ui.createShell = (ctx) => {
        const { el, $ } = videoFloating.core.utils;
        const floating = ext?.shared?.floatingCore;
        const config = videoFloating.core.config;

        const resetIdle = () => {
            if (ctx.iconRef) ctx.iconRef.setOpacity(1);
            const panel = $('fvp-left-panel');
            if (panel) panel.style.opacity = '1';
            clearTimeout(ctx.state.idleTimer);
            ctx.state.idleTimer = setTimeout(() => {
                if (ctx.iconRef && !ctx.menuRef?.element.isConnected) ctx.iconRef.setOpacity(0.4);
                const p = $('fvp-left-panel');
                if (p) p.style.opacity = '';
            }, 3000);
        };

        const ensureInitialized = (menuVideoIcon) => {
            if (ctx.box) return;

            ctx.iconRef = floating.createTriggerElement({
                className: 'fvp-idle',
                htmlContent: menuVideoIcon.replace('fvp-menu-icon-svg', 'fvp-master-icon-svg'),
                hidden: true
            });
            ctx.iconRef.element.id = 'fvp-master-icon';
            config.iconPosStorage.load().then((pos) => ctx.iconRef.setPosition(pos.left, pos.top));
            config.ensureLayoutReady();

            ctx.menuRef = floating.createPanelRoot({ className: 'fvp-menu', hidden: true });
            ctx.menuRef.element.id = 'fvp-menu';

            ctx.box = el(
                'div',
                '',
                `
                <div id="fvp-wrapper"></div>
                <button id="fvp-center-play" type="button" aria-label="Resume video" hidden>⏸</button>
                <div id="fvp-left-drag"></div>
                <div id="fvp-left-panel">
                    <div id="fvp-video-order" class="fvp-side-badge" hidden>1/1</div>
                    <button id="fvp-vol-btn" class="fvp-btn">🔊</button>
                    <button id="fvp-speed" class="fvp-btn" style="font-size:11px;font-weight:700">1.0x</button>
                    <div id="fvp-speed-popup" class="fvp-res-popup" style="display:none; flex-direction:column; align-items:center; padding:10px 5px; gap:8px; border-radius:8px; background:rgba(0,0,0,0.85); bottom: 50%; transform: translateY(50%);">
                        <span id="fvp-speed-value" style="font-size:11px; font-weight:bold; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.8);">1.0x</span>
                        <input type="range" id="fvp-speed-slider" min="0.1" max="4.0" step="0.1" value="1.0" style="writing-mode:vertical-lr; direction:rtl; width:8px; height:120px; margin:0; cursor:pointer;">
                    </div>
                    <button id="fvp-res" class="fvp-btn" style="font-size:11px;font-weight:700">HD</button>
                    <div id="fvp-res-popup"></div>
                    <button id="fvp-rotate" class="fvp-btn">↻</button>
                    <button id="fvp-zoom" class="fvp-btn">+</button>
                    <button id="fvp-fit" class="fvp-btn">⤢</button>
                    <button id="fvp-full" class="fvp-btn">⛶</button>
                    <button id="fvp-close" class="fvp-btn">✕</button>
                </div>
                <div class="fvp-resize-handle fvp-resize-br"></div>
                <div class="fvp-resize-handle fvp-resize-bl"></div>
                <div id="fvp-ctrl" class="fvp-overlay">
                    <div id="fvp-seek-row">
                        <span id="fvp-time-display">0.00/0.00</span>
                        <div id="fvp-seek-container">
                            <div id="fvp-seek-track"><div id="fvp-buffer"></div></div>
                            <input type="range" id="fvp-seek" min="0" max="10000" step="1" value="0">
                        </div>
                    </div>
                </div>
            `
            );
            ctx.box.id = 'fvp-container';
            ctx.box.style.display = 'none';
            document.body.appendChild(ctx.box);
        };

        const setupOutsideClickGuard = () => {
            const removeOutsideClick = floating.bindOutsideClickGuard({
                isOpen: () => ctx.menuRef.element.style.display !== 'none',
                containsTarget: (target) => ctx.iconRef.element.contains(target) || ctx.menuRef.element.contains(target),
                onOutside: () => ctx.menuRef.hide()
            });
            ctx.cleanup.push(removeOutsideClick);
        };

        return {
            ensureInitialized,
            resetIdle,
            setupOutsideClickGuard
        };
    };
})();


/* --- Source: content/video-floating/ui/menu.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.ui = videoFloating.ui || {};

    const menuVideoIcon =
        '<svg class="fvp-menu-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16h-4.4l-3.3 3.1c-.65.62-1.8.16-1.8-.74V16H6.5A2.5 2.5 0 0 1 4 13.5zm6.2 1.9v3.2c0 .62.67 1 1.2.68l2.7-1.6a.8.8 0 0 0 0-1.36l-2.7-1.6a.8.8 0 0 0-1.2.68Z"/></svg>';

    videoFloating.ui.createMenu = (ctx) => {
        let floatingSession = null;

        const setFloatingSession = (fs) => {
            floatingSession = fs;
        };
        const { el } = videoFloating.core.utils;
        const { isFeatureEnabled } = videoFloating.core.config;

        const getAvailableMediaItems = () => {
            const videoItems = floatingSession.getOrderedVideoSequence().map((video, index) => ({
                type: 'video',
                key: `video-${index}`,
                label: `Video ${index + 1}`,
                active: video === ctx.curVid,
                onSelect: () => floatingSession.float(video)
            }));
            const iframeItems = videoFloating.media.detector.getTrackedIframeEntries(ctx.iframeVideoMap).map(([iframe], index) => {
                const domain = (() => {
                    try {
                        return new URL(iframe.src).hostname;
                    } catch {
                        return 'iframe';
                    }
                })();
                return {
                    type: 'iframe',
                    key: `iframe-${index}`,
                    label: `iFrame: ${domain}`,
                    active: iframe === ctx.floatedIframe,
                    onSelect: () => floatingSession.floatIframe(iframe)
                };
            });
            return [...videoItems, ...iframeItems];
        };

        const renderMenu = () => {
            const items = getAvailableMediaItems();
            const menu = ctx.menuRef.element;
            menu.innerHTML = '';
            if (!items.length) {
                menu.innerHTML = '<div class="fvp-menu-item" style="opacity:0.5">No videos found</div>';
                return;
            }
            items.forEach((entry) => {
                const item = el(
                    'div',
                    `fvp-menu-item${entry.active ? ' active' : ''}`,
                    `<span class="fvp-menu-icon">${menuVideoIcon}</span><span>${entry.label}</span>`
                );
                item.onclick = () => {
                    entry.onSelect();
                    ctx.menuRef.hide();
                };
                menu.appendChild(item);
            });
        };

        const openMenuAtAnchor = (anchor) => {
            if (!ctx.menuRef || !anchor) return;
            if (!isFeatureEnabled()) {
                ctx.menuRef.hide();
                return;
            }
            const rect = anchor.getBoundingClientRect();
            ctx.menuRef.element.style.width = '';
            ctx.menuRef.element.style.maxHeight = '';

            const clamp = videoFloating.core.utils.clamp;
            ctx.menuRef.setPosition(clamp(rect.left, 10, innerWidth - 206), innerHeight - rect.bottom < 300 ? 'auto' : rect.bottom + 10);
            if (innerHeight - rect.bottom < 300) ctx.menuRef.element.style.bottom = `${innerHeight - rect.top + 10}px`;
            else ctx.menuRef.element.style.bottom = 'auto';

            renderMenu();
            ctx.menuRef.show('flex');
        };

        const floatFirstAvailableMedia = () => {
            if (!isFeatureEnabled()) return;
            const preferredVideo = videoFloating.media.detector.getDirectVideos()[0];
            if (preferredVideo) {
                ctx.menuRef?.hide();
                floatingSession.float(preferredVideo);
                return;
            }
            const [firstItem] = getAvailableMediaItems();
            if (!firstItem) {
                ctx.menuRef?.hide();
                return;
            }
            ctx.menuRef?.hide();
            firstItem.onSelect();
        };

        return {
            openMenuAtAnchor,
            floatFirstAvailableMedia,
            menuVideoIcon,
            setFloatingSession
        };
    };
})();


/* --- Source: content/video-floating/interactions/drag-resize.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createDragResizeHandler = (ctx, layoutManager, shell) => {
        const { getCoord } = videoFloating.core.utils;
        const touch = ext?.shared?.touchCore;

        let activeBoxPointerId = null;
        let activeBoxPointerEl = null;

        const beginBoxInteraction = (event, mode, resizeDir = '') => {
            if (event.button !== undefined && event.button !== 0) return;
            if (touch?.isTouchLikeEvent?.(event)) touch.preventCancelable(event);
            const c = getCoord(event);
            activeBoxPointerId = event.pointerId ?? 'mouse';
            activeBoxPointerEl = event.currentTarget instanceof Element ? event.currentTarget : null;
            ctx.state.isDrag = mode === 'drag';
            ctx.state.isResize = mode === 'resize';
            ctx.state.resizeDir = resizeDir;
            ctx.state.startX = c.x;
            ctx.state.startY = c.y;
            ctx.state.initX = ctx.box.offsetLeft;
            ctx.state.initY = ctx.box.offsetTop;
            ctx.state.initW = ctx.box.offsetWidth;
            ctx.state.initH = ctx.box.offsetHeight;
            try {
                activeBoxPointerEl?.setPointerCapture?.(event.pointerId);
            } catch {
                /* ignore */
            }
            shell.resetIdle();
        };

        const handleBoxPointerMove = (event) => {
            if ((event.pointerId ?? 'mouse') !== activeBoxPointerId) return;
            if (!ctx.state.isDrag && !ctx.state.isResize) return;
            if (touch?.isTouchLikeEvent?.(event)) touch.preventCancelable(event);
            const c = getCoord(event);
            const dx = c.x - ctx.state.startX;
            const dy = c.y - ctx.state.startY;
            if (ctx.state.isDrag) {
                const next = layoutManager.clampBoxPosition({
                    left: ctx.state.initX + dx,
                    top: ctx.state.initY + dy,
                    width: ctx.box.offsetWidth,
                    height: ctx.box.offsetHeight
                });
                ctx.box.style.left = `${next.left}px`;
                ctx.box.style.top = `${next.top}px`;
                layoutManager.updateLeftPanelLayout();
            } else if (ctx.state.isResize) {
                const { vertical } = layoutManager.getBoxViewportInsets();
                const width = Math.min(
                    Math.max(ctx.state.resizeDir === 'bl' ? ctx.state.initW - dx : ctx.state.initW + dx, 200),
                    layoutManager.getMaxBoxWidth()
                );
                const height = Math.min(Math.max(ctx.state.initH + dy, 120), Math.max(120, window.innerHeight - vertical * 2));
                const left = ctx.state.resizeDir === 'bl' ? ctx.state.initX + (ctx.state.initW - width) : ctx.state.initX;
                const next = layoutManager.clampBoxPosition({ left, top: ctx.state.initY, width, height });
                ctx.box.style.width = `${Math.round(width)}px`;
                ctx.box.style.height = `${Math.round(height)}px`;
                ctx.box.style.left = `${Math.round(next.left)}px`;
                ctx.box.style.top = `${Math.round(next.top)}px`;
                layoutManager.updateLeftPanelLayout();
            }
            shell.resetIdle();
        };

        const handleBoxPointerEnd = (event) => {
            if ((event.pointerId ?? 'mouse') !== activeBoxPointerId) return;
            if (ctx.state.isDrag || ctx.state.isResize) {
                ctx.state.isDrag = false;
                ctx.state.isResize = false;
                layoutManager.persistCurrentBoxLayout();
            }
            activeBoxPointerId = null;
        };

        return {
            beginBoxInteraction,
            handleBoxPointerMove,
            handleBoxPointerEnd
        };
    };
})();


/* --- Source: content/video-floating/interactions/gestures.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createGesturesHandler = (ctx, floatingSession, seekController, uiControls, shell) => {
        const { clamp, $ } = videoFloating.core.utils;

        const isWrapperToggleBlockedTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return Boolean(
                node.closest('#fvp-left-panel, #fvp-ctrl, #fvp-res-popup, .fvp-resize-handle, button, input, select, textarea, a, label')
            );
        };

        const setupWrapperGestures = () => {
            const TAP_MOVE_THRESHOLD = 10;
            const POINTER_SWITCH_THRESHOLD = 28;
            const POINTER_SWITCH_DIAGONAL_RATIO = 1.3;
            const wheelGestureConfig = videoFloating.WHEEL_GESTURE || {
                idleMs: 300,
                seekSecondsPerPixel: 0.1,
                switchThreshold: 120,
                switchCooldownMs: 500
            };

            let wrapperPointerId = null;
            let wrapperStartX = 0;
            let wrapperStartY = 0;
            let wrapperPointerType = '';
            let wrapperMoved = false;
            let wrapperSwitchDir = 0;

            let wheelDeltaY = 0;
            let wheelGestureResetTimer = 0;
            let wheelSeekBaseTime = null;
            let wheelSeekDeltaX = 0;
            let lastWheelSwitchAt = 0;
            let hasSwitchedInCurrentGesture = false;

            const resetWrapperTap = () => {
                wrapperPointerId = null;
                wrapperPointerType = '';
                wrapperMoved = false;
                wrapperSwitchDir = 0;
            };

            const switchFromWrapper = (dir) => {
                if (ctx.curVid) {
                    floatingSession.switchVid(dir);
                }
            };

            const scheduleWheelGestureReset = () => {
                clearTimeout(wheelGestureResetTimer);
                wheelGestureResetTimer = window.setTimeout(() => {
                    wheelDeltaY = 0;
                    wheelSeekBaseTime = null;
                    wheelSeekDeltaX = 0;
                    wheelGestureResetTimer = 0;
                    hasSwitchedInCurrentGesture = false;
                }, wheelGestureConfig.idleMs);
            };

            const getWheelDeltaPixels = (event) => {
                const delta = Number(event?.deltaY) || 0;
                if (event?.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
                if (event?.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * Math.max(1, innerHeight);
                return delta;
            };

            const seekFromWheel = (deltaX) => {
                if (!ctx.curVid?.duration) return false;
                if (wheelSeekBaseTime === null) {
                    wheelSeekBaseTime = ctx.curVid.currentTime || 0;
                    wheelSeekDeltaX = 0;
                }
                wheelSeekDeltaX += deltaX;
                const nextTime = clamp(
                    wheelSeekBaseTime + wheelSeekDeltaX * wheelGestureConfig.seekSecondsPerPixel,
                    0,
                    ctx.curVid.duration
                );
                ctx.curVid.currentTime = nextTime;
                seekController.renderSeekPreview(nextTime / ctx.curVid.duration);
                return true;
            };

            const handleWrapperPointerDown = (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                if (isWrapperToggleBlockedTarget(event.target)) return;
                if (ctx.box?.style.display === 'none') return;
                wrapperPointerId = event.pointerId ?? 'mouse';
                wrapperStartX = event.clientX ?? 0;
                wrapperStartY = event.clientY ?? 0;
                wrapperPointerType = event.pointerType || 'mouse';
                wrapperMoved = false;
                wrapperSwitchDir = 0;
            };

            const handleWrapperPointerMove = (event) => {
                if ((event.pointerId ?? 'mouse') !== wrapperPointerId) return;
                const dx = (event.clientX ?? 0) - wrapperStartX;
                const dy = (event.clientY ?? 0) - wrapperStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                if (!wrapperMoved && Math.hypot(dx, dy) >= TAP_MOVE_THRESHOLD) {
                    wrapperMoved = true;
                }
                if (wrapperPointerType !== 'mouse' || wrapperSwitchDir) return;
                if (absDy < POINTER_SWITCH_THRESHOLD || absDy / (absDx + 1) < POINTER_SWITCH_DIAGONAL_RATIO) return;
                wrapperSwitchDir = dy < 0 ? 1 : -1;
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
            };

            const handleWrapperPointerEnd = (event) => {
                if ((event.pointerId ?? 'mouse') !== wrapperPointerId) return;
                const switchDir = wrapperSwitchDir;
                const shouldToggle =
                    !wrapperMoved &&
                    !switchDir &&
                    !ctx.state.isDrag &&
                    !ctx.state.isResize &&
                    !ctx.state.isSeeking &&
                    !ctx.state.seekDragActive &&
                    !isWrapperToggleBlockedTarget(event.target);
                resetWrapperTap();
                if (switchDir) {
                    switchFromWrapper(switchDir);
                    if (event.cancelable) event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                if (!shouldToggle) return;
                uiControls.togglePlayback();
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
            };

            const handleWrapperPointerCancel = (event) => {
                if ((event.pointerId ?? 'mouse') !== wrapperPointerId) return;
                resetWrapperTap();
            };

            const handleWrapperWheel = (event) => {
                if (ctx.box?.style.display === 'none') return;
                if (isWrapperToggleBlockedTarget(event.target)) return;
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                scheduleWheelGestureReset();

                const absX = Math.abs(event.deltaX || 0);
                const absY = Math.abs(event.deltaY || 0);
                if (absX > 0 && absX >= absY * 0.8) {
                    seekFromWheel(event.deltaX || 0);
                    return;
                }

                if (hasSwitchedInCurrentGesture) return;

                wheelDeltaY += getWheelDeltaPixels(event);
                if (Math.abs(wheelDeltaY) < wheelGestureConfig.switchThreshold) return;

                const now = performance.now();
                if (now - lastWheelSwitchAt < wheelGestureConfig.switchCooldownMs) return;

                const dir = wheelDeltaY > 0 ? 1 : -1;
                hasSwitchedInCurrentGesture = true;
                wheelDeltaY -= dir * wheelGestureConfig.switchThreshold;
                if (Math.sign(wheelDeltaY) !== dir) wheelDeltaY = 0;
                lastWheelSwitchAt = now;
                switchFromWrapper(dir);
            };

            const wrapperEl = $('fvp-wrapper');
            wrapperEl.addEventListener('pointerdown', handleWrapperPointerDown, true);
            wrapperEl.addEventListener('pointermove', handleWrapperPointerMove, true);
            wrapperEl.addEventListener('pointerup', handleWrapperPointerEnd, true);
            wrapperEl.addEventListener('pointercancel', handleWrapperPointerCancel, true);
            wrapperEl.addEventListener('wheel', handleWrapperWheel, { capture: true, passive: false });
            ctx.cleanup.push(() => {
                wrapperEl.removeEventListener('pointerdown', handleWrapperPointerDown, true);
                wrapperEl.removeEventListener('pointermove', handleWrapperPointerMove, true);
                wrapperEl.removeEventListener('pointerup', handleWrapperPointerEnd, true);
                wrapperEl.removeEventListener('pointercancel', handleWrapperPointerCancel, true);
                wrapperEl.removeEventListener('wheel', handleWrapperWheel, { capture: true, passive: false });
                clearTimeout(wheelGestureResetTimer);
            });
        };

        return {
            setupWrapperGestures
        };
    };
})();


/* --- Source: content/video-floating/interactions/icon.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createIconHandler = (ctx, menu, shell) => {
        const config = videoFloating.core.config;
        const floating = ext?.shared?.floatingCore;

        const setupIconGestures = () => {
            const DOUBLE_TAP_MS = 280;
            const DRAG_THRESHOLD = 6;
            let pointerId = null;
            let startX = 0;
            let startY = 0;
            let dragging = false;
            let origin = { left: 0, top: 0 };
            let tapTimer = 0;
            let mouseClickTimer = 0;
            let lastTapAt = 0;

            const clearTapTimer = () => {
                clearTimeout(tapTimer);
                tapTimer = 0;
            };
            const clearMouseClickTimer = () => {
                clearTimeout(mouseClickTimer);
                mouseClickTimer = 0;
            };
            const resetIconPointer = () => {
                pointerId = null;
                dragging = false;
            };
            const handleIconPointerDown = (event) => {
                if (event.button !== 0) return;
                pointerId = event.pointerId;
                startX = event.clientX;
                startY = event.clientY;
                origin = { left: ctx.iconRef.element.offsetLeft, top: ctx.iconRef.element.offsetTop };
                dragging = false;
                try {
                    ctx.iconRef.element.setPointerCapture(event.pointerId);
                } catch {
                    /* ignore */
                }
            };
            const handleIconPointerMove = (event) => {
                if (event.pointerId !== pointerId) return;
                const deltaX = event.clientX - startX;
                const deltaY = event.clientY - startY;
                if (!dragging && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD) {
                    dragging = true;
                    clearTapTimer();
                    ctx.menuRef.hide();
                }
                if (!dragging) return;
                const next = floating.clampFixedPosition({
                    left: origin.left + deltaX,
                    top: origin.top + deltaY,
                    width: 42,
                    height: 42,
                    margin: 10
                });
                ctx.iconRef.setPosition(next.left, next.top);
                shell.resetIdle();
            };
            const handleIconPointerUp = (event) => {
                if (event.pointerId !== pointerId) return;
                if (dragging) {
                    config.iconPosStorage.save(ctx.iconRef.element.style.left, ctx.iconRef.element.style.top);
                } else {
                    if (event.pointerType === 'mouse') {
                        clearTapTimer();
                        clearMouseClickTimer();
                        lastTapAt = 0;
                        mouseClickTimer = window.setTimeout(() => {
                            mouseClickTimer = 0;
                            menu.floatFirstAvailableMedia();
                        }, DOUBLE_TAP_MS);
                        resetIconPointer();
                        return;
                    }
                    const now = Date.now();
                    if (lastTapAt && now - lastTapAt <= DOUBLE_TAP_MS) {
                        clearTapTimer();
                        lastTapAt = 0;
                        menu.openMenuAtAnchor(ctx.iconRef.element);
                    } else {
                        lastTapAt = now;
                        clearTapTimer();
                        tapTimer = window.setTimeout(() => {
                            tapTimer = 0;
                            lastTapAt = 0;
                            menu.floatFirstAvailableMedia();
                        }, DOUBLE_TAP_MS);
                    }
                }
                resetIconPointer();
            };
            const handleIconPointerCancel = (event) => {
                if (event.pointerId !== pointerId) return;
                resetIconPointer();
            };
            const handleIconDoubleClick = (event) => {
                if (event.button !== 0) return;
                clearTapTimer();
                clearMouseClickTimer();
                lastTapAt = 0;
                ctx.menuRef.hide();
                menu.openMenuAtAnchor(ctx.iconRef.element);
                event.preventDefault();
                event.stopPropagation();
            };

            ctx.iconRef.element.addEventListener('pointerdown', handleIconPointerDown, true);
            ctx.iconRef.element.addEventListener('pointermove', handleIconPointerMove, true);
            ctx.iconRef.element.addEventListener('pointerup', handleIconPointerUp, true);
            ctx.iconRef.element.addEventListener('pointercancel', handleIconPointerCancel, true);
            ctx.iconRef.element.addEventListener('dblclick', handleIconDoubleClick, true);
            ctx.cleanup.push(() => {
                clearTapTimer();
                clearMouseClickTimer();
                ctx.iconRef.element.removeEventListener('pointerdown', handleIconPointerDown, true);
                ctx.iconRef.element.removeEventListener('pointermove', handleIconPointerMove, true);
                ctx.iconRef.element.removeEventListener('pointerup', handleIconPointerUp, true);
                ctx.iconRef.element.removeEventListener('pointercancel', handleIconPointerCancel, true);
                ctx.iconRef.element.removeEventListener('dblclick', handleIconDoubleClick, true);
            });
        };

        return {
            setupIconGestures
        };
    };
})();


/* --- Source: content/video-floating/interactions/video-target-finder.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createVideoTargetFinder = () => {
        const getFloatingActiveVideo = (wrapper = videoFloating.core.utils.$('fvp-wrapper')) => {
            if (!wrapper) return null;
            const floatingVideos = [...wrapper.querySelectorAll('video')];
            return floatingVideos.find((node) => node.parentElement === wrapper) || floatingVideos[floatingVideos.length - 1] || null;
        };

        const isPointInFloatingUI = (x, y) => {
            for (const id of ['fvp-container', 'fvp-master-icon', 'fvp-menu']) {
                const node = videoFloating.core.utils.$(id);
                if (node?.isConnected) {
                    const rect = videoFloating.core.utils.getRect(node);
                    if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                        return true;
                    }
                }
            }
            return false;
        };

        const getVideoAtPoint = (x, y) => {
            if (isPointInFloatingUI(x, y)) return null;

            if (typeof document.elementsFromPoint === 'function') {
                for (const node of document.elementsFromPoint(x, y)) {
                    if (!(node instanceof Element)) continue;
                    const video = node.tagName === 'VIDEO' || node.tagName === 'AUDIO' ? node : node.closest?.('video, audio');
                    if (!video || !video.isConnected || video.closest('#fvp-wrapper')) continue;
                    if (videoFloating.media.detector.isDetectableVideo(video)) return video;
                }
            }
            for (const video of videoFloating.media.detector.getDirectVideos()) {
                if (!videoFloating.media.detector.isDetectableVideo(video) || video.closest('#fvp-wrapper')) continue;
                const rect = videoFloating.core.utils.getRect(video);
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return video;
            }
            return null;
        };

        const getSeekableVideoAtPoint = (x, y, { includeFloating = false } = {}) => {
            if (includeFloating) {
                const wrapper = videoFloating.core.utils.$('fvp-wrapper');
                const box = videoFloating.core.utils.$('fvp-container');
                const isFloatingBoxVisible = !!(box && box.style.display !== 'none');
                const rect = isFloatingBoxVisible ? videoFloating.core.utils.getRect(wrapper) : null;
                if (rect?.width && rect?.height && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    const video = getFloatingActiveVideo(wrapper);
                    if (video?.isConnected && Number.isFinite(video.duration) && video.duration > 0) return video;
                }
            }
            const video = getVideoAtPoint(x, y);
            return video?.isConnected && Number.isFinite(video.duration) && video.duration > 0 ? video : null;
        };

        const isFloatingGestureBlockedTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return Boolean(
                node.closest('#fvp-left-panel, #fvp-ctrl, #fvp-res-popup, .fvp-resize-handle, button, input, select, textarea, a, label')
            );
        };

        const isVideoSeekEditableTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return Boolean(node.closest('input, select, textarea, [contenteditable]'));
        };

        const isVideoSeekWheelBlockedTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return isVideoSeekEditableTarget(node) || Boolean(node.closest('button, a, label, [role="button"]'));
        };

        const getVideo = () => {
            const fs = videoFloating.core.utils.getFullscreenEl();
            if (fs) {
                if (fs.tagName === 'VIDEO' || fs.tagName === 'AUDIO') return fs;
                const video = fs.querySelector('video, audio');
                if (video) return video;
            }
            const wrapper = videoFloating.core.utils.$('fvp-wrapper');
            if (wrapper) {
                const video = getFloatingActiveVideo(wrapper);
                if (video) return video;
            }
            return videoFloating.media.detector.getDirectVideos()[0] || null;
        };

        return {
            getFloatingActiveVideo,
            isPointInFloatingUI,
            getVideoAtPoint,
            getSeekableVideoAtPoint,
            isFloatingGestureBlockedTarget,
            isVideoSeekEditableTarget,
            isVideoSeekWheelBlockedTarget,
            getVideo
        };
    };
})();


/* --- Source: content/video-floating/interactions/seek-notice-ui.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createSeekNoticeUI = () => {
        let noticeEl = null;
        let hideTimer = 0;

        const ensureNotice = (video) => {
            if (!video) return null;
            const fs = videoFloating.core.utils.getFullscreenEl();
            const container = fs && (fs === video || fs.contains(video)) ? fs : video.parentElement || document.body;
            if (!noticeEl || !container.contains(noticeEl)) {
                noticeEl?.remove();
                noticeEl = document.createElement('div');
                noticeEl.className = 'vf-notice';
                if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
                container.appendChild(noticeEl);
            }
            noticeEl.style.fontSize = `${videoFloating.core.config.getFeatureConfig().noticeFontSize}px`;
            return noticeEl;
        };

        const showSeekNotice = (video, delta) => {
            const notice = ensureNotice(video);
            if (!notice) return;
            notice.textContent = `${delta >= 0 ? '▶ +' : '◀ '}${delta}s`;
            notice.classList.add('show');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => notice.classList.remove('show'), 700);
        };

        return {
            showSeekNotice
        };
    };
})();


/* --- Source: content/video-floating/interactions/touch-swipe-seek.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createTouchSwipeSeek = (targetFinder, noticeUI) => {
        const emitTouchSwitchVideo = (dir) => {
            if (!dir) return;
            window.dispatchEvent(
                new CustomEvent(videoFloating.core.config.TOUCH_SWITCH_VIDEO_EVENT || 'fvp-touch-switch-video', { detail: { dir } })
            );
        };

        const stopTouchEventForFloating = (event) => {
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        };

        const swipe = {
            active: false,
            video: null,
            startedInsideFloatingBox: false,
            startX: 0,
            startY: 0,
            startTime: 0,
            lastUpdate: 0,
            lastDelta: 0,
            cancelled: false,
            gesture: '',
            allowVerticalSwitch: false,
            pendingSwitchDir: 0
        };

        const resetSwipe = () => {
            swipe.active = false;
            swipe.cancelled = false;
            swipe.video = null;
            swipe.startedInsideFloatingBox = false;
            swipe.lastDelta = 0;
            swipe.gesture = '';
            swipe.allowVerticalSwitch = false;
            swipe.pendingSwitchDir = 0;
        };

        const onTouchStart = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            resetSwipe();
            const point = event.touches?.length === 1 ? event.touches[0] : null;
            if (!point) return;
            try {
                const floatingBox = videoFloating.core.utils.$('fvp-container');
                const isFloatingBoxVisible = !!(floatingBox && floatingBox.style.display !== 'none');
                const floatingBoxRect = isFloatingBoxVisible ? videoFloating.core.utils.getRect(floatingBox) : null;
                const startedInsideFloatingBox = !!(
                    floatingBoxRect &&
                    point.clientX >= floatingBoxRect.left &&
                    point.clientX <= floatingBoxRect.right &&
                    point.clientY >= floatingBoxRect.top &&
                    point.clientY <= floatingBoxRect.bottom
                );
                if (startedInsideFloatingBox && targetFinder.isFloatingGestureBlockedTarget(event.target)) return;
                if (!startedInsideFloatingBox && videoFloating.core.config.isBackgroundSeekExcluded()) return;

                const wrapper = startedInsideFloatingBox ? videoFloating.core.utils.$('fvp-wrapper') : null;
                const wrapperRect = wrapper ? videoFloating.core.utils.getRect(wrapper) : null;
                let video =
                    startedInsideFloatingBox && wrapperRect?.width && wrapperRect?.height
                        ? targetFinder.getFloatingActiveVideo(wrapper)
                        : targetFinder.getVideoAtPoint(point.clientX, point.clientY);

                if (!video && !startedInsideFloatingBox) {
                    const activeMedia = targetFinder.getVideo();
                    if (activeMedia) {
                        const isAudio = activeMedia.tagName === 'AUDIO';
                        const isYtMusic = location.hostname.includes('music.youtube.com');
                        const isPlaying = !activeMedia.paused && activeMedia.currentTime > 0;
                        if (isAudio || isYtMusic || isPlaying) {
                            video = activeMedia;
                        }
                    }
                }

                if (!video?.isConnected || !Number.isFinite(video.duration) || video.duration <= 0) return;
                const rect =
                    startedInsideFloatingBox && wrapperRect?.width && wrapperRect?.height
                        ? wrapperRect
                        : videoFloating.core.utils.getRect(video);

                const isAudioOrHidden =
                    video.tagName === 'AUDIO' || location.hostname.includes('music.youtube.com') || !rect.width || !rect.height;
                if (!isAudioOrHidden) {
                    if (!rect.width || !rect.height) return;
                    const bottomGuard = startedInsideFloatingBox ? 60 : Math.min(44, Math.max(18, rect.height * 0.1));
                    if (point.clientY > rect.bottom - bottomGuard) return;
                }
                if (startedInsideFloatingBox) {
                    stopTouchEventForFloating(event);
                }
                Object.assign(swipe, {
                    video,
                    active: true,
                    startedInsideFloatingBox,
                    startX: point.clientX,
                    startY: point.clientY,
                    startTime: video.currentTime,
                    lastUpdate: performance.now(),
                    allowVerticalSwitch: startedInsideFloatingBox || window !== window.top
                });
            } catch {
                resetSwipe();
            }
        };

        const onTouchMove = (event) => {
            if (!swipe.active || !swipe.video || swipe.cancelled) return;
            const vfConfig = videoFloating.core.config.getFeatureConfig();
            const point = event.touches?.length === 1 ? event.touches[0] : null;
            if (!point || !swipe.video.isConnected) {
                swipe.cancelled = true;
                return;
            }
            const dx = point.clientX - swipe.startX;
            const dy = point.clientY - swipe.startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx < 5 && absDy < 5) return;
            const lockDistance = Math.max(12, Math.round(vfConfig.minSwipeDistance * 0.55));
            const commitDistance = Math.max(18, Math.round(vfConfig.minSwipeDistance * 0.7));
            const diagonalRatio = Math.max(1.12, vfConfig.diagonalThreshold * 0.78);
            const horizontalSlack = Math.max(vfConfig.verticalTolerance, 120);
            if (!swipe.gesture) {
                const verticalDominant = absDy >= lockDistance && absDy > absDx && absDy / (absDx + 1) >= diagonalRatio;
                const horizontalDominant = absDx >= lockDistance && absDx > absDy && absDx / (absDy + 1) >= diagonalRatio;
                if (swipe.allowVerticalSwitch && verticalDominant) {
                    swipe.gesture = 'switch';
                } else if (horizontalDominant) {
                    swipe.gesture = 'seek';
                } else if (absDx >= commitDistance && absDy > horizontalSlack) {
                    swipe.cancelled = true;
                    return;
                }
            }
            if (swipe.gesture === 'switch') {
                if (absDy < commitDistance) return;
                swipe.pendingSwitchDir = dy < 0 ? 1 : -1;
                if (swipe.startedInsideFloatingBox) {
                    stopTouchEventForFloating(event);
                } else if (event.cancelable) event.preventDefault();
                return;
            }
            if (swipe.gesture !== 'seek') return;
            if (absDx < commitDistance) return;
            if (absDx > absDy && swipe.startedInsideFloatingBox) {
                stopTouchEventForFloating(event);
            } else if (absDx > absDy && event.cancelable) event.preventDefault();
            const scale = absDx < vfConfig.shortThreshold ? vfConfig.swipeShort : vfConfig.swipeLong;
            const effectiveMinDistance = Math.max(12, Math.round(vfConfig.minSwipeDistance * 0.45));
            const delta = Math.round((dx > 0 ? dx - effectiveMinDistance : dx + effectiveMinDistance) * scale);
            swipe.lastDelta = delta;
            noticeUI.showSeekNotice(swipe.video, delta);
            const now = performance.now();
            if (vfConfig.realtimePreview && now - swipe.lastUpdate > vfConfig.throttle) {
                swipe.lastUpdate = now;
                swipe.video.currentTime = videoFloating.core.utils.clamp(swipe.startTime + delta, 0, swipe.video.duration);
            }
        };

        const onTouchEnd = (event) => {
            if (!swipe.active || !swipe.video) return;
            const vfConfig = videoFloating.core.config.getFeatureConfig();
            if (swipe.startedInsideFloatingBox) {
                stopTouchEventForFloating(event);
            }
            if (!swipe.cancelled && swipe.gesture === 'switch' && swipe.pendingSwitchDir) {
                emitTouchSwitchVideo(swipe.pendingSwitchDir);
            } else if (!swipe.cancelled && !vfConfig.realtimePreview && swipe.video.isConnected) {
                swipe.video.currentTime = videoFloating.core.utils.clamp(swipe.startTime + (swipe.lastDelta || 0), 0, swipe.video.duration);
            }
            resetSwipe();
        };

        const install = () => {
            document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
            document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
            document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });

            return () => {
                document.removeEventListener('touchstart', onTouchStart, { capture: true, passive: false });
                document.removeEventListener('touchmove', onTouchMove, { capture: true, passive: false });
                document.removeEventListener('touchend', onTouchEnd, { capture: true, passive: false });
            };
        };

        return { install };
    };
})();


/* --- Source: content/video-floating/interactions/wheel-keyboard-seek.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createWheelKeyboardSeek = (targetFinder, noticeUI) => {
        const wheel = {
            video: null,
            baseTime: 0,
            deltaX: 0,
            resetTimer: 0
        };
        const pointer = {
            active: false,
            x: 0,
            y: 0
        };
        const resetWheelGesture = () => {
            wheel.video = null;
            wheel.baseTime = 0;
            wheel.deltaX = 0;
            wheel.resetTimer = 0;
        };
        const scheduleWheelReset = () => {
            clearTimeout(wheel.resetTimer);
            wheel.resetTimer = window.setTimeout(resetWheelGesture, videoFloating.WHEEL_GESTURE?.idleMs || 300);
        };
        const seekVideoBy = (video, deltaSeconds) => {
            if (!video?.duration) return false;
            const nextTime = videoFloating.core.utils.clamp((video.currentTime || 0) + deltaSeconds, 0, video.duration);
            video.currentTime = nextTime;
            noticeUI.showSeekNotice(video, Math.round(deltaSeconds));
            return true;
        };
        const seekVideoFromWheel = (video, deltaX) => {
            if (!video?.duration) return false;
            if (wheel.video !== video) {
                wheel.video = video;
                wheel.baseTime = video.currentTime || 0;
                wheel.deltaX = 0;
            }
            wheel.deltaX += deltaX;
            const nextTime = videoFloating.core.utils.clamp(
                wheel.baseTime + wheel.deltaX * (videoFloating.WHEEL_GESTURE?.seekSecondsPerPixel || 0.1),
                0,
                video.duration
            );
            video.currentTime = nextTime;
            noticeUI.showSeekNotice(video, Math.round(nextTime - wheel.baseTime));
            return true;
        };
        const stopSeekEvent = (event) => {
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        };
        const updatePointerPosition = (event) => {
            pointer.active = true;
            pointer.x = event.clientX || 0;
            pointer.y = event.clientY || 0;
        };
        const blurFocusedControl = () => {
            const active = document.activeElement;
            if (!(active instanceof HTMLElement) || targetFinder.isVideoSeekEditableTarget(active)) return;
            if (active.matches('button, a, label, [role="button"], [tabindex]')) {
                active.blur();
            }
        };
        const onWheel = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            if (targetFinder.isVideoSeekWheelBlockedTarget(event.target)) return;
            const absX = Math.abs(event.deltaX || 0);
            const absY = Math.abs(event.deltaY || 0);
            if (!absX || absX < absY * 0.8) return;

            let video = targetFinder.getSeekableVideoAtPoint(event.clientX || 0, event.clientY || 0, { includeFloating: true });
            if (!video) {
                const activeMedia = targetFinder.getVideo();
                if (activeMedia && (activeMedia.tagName === 'AUDIO' || location.hostname.includes('music.youtube.com'))) {
                    video = activeMedia;
                }
            }
            if (!video) return;
            if (videoFloating.core.config.isBackgroundSeekExcluded() && !video.closest?.('#fvp-wrapper')) return;

            stopSeekEvent(event);
            scheduleWheelReset();
            seekVideoFromWheel(video, event.deltaX || 0);
        };
        const onKeyDown = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled() || videoFloating.core.config.getFeatureConfig().hotkeys === false) return;
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (!pointer.active || targetFinder.isVideoSeekEditableTarget(event.target)) return;

            let video = targetFinder.getSeekableVideoAtPoint(pointer.x, pointer.y, { includeFloating: true });
            if (!video) {
                const activeMedia = targetFinder.getVideo();
                if (activeMedia && (activeMedia.tagName === 'AUDIO' || location.hostname.includes('music.youtube.com'))) {
                    video = activeMedia;
                }
            }
            if (!video) return;
            if (videoFloating.core.config.isBackgroundSeekExcluded() && !video.closest?.('#fvp-wrapper')) return;

            const step = Math.max(1, Number(videoFloating.core.config.getFeatureConfig().forwardStep) || 5);
            stopSeekEvent(event);
            blurFocusedControl();
            seekVideoBy(video, event.key === 'ArrowRight' ? step : -step);
        };

        const install = () => {
            window.addEventListener('pointermove', updatePointerPosition, { capture: true, passive: true });
            window.addEventListener('pointerdown', updatePointerPosition, { capture: true, passive: true });
            window.addEventListener('wheel', onWheel, { capture: true, passive: false });
            document.addEventListener('keydown', onKeyDown, true);

            return () => {
                window.removeEventListener('pointermove', updatePointerPosition, { capture: true, passive: true });
                window.removeEventListener('pointerdown', updatePointerPosition, { capture: true, passive: true });
                window.removeEventListener('wheel', onWheel, { capture: true, passive: false });
                document.removeEventListener('keydown', onKeyDown, true);
                clearTimeout(wheel.resetTimer);
            };
        };

        return { install };
    };
})();


/* --- Source: content/video-floating/interactions/global-gestures.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    const targetFinder = videoFloating.interactions.createVideoTargetFinder();
    const noticeUI = videoFloating.interactions.createSeekNoticeUI();

    videoFloating.interactions.installTouchSwipeSeek = videoFloating.interactions.createTouchSwipeSeek(targetFinder, noticeUI).install;
    videoFloating.interactions.installWheelKeyboardSeek = videoFloating.interactions.createWheelKeyboardSeek(
        targetFinder,
        noticeUI
    ).install;
})();


/* --- Source: content/video-floating/iframe-video-manager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FIT_MODES, ZOOM_LEVELS } = videoFloating;
    const { getRect, queryAllDeep, getFullscreenEl } = videoFloating.core.utils;
    const { isDetectableVideo, compareVideoPriority, isVideoActivelyPlaying, getDirectVideos } = videoFloating.media.detector;

    videoFloating.createIframeVideoManager = (deps) => {
        const { onStateChange, iframeUiState } = deps;

        let activeIframeVideo = null;
        let styledIframeVideo = null;
        let trackedStateVideo = null;
        const IFRAME_STATE_EVENTS = [
            'play',
            'pause',
            'ended',
            'timeupdate',
            'durationchange',
            'loadedmetadata',
            'volumechange',
            'progress',
            'seeking',
            'seeked'
        ];

        const getVideo = () => {
            const fs = getFullscreenEl();
            if (fs) {
                if (fs.tagName === 'VIDEO' || fs.tagName === 'AUDIO') return fs;
                const video = fs.querySelector('video, audio');
                if (video) return video;
            }
            return getDirectVideos()[0] || null;
        };

        const getIframeVideos = () => {
            const unique = new Set();
            for (const video of queryAllDeep('video, audio')) {
                if (!video?.isConnected) continue;

                if (!isDetectableVideo(video)) continue;

                try {
                    const style = window.getComputedStyle(video);
                    if (style.display === 'none' || style.visibility === 'hidden') continue;
                } catch {
                    // Some cross-origin or detached nodes may not expose computed styles.
                }

                const isYouTube = location.hostname.includes('youtube.com') || location.hostname.includes('youtube-nocookie.com');
                if (isYouTube) {
                    const isMainPlayer = video.classList.contains('html5-main-video') || video.closest('#movie_player');
                    if (!isMainPlayer) continue;
                }

                const rect = getRect(video);
                const hasMediaSource = Boolean(video.currentSrc || video.src || video.querySelector('source[src]'));
                const hasPlaybackState = Number.isFinite(video.duration) || video.readyState > 0 || video.currentTime > 0;
                const largeEnough = rect.width >= 160 && rect.height >= 90;
                if (!(hasMediaSource || hasPlaybackState || largeEnough)) continue;

                unique.add(video);
            }
            return [...unique].sort(compareVideoPriority);
        };

        const getOwnVideoCount = () => getIframeVideos().length;

        const onActiveIframeStateChange = (event) => {
            const video = event.currentTarget;
            if (video && video !== activeIframeVideo) {
                activeIframeVideo = video;
                applyIframePresentation(activeIframeVideo);
                bindActiveIframeState(activeIframeVideo);
            }
            onStateChange();
        };

        const unbindActiveIframeState = () => {
            if (!trackedStateVideo) return;
            IFRAME_STATE_EVENTS.forEach((eventName) => trackedStateVideo.removeEventListener(eventName, onActiveIframeStateChange));
            trackedStateVideo = null;
        };

        const bindActiveIframeState = (video) => {
            if (trackedStateVideo === video) return;
            unbindActiveIframeState();
            if (!video) return;
            trackedStateVideo = video;
            IFRAME_STATE_EVENTS.forEach((eventName) => trackedStateVideo.addEventListener(eventName, onActiveIframeStateChange));
        };

        const getCurrentIframeVideo = () => {
            const preferredVideo = getIframeVideos()[0] || null;
            if (
                preferredVideo &&
                (!activeIframeVideo?.isConnected || (preferredVideo !== activeIframeVideo && isVideoActivelyPlaying(preferredVideo)))
            ) {
                activeIframeVideo = preferredVideo;
            }
            if (activeIframeVideo?.isConnected) {
                bindActiveIframeState(activeIframeVideo);
                return activeIframeVideo;
            }
            activeIframeVideo = getVideo() || preferredVideo;
            bindActiveIframeState(activeIframeVideo);
            return activeIframeVideo;
        };

        const applyIframePresentation = (video = getCurrentIframeVideo()) => {
            if (!video) return;
            if (styledIframeVideo && styledIframeVideo !== video) {
                Object.assign(styledIframeVideo.style, { objectFit: '', transform: '' });
            }
            styledIframeVideo = video;
            const zoom = ZOOM_LEVELS[iframeUiState.zoomIdx];
            const transforms = [];
            if (iframeUiState.rotationAngle) transforms.push(`rotate(${iframeUiState.rotationAngle}deg)`);
            if (zoom !== 1) transforms.push(`scale(${zoom})`);
            video.style.transform = transforms.join(' ');
            video.style.objectFit =
                iframeUiState.rotationAngle === 90 || iframeUiState.rotationAngle === 270 ? 'contain' : FIT_MODES[iframeUiState.fitIdx];
        };

        const switchIframeVideo = (dir) => {
            const list = getIframeVideos();
            if (!list.length) return;
            const current = getCurrentIframeVideo();
            const index = Math.max(0, list.indexOf(current));
            activeIframeVideo = list[(index + dir + list.length) % list.length];
            bindActiveIframeState(activeIframeVideo);
            Object.assign(iframeUiState, { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 });
            applyIframePresentation(activeIframeVideo);
        };

        const setActiveIframeVideo = (video) => {
            activeIframeVideo = video;
            bindActiveIframeState(activeIframeVideo);
            applyIframePresentation(activeIframeVideo);
        };

        return {
            getOwnVideoCount,
            getIframeVideos,
            getCurrentIframeVideo,
            applyIframePresentation,
            switchIframeVideo,
            unbindActiveIframeState,
            setActiveIframeVideo
        };
    };
})();


/* --- Source: content/video-floating/iframe-message-bridge.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FVP_IFRAME_BRIDGE, FIT_MODES, ZOOM_LEVELS } = videoFloating;
    const { queryAllDeep, clamp } = videoFloating.core.utils;

    videoFloating.createIframeMessageBridge = (deps) => {
        const { videoManager, iframeUiState, setFloatingActive } = deps;
        const childFrameVideoMap = new Map();

        const postIframeBridgeMessage = (payload) => {
            try {
                window.postMessage({ source: FVP_IFRAME_BRIDGE, ...payload }, '*');
            } catch {
                // Bridge delivery is best-effort across frame boundaries.
            }
        };

        const postIframeState = () => {
            const video = videoManager.getCurrentIframeVideo();
            try {
                window.parent.postMessage(
                    {
                        type: 'fvp-iframe-state',
                        state: video
                            ? {
                                  hasVideo: true,
                                  paused: !!video.paused,
                                  muted: !!video.muted,
                                  volume: video.volume || 1,
                                  currentTime: video.currentTime || 0,
                                  duration: video.duration || 0,
                                  playbackRate: video.playbackRate || 1,
                                  bufferedEnd: video.buffered?.length ? video.buffered.end(video.buffered.length - 1) : 0,
                                  fitIdx: iframeUiState.fitIdx,
                                  zoomIdx: iframeUiState.zoomIdx,
                                  rotationAngle: iframeUiState.rotationAngle
                              }
                            : {
                                  hasVideo: false,
                                  paused: true,
                                  muted: false,
                                  volume: 1,
                                  currentTime: 0,
                                  duration: 0,
                                  playbackRate: 1,
                                  bufferedEnd: 0,
                                  fitIdx: 0,
                                  zoomIdx: 0,
                                  rotationAngle: 0
                              }
                    },
                    '*'
                );
            } catch {
                // Parent may be gone while the iframe is unloading.
            }
        };

        const pruneChildFrames = () => {
            for (const frame of [...childFrameVideoMap.keys()]) {
                if (!frame?.isConnected) childFrameVideoMap.delete(frame);
            }
        };

        const reportVideos = () => {
            pruneChildFrames();
            try {
                window.parent.postMessage(
                    {
                        type: 'fvp-iframe-videos',
                        count: videoManager.getOwnVideoCount() + [...childFrameVideoMap.values()].reduce((sum, count) => sum + count, 0)
                    },
                    '*'
                );
            } catch {
                // Parent may be gone while the iframe is unloading.
            }
        };

        const playIframeVideo = (video) => {
            if (!video) return;
            video.play?.().catch(() => {
                postIframeState();
            });
        };

        const ALLOWED_IFRAME_COMMANDS = new Set([
            'set-floating-active',
            'play',
            'pause',
            'play-pause',
            'toggle-mute',
            'seek-to-ratio',
            'prev-video',
            'next-video',
            'cycle-fit',
            'cycle-zoom',
            'rotate',
            'get-state',
            'get-quality',
            'set-quality',
            'set-speed'
        ]);

        const onMessage = (event) => {
            if (!event || !event.data || typeof event.data !== 'object') return;

            if (event.source === window && event.data?.source === FVP_IFRAME_BRIDGE) {
                if (event.data?.type === 'fvp-page-quality-result') {
                    try {
                        window.parent.postMessage(
                            { type: 'fvp-iframe-quality-result', detail: Array.isArray(event.data.detail) ? event.data.detail : [] },
                            '*'
                        );
                    } catch {
                        // Parent may be gone while the iframe is unloading.
                    }
                }
                return;
            }

            if (event.data?.type === 'fvp-iframe-videos') {
                if (event.source === window) return;
                const frame = Array.from(queryAllDeep('iframe')).find((iframe) => iframe.contentWindow === event.source);
                if (frame) {
                    const count = Number(event.data.count) || 0;
                    if (count > 0) childFrameVideoMap.set(frame, count);
                    else childFrameVideoMap.delete(frame);
                    reportVideos();
                }
                return;
            }

            if (event.data?.type !== 'fvp-iframe-command') return;

            // Security check: Only process iframe commands originating from top/parent frames or self
            if (event.source !== window.parent && event.source !== window.top && event.source !== window) {
                return;
            }

            const command = String(event.data.command || '').trim();
            if (!ALLOWED_IFRAME_COMMANDS.has(command)) {
                return;
            }

            if (command === 'set-floating-active') {
                setFloatingActive(!!event.data.active);
                return;
            }
            const video = videoManager.getCurrentIframeVideo();
            switch (command) {
                case 'play':
                    playIframeVideo(video);
                    break;
                case 'pause':
                    if (video) video.pause();
                    break;
                case 'play-pause':
                    if (video) video.paused ? playIframeVideo(video) : video.pause();
                    break;
                case 'toggle-mute':
                    if (video) video.muted = !video.muted;
                    break;
                case 'seek-to-ratio':
                    if (video?.duration) video.currentTime = clamp((Number(event.data.ratio) || 0) * video.duration, 0, video.duration);
                    break;
                case 'prev-video':
                    videoManager.switchIframeVideo(-1);
                    break;
                case 'next-video':
                    videoManager.switchIframeVideo(1);
                    break;
                case 'cycle-fit':
                    iframeUiState.fitIdx = (iframeUiState.fitIdx + 1) % FIT_MODES.length;
                    videoManager.applyIframePresentation();
                    break;
                case 'cycle-zoom':
                    iframeUiState.zoomIdx = (iframeUiState.zoomIdx + 1) % ZOOM_LEVELS.length;
                    videoManager.applyIframePresentation();
                    break;
                case 'rotate':
                    iframeUiState.rotationAngle = (iframeUiState.rotationAngle + 90) % 360;
                    videoManager.applyIframePresentation();
                    break;
                case 'get-state':
                    break;
                case 'get-quality':
                    postIframeBridgeMessage({ type: 'fvp-page-get-quality' });
                    break;
                case 'set-quality':
                    if (event.data.item && typeof event.data.item === 'object')
                        postIframeBridgeMessage({ type: 'fvp-page-set-quality', item: event.data.item });
                    break;
                case 'set-speed':
                    if (video) video.playbackRate = Number(event.data.rate) || 1;
                    break;
                default:
                    break;
            }
            postIframeState();
            if (command !== 'get-state') setTimeout(postIframeState, 80);
        };

        const install = () => {
            window.addEventListener('message', onMessage);
            return () => {
                window.removeEventListener('message', onMessage);
            };
        };

        return {
            install,
            postIframeState,
            reportVideos
        };
    };
})();


/* --- Source: content/video-floating/iframe-gestures.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { WHEEL_GESTURE } = videoFloating;
    const { clamp } = videoFloating.core.utils;
    const { TOUCH_SWITCH_VIDEO_EVENT } = videoFloating.core.config;

    videoFloating.createIframeGestures = (deps) => {
        const { videoManager, getFloatingActive, postIframeState } = deps;

        let wheelDeltaY = 0;
        let wheelGestureResetTimer = 0;
        let wheelSeekBaseTime = null;
        let wheelSeekDeltaX = 0;
        let lastWheelSwitchAt = 0;
        let hasSwitchedInCurrentGesture = false;

        const scheduleWheelGestureReset = () => {
            clearTimeout(wheelGestureResetTimer);
            wheelGestureResetTimer = window.setTimeout(() => {
                wheelDeltaY = 0;
                wheelSeekBaseTime = null;
                wheelSeekDeltaX = 0;
                wheelGestureResetTimer = 0;
                hasSwitchedInCurrentGesture = false;
            }, WHEEL_GESTURE.idleMs);
        };

        const getWheelDeltaPixels = (event) => {
            const delta = Number(event?.deltaY) || 0;
            if (event?.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
            if (event?.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * Math.max(1, innerHeight);
            return delta;
        };

        const seekFromWheel = (deltaX) => {
            const video = videoManager.getCurrentIframeVideo();
            if (!video?.duration) return false;
            if (wheelSeekBaseTime === null) {
                wheelSeekBaseTime = video.currentTime || 0;
                wheelSeekDeltaX = 0;
            }
            wheelSeekDeltaX += deltaX;
            video.currentTime = clamp(wheelSeekBaseTime + wheelSeekDeltaX * WHEEL_GESTURE.seekSecondsPerPixel, 0, video.duration);
            postIframeState();
            return true;
        };

        const onWheel = (event) => {
            if (!getFloatingActive()) return;
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            scheduleWheelGestureReset();

            const absX = Math.abs(event.deltaX || 0);
            const absY = Math.abs(event.deltaY || 0);
            if (absX > 0 && absX >= absY * 0.8) {
                seekFromWheel(event.deltaX || 0);
                return;
            }

            if (hasSwitchedInCurrentGesture) return;

            wheelDeltaY += getWheelDeltaPixels(event);
            if (Math.abs(wheelDeltaY) < WHEEL_GESTURE.switchThreshold) return;

            const now = performance.now();
            if (now - lastWheelSwitchAt < WHEEL_GESTURE.switchCooldownMs) return;

            const dir = wheelDeltaY > 0 ? 1 : -1;
            videoManager.switchIframeVideo(dir);
            hasSwitchedInCurrentGesture = true;
            wheelDeltaY -= dir * WHEEL_GESTURE.switchThreshold;
            if (Math.sign(wheelDeltaY) !== dir) wheelDeltaY = 0;
            lastWheelSwitchAt = now;
            postIframeState();
            setTimeout(postIframeState, 80);
        };

        const onTouchSwitchVideo = (event) => {
            const dir = Number(event.detail?.dir) || 0;
            if (!dir) return;
            videoManager.switchIframeVideo(dir > 0 ? 1 : -1);
            postIframeState();
        };

        const install = () => {
            window.addEventListener('wheel', onWheel, { capture: true, passive: false });
            window.addEventListener(TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);

            return () => {
                window.removeEventListener('wheel', onWheel, { capture: true, passive: false });
                window.removeEventListener(TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);
                clearTimeout(wheelGestureResetTimer);
            };
        };

        return { install };
    };
})();


/* --- Source: content/video-floating/iframe-mode.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createIframeController = () => {
        const iframeUiState = { fitIdx: 0, zoomIdx: 0, rotationAngle: 0 };
        let isFloatingActive = false;
        let reportTimer = 0;

        const setFloatingActive = (active) => {
            isFloatingActive = active;
        };

        const getFloatingActive = () => isFloatingActive;

        const videoManager = videoFloating.createIframeVideoManager({
            iframeUiState,
            onStateChange: () => messageBridge.postIframeState()
        });

        const messageBridge = videoFloating.createIframeMessageBridge({
            videoManager,
            iframeUiState,
            setFloatingActive
        });

        const gestures = videoFloating.createIframeGestures({
            videoManager,
            getFloatingActive,
            postIframeState: () => messageBridge.postIframeState()
        });

        const uninstallMessageBridge = messageBridge.install();
        const uninstallGestures = gestures.install();

        const onVideoPlay = (event) => {
            const video = event.target;
            if (!(video instanceof HTMLVideoElement) || !video.isConnected) return;
            videoManager.setActiveIframeVideo(video);
            messageBridge.postIframeState();
        };
        window.addEventListener('play', onVideoPlay, true);

        reportTimer = window.setInterval(messageBridge.reportVideos, videoFloating.VIDEO_CHECK_INTERVAL);
        messageBridge.reportVideos();
        messageBridge.postIframeState();

        return {
            onConfigChange() {},
            destroy() {
                videoManager.unbindActiveIframeState();
                uninstallMessageBridge();
                uninstallGestures();
                window.removeEventListener('play', onVideoPlay, true);
                window.clearInterval(reportTimer);
            }
        };
    };
})();


/* --- Source: content/video-floating/video-presentation-helper.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    const originalVideoStyles = new WeakMap();

    const captureVideoPresentation = (video) => {
        if (video && !originalVideoStyles.has(video)) {
            originalVideoStyles.set(video, video.getAttribute('style'));
        }
    };

    const resetVideoPresentation = (video) => {
        if (!video) return;
        Object.assign(video.style, {
            width: '',
            height: '',
            objectFit: '',
            objectPosition: '',
            transform: '',
            transition: ''
        });
    };

    const restoreVideoPresentation = (video) => {
        if (!video) return;
        if (!originalVideoStyles.has(video)) {
            resetVideoPresentation(video);
            return;
        }
        const originalStyle = originalVideoStyles.get(video);
        if (originalStyle === null) {
            video.removeAttribute('style');
        } else {
            video.setAttribute('style', originalStyle);
        }
        originalVideoStyles.delete(video);
    };

    const restoreVideoNode = (video, parent, placeholder) => {
        if (!video) return false;
        if (parent?.isConnected) {
            if (placeholder?.parentNode === parent) {
                parent.replaceChild(video, placeholder);
            } else {
                parent.appendChild(video);
            }
            return true;
        }
        if (placeholder?.parentNode) {
            placeholder.parentNode.replaceChild(video, placeholder);
            return true;
        }
        video.remove();
        return false;
    };

    const createTransitionLayer = (video, className, el) => {
        if (!video) return null;
        const layer = el('div', `fvp-transition-layer ${className}`);
        layer.appendChild(video);
        return layer;
    };

    videoFloating.presentationHelper = {
        captureVideoPresentation,
        resetVideoPresentation,
        restoreVideoPresentation,
        restoreVideoNode,
        createTransitionLayer
    };
})();


/* --- Source: content/video-floating/video-collection.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createVideoCollection = (ctx, deps) => {
        const { $, getDirectVideos, getDirectVideoSequence, getTrackedIframeEntries, isFeatureEnabled, updateLeftPanelLayout } = deps;

        const getSwitchVideos = () => (typeof getDirectVideoSequence === 'function' ? getDirectVideoSequence() : getDirectVideos());

        const getVideos = () => {
            const liveVideos = getSwitchVideos();
            const snapshot = Array.isArray(ctx.videoSequence)
                ? ctx.videoSequence.filter(
                      (video) =>
                          video?.isConnected &&
                          (video === ctx.curVid || video === ctx.state.switchTransition?.nextVideo || !video.closest?.('#fvp-wrapper'))
                  )
                : [];
            const merged = [];
            const seen = new Set();
            for (const video of [...snapshot, ...liveVideos]) {
                if (!video || seen.has(video)) {
                    continue;
                }
                seen.add(video);
                merged.push(video);
            }
            if (ctx.curVid?.isConnected && !merged.includes(ctx.curVid)) {
                merged.unshift(ctx.curVid);
            }
            return merged;
        };

        const getVideoOrderInfo = (video = ctx.curVid) => {
            if (!video) return { index: 0, total: 0 };
            const list = getVideos();
            const index = list.indexOf(video);
            return {
                index: index >= 0 ? index + 1 : 1,
                total: Math.max(list.length, 1)
            };
        };

        const updateVideoOrderUI = (video = ctx.curVid) => {
            const badge = $('fvp-video-order');
            if (!badge) return;
            if (ctx.floatedIframe || !video) {
                badge.hidden = true;
                badge.textContent = '';
                updateLeftPanelLayout?.();
                return;
            }
            const order = getVideoOrderInfo(video);
            badge.hidden = false;
            badge.textContent = `${order.index}/${order.total}`;
            badge.title = `Video ${order.index} / ${order.total}`;
            updateLeftPanelLayout?.();
        };

        const getOrderedVideoSequence = () => {
            const list = getVideos();
            if (!ctx.curVid) return list;
            const currentIndex = list.indexOf(ctx.curVid);
            if (currentIndex < 0) return [ctx.curVid, ...list];
            return [...list.slice(currentIndex), ...list.slice(0, currentIndex)];
        };

        const updateVideoDetectionUI = () => {
            if (!ctx.iconRef) return;
            if (!isFeatureEnabled()) {
                ctx.iconRef.hide();
                ctx.menuRef?.hide();
                return;
            }
            for (const frame of [...ctx.iframeVideoMap.keys()]) if (!frame?.isConnected) ctx.iframeVideoMap.delete(frame);
            const count = getVideos().length + getTrackedIframeEntries(ctx.iframeVideoMap).length;
            if (count > 0) {
                ctx.iconRef.show();
                ctx.iconRef.setBadge(count);
            } else {
                ctx.iconRef.hide();
            }
        };

        return {
            getSwitchVideos,
            getVideos,
            getOrderedVideoSequence,
            updateVideoDetectionUI,
            updateVideoOrderUI
        };
    };
})();


/* --- Source: content/video-floating/video-lifecycle.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FIT_MODES, ZOOM_LEVELS } = videoFloating;

    videoFloating.createVideoLifecycle = (ctx, deps, videoCollection) => {
        const {
            el,
            $,
            isFeatureEnabled,
            loadLayout,
            ensureLayoutReady,
            formatTime,
            applyBoxLayout,
            updateLeftPanelLayout,
            updateVolUI,
            updateSpeedUI,
            updatePlaybackOverlayUI
        } = deps;

        const { captureVideoPresentation, restoreVideoPresentation, restoreVideoNode } = videoFloating.presentationHelper;

        const isFloatingShellOpen = () => !!(ctx.box && ctx.box.style.display !== 'none');

        const showFloatingShell = ({ applySavedLayout = false, isCurrent = () => true } = {}) => {
            if (!ctx.box) return;
            ctx.box.style.display = 'flex';
            if (!applySavedLayout) {
                updateLeftPanelLayout?.();
                return;
            }
            applyBoxLayout(loadLayout());
            ensureLayoutReady().then((layout) => {
                if (layout && isFloatingShellOpen() && isCurrent()) applyBoxLayout(layout);
            });
        };

        const applyTransform = () => {
            if (!ctx.curVid) return;
            const zoom = ZOOM_LEVELS[ctx.zoomIdx];
            const transforms = [];
            if (ctx.rotationAngle) transforms.push(`rotate(${ctx.rotationAngle}deg)`);
            if (zoom !== 1) transforms.push(`scale(${zoom})`);
            ctx.curVid.style.transform = transforms.join(' ');
            ctx.curVid.style.objectFit = ctx.rotationAngle === 90 || ctx.rotationAngle === 270 ? 'contain' : FIT_MODES[ctx.fitIdx];
        };

        const stopProgressLoop = () => {
            if (ctx.state.rafId) {
                cancelAnimationFrame(ctx.state.rafId);
                ctx.state.rafId = null;
            }
        };

        const startProgressLoop = () => {
            stopProgressLoop();
            const updateLoop = () => {
                if (!ctx.curVid) return;
                if (!ctx.state.isSeeking && ctx.curVid.duration) {
                    const seek = $('fvp-seek');
                    if (seek) seek.value = (ctx.curVid.currentTime / ctx.curVid.duration) * 10000;
                    const td = $('fvp-time-display');
                    if (td) td.textContent = `${formatTime(ctx.curVid.currentTime)}/${formatTime(ctx.curVid.duration)}`;
                }
                if (ctx.curVid.buffered?.length && ctx.curVid.duration) {
                    const buffer = $('fvp-buffer');
                    if (buffer)
                        buffer.style.width = `${(ctx.curVid.buffered.end(ctx.curVid.buffered.length - 1) / ctx.curVid.duration) * 100}%`;
                }
                ctx.state.rafId = requestAnimationFrame(updateLoop);
            };
            ctx.state.rafId = requestAnimationFrame(updateLoop);
        };

        const clearWrapper = (wrapper, keepNodes = []) => {
            if (!wrapper) return;
            const keep = new Set(keepNodes.filter(Boolean));
            [...wrapper.childNodes].forEach((node) => {
                if (!keep.has(node)) node.remove();
            });
        };

        const bindCurrentVideo = (video, onEnded) => {
            if (!video) return;
            video.onplay = () => updatePlaybackOverlayUI?.();
            video.onpause = () => updatePlaybackOverlayUI?.();
            video.onended = () => {
                updatePlaybackOverlayUI?.();
                onEnded?.();
            };
        };

        const activateCurrentVideo = (video, onEnded) => {
            if (!video) return;
            ctx.curVid = video;
            ctx.zoomIdx = 0;
            ctx.rotationAngle = 0;
            applyTransform();
            updateVolUI();
            updateSpeedUI?.();
            videoCollection.updateVideoOrderUI(video);
            updatePlaybackOverlayUI?.();
            startProgressLoop();
            bindCurrentVideo(video, onEnded);
            video.play().catch(() => {
                updatePlaybackOverlayUI?.();
            });
        };

        const restore = (cleanupSwitchTransition, restoreFloatedIframe) => {
            stopProgressLoop();
            if (ctx.state.seekApplyRaf) {
                cancelAnimationFrame(ctx.state.seekApplyRaf);
                ctx.state.seekApplyRaf = 0;
            }
            clearTimeout(ctx.state.transitionTimer);
            ctx.state.transitionTimer = 0;
            ctx.state.isSwitchingVideo = false;

            const transitionRestored = cleanupSwitchTransition ? cleanupSwitchTransition() : false;
            ctx.state.pendingSeekRatio = null;
            ctx.state.seekPreviewRatio = null;
            ctx.state.isSeeking = false;
            ctx.state.seekDragActive = false;

            if (ctx.floatedIframe) {
                restoreFloatedIframe?.({ clearRefs: true });
            } else if (!transitionRestored && ctx.curVid) {
                restoreVideoNode(ctx.curVid, ctx.origPar, ctx.ph);
                restoreVideoPresentation(ctx.curVid);
                ctx.curVid.onplay = ctx.curVid.onpause = ctx.curVid.onended = null;
                ctx.curVid = null;
            }

            clearWrapper($('fvp-wrapper'));
            if (ctx.box) ctx.box.style.display = 'none';
            ctx.videoSequence = [];
            ctx.zoomIdx = 0;
            ctx.rotationAngle = 0;
            updateLeftPanelLayout?.();
            videoCollection.updateVideoOrderUI(null);
            updatePlaybackOverlayUI?.();
        };

        const float = (video, restoreFunc, onEnded) => {
            if (!isFeatureEnabled()) return;
            const shouldApplyLayout = !isFloatingShellOpen();

            if (ctx.floatedIframe) {
                restoreFunc?.(false, true); // Partial restore to clear iframe
            }
            if (ctx.curVid && ctx.curVid !== video) {
                restoreFunc?.();
            }
            if (ctx.curVid === video) return;

            deps.ensureInitialized();
            ctx.videoSequence = videoCollection.getSwitchVideos();
            ctx.origPar = video.parentNode;
            ctx.curVid = video;

            captureVideoPresentation(video);
            ctx.ph = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            ctx.ph.style.cssText = `width:${video.offsetWidth || 300}px;height:${video.offsetHeight || 200}px`;
            ctx.origPar?.replaceChild(ctx.ph, video);

            const wrapper = $('fvp-wrapper');
            clearWrapper(wrapper);
            wrapper.appendChild(video);
            video.style.objectFit = FIT_MODES[ctx.fitIdx];

            showFloatingShell({
                applySavedLayout: shouldApplyLayout,
                isCurrent: () => ctx.curVid === video
            });
            ctx.menuRef?.hide();
            updatePlaybackOverlayUI?.();
            activateCurrentVideo(video, onEnded);
        };

        return {
            isFloatingShellOpen,
            showFloatingShell,
            applyTransform,
            stopProgressLoop,
            startProgressLoop,
            clearWrapper,
            activateCurrentVideo,
            restore,
            float
        };
    };
})();


/* --- Source: content/video-floating/video-switcher.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FIT_MODES } = videoFloating;

    videoFloating.createVideoSwitcher = (ctx, deps, videoCollection, videoLifecycle) => {
        const { el, $, updatePlaybackOverlayUI } = deps;
        const { restoreVideoNode, restoreVideoPresentation, captureVideoPresentation, createTransitionLayer } =
            videoFloating.presentationHelper;

        const cleanupSwitchTransition = () => {
            const transition = ctx.state.switchTransition;
            if (!transition) return false;
            const { currentVideo, previousPlaceholder, previousParent, nextVideo, nextPlaceholder, nextParent } = transition;
            restoreVideoNode(currentVideo, previousParent, previousPlaceholder);
            restoreVideoNode(nextVideo, nextParent, nextPlaceholder);
            restoreVideoPresentation(currentVideo);
            restoreVideoPresentation(nextVideo);
            currentVideo.onplay = currentVideo.onpause = currentVideo.onended = null;
            nextVideo.onplay = nextVideo.onpause = nextVideo.onended = null;
            currentVideo.pause?.();
            nextVideo.pause?.();
            ctx.state.switchTransition = null;
            ctx.curVid = null;
            ctx.origPar = null;
            ctx.ph = null;
            return true;
        };

        const switchVid = (dir, floatFunc, onEnded) => {
            if (ctx.state.isSwitchingVideo) return;
            const sequence = videoCollection.getOrderedVideoSequence();
            if (!sequence.length) return;
            const currentIndex = ctx.curVid && sequence.includes(ctx.curVid) ? sequence.indexOf(ctx.curVid) : 0;
            const nextIndex = (currentIndex + dir + sequence.length) % sequence.length;
            const nextVideo = sequence[nextIndex];
            if (!nextVideo || nextVideo === ctx.curVid) return;
            if (!ctx.curVid || !ctx.box || ctx.box.style.display === 'none') {
                floatFunc?.(nextVideo);
                return;
            }
            const wrapper = $('fvp-wrapper');
            if (!wrapper) {
                floatFunc?.(nextVideo);
                return;
            }

            const currentVideo = ctx.curVid;
            const previousPlaceholder = ctx.ph;
            const previousParent = ctx.origPar;
            const nextParent = nextVideo.parentNode;
            if (!previousPlaceholder || !previousParent || !nextParent) {
                floatFunc?.(nextVideo);
                return;
            }

            videoLifecycle.stopProgressLoop();
            ctx.state.isSwitchingVideo = true;
            currentVideo.onplay = currentVideo.onpause = currentVideo.onended = null;
            currentVideo.pause?.();

            captureVideoPresentation(nextVideo);
            const nextPlaceholder = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            nextPlaceholder.style.cssText = `width:${nextVideo.offsetWidth || 300}px;height:${nextVideo.offsetHeight || 200}px`;
            nextParent.replaceChild(nextPlaceholder, nextVideo);
            ctx.state.switchTransition = {
                currentVideo,
                previousPlaceholder,
                previousParent,
                nextVideo,
                nextPlaceholder,
                nextParent
            };

            videoLifecycle.clearWrapper(wrapper, [currentVideo]);
            const outgoingLayer = createTransitionLayer(currentVideo, dir > 0 ? 'is-outgoing-up' : 'is-outgoing-down', el);
            const incomingLayer = createTransitionLayer(nextVideo, dir > 0 ? 'is-incoming-from-bottom' : 'is-incoming-from-top', el);
            if (!outgoingLayer || !incomingLayer) {
                ctx.state.switchTransition = null;
                restoreVideoNode(nextVideo, nextParent, nextPlaceholder);
                restoreVideoPresentation(nextVideo);
                ctx.state.isSwitchingVideo = false;
                floatFunc?.(nextVideo);
                return;
            }

            wrapper.appendChild(outgoingLayer);
            wrapper.appendChild(incomingLayer);
            nextVideo.style.objectFit = FIT_MODES[0];
            nextVideo.play().catch(() => {
                updatePlaybackOverlayUI?.();
            });
            videoCollection.updateVideoOrderUI(nextVideo);

            requestAnimationFrame(() => {
                outgoingLayer.classList.add('is-animating');
                incomingLayer.classList.add('is-animating');
            });

            const finalizeSwitch = () => {
                if (!ctx.state.isSwitchingVideo) return;
                clearTimeout(ctx.state.transitionTimer);
                ctx.state.transitionTimer = 0;
                ctx.state.isSwitchingVideo = false;
                restoreVideoNode(currentVideo, previousParent, previousPlaceholder);
                restoreVideoPresentation(currentVideo);
                currentVideo.pause?.();
                ctx.state.switchTransition = null;
                ctx.origPar = nextParent;
                ctx.ph = nextPlaceholder;
                wrapper.appendChild(nextVideo);
                outgoingLayer.remove();
                incomingLayer.remove();
                videoLifecycle.clearWrapper(wrapper, [nextVideo]);
                videoLifecycle.activateCurrentVideo(nextVideo, onEnded);
            };

            ctx.state.transitionTimer = setTimeout(finalizeSwitch, 260);
        };

        return {
            cleanupSwitchTransition,
            switchVid
        };
    };
})();


/* --- Source: content/video-floating/iframe-lifecycle.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createIframeLifecycle = (ctx, deps, videoLifecycle, videoCollection) => {
        const { el, $, isFeatureEnabled, updatePlaybackOverlayUI, postToFloatedIframe } = deps;

        const resetIframePlaybackState = () => {
            Object.assign(ctx.iframePlaybackState, {
                hasVideo: false,
                paused: true,
                muted: false,
                volume: 1,
                currentTime: 0,
                duration: 0,
                bufferedEnd: 0,
                fitIdx: 0,
                zoomIdx: 0,
                rotationAngle: 0
            });
        };

        const restoreFloatedIframe = ({ clearRefs = false } = {}) => {
            if (!ctx.floatedIframe) return;
            clearInterval(ctx.iframeStatePollTimer);
            ctx.iframeStatePollTimer = 0;
            postToFloatedIframe({ command: 'set-floating-active', active: false });
            ctx.floatedIframe.setAttribute('style', ctx.iframeOrigStyle);
            ctx.iframeOrigPar?.replaceChild(ctx.floatedIframe, ctx.iframePh);
            if (!clearRefs) return;
            ctx.floatedIframe = null;
            ctx.iframeOrigPar = null;
            ctx.iframePh = null;
            resetIframePlaybackState();
        };

        const floatIframe = (iframe, restoreFunc) => {
            if (!isFeatureEnabled()) return;
            const shouldApplyLayout = !videoLifecycle.isFloatingShellOpen();
            if (ctx.floatedIframe) {
                restoreFloatedIframe();
            }
            if (ctx.curVid) {
                restoreFunc?.(false, true); // Partial restore to clear curVid
            }
            deps.ensureInitialized();
            ctx.floatedIframe = iframe;
            ctx.iframeOrigPar = iframe.parentNode;
            ctx.iframeOrigStyle = iframe.getAttribute('style') || '';
            resetIframePlaybackState();
            ctx.iframePh = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            ctx.iframePh.style.cssText = `width:${iframe.offsetWidth || 300}px;height:${iframe.offsetHeight || 200}px`;
            ctx.iframeOrigPar?.replaceChild(ctx.iframePh, iframe);
            const wrapper = $('fvp-wrapper');
            videoLifecycle.clearWrapper(wrapper);
            iframe.style.cssText = 'width:100%!important;height:100%!important;border:none!important;position:absolute;top:0;left:0;';
            wrapper.appendChild(iframe);
            videoLifecycle.showFloatingShell({
                applySavedLayout: shouldApplyLayout,
                isCurrent: () => ctx.floatedIframe === iframe
            });
            ctx.menuRef?.hide();
            videoCollection.updateVideoOrderUI(null);
            updatePlaybackOverlayUI?.();
            postToFloatedIframe({ command: 'set-floating-active', active: true });
            postToFloatedIframe({ command: 'get-state' });
            ctx.iframeStatePollTimer = setInterval(() => postToFloatedIframe({ command: 'get-state' }), 350);
        };

        return {
            resetIframePlaybackState,
            restoreFloatedIframe,
            floatIframe
        };
    };
})();


/* --- Source: content/video-floating/floating-session.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createFloatingSession = (ctx, deps) => {
        const videoCollection = videoFloating.createVideoCollection(ctx, deps);

        let videoLifecycle;
        let iframeLifecycle;
        let videoSwitcher;

        videoLifecycle = videoFloating.createVideoLifecycle(ctx, deps, videoCollection);

        iframeLifecycle = videoFloating.createIframeLifecycle(ctx, deps, videoLifecycle, videoCollection);

        videoSwitcher = videoFloating.createVideoSwitcher(ctx, deps, videoCollection, videoLifecycle);

        // Bridge circular dependencies with arrow functions
        const cleanupSwitchTransition = () => videoSwitcher.cleanupSwitchTransition();
        const restoreFloatedIframe = (opts) => iframeLifecycle.restoreFloatedIframe(opts);
        const floatFunc = (video) => videoLifecycle.float(video, restore, onVideoEnded);
        const onVideoEnded = () => videoSwitcher.switchVid(1, floatFunc, onVideoEnded);

        const restore = (skipSwitchCleanup, skipIframeRestore) => {
            videoLifecycle.restore(skipSwitchCleanup ? null : cleanupSwitchTransition, skipIframeRestore ? null : restoreFloatedIframe);
        };

        const float = (video) => videoLifecycle.float(video, restore, onVideoEnded);
        const floatIframe = (iframe) => iframeLifecycle.floatIframe(iframe, restore);
        const switchVid = (dir) => videoSwitcher.switchVid(dir, float, onVideoEnded);

        return {
            getVideos: videoCollection.getVideos,
            getOrderedVideoSequence: videoCollection.getOrderedVideoSequence,
            updateVideoDetectionUI: videoCollection.updateVideoDetectionUI,
            applyTransform: videoLifecycle.applyTransform,
            restore,
            switchVid,
            floatIframe,
            float
        };
    };
})();


/* --- Source: content/video-floating/seek-controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createSeekController = (ctx, deps) => {
        const { $, clamp, formatTime } = deps;

        const getActiveSeekDuration = () => (ctx.floatedIframe ? ctx.iframePlaybackState.duration || 0 : ctx.curVid?.duration || 0);
        const renderSeekPreview = (ratio) => {
            const seek = $('fvp-seek');
            if (seek) seek.value = Math.round(clamp(ratio, 0, 1) * 10000);
            const duration = getActiveSeekDuration();
            const currentTime = duration > 0 ? clamp(ratio, 0, 1) * duration : 0;
            const td = $('fvp-time-display');
            if (td) td.textContent = `${formatTime(currentTime)}/${formatTime(duration)}`;
        };
        const flushPendingSeek = (force = false) => {
            ctx.state.seekApplyRaf = 0;
            if (ctx.state.pendingSeekRatio === null) return;
            const ratio = clamp(ctx.state.pendingSeekRatio, 0, 1);
            const now = performance.now();
            if (!force && now - ctx.state.lastSeekCommitAt < 70) {
                ctx.state.seekApplyRaf = requestAnimationFrame(() => flushPendingSeek(false));
                return;
            }
            ctx.state.lastSeekCommitAt = now;
            if (ctx.floatedIframe) {
                deps.postToFloatedIframe({ command: 'seek-to-ratio', ratio });
            } else if (ctx.curVid?.duration) {
                ctx.curVid.currentTime = ratio * ctx.curVid.duration;
            }
        };
        const scheduleSeekApply = (ratio) => {
            ctx.state.pendingSeekRatio = ratio;
            ctx.state.seekPreviewRatio = ratio;
            renderSeekPreview(ratio);
            if (ctx.state.seekApplyRaf) return;
            ctx.state.seekApplyRaf = requestAnimationFrame(() => flushPendingSeek(false));
        };
        const endSeekInteraction = () => {
            ctx.state.seekDragActive = false;
            if (ctx.state.pendingSeekRatio !== null) {
                flushPendingSeek(true);
                ctx.state.pendingSeekRatio = null;
            }

            // Keep isSeeking = true and preserve seekPreviewRatio for a brief period to allow the player to update its currentTime
            // and avoid snapping back to the old playback position.
            setTimeout(() => {
                if (!ctx.state.seekDragActive) {
                    ctx.state.isSeeking = false;
                    ctx.state.seekPreviewRatio = null;
                }
            }, 400);
        };

        const bind = () => {
            const seekEl = $('fvp-seek');

            const handleInput = () => {
                ctx.state.isSeeking = true;
                ctx.state.seekDragActive = true;
                const ratio = parseFloat(seekEl.value) / 10000;
                ctx.state.seekPreviewRatio = ratio;

                // Update the preview immediately
                const duration = getActiveSeekDuration();
                const currentTime = duration > 0 ? clamp(ratio, 0, 1) * duration : 0;
                const td = $('fvp-time-display');
                if (td) td.textContent = `${formatTime(currentTime)}/${formatTime(duration)}`;

                scheduleSeekApply(ratio);
            };

            const handleChange = () => {
                const ratio = parseFloat(seekEl.value) / 10000;
                ctx.state.pendingSeekRatio = ratio;
                endSeekInteraction();
            };

            seekEl.addEventListener('input', handleInput);
            seekEl.addEventListener('change', handleChange);

            return () => {
                seekEl.removeEventListener('input', handleInput);
                seekEl.removeEventListener('change', handleChange);
            };
        };

        return {
            bind,
            renderSeekPreview,
            endSeekInteraction
        };
    };
})();


/* --- Source: content/video-floating/ui-controls.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FIT_MODES, FIT_ICONS, ZOOM_LEVELS, ZOOM_ICONS } = videoFloating;

    videoFloating.createUiControls = (ctx, deps) => {
        const { $, el, formatTime, getFullscreenEl, postToFloatedIframe } = deps;
        const getPausedState = () => (ctx.floatedIframe ? !!ctx.iframePlaybackState.paused : !!(ctx.curVid?.paused ?? true));
        const requestIframeState = () => {
            if (!ctx.floatedIframe) return;
            postToFloatedIframe({ command: 'get-state' });
        };

        const updateVolUI = () => {
            const btn = $('fvp-vol-btn');
            if (!btn) return;
            const volume = ctx.floatedIframe
                ? ctx.iframePlaybackState.muted
                    ? 0
                    : ctx.iframePlaybackState.volume
                : ctx.curVid
                  ? ctx.curVid.muted
                      ? 0
                      : ctx.curVid.volume
                  : 1;
            btn.textContent = volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';
        };

        const updateSpeedUI = () => {
            const speedBtn = $('fvp-speed');
            if (!speedBtn) return;
            const rate = ctx.floatedIframe ? ctx.iframePlaybackState.playbackRate || 1 : ctx.curVid?.playbackRate || 1;
            speedBtn.textContent = `${Number(rate).toFixed(1)}x`;
        };

        const updatePlaybackOverlayUI = () => {
            const button = $('fvp-center-play');
            if (!button) return;
            const hasActiveMedia = !!(ctx.floatedIframe || ctx.curVid);
            if (!hasActiveMedia) {
                button.hidden = true;
                return;
            }
            const paused = getPausedState();
            button.textContent = '⏸';
            button.setAttribute('aria-label', paused ? 'Resume video' : 'Pause video');
            button.hidden = !paused;
        };

        const togglePlayback = () => {
            if (ctx.floatedIframe) {
                const paused = getPausedState();
                ctx.iframePlaybackState.paused = !paused;
                updatePlaybackOverlayUI();
                postToFloatedIframe({ command: paused ? 'play' : 'pause' });
                setTimeout(requestIframeState, 80);
                return;
            }
            if (!ctx.curVid) return;
            if (ctx.curVid.paused) ctx.curVid.play().catch(() => {});
            else ctx.curVid.pause();
        };

        const syncFloatedIframeUI = () => {
            const seek = $('fvp-seek');
            const duration = ctx.iframePlaybackState.duration || 0;
            const current = ctx.iframePlaybackState.currentTime || 0;
            if (ctx.state.isSeeking && ctx.state.seekPreviewRatio !== null) {
                // While dragging seek, keep the local preview stable and ignore iframe polling updates.
                deps.renderSeekPreview(ctx.state.seekPreviewRatio);
            } else {
                if (seek && duration > 0) seek.value = (current / duration) * 10000;
                const td = $('fvp-time-display');
                if (td) td.textContent = `${formatTime(current)}/${formatTime(duration)}`;
            }
            const buffer = $('fvp-buffer');
            if (buffer) buffer.style.width = duration > 0 ? `${(ctx.iframePlaybackState.bufferedEnd / duration) * 100}%` : '0%';
            updateVolUI();
            updateSpeedUI();
            updatePlaybackOverlayUI();
            const fit = $('fvp-fit');
            if (fit) fit.textContent = FIT_ICONS[ctx.iframePlaybackState.fitIdx] || FIT_ICONS[0];
            const zoom = $('fvp-zoom');
            if (zoom) zoom.textContent = ZOOM_ICONS[ctx.iframePlaybackState.zoomIdx] || ZOOM_ICONS[0];
            const rotate = $('fvp-rotate');
            if (rotate) rotate.style.transform = `rotate(${ctx.iframePlaybackState.rotationAngle || 0}deg)`;
        };

        const bindButtons = () => {
            $('fvp-close').onclick = deps.restore;
            $('fvp-center-play').onclick = (event) => {
                event.preventDefault();
                event.stopPropagation();
                togglePlayback();
            };
            $('fvp-vol-btn').onclick = () => {
                if (ctx.floatedIframe) postToFloatedIframe({ command: 'toggle-mute' });
                else if (ctx.curVid) {
                    ctx.curVid.muted = !ctx.curVid.muted;
                    updateVolUI();
                }
            };
            $('fvp-fit').onclick = () => {
                if (ctx.floatedIframe) postToFloatedIframe({ command: 'cycle-fit' });
                else {
                    ctx.fitIdx = (ctx.fitIdx + 1) % FIT_MODES.length;
                    if (ctx.curVid) ctx.curVid.style.objectFit = FIT_MODES[ctx.fitIdx];
                    $('fvp-fit').textContent = FIT_ICONS[ctx.fitIdx];
                }
            };
            $('fvp-zoom').onclick = () => {
                if (ctx.floatedIframe) postToFloatedIframe({ command: 'cycle-zoom' });
                else if (ctx.curVid) {
                    ctx.zoomIdx = (ctx.zoomIdx + 1) % ZOOM_LEVELS.length;
                    deps.applyTransform();
                    $('fvp-zoom').textContent = ZOOM_ICONS[ctx.zoomIdx];
                }
            };
            $('fvp-rotate').onclick = () => {
                if (ctx.floatedIframe) postToFloatedIframe({ command: 'rotate' });
                else if (ctx.curVid) {
                    ctx.rotationAngle = (ctx.rotationAngle + 90) % 360;
                    deps.applyTransform();
                    $('fvp-rotate').style.transform = `rotate(${ctx.rotationAngle}deg)`;
                }
            };
            $('fvp-full').onclick = () => {
                const fs = getFullscreenEl();
                if (!fs) ctx.box.requestFullscreen?.() || ctx.box.webkitRequestFullscreen?.();
                else document.exitFullscreen?.() || document.webkitExitFullscreen?.();
            };

            $('fvp-speed').onclick = () => {
                const popup = $('fvp-speed-popup');
                if (popup.style.display === 'flex') {
                    popup.style.display = 'none';
                    return;
                }
                const currentSpeed = ctx.floatedIframe ? ctx.iframePlaybackState.playbackRate || 1 : ctx.curVid?.playbackRate || 1;

                const slider = $('fvp-speed-slider');
                const valDisplay = $('fvp-speed-value');
                if (slider) slider.value = currentSpeed;
                if (valDisplay) valDisplay.textContent = `${Number(currentSpeed).toFixed(1)}x`;

                popup.style.display = 'flex';
                $('fvp-res-popup').style.display = 'none';
            };

            const speedSlider = $('fvp-speed-slider');
            if (speedSlider) {
                speedSlider.oninput = (e) => {
                    const speed = Number(e.target.value) || 1;
                    const valDisplay = $('fvp-speed-value');
                    if (valDisplay) valDisplay.textContent = `${speed.toFixed(1)}x`;
                    $('fvp-speed').textContent = `${speed.toFixed(1)}x`;

                    if (ctx.floatedIframe) postToFloatedIframe({ command: 'set-speed', rate: speed });
                    else if (ctx.curVid) {
                        ctx.curVid.playbackRate = speed;
                    }
                };
            }

            $('fvp-res').onclick = () => {
                const popup = $('fvp-res-popup');
                if (popup.style.display === 'flex') popup.style.display = 'none';
                else if (ctx.floatedIframe) postToFloatedIframe({ command: 'get-quality' });
                else window.dispatchEvent(new CustomEvent('fvp-get-quality'));
            };
        };

        const bindQualityEvents = () => {
            const closePopup = () => {
                const popup = $('fvp-res-popup');
                if (popup) popup.style.display = 'none';
            };

            const onWindowMessage = (event) => {
                if (
                    event.data?.type === 'fvp-page-quality-result' ||
                    (event.data?.type === 'fvp-iframe-quality-result' && ctx.floatedIframe?.contentWindow === event.source)
                ) {
                    const popup = $('fvp-res-popup');
                    popup.innerHTML = '';
                    (event.data.detail || []).forEach((level) => {
                        const item = el('div', `fvp-res-item${level.active ? ' active' : ''}`, level.label);
                        item.onclick = (ev) => {
                            ev.stopPropagation();
                            if (ctx.floatedIframe) postToFloatedIframe({ command: 'set-quality', item: level });
                            else window.dispatchEvent(new CustomEvent('fvp-set-quality', { detail: level }));
                            closePopup();
                        };
                        popup.appendChild(item);
                    });
                    popup.style.display = 'flex';
                }
            };
            const onQualityResult = (event) => {
                const popup = $('fvp-res-popup');
                popup.innerHTML = '';
                (event.detail || []).forEach((level) => {
                    const item = el('div', `fvp-res-item${level.active ? ' active' : ''}`, level.label);
                    item.onclick = (ev) => {
                        ev.stopPropagation();
                        window.dispatchEvent(new CustomEvent('fvp-set-quality', { detail: level }));
                        closePopup();
                    };
                    popup.appendChild(item);
                });
                popup.style.display = 'flex';
            };
            const onPointerDownOutside = (event) => {
                const target = event.target instanceof Element ? event.target : null;

                const resPopup = $('fvp-res-popup');
                const resButton = $('fvp-res');
                if (resPopup && resPopup.style.display === 'flex') {
                    if (!target || (!resPopup.contains(target) && !resButton?.contains(target))) {
                        closePopup();
                    }
                }

                const speedPopup = $('fvp-speed-popup');
                const speedButton = $('fvp-speed');
                if (speedPopup && speedPopup.style.display === 'flex') {
                    if (!target || (!speedPopup.contains(target) && !speedButton?.contains(target))) {
                        speedPopup.style.display = 'none';
                    }
                }
            };
            window.addEventListener('message', onWindowMessage);
            window.addEventListener('fvp-quality-result', onQualityResult);
            document.addEventListener('pointerdown', onPointerDownOutside, true);
            return () => {
                window.removeEventListener('message', onWindowMessage);
                window.removeEventListener('fvp-quality-result', onQualityResult);
                document.removeEventListener('pointerdown', onPointerDownOutside, true);
            };
        };

        return {
            updateVolUI,
            updateSpeedUI,
            togglePlayback,
            updatePlaybackOverlayUI,
            syncFloatedIframeUI,
            bindButtons,
            bindQualityEvents
        };
    };
})();


/* --- Source: content/video-floating/core/controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.core = videoFloating.core || {};

    videoFloating.createTopFrameController = () => {
        const ctx = videoFloating.core.createContext();

        const layoutManager = videoFloating.ui.createLayoutManager(ctx);
        const shell = videoFloating.ui.createShell(ctx);
        const autoSync = videoFloating.media.createAutoSync(ctx);
        const menu = videoFloating.ui.createMenu(ctx);

        const postToFloatedIframe = (cmd) => ctx.floatedIframe?.contentWindow?.postMessage({ type: 'fvp-iframe-command', ...cmd }, '*');

        const floatingSession = videoFloating.createFloatingSession(ctx, {
            el: videoFloating.core.utils.el,
            $: videoFloating.core.utils.$,
            getDirectVideos: videoFloating.media.detector.getDirectVideos,
            getDirectVideoSequence: videoFloating.media.detector.getDirectVideoSequence,
            getTrackedIframeEntries: videoFloating.media.detector.getTrackedIframeEntries,
            isFeatureEnabled: videoFloating.core.config.isFeatureEnabled,
            loadLayout: videoFloating.core.config.loadLayout,
            ensureLayoutReady: videoFloating.core.config.ensureLayoutReady,
            formatTime: videoFloating.core.utils.formatTime,
            applyBoxLayout: layoutManager.applyBoxLayout,
            updateLeftPanelLayout: layoutManager.updateLeftPanelLayout,
            updateVolUI: () => uiControls.updateVolUI(),
            updateSpeedUI: () => uiControls.updateSpeedUI(),
            updatePlaybackOverlayUI: () => uiControls.updatePlaybackOverlayUI(),
            postToFloatedIframe,
            ensureInitialized: () => shell.ensureInitialized(menu.menuVideoIcon)
        });

        // Wire up circular dependencies
        menu.setFloatingSession?.(floatingSession);
        autoSync.setFloatingSession?.(floatingSession);

        menu.floatFirstAvailableMedia = () => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            const preferredVideo = videoFloating.media.detector.getDirectVideos()[0];
            if (preferredVideo) {
                ctx.menuRef?.hide();
                floatingSession.float(preferredVideo);
                return;
            }
            // fallback logic handled in menu.js itself
        };

        const seekController = videoFloating.createSeekController(ctx, {
            $: videoFloating.core.utils.$,
            getCoord: videoFloating.core.utils.getCoord,
            getRect: videoFloating.core.utils.getRect,
            clamp: videoFloating.core.utils.clamp,
            formatTime: videoFloating.core.utils.formatTime,
            touch: ext?.shared?.touchCore,
            postToFloatedIframe
        });

        const uiControls = videoFloating.createUiControls(ctx, {
            $: videoFloating.core.utils.$,
            el: videoFloating.core.utils.el,
            formatTime: videoFloating.core.utils.formatTime,
            getFullscreenEl: videoFloating.core.utils.getFullscreenEl,
            postToFloatedIframe,
            renderSeekPreview: (ratio) => seekController.renderSeekPreview(ratio),
            restore: () => floatingSession.restore(),
            applyTransform: () => floatingSession.applyTransform()
        });

        const gesturesHandler = videoFloating.interactions.createGesturesHandler(ctx, floatingSession, seekController, uiControls, shell);
        const dragResizeHandler = videoFloating.interactions.createDragResizeHandler(ctx, layoutManager, shell);
        const iconHandler = videoFloating.interactions.createIconHandler(ctx, menu, shell);

        shell.ensureInitialized(menu.menuVideoIcon);

        ctx.cleanup.push(
            videoFloating.core.config.bindStorageListener(() => {
                if (!videoFloating.core.config.isFeatureEnabled()) floatingSession.restore();
                floatingSession.updateVideoDetectionUI();
            })
        );

        const onWindowMessage = (event) => {
            if (!event.data) return;
            if (event.data.type === 'fvp-iframe-video-count') {
                if (event.source === window) return;
                const iframes = document.querySelectorAll('iframe');
                const matched = Array.from(iframes).find((iframe) => iframe.contentWindow === event.source);
                if (matched) {
                    const count = Number(event.data.count) || 0;
                    if (count > 0 && videoFloating.media.detector.isLikelyVideoIframe?.(matched)) ctx.iframeVideoMap.set(matched, count);
                    else ctx.iframeVideoMap.delete(matched);
                    floatingSession.updateVideoDetectionUI();
                }
            }
            if (event.data.type === 'fvp-iframe-state' && ctx.floatedIframe?.contentWindow === event.source) {
                if (event.data.state && typeof event.data.state === 'object') {
                    Object.assign(ctx.iframePlaybackState, event.data.state);
                    uiControls.syncFloatedIframeUI?.();
                }
            }
        };
        window.addEventListener('message', onWindowMessage);
        ctx.cleanup.push(() => window.removeEventListener('message', onWindowMessage));

        const onTouchSwitchVideo = (event) => {
            const dir = Number(event.detail?.dir) || 0;
            if (dir) floatingSession.switchVid(dir);
        };
        window.addEventListener(videoFloating.core.config.TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);
        ctx.cleanup.push(() => window.removeEventListener(videoFloating.core.config.TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo));

        autoSync.bindEvents(floatingSession);
        gesturesHandler.setupWrapperGestures();
        iconHandler.setupIconGestures();
        shell.setupOutsideClickGuard();
        uiControls.bindButtons();

        ctx.cleanup.push(seekController.bind());
        ctx.cleanup.push(uiControls.bindQualityEvents());

        // Wire up resize/drag handles in DOM
        const dragHandle = videoFloating.core.utils.$('fvp-left-drag');
        const resizeBr = document.querySelector('.fvp-resize-br');
        const resizeBl = document.querySelector('.fvp-resize-bl');

        if (dragHandle) {
            dragHandle.addEventListener('pointerdown', (e) => dragResizeHandler.beginBoxInteraction(e, 'drag'), true);
            dragHandle.addEventListener('pointermove', dragResizeHandler.handleBoxPointerMove, true);
            dragHandle.addEventListener('pointerup', dragResizeHandler.handleBoxPointerEnd, true);
            dragHandle.addEventListener('pointercancel', dragResizeHandler.handleBoxPointerEnd, true);
        }

        if (resizeBr) {
            resizeBr.addEventListener('pointerdown', (e) => dragResizeHandler.beginBoxInteraction(e, 'resize', 'br'), true);
            resizeBr.addEventListener('pointermove', dragResizeHandler.handleBoxPointerMove, true);
            resizeBr.addEventListener('pointerup', dragResizeHandler.handleBoxPointerEnd, true);
            resizeBr.addEventListener('pointercancel', dragResizeHandler.handleBoxPointerEnd, true);
        }

        if (resizeBl) {
            resizeBl.addEventListener('pointerdown', (e) => dragResizeHandler.beginBoxInteraction(e, 'resize', 'bl'), true);
            resizeBl.addEventListener('pointermove', dragResizeHandler.handleBoxPointerMove, true);
            resizeBl.addEventListener('pointerup', dragResizeHandler.handleBoxPointerEnd, true);
            resizeBl.addEventListener('pointercancel', dragResizeHandler.handleBoxPointerEnd, true);
        }

        videoFloating.core.config.loadCfgAsync();
        autoSync.syncFloatingWithPlayingDirectVideo();
        floatingSession.updateVideoDetectionUI();

        const detectionTimer = window.setInterval(
            () => floatingSession.updateVideoDetectionUI(),
            videoFloating.core.config.VIDEO_CHECK_INTERVAL || 2000
        );
        ctx.cleanup.push(() => window.clearInterval(detectionTimer));

        return {
            onConfigChange() {
                if (!videoFloating.core.config.isFeatureEnabled()) floatingSession.restore();
                floatingSession.updateVideoDetectionUI();
            },
            destroy() {
                floatingSession.restore();
                clearTimeout(ctx.state.idleTimer);
                ctx.cleanup.splice(0).forEach((fn) => {
                    try {
                        fn();
                    } catch {
                        /* ignore */
                    }
                });
                ctx.iconRef?.destroy();
                ctx.menuRef?.destroy();
                ctx.box?.remove();
            }
        };
    };
})();


/* --- Source: content/video-floating/index.js --- */
(() => {
    'use strict';

    const ext = globalThis.GestureExtension;

    const createMountedController = () => {
        ext.videoFloating.core.config.loadCfgAsync?.();
        const cleanupSwipeSeek = ext.videoFloating.interactions.installTouchSwipeSeek();
        const cleanupWheelKeyboardSeek = ext.videoFloating.interactions.installWheelKeyboardSeek();
        let controller = null;
        let domReadyHandler = null;

        const mountController = () => {
            if (controller) {
                return controller;
            }
            controller = window !== window.top ? ext.videoFloating.createIframeController() : ext.videoFloating.createTopFrameController();
            return controller;
        };

        if (window !== window.top) {
            mountController();
        } else if (document.readyState === 'loading' || !document.body) {
            domReadyHandler = () => {
                domReadyHandler = null;
                mountController();
            };
            document.addEventListener('DOMContentLoaded', domReadyHandler, { once: true });
        } else {
            mountController();
        }

        return {
            onConfigChange(nextConfig) {
                controller?.onConfigChange?.(nextConfig);
            },
            destroy() {
                if (domReadyHandler) {
                    document.removeEventListener('DOMContentLoaded', domReadyHandler);
                    domReadyHandler = null;
                }
                cleanupSwipeSeek?.();
                cleanupWheelKeyboardSeek?.();
                controller?.destroy?.();
                controller = null;
                window.__gestureVideoFloatingController = null;
            }
        };
    };

    const ensureStarted = () => {
        if (window.__gestureVideoFloatingController) {
            return window.__gestureVideoFloatingController;
        }
        window.__gestureVideoFloatingController = createMountedController();
        return window.__gestureVideoFloatingController;
    };

    ext.features.videoFloating = {
        shouldRun: ({ runtime, getConfig }) => runtime.isHttpPage() && getConfig()?.videoFloating?.enabled !== false,
        init() {
            return ensureStarted();
        }
    };
})();


/* --- Source: content/youtube-subtitles/constants.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.SELECTORS = Object.freeze({
        player: '#movie_player, .html5-video-player',
        translateButton: '#gesture-youtube-subtitles-toggle',
        container: '#yt-bilingual-subtitles',
        nativeCaptionNodes: '.ytp-caption-window-container, .caption-window, .captions-text, .ytp-caption-segment'
    });

    youtubeSubtitles.EARLY_VISIBLE_CAPTION_WORDS = 6;
    youtubeSubtitles.MIN_VISIBLE_CAPTION_WORDS = 10;
    youtubeSubtitles.MAX_VISIBLE_CAPTION_WORDS = 18;
    youtubeSubtitles.isWatchPage = () => /\/watch|[?&]v=/.test(window.location.href);
})();


/* --- Source: content/youtube-subtitles/dom.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});
    const floating = ext.shared.floatingCore;
    const { SELECTORS } = youtubeSubtitles;
    const ICONS = floating.icons;

    const getToggleButton = () => document.querySelector(SELECTORS.translateButton);
    const getDefaultTogglePosition = () => ({
        left: Math.max(12, window.innerWidth - 66),
        top: Math.max(12, window.innerHeight - 158)
    });
    const togglePosStorage = floating.createPositionStorage('gesture_youtube_subtitles_toggle_pos_v1', getDefaultTogglePosition());

    youtubeSubtitles.dom = {
        mountControlButtons({ onToggleTranslate }) {
            floating.ensureSharedActionButtonStyles();
            getToggleButton()?.remove();
            const buttonRef = floating.createActionButton({
                id: 'gesture-youtube-subtitles-toggle',
                className: 'gesture-youtube-subtitles-toggle',
                title: 'Dịch phụ đề',
                ariaLabel: 'Dịch phụ đề',
                htmlContent: ICONS.translate,
                hidden: false,
                parent: document.documentElement,
                position: 'fixed',
                zIndex: '2147483644'
            });
            buttonRef.element.style.touchAction = 'none';

            togglePosStorage.load().then(({ left, top }) => {
                const pos = floating.clampFixedPosition({
                    left,
                    top,
                    width: 46,
                    height: 46,
                    margin: 12
                });
                buttonRef.setPosition(pos.left, pos.top);
            });

            floating.bindDragBehavior({
                target: buttonRef.element,
                threshold: 4,
                getInitialPosition: () => ({
                    left: buttonRef.element.getBoundingClientRect().left,
                    top: buttonRef.element.getBoundingClientRect().top
                }),
                onMove: ({ event, deltaX, deltaY, origin }) => {
                    floating.stopFloatingEvent(event);
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: 46,
                        height: 46,
                        margin: 12
                    });
                    buttonRef.setPosition(next.left, next.top);
                    buttonRef.element.classList.add('is-dragging');
                },
                onDragEnd: () => {
                    buttonRef.element.classList.remove('is-dragging');
                    const rect = buttonRef.element.getBoundingClientRect();
                    togglePosStorage.save(rect.left, rect.top);
                },
                onClick: ({ event }) => {
                    floating.stopFloatingEvent(event);
                    onToggleTranslate();
                }
            });

            buttonRef.element.addEventListener(
                'pointerdown',
                (event) => {
                    floating.stopFloatingEvent(event);
                },
                true
            );
        },
        setTranslateButtonState(enabled) {
            const button = getToggleButton();
            if (!button) {
                return;
            }
            button.classList.toggle('is-active', enabled);
            button.innerHTML = enabled ? ICONS.translateActive : ICONS.translate;
            button.title = enabled ? 'Tắt dịch (T)' : 'Dịch phụ đề (T)';
            button.setAttribute('aria-label', enabled ? 'Tắt dịch phụ đề' : 'Dịch phụ đề');
        },
        removeTranslateButtons() {
            getToggleButton()?.remove();
        },
        ensureSubtitleContainer() {
            let container = document.querySelector(SELECTORS.container);
            if (container) {
                return container;
            }
            container = document.createElement('div');
            container.id = 'yt-bilingual-subtitles';
            container.innerHTML = '<div class="sub-original"></div><div class="sub-translated"></div>';
            document.body.appendChild(container);
            return container;
        },
        removeSubtitleContainer() {
            document.querySelector(SELECTORS.container)?.remove();
        },
        setPlayerTranslating(active) {
            const player = document.querySelector(SELECTORS.player);
            if (player) {
                player.classList.toggle('yt-translating', active);
            }
            document.documentElement.classList.toggle('ext-yt-translating', active);
            document.body?.classList.toggle('ext-yt-translating', active);
        },
        ensureStyles() {
            if (document.getElementById('gesture-youtube-subtitles-style')) {
                return;
            }
            const style = document.createElement('style');
            style.id = 'gesture-youtube-subtitles-style';
            style.textContent = `
                :root {
                    --ext-yt-font-size: 16px;
                    --ext-yt-translated-font-size: 16px;
                    --ext-yt-original-color: #ffffff;
                    --ext-yt-translated-color: #0e8cecff;
                }
                #gesture-youtube-subtitles-toggle {
                    z-index: 2147483644;
                }
                #gesture-youtube-subtitles-toggle svg,
                #gesture-youtube-subtitles-toggle > * {
                    width: 28px !important;
                    height: 28px !important;
                }
                .yt-translating .ytp-caption-window-container,
                .yt-translating .caption-window,
                .yt-translating .captions-text,
                .yt-translating .ytp-caption-segment,
                .ext-yt-translating .ytp-caption-window-container,
                .ext-yt-translating .caption-window,
                .ext-yt-translating .captions-text,
                .ext-yt-translating .ytp-caption-segment {
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                    display: none !important;
                }
                #yt-bilingual-subtitles {
                    position: fixed !important;
                    z-index: 9998 !important;
                    display: inline-flex !important;
                    flex-direction: column !important;
                    gap: 4px !important;
                    min-width: 200px !important;
                    max-width: 90% !important;
                    padding: 8px 12px !important;
                    border-radius: 6px !important;
                    background: rgba(8, 8, 8, 0.85) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                    backdrop-filter: blur(4px) !important;
                    cursor: move !important;
                    user-select: none !important;
                    touch-action: none !important;
                    -webkit-user-select: none !important;
                }
                #yt-bilingual-subtitles:hover {
                    background: rgba(15, 15, 15, 0.9) !important;
                }
                #yt-bilingual-subtitles.yt-sub-dragging {
                    opacity: 0.8 !important;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4) !important;
                    z-index: 9999 !important;
                }
                #yt-bilingual-subtitles .sub-original {
                    color: var(--ext-yt-original-color) !important;
                    font-size: var(--ext-yt-font-size) !important;
                    line-height: 1.3 !important;
                    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9) !important;
                    white-space: normal !important;
                    word-wrap: break-word !important;
                }
                #yt-bilingual-subtitles .sub-translated {
                    color: var(--ext-yt-translated-color) !important;
                    font-size: var(--ext-yt-translated-font-size) !important;
                    line-height: 1.3 !important;
                    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9) !important;
                    white-space: normal !important;
                    word-wrap: break-word !important;
                }
                #yt-bilingual-subtitles .sub-translated.sub-error {
                    color: #ffb347 !important;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        },
        applySettingsStyles(settings) {
            const style = document.documentElement.style;
            style.setProperty('--ext-yt-font-size', `${settings.fontSize}px`);
            style.setProperty('--ext-yt-translated-font-size', `${settings.translatedFontSize}px`);
            style.setProperty('--ext-yt-original-color', settings.originalColor);
            style.setProperty('--ext-yt-translated-color', settings.translatedColor);

            const container = document.querySelector(SELECTORS.container);
            if (!container) {
                return;
            }
            const align = settings.containerAlignment;
            container.style.left = align === 'right' ? 'auto' : align === 'center' ? '50%' : settings.containerPosition.x;
            container.style.right = align === 'right' ? settings.containerPosition.x : 'auto';
            container.style.top = settings.containerPosition.y.includes('%') ? 'auto' : settings.containerPosition.y;
            container.style.bottom = settings.containerPosition.y.includes('%') ? settings.containerPosition.y : 'auto';
            container.style.transform = align === 'center' ? 'translateX(-50%)' : 'none';
        },
        makeContainerDraggable(container, persistSettings) {
            if (container.dataset.extDragMounted === 'true') {
                return;
            }
            container.dataset.extDragMounted = 'true';
            floating.bindDragBehavior({
                target: container,
                threshold: 3,
                getInitialPosition: () => {
                    const rect = container.getBoundingClientRect();
                    return { left: rect.left, top: rect.top };
                },
                onMove: ({ event, deltaX, deltaY, origin }) => {
                    if (window.getSelection()?.toString()) {
                        return;
                    }
                    event.preventDefault();
                    const nextLeft = Math.max(0, Math.min(origin.left + deltaX, window.innerWidth - container.offsetWidth));
                    const nextTop = Math.max(0, Math.min(origin.top + deltaY, window.innerHeight - container.offsetHeight));
                    const alignment =
                        nextLeft > (window.innerWidth - container.offsetWidth) * 0.7
                            ? 'right'
                            : nextLeft < (window.innerWidth - container.offsetWidth) * 0.3
                              ? 'left'
                              : 'center';

                    container.classList.add('yt-sub-dragging');
                    container.style.left = alignment === 'right' ? 'auto' : `${nextLeft}px`;
                    container.style.right = alignment === 'right' ? `${window.innerWidth - nextLeft - container.offsetWidth}px` : 'auto';
                    container.style.top = `${nextTop}px`;
                    container.style.bottom = 'auto';
                    container.style.transform = alignment === 'center' ? 'translateX(-50%)' : 'none';
                    container.dataset.dragAlignment = alignment;
                    container.dataset.dragLeft = String(nextLeft);
                    container.dataset.dragTop = String(nextTop);
                },
                onDragEnd: () => {
                    container.classList.remove('yt-sub-dragging');
                    if (container.dataset.dragLeft && container.dataset.dragTop) {
                        persistSettings({
                            containerPosition: {
                                x: `${container.dataset.dragLeft}px`,
                                y: `${container.dataset.dragTop}px`
                            },
                            containerAlignment: container.dataset.dragAlignment || 'left'
                        }).catch(() => {});
                    }
                }
            });
        }
    };
})();


/* --- Source: content/youtube-subtitles/caption-source.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});
    const { queryAllDeep } = ext.shared.domUtils;
    const { EARLY_VISIBLE_CAPTION_WORDS, MIN_VISIBLE_CAPTION_WORDS, MAX_VISIBLE_CAPTION_WORDS } = youtubeSubtitles;

    const normalizeCueText = (text) =>
        String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    const normalizeCaptionWords = (text) =>
        String(text || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    const getSubtitleTracks = (video) => {
        if (!video?.textTracks) {
            return [];
        }
        const tracks = [];
        for (let index = 0; index < video.textTracks.length; index += 1) {
            const track = video.textTracks[index];
            if (track?.kind === 'captions' || track?.kind === 'subtitles') {
                tracks.push(track);
            }
        }
        return tracks;
    };

    const getPreferredTrack = (video) => {
        const tracks = getSubtitleTracks(video);
        if (!tracks.length) {
            return null;
        }
        return tracks.find((track) => track.mode === 'showing') || tracks.find((track) => track.language) || tracks[0];
    };

    const getActiveCaptionTrack = (video, managedTrack) => {
        const tracks = getSubtitleTracks(video);
        if (!tracks.length) {
            return null;
        }
        const showingTrack = tracks.find((track) => track.mode === 'showing');
        if (showingTrack) {
            return showingTrack;
        }
        if (managedTrack && tracks.includes(managedTrack) && managedTrack.mode === 'hidden') {
            return managedTrack;
        }
        return null;
    };

    const extractCaptionTextFromDom = () => {
        const captionContainers = queryAllDeep(
            '.caption-window, .ytp-caption-window-container, .captions-text'
        );
        for (const root of [...captionContainers].reverse()) {
            const lineNodes = root.querySelectorAll?.('.caption-visual-line, .ytp-caption-segment') || [];
            if (lineNodes.length) {
                const lineText = Array.from(lineNodes)
                    .map((line) =>
                        Array.from(line.querySelectorAll('.ytp-caption-segment, span'))
                            .map((segment) => segment.textContent.trim())
                            .filter(Boolean)
                            .join(' ')
                    )
                    .filter(Boolean)
                    .join(' ')
                    .trim();
                if (lineText) {
                    return lineText;
                }
            }

            const segmentText = Array.from(root.querySelectorAll?.('.ytp-caption-segment, span') || [])
                .map((segment) => segment.textContent.trim())
                .filter(Boolean)
                .join(' ')
                .trim();
            if (segmentText) {
                return segmentText;
            }

            const ownText = normalizeCueText(root.textContent);
            if (ownText) {
                return ownText;
            }
        }
        return '';
    };

    youtubeSubtitles.captionSource = {
        getSubtitleTracks,
        getPreferredTrack,
        getActiveCaptionTrack,
        extractCaptionTextFromDom,
        hasDomCaptionText() {
            return !!extractCaptionTextFromDom();
        },
        hideNativeCaptionTracks(video) {
            getSubtitleTracks(video).forEach((track) => {
                try {
                    track.mode = 'hidden';
                } catch {
                    // Ignore sites that reject track mode changes.
                }
            });
        },
        hideNativeCaptionTrack(track) {
            if (!track) {
                return;
            }
            try {
                if (track.mode === 'showing') {
                    track.mode = 'hidden';
                }
            } catch {
                // Ignore track mode errors.
            }
        },
        extractCaptionText(video, track = getPreferredTrack(video)) {
            if (!track) {
                return getSubtitleTracks(video).length ? '' : extractCaptionTextFromDom();
            }
            const activeCues = Array.from(track.activeCues || []);
            if (activeCues.length) {
                return activeCues
                    .map((cue) => normalizeCueText(cue.text))
                    .filter(Boolean)
                    .join(' ')
                    .trim();
            }
            const currentTime = video?.currentTime ?? 0;
            const cues = Array.from(track.cues || []);
            const currentCue = cues.find((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime);
            const text = normalizeCueText(currentCue?.text);
            return text || extractCaptionTextFromDom();
        },
        bindTrackCueChange(video, onChange) {
            const removers = [];
            if (typeof video?.textTracks?.addEventListener === 'function') {
                video.textTracks.addEventListener('addtrack', onChange);
                video.textTracks.addEventListener('change', onChange);
                removers.push(() => {
                    video.textTracks.removeEventListener('addtrack', onChange);
                    video.textTracks.removeEventListener('change', onChange);
                });
            }
            getSubtitleTracks(video).forEach((track) => {
                if (typeof track.addEventListener === 'function') {
                    track.addEventListener('cuechange', onChange);
                    removers.push(() => track.removeEventListener('cuechange', onChange));
                }
            });
            return () => removers.forEach((remove) => remove());
        },
        getDisplayCaptionText(currentSource, previousSource, state) {
            const currentWords = normalizeCaptionWords(currentSource);
            const previousWords = normalizeCaptionWords(previousSource);
            if (!currentWords.length) {
                return '';
            }

            const isProgressiveAutoCaption =
                previousWords.length > 0 &&
                previousWords.length < currentWords.length &&
                previousWords.every((word, index) => currentWords[index] === word);

            let availableWords;
            if (isProgressiveAutoCaption) {
                availableWords = currentWords.slice(state.consumedWordCount);
            } else {
                state.consumedWordCount = 0;
                availableWords = currentWords;
            }

            if (!availableWords.length) {
                return '';
            }

            const lastWord = availableWords[availableWords.length - 1] || '';
            const hasPunctuation = /[.?!;:,'"]$/.test(lastWord);
            const minWordsThreshold = state.consumedWordCount === 0 ? EARLY_VISIBLE_CAPTION_WORDS : MIN_VISIBLE_CAPTION_WORDS;
            const effectiveMinWords = hasPunctuation ? 1 : Math.max(5, minWordsThreshold);

            if (availableWords.length < effectiveMinWords) {
                return '';
            }

            const chunkWords = availableWords.slice(0, MAX_VISIBLE_CAPTION_WORDS);
            state.consumedWordCount += chunkWords.length;
            return chunkWords.join(' ');
        }
    };
})();


/* --- Source: content/youtube-subtitles/translator.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});
    const { createMemoryCache, translateDetailed } = ext.shared.translateCore;

    const cache = createMemoryCache({ maxSize: 500 });

    youtubeSubtitles.translator = {
        clearCache() {
            cache.clear();
        },
        async translateCaption(text, settings) {
            const key = text.trim();
            if (!key) {
                return { text: '', error: '' };
            }
            const cached = cache.get(key);
            if (cached?.result) {
                return { text: cached.result, error: '' };
            }
            try {
                const result = await translateDetailed(key, {
                    cache,
                    targetLanguage: settings.targetLang
                });
                const translated = String(result?.translatedText || '').trim();
                if (translated) {
                    return { text: translated, error: '' };
                }
                return { text: '', error: result?.error || 'Loi dich tam thoi. Thu lai sau.' };
            } catch (error) {
                return { text: '', error: String(error?.message || 'Loi dich tam thoi. Thu lai sau.') };
            }
        }
    };
})();


/* --- Source: content/youtube-subtitles/caption-manager.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createCaptionManager = (deps) => {
        const { state, settings, persistSettings, releaseCaptionTrack } = deps;

        const getCurrentVideo = () => ext.shared.domUtils.queryDeep('video') || document.querySelector('video');
        const getNativeCaptionButton = () =>
            ext.shared.domUtils.queryDeep('.ytp-subtitles-button') || document.querySelector('.ytp-subtitles-button');
        const isNativeCaptionEnabled = (video = getCurrentVideo()) => {
            const button = getNativeCaptionButton();
            if (button?.getAttribute('aria-pressed') === 'true') {
                return true;
            }
            const activeTrack = youtubeSubtitles.captionSource.getActiveCaptionTrack(video, state.captionTrack);
            if (activeTrack) {
                return true;
            }
            return youtubeSubtitles.captionSource.hasDomCaptionText();
        };

        const resetCaptionState = () => {
            state.lastSource = '';
            state.lastRenderedSource = '';
            state.consumedWordCount = 0;
        };

        const renderCurrentCaption = async () => {
            const video = state.video || getCurrentVideo();
            if (!video) {
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }

            if (!isNativeCaptionEnabled(video)) {
                releaseCaptionTrack();
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }

            let source;
            const captionTrack = youtubeSubtitles.captionSource.getActiveCaptionTrack(video, state.captionTrack);
            if (captionTrack) {
                state.captionTrack = captionTrack;
                youtubeSubtitles.captionSource.hideNativeCaptionTrack(captionTrack);
                source = youtubeSubtitles.captionSource.extractCaptionText(video, captionTrack);
            } else if (!youtubeSubtitles.captionSource.getSubtitleTracks(video).length) {
                releaseCaptionTrack();
                source = youtubeSubtitles.captionSource.extractCaptionText(video, null);
            } else {
                releaseCaptionTrack();
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }
            if (!source) {
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(!!captionTrack);
                resetCaptionState();
                return;
            }

            if (source === state.lastSource) {
                return;
            }

            const previousSource = state.lastSource;
            state.lastSource = source;
            const displaySource = youtubeSubtitles.captionSource.getDisplayCaptionText(source, previousSource, state);
            if (!displaySource || displaySource === state.lastRenderedSource) {
                return;
            }

            const renderGeneration = state.renderGeneration;
            const translation = await youtubeSubtitles.translator.translateCaption(displaySource, settings());
            if (!state.enabled || renderGeneration !== state.renderGeneration) {
                return;
            }
            const translated = translation?.text || '';
            const errorMessage = translation?.error || '';
            if ((!translated || translated === displaySource) && !errorMessage) {
                return;
            }

            const container = youtubeSubtitles.dom.ensureSubtitleContainer();
            youtubeSubtitles.dom.makeContainerDraggable(container, persistSettings);
            const originalNode = container.querySelector('.sub-original');
            const translatedNode = container.querySelector('.sub-translated');
            originalNode.textContent = displaySource;
            translatedNode.textContent = translated || errorMessage;
            translatedNode.classList.toggle('sub-error', !translated && !!errorMessage);
            translatedNode.style.display = translatedNode.textContent ? '' : 'none';
            originalNode.style.display = settings().showOriginal ? '' : 'none';
            state.lastRenderedSource = displaySource;
            youtubeSubtitles.dom.applySettingsStyles(settings());
            youtubeSubtitles.dom.setPlayerTranslating(true);
        };

        return {
            getCurrentVideo,
            isNativeCaptionEnabled,
            resetCaptionState,
            renderCurrentCaption
        };
    };
})();


/* --- Source: content/youtube-subtitles/video-sync.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createVideoSync = (deps) => {
        const { state, releaseCaptionTrack, renderCurrentCaption } = deps;

        const createCaptionObserver = (onChange) => {
            let mutationObserver = null;
            return {
                start() {
                    if (mutationObserver) {
                        return;
                    }
                    mutationObserver = new MutationObserver(() => onChange());
                    const target = document.querySelector('#movie_player, .html5-video-player') || document.body;
                    mutationObserver.observe(target, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['aria-pressed', 'class'],
                        characterData: true
                    });
                },
                stop() {
                    mutationObserver?.disconnect();
                    mutationObserver = null;
                }
            };
        };

        const bindVideoSync = (video) => {
            if (!video) {
                return;
            }
            const isSameVideo = state.video === video && state.videoSyncHandler;
            if (isSameVideo) {
                return;
            }
            if (state.video && state.videoSyncHandler) {
                state.video.removeEventListener('timeupdate', state.videoSyncHandler);
                state.video.removeEventListener('seeked', state.videoSyncHandler);
                state.video.removeEventListener('loadedmetadata', state.videoSyncHandler);
            }
            state.detachTrackListener?.();
            state.detachTrackListener = null;
            releaseCaptionTrack();
            state.video = video;
            state.videoSyncHandler = () => {
                if (state.enabled) {
                    renderCurrentCaption().catch(() => {});
                }
            };
            video.addEventListener('timeupdate', state.videoSyncHandler);
            video.addEventListener('seeked', state.videoSyncHandler);
            video.addEventListener('loadedmetadata', state.videoSyncHandler);
            state.detachTrackListener = youtubeSubtitles.captionSource.bindTrackCueChange(video, state.videoSyncHandler);
        };

        return {
            createCaptionObserver,
            bindVideoSync
        };
    };
})();


/* --- Source: content/youtube-subtitles/page-events.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createPageEvents = (deps) => {
        const { state, settings, toggleTranslationMode, stopTranslationMode, startTranslationMode } = deps;

        let locationHref = window.location.href;
        let pageEventCleanup = null;
        const NAVIGATION_RETRY_DELAY_MS = 500;
        const MAX_NAVIGATION_RETRY_ATTEMPTS = 20;

        const bindPageEvents = () => {
            if (state.pageEventsBound) {
                return;
            }
            state.pageEventsBound = true;
            const resizeContainerIntoViewport = () => {
                const container = document.querySelector('#yt-bilingual-subtitles');
                if (!container) {
                    return;
                }
                const rect = container.getBoundingClientRect();
                if (rect.left < 0) container.style.left = '0px';
                if (rect.top < 0) container.style.top = '0px';
                if (rect.right > window.innerWidth) container.style.left = `${window.innerWidth - container.offsetWidth}px`;
                if (rect.bottom > window.innerHeight) container.style.top = `${window.innerHeight - container.offsetHeight}px`;
            };

            const onKeyDown = (event) => {
                const activeElement = document.activeElement;
                if (
                    activeElement instanceof HTMLElement &&
                    (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
                ) {
                    return;
                }
                if (
                    event.key.toLowerCase() === 't' &&
                    !event.ctrlKey &&
                    !event.altKey &&
                    !event.metaKey &&
                    document.querySelector('video')
                ) {
                    event.preventDefault();
                    toggleTranslationMode();
                }
            };

            const scheduleNavigationResume = (shouldResume, attempt = 0) => {
                window.clearTimeout(state.navigateTimer);
                state.navigateTimer = window.setTimeout(
                    () => {
                        state.navigateTimer = 0;
                        if (youtubeSubtitles.isWatchPage()) {
                            document.body.dataset.gestureYoutubeSubtitlesMounted = 'true';
                            youtubeSubtitles.dom.mountControlButtons({ onToggleTranslate: toggleTranslationMode });
                            youtubeSubtitles.dom.applySettingsStyles(settings());
                            if (shouldResume && !startTranslationMode() && attempt < MAX_NAVIGATION_RETRY_ATTEMPTS) {
                                scheduleNavigationResume(shouldResume, attempt + 1);
                            }
                        } else {
                            delete document.body.dataset.gestureYoutubeSubtitlesMounted;
                            youtubeSubtitles.dom.removeTranslateButtons();
                        }
                    },
                    attempt === 0 ? 300 : NAVIGATION_RETRY_DELAY_MS
                );
            };

            const onNavigateFinish = () => {
                locationHref = window.location.href;
                const shouldResume = state.enabled || settings()?.enabled;
                stopTranslationMode();
                youtubeSubtitles.translator.clearCache();
                scheduleNavigationResume(shouldResume);
            };

            const onLocationMaybeChanged = () => {
                if (window.location.href === locationHref) {
                    return;
                }
                locationHref = window.location.href;
                onNavigateFinish();
            };

            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('yt-navigate-finish', onNavigateFinish);
            window.addEventListener('resize', resizeContainerIntoViewport);
            state.locationPollTimer = window.setInterval(onLocationMaybeChanged, 700);

            pageEventCleanup = () => {
                window.clearTimeout(state.navigateTimer);
                state.navigateTimer = 0;
                window.clearInterval(state.locationPollTimer);
                state.locationPollTimer = 0;
                document.removeEventListener('keydown', onKeyDown);
                document.removeEventListener('yt-navigate-finish', onNavigateFinish);
                window.removeEventListener('resize', resizeContainerIntoViewport);
                state.pageEventsBound = false;
                pageEventCleanup = null;
            };
        };

        const destroy = () => {
            pageEventCleanup?.();
        };

        return {
            bindPageEvents,
            destroy
        };
    };
})();


/* --- Source: content/youtube-subtitles/controller.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createController = ({ getConfig, storage }) => {
        let settings = getConfig().youtubeSubtitles;
        const state = {
            enabled: false,
            lastSource: '',
            lastRenderedSource: '',
            consumedWordCount: 0,
            renderGeneration: 0,
            mounted: false,
            pageEventsBound: false,
            video: null,
            captionTrack: null,
            detachTrackListener: null,
            videoSyncHandler: null,
            navigateTimer: 0,
            locationPollTimer: 0
        };

        const releaseCaptionTrack = () => {
            state.captionTrack = null;
        };

        const invalidatePendingRender = () => {
            state.renderGeneration += 1;
        };

        const persistSettings = async (partial) => {
            settings = {
                ...settings,
                ...partial,
                containerPosition: {
                    ...settings.containerPosition,
                    ...(partial.containerPosition ?? {})
                }
            };
            const nextConfig = await storage.updateConfig((draft) => {
                draft.youtubeSubtitles = {
                    ...draft.youtubeSubtitles,
                    ...partial,
                    containerPosition: {
                        ...draft.youtubeSubtitles.containerPosition,
                        ...(partial.containerPosition ?? {})
                    }
                };
                return draft;
            });
            settings = nextConfig.youtubeSubtitles;
            youtubeSubtitles.dom.applySettingsStyles(settings);
        };

        const captionManager = youtubeSubtitles.createCaptionManager({
            state,
            settings: () => settings,
            persistSettings,
            invalidatePendingRender,
            releaseCaptionTrack
        });

        const videoSync = youtubeSubtitles.createVideoSync({
            state,
            releaseCaptionTrack,
            renderCurrentCaption: captionManager.renderCurrentCaption
        });

        const stopTranslationMode = () => {
            observer?.stop();
            state.enabled = false;
            captionManager.resetCaptionState();
            invalidatePendingRender();
            state.detachTrackListener?.();
            state.detachTrackListener = null;
            releaseCaptionTrack();
            if (state.video && state.videoSyncHandler) {
                state.video.removeEventListener('timeupdate', state.videoSyncHandler);
                state.video.removeEventListener('seeked', state.videoSyncHandler);
                state.video.removeEventListener('loadedmetadata', state.videoSyncHandler);
            }
            state.video = null;
            state.videoSyncHandler = null;
            youtubeSubtitles.dom.removeSubtitleContainer();
            youtubeSubtitles.dom.setPlayerTranslating(false);
            youtubeSubtitles.dom.setTranslateButtonState(false);
        };

        const startTranslationMode = () => {
            const video = captionManager.getCurrentVideo();
            if (!video) {
                return false;
            }
            state.enabled = true;
            observer?.start();
            videoSync.bindVideoSync(video);
            youtubeSubtitles.dom.setTranslateButtonState(true);
            captionManager.renderCurrentCaption().catch(() => {});
            return true;
        };

        const toggleTranslationMode = () => {
            if (state.enabled) {
                stopTranslationMode();
                persistSettings({ enabled: false }).catch(() => {});
                return;
            }
            startTranslationMode();
            persistSettings({ enabled: true }).catch(() => {});
        };

        const pageEvents = youtubeSubtitles.createPageEvents({
            state,
            settings: () => settings,
            toggleTranslationMode,
            stopTranslationMode,
            startTranslationMode
        });

        youtubeSubtitles.dom.ensureStyles();
        const observer = videoSync.createCaptionObserver(() => {
            if (state.enabled) {
                captionManager.renderCurrentCaption().catch(() => {});
            }
        });
        pageEvents.bindPageEvents();

        return {
            state,
            settings: () => settings,
            startTranslationMode,
            stopTranslationMode,
            toggleTranslationMode,
            renderCurrentCaption: captionManager.renderCurrentCaption,
            bindVideoSync: videoSync.bindVideoSync,
            persistSettings,
            onConfigChange(nextConfig) {
                settings = nextConfig.youtubeSubtitles;
                youtubeSubtitles.dom.applySettingsStyles(settings);
                if (!settings.enabled && state.enabled) {
                    stopTranslationMode();
                }
            },
            destroy() {
                stopTranslationMode();
                observer?.stop();
                pageEvents.destroy();
            }
        };
    };
})();


/* --- Source: content/youtube-subtitles/index.js --- */
(() => {
    const ext = globalThis.GestureExtension;

    ext.features.youtubeSubtitles = {
        shouldRun: ({ runtime }) => runtime.isHttpPage() && /(^|\.)youtube\.com$/i.test(window.location.hostname),
        init: ({ getConfig, storage }) => {
            const body = document.body;
            if (window.top !== window || body?.dataset?.gestureYoutubeSubtitlesMounted === 'true') {
                return {
                    onConfigChange() {},
                    destroy() {}
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
                    ext.youtubeSubtitles.dom.removeTranslateButtons();
                    originalDestroy();
                }
            };
        }
    };
})();


/* --- Source: content/bootstrap.js --- */
(() => {
    const ext = globalThis.GestureExtension;
    const { STORAGE_KEY, normalizeConfig } = ext.shared.config;

    const controllers = [];
    const state = {
        config: null,
        active: false
    };

    const context = {
        getConfig: () => state.config,
        storage: ext.shared.storage,
        runtime: ext.shared.runtime,
        tabActions: ext.shared.tabActions,
        configUtils: ext.shared.config
    };
    const isCurrentHostExcluded = () => ext.shared.config.isHostExcluded(state.config, location.hostname);

    const getFeatureName = (feature, index) => {
        if (!feature || typeof feature !== 'object') {
            return `unknown-${index}`;
        }
        return feature.name || feature.id || feature.key || feature.title || `feature-${index}`;
    };

    const destroyControllers = () => {
        while (controllers.length) {
            const controller = controllers.pop();
            try {
                controller?.destroy?.();
            } catch (error) {
                console.error('[GestureExtension] Failed to destroy feature controller', error);
            }
        }
        state.active = false;
    };

    const activateFeatures = () => {
        if (state.active || isCurrentHostExcluded()) {
            return;
        }
        const features = [
            ext.features.clipboard,
            ext.features.googleSearch,
            ext.features.quickSearch,
            ext.features.inlineTranslate,
            ext.features.videoFloating,
            ext.features.videoScreenshot,
            ext.features.youtubeSubtitles,
            ext.features.forum,
            ext.features.gesturesDesktop,
            ext.features.gesturesMobile,
            ext.features.unblockCopy
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
        state.active = true;
    };

    const syncFeatureActivation = () => {
        if (isCurrentHostExcluded()) {
            destroyControllers();
            return;
        }
        if (!state.active) {
            activateFeatures();
            return;
        }
        for (const controller of controllers) {
            try {
                controller.onConfigChange?.(state.config);
            } catch (error) {
                console.error('[GestureExtension] Failed to refresh feature config', error);
            }
        }
    };

    ext.shared.storage
        .getConfig()
        .then((config) => {
            state.config = config;
            syncFeatureActivation();
        })
        .catch((error) => {
            console.error('[GestureExtension] Failed to load config', error);
            state.config = normalizeConfig();
            syncFeatureActivation();
        });

    if (globalThis.chrome?.storage?.onChanged?.addListener) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !changes[STORAGE_KEY]) return;
            state.config = normalizeConfig(changes[STORAGE_KEY].newValue);
            syncFeatureActivation();
        });
    }
})();

