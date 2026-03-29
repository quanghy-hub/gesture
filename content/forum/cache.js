(() => {
    const ext = globalThis.GestureExtension;
    const forumCache = ext.forumCache = ext.forumCache || {};

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

            localStorage.setItem(forumCache.FORUM_CACHE_PREFIX + host, JSON.stringify({
                enabled: !!config.enabled,
                wide: !!config.wide,
                minWidth: Number(config.minWidth) || 1000,
                gap: Number(config.gap) || 1,
                fadeTime: Number(config.fadeTime) || 150,
                initDelay: Number(config.initDelay) || 100
            }));
        } catch {
            // Ignore cache write errors.
        }
    };
})();
