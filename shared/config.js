(() => {
    const ext = globalThis.GestureExtension;

    const STORAGE_KEY = 'gesture_extension_config_v1';

    const DEFAULT_CONFIG = Object.freeze({
        version: 1,
        clipboard: {
            enabled: true,
            maxHistory: 5,
            history: [],
            pinned: []
        },
        googleSearch: {
            enabled: true
        },
        quickSearch: {
            enabled: true
        },
        inlineTranslate: {
            enabled: true,
            provider: 'google',
            hotkey: 'f2',
            swipeEnabled: true,
            swipeDir: 'both',
            swipePx: 60,
            swipeSlopeMax: 0.4,
            fontScale: 0.95,
            mutedColor: '#00bfff',
            dedupeSeconds: 0.7
        },
        trustedTypes: {
            enabled: false,
            allowDomains: []
        },
        youtubeSubtitles: {
            targetLang: 'vi',
            fontSize: 16,
            translatedFontSize: 16,
            originalColor: '#ffffff',
            translatedColor: '#0e8cef',
            displayMode: 'compact',
            showOriginal: true,
            containerPosition: { x: '5%', y: '70px' },
            containerAlignment: 'left',
            enabled: false
        },
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
        gestures: {
            desktop: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                rclick: { enabled: true, mode: 'fg' },
                dblRight: { enabled: true, ms: 500 },
                pager: { enabled: true, hops: 3 }
            },
            mobile: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                dblTap: { enabled: false, ms: 300 },
                edge: { enabled: true, width: 40, speed: 3, side: 'both' }
            }
        }
    });

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

    const normalizeConfig = (rawConfig) => {
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

        config.googleSearch = config.googleSearch && typeof config.googleSearch === 'object' ? config.googleSearch : {};
        config.googleSearch.enabled = config.googleSearch.enabled !== false;

        config.quickSearch = config.quickSearch && typeof config.quickSearch === 'object' ? config.quickSearch : {};
        config.quickSearch.enabled = config.quickSearch.enabled !== false;

        config.inlineTranslate = config.inlineTranslate && typeof config.inlineTranslate === 'object' ? config.inlineTranslate : {};
        config.inlineTranslate.enabled = config.inlineTranslate.enabled !== false;
        config.inlineTranslate.provider = config.inlineTranslate.provider === 'google' ? 'google' : 'google';
        config.inlineTranslate.hotkey = ['f2', 'f4', 'f8'].includes(String(config.inlineTranslate.hotkey || '').toLowerCase())
            ? String(config.inlineTranslate.hotkey).toLowerCase()
            : 'f2';
        config.inlineTranslate.swipeEnabled = config.inlineTranslate.swipeEnabled !== false;
        config.inlineTranslate.swipeDir = ['left', 'right', 'both'].includes(config.inlineTranslate.swipeDir) ? config.inlineTranslate.swipeDir : 'both';
        config.inlineTranslate.swipePx = clampNumber(config.inlineTranslate.swipePx, 60, 20, 240);
        config.inlineTranslate.swipeSlopeMax = clampNumber(config.inlineTranslate.swipeSlopeMax, 0.4, 0.1, 1);
        config.inlineTranslate.fontScale = clampNumber(config.inlineTranslate.fontScale, 0.95, 0.5, 2);
        config.inlineTranslate.mutedColor = typeof config.inlineTranslate.mutedColor === 'string' && config.inlineTranslate.mutedColor.trim()
            ? config.inlineTranslate.mutedColor.trim()
            : '#00bfff';
        config.inlineTranslate.dedupeSeconds = clampNumber(config.inlineTranslate.dedupeSeconds, 0.7, 0.1, 10);

        config.trustedTypes = config.trustedTypes && typeof config.trustedTypes === 'object' ? config.trustedTypes : {};
        config.trustedTypes.enabled = !!config.trustedTypes.enabled;
        config.trustedTypes.allowDomains = Array.isArray(config.trustedTypes.allowDomains)
            ? config.trustedTypes.allowDomains.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim())
            : [];

        config.youtubeSubtitles = config.youtubeSubtitles && typeof config.youtubeSubtitles === 'object' ? config.youtubeSubtitles : {};
        config.youtubeSubtitles.targetLang = typeof config.youtubeSubtitles.targetLang === 'string' && config.youtubeSubtitles.targetLang.trim()
            ? config.youtubeSubtitles.targetLang.trim()
            : 'vi';
        config.youtubeSubtitles.fontSize = clampNumber(config.youtubeSubtitles.fontSize, 16, 12, 32);
        config.youtubeSubtitles.translatedFontSize = clampNumber(config.youtubeSubtitles.translatedFontSize, 16, 12, 32);
        config.youtubeSubtitles.originalColor = typeof config.youtubeSubtitles.originalColor === 'string' && config.youtubeSubtitles.originalColor.trim()
            ? config.youtubeSubtitles.originalColor.trim()
            : '#ffffff';
        config.youtubeSubtitles.translatedColor = typeof config.youtubeSubtitles.translatedColor === 'string' && config.youtubeSubtitles.translatedColor.trim()
            ? config.youtubeSubtitles.translatedColor.trim()
            : '#0e8cef';
        config.youtubeSubtitles.displayMode = ['compact', 'full'].includes(config.youtubeSubtitles.displayMode)
            ? config.youtubeSubtitles.displayMode
            : 'compact';
        config.youtubeSubtitles.showOriginal = config.youtubeSubtitles.showOriginal !== false;
        config.youtubeSubtitles.containerPosition = config.youtubeSubtitles.containerPosition && typeof config.youtubeSubtitles.containerPosition === 'object'
            ? config.youtubeSubtitles.containerPosition
            : {};
        config.youtubeSubtitles.containerPosition.x = typeof config.youtubeSubtitles.containerPosition.x === 'string' && config.youtubeSubtitles.containerPosition.x.trim()
            ? config.youtubeSubtitles.containerPosition.x.trim()
            : '5%';
        config.youtubeSubtitles.containerPosition.y = typeof config.youtubeSubtitles.containerPosition.y === 'string' && config.youtubeSubtitles.containerPosition.y.trim()
            ? config.youtubeSubtitles.containerPosition.y.trim()
            : '70px';
        config.youtubeSubtitles.containerAlignment = ['left', 'center', 'right'].includes(config.youtubeSubtitles.containerAlignment)
            ? config.youtubeSubtitles.containerAlignment
            : 'left';
        config.youtubeSubtitles.enabled = !!config.youtubeSubtitles.enabled;

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
                enabled: values?.enabled ?? config.forum.defaults.enabled,
                wide: values?.wide ?? config.forum.defaults.wide,
                minWidth: clampNumber(values?.minWidth, config.forum.defaults.minWidth, 0, 4000),
                gap: clampNumber(values?.gap, config.forum.defaults.gap, 0, 24),
                fadeTime: clampNumber(values?.fadeTime, config.forum.defaults.fadeTime, 0, 1000),
                initDelay: clampNumber(values?.initDelay, config.forum.defaults.initDelay, 0, 1000)
            };
        }
        config.forum.hosts = normalizedHosts;

        config.gestures.desktop.enabled = !!config.gestures.desktop.enabled;
        config.gestures.desktop.lpress.enabled = !!config.gestures.desktop.lpress.enabled;
        config.gestures.desktop.lpress.mode = normalizeMode(config.gestures.desktop.lpress.mode, 'bg');
        config.gestures.desktop.lpress.ms = clampNumber(config.gestures.desktop.lpress.ms, 500, 200, 2000);
        config.gestures.desktop.rclick.enabled = !!config.gestures.desktop.rclick.enabled;
        config.gestures.desktop.rclick.mode = normalizeMode(config.gestures.desktop.rclick.mode, 'fg');
        config.gestures.desktop.dblRight.enabled = !!config.gestures.desktop.dblRight.enabled;
        config.gestures.desktop.dblRight.ms = clampNumber(config.gestures.desktop.dblRight.ms, 500, 200, 1000);
        config.gestures.desktop.pager.enabled = !!config.gestures.desktop.pager.enabled;
        config.gestures.desktop.pager.hops = clampNumber(config.gestures.desktop.pager.hops, 3, 1, 3);
        config.gestures.desktop.pager.enabled = !!config.gestures.desktop.pager.enabled;

        config.gestures.mobile.enabled = !!config.gestures.mobile.enabled;
        config.gestures.mobile.lpress.enabled = !!config.gestures.mobile.lpress.enabled;
        config.gestures.mobile.lpress.mode = normalizeMode(config.gestures.mobile.lpress.mode, 'bg');
        config.gestures.mobile.lpress.ms = clampNumber(config.gestures.mobile.lpress.ms, 500, 200, 2000);
        config.gestures.mobile.dblTap.enabled = !!config.gestures.mobile.dblTap.enabled;
        config.gestures.mobile.dblTap.ms = clampNumber(config.gestures.mobile.dblTap.ms, 300, 150, 500);
        config.gestures.mobile.edge.enabled = !!config.gestures.mobile.edge.enabled;
        config.gestures.mobile.edge.width = clampNumber(config.gestures.mobile.edge.width, 40, 20, 120);
        config.gestures.mobile.edge.speed = clampNumber(config.gestures.mobile.edge.speed, 3, 1, 10);
        config.gestures.mobile.edge.side = normalizeSide(config.gestures.mobile.edge.side);

        return config;
    };

    const getForumConfig = (config, host) => {
        const normalized = normalizeConfig(config);
        return {
            ...normalized.forum.defaults,
            ...(host ? normalized.forum.hosts[host] || {} : {})
        };
    };

    const updateForumHostConfig = (config, host, patch) => {
        const next = normalizeConfig(config);
        next.forum.hosts[host] = {
            ...getForumConfig(next, host),
            ...(patch || {})
        };
        return normalizeConfig(next);
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
            doubleRight: {
                enabled: !!normalized.gestures.desktop.dblRight.enabled,
                ms: normalized.gestures.desktop.dblRight.ms,
            },
            doubleTap: {
                enabled: !!normalized.gestures.mobile.dblTap.enabled,
                ms: normalized.gestures.mobile.dblTap.ms
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
        const next = normalizeConfig(config);
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
            doubleRight: {
                ...current.doubleRight,
                ...(patch?.doubleRight || {})
            },
            doubleTap: {
                ...current.doubleTap,
                ...(patch?.doubleTap || {})
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
        next.gestures.desktop.dblRight = {
            enabled: !!merged.doubleRight.enabled,
            ms: merged.doubleRight.ms
        };
        next.gestures.mobile.dblTap = {
            enabled: !!merged.doubleTap.enabled,
            ms: merged.doubleTap.ms
        };
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

        return normalizeConfig(next);
    };

    ext.shared.config = {
        STORAGE_KEY,
        DEFAULT_CONFIG,
        deepClone,
        normalizeConfig,
        getForumConfig,
        updateForumHostConfig,
        getGestureSettings,
        applyGestureSettings
    };
})();
