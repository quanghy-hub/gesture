(() => {
    const ext = globalThis.GestureExtension;
    const forum = ext.forum = ext.forum || {};
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
            revealTimer = window.setTimeout(() => {
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
                observer?.disconnect();
                observer = null;
            }
        };
    };
})();
