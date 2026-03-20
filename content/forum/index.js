(() => {
    const ext = globalThis.GestureExtension;
    const { debounce, isHttpPage } = ext.shared.runtime;
    const { getForumConfig } = ext.shared.config;
    const { createMasonry, destroyMasonry, selectors } = ext.features.forumLayout;

    const FORUM_CACHE_PREFIX = 'gesture_extension_forum_cache_v1:';
    const EARLY_STYLE_ID = 'gesture-ext-forum-early-style';

    const readForumCache = (host) => {
        try {
            const raw = localStorage.getItem(FORUM_CACHE_PREFIX + host);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    };

    const writeForumCache = (host, config) => {
        try {
            if (!config?.enabled) {
                localStorage.removeItem(FORUM_CACHE_PREFIX + host);
                return;
            }

            localStorage.setItem(FORUM_CACHE_PREFIX + host, JSON.stringify({
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

    const injectEarlyStyle = (fadeTime) => {
        if (document.getElementById(EARLY_STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = EARLY_STYLE_ID;
        style.textContent = `html.fs-loading body{opacity:0!important}html.fs-ready body{opacity:1;transition:opacity ${fadeTime}ms ease-out}`;
        (document.head || document.documentElement).appendChild(style);
    };

    const cachedForumConfig = isHttpPage() ? readForumCache(location.host) : null;
    if (cachedForumConfig?.enabled) {
        injectEarlyStyle(cachedForumConfig.fadeTime || 150);
        document.documentElement.classList.add('fs-loading');
    }

    ext.features.forum = {
        shouldRun() {
            return isHttpPage();
        },

        init(context) {
            const html = document.documentElement;
            let currentConfig = getForumConfig(context.getConfig(), location.host);
            let activeWrappers = [];
            let styleNode = null;
            let observer = null;
            let initialized = false;
            let revealTimer = null;

            const injectStyles = () => {
                if (styleNode) return;
                styleNode = document.createElement('style');
                styleNode.id = 'gesture-ext-forum-styles';
                styleNode.textContent = ext.features.forumStyles.css;
                (document.head || document.documentElement).appendChild(styleNode);
            };

            const syncCache = () => {
                writeForumCache(location.host, currentConfig);
            };

            const showContent = () => {
                clearTimeout(revealTimer);
                revealTimer = null;

                if (!html.classList.contains('fs-loading')) return;
                html.classList.remove('fs-loading');
                html.classList.add('fs-ready');

                const earlyStyle = document.getElementById(EARLY_STYLE_ID);
                if (earlyStyle) {
                    setTimeout(() => earlyStyle.remove(), currentConfig.fadeTime + 50);
                }
            };

            const scheduleRevealFallback = () => {
                if (!html.classList.contains('fs-loading') || revealTimer) return;
                revealTimer = setTimeout(() => {
                    revealTimer = null;
                    showContent();
                }, Math.max(350, currentConfig.initDelay + currentConfig.fadeTime + 500));
            };

            const shouldActivate = () => currentConfig.enabled && innerWidth > innerHeight && innerWidth >= currentConfig.minWidth;

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
                    showContent();
                    return false;
                }

                const applied = applyMasonry();
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
                    showContent();
                    return;
                }

                const applied = applyMasonry();
                if (applied) {
                    showContent();
                } else {
                    scheduleRevealFallback();
                }
            }, 250);

            const ensureObserver = () => {
                if (observer || !document.body) return;
                observer = new MutationObserver(() => debouncedApply());
                observer.observe(document.body, { childList: true, subtree: true });
            };

            const start = () => {
                if (initialized) return;
                initialized = true;

                syncCache();
                if (cachedForumConfig?.enabled) {
                    injectStyles();
                    scheduleRevealFallback();
                    addEventListener('load', showContent, { once: true });
                }

                setTimeout(() => {
                    refresh();
                    ensureObserver();
                }, currentConfig.initDelay);
                addEventListener('resize', debouncedRefresh, { passive: true });
            };

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', start, { once: true });
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
                    removeMasonry();
                    observer?.disconnect();
                }
            };
        }
    };
})();