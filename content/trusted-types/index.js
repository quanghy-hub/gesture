(() => {
    const ext = globalThis.GestureExtension;

    const injectPagePolicy = () => {
        if (!window.trustedTypes || window.trustedTypes.defaultPolicy) {
            return;
        }

        try {
            window.trustedTypes.createPolicy('default', {
                createHTML: (value) => value,
                createScript: (value) => value,
                createScriptURL: (value) => value
            });
        } catch {
            // Ignore sites that block policy creation.
        }
    };

    ext.features.trustedTypes = {
        shouldRun: ({ runtime }) => runtime.isHttpPage(),
        init: ({ getConfig }) => {
            const config = getConfig();
            const trustedTypesConfig = config?.trustedTypes || { enabled: false, allowDomains: [] };
            const enabled = !!trustedTypesConfig.enabled;
            const allowDomains = Array.isArray(trustedTypesConfig.allowDomains) ? trustedTypesConfig.allowDomains : [];
            const allowed = allowDomains.includes(location.hostname);

            if (!enabled || !allowed) {
                return {
                    onConfigChange() { },
                    destroy() { }
                };
            }

            injectPagePolicy();

            return {
                onConfigChange() { },
                destroy() { }
            };
        }
    };
})();