// @ts-check
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
