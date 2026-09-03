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
        isVideoFloatingBackgroundSeekExcluded,
        setVideoFloatingBackgroundSeekExcluded,
        isGestureHostExcluded,
        setGestureHostExcluded,
        getGestureSettings
    };
})();
