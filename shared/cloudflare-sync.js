(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const state = ext.shared.cloudflareSyncState;
    const api = ext.shared.cloudflareSyncApi;
    const auto = ext.shared.cloudflareSyncAuto;

    ext.shared.cloudflareSync = {
        APP_ID: state.APP_ID,
        DEFAULT_WORKER_URL: state.DEFAULT_WORKER_URL,
        KEYS: state.KEYS,
        consumeSkipNextConfigChange: state.consumeSkipNextConfigChange,
        loadSettings: state.loadSettings,
        saveSettings: state.saveSettings,
        pullConfig: api.pullConfig,
        pushConfig: api.pushConfig,
        scheduleAutoSync: auto.scheduleAutoSync,
        bootstrapProfile: api.bootstrapProfile,
        verify: api.verify
    };
})();
