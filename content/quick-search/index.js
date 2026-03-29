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
                    destroy() { }
                };
            }

            window.__gestureQuickSearchMounted = true;
            return ext.quickSearch.createController({ tabActions, getConfig });
        }
    };
})();
