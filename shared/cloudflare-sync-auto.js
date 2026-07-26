(() => {
    const ext = globalThis.GestureExtension;
    const stateManager = ext.shared.cloudflareSyncState;
    const api = ext.shared.cloudflareSyncApi;
    const AUTO_SYNC_DELAY = 10000;
    
    let autoSyncTimer = 0;
    let autoSyncRunning = false;

    const scheduleAutoSync = async (getConfig, onStatus) => {
        if (autoSyncTimer) {
            clearTimeout(autoSyncTimer);
            autoSyncTimer = 0;
        }

        const settings = await stateManager.loadSettings();
        if (!settings.workerUrl || !settings.apiCode) return;

        autoSyncTimer = setTimeout(async () => {
            if (autoSyncRunning) return;
            autoSyncRunning = true;
            try {
                if (!settings.ready) {
                    const boot = await api.bootstrapProfile(settings);
                    if (boot.action === 'pulled') {
                        const message = `Pulled cloud profile · ${stateManager.statusSuffix(boot.state?.revision)}`;
                        await stateManager.persistStatus(message, 'ok');
                        onStatus?.(message, 'ok');
                        return;
                    }
                }
                const config = typeof getConfig === 'function' ? await getConfig() : null;
                if (!config) return;
                const state = await api.pushConfig(config);
                const message = `Auto sync succeeded · ${stateManager.statusSuffix(state?.revision)}`;
                await stateManager.persistStatus(message, 'ok');
                onStatus?.(message, 'ok');
            } catch (error) {
                const message = `Auto sync failed: ${error.message}`;
                await stateManager.persistStatus(message, 'err');
                onStatus?.(message, 'err');
                console.error('[GestureExtension] Cloudflare auto sync failed', error);
            } finally {
                autoSyncRunning = false;
            }
        }, AUTO_SYNC_DELAY);
    };

    ext.shared.cloudflareSyncAuto = {
        scheduleAutoSync
    };
})();
