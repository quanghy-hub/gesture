(() => {
    const ext = globalThis.GestureExtension;
    const { STORAGE_KEY, normalizeConfig } = ext.shared.config;

    const APP_ID = 'gesture';
    const DEFAULT_WORKER_URL = 'https://extension.quavav15-6.workers.dev';
    const AUTO_SYNC_DELAY = 1200;

    const KEYS = {
        workerUrl: 'gestureSyncWorkerUrl',
        apiCode: 'gestureSyncApiCode',
        mode: 'gestureSyncMode',
        autosyncMacbook: 'gestureSyncAutosyncMacbook',
        autosyncMobile: 'gestureSyncAutosyncMobile',
        profile: 'gestureSyncProfile',
        profiles: 'gestureSyncProfiles',
        ready: 'gestureSyncReady',
        revision: 'gestureSyncRevision',
        skipNextConfigChange: 'gestureSyncSkipNextConfigChange'
    };

    let autoSyncTimer = 0;
    let autoSyncRunning = false;

    const getLocal = (keys) => ext.shared.storage.getLocal(keys);
    const setLocal = (payload) => ext.shared.storage.setLocal(payload);
    const normalizeWorkerUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
    const normalizeMode = (value) => value === 'auto' ? 'auto' : 'manual';
    const isSafeRevision = (value) => Number.isSafeInteger(value) ? value : null;

    const getHeaders = (apiCode) => {
        const token = String(apiCode || '').trim();
        if (!token) return null;
        return {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    const getEndpoint = (workerUrl) => {
        const base = normalizeWorkerUrl(workerUrl);
        return base ? `${base}/sync/${APP_ID}/state` : '';
    };

    const loadSettings = async () => {
        const result = await getLocal([
            KEYS.workerUrl,
            KEYS.apiCode,
            KEYS.mode,
            KEYS.ready,
            KEYS.revision,
            KEYS.profile,
            KEYS.autosyncMacbook,
            KEYS.autosyncMobile
        ]);

        return {
            workerUrl: normalizeWorkerUrl(result[KEYS.workerUrl] || DEFAULT_WORKER_URL),
            apiCode: String(result[KEYS.apiCode] || '').trim(),
            mode: normalizeMode(result[KEYS.mode]),
            ready: result[KEYS.ready] === true,
            revision: isSafeRevision(result[KEYS.revision]),
            profile: result[KEYS.profile] === 'mobile' ? 'mobile' : 'macbook',
            autosyncMacbook: result[KEYS.autosyncMacbook] === true,
            autosyncMobile: result[KEYS.autosyncMobile] === true
        };
    };

    const saveSettings = async (patch = {}) => {
        const current = await loadSettings();
        const next = {
            ...current,
            ...patch
        };
        next.workerUrl = normalizeWorkerUrl(next.workerUrl);
        next.apiCode = String(next.apiCode || '').trim();
        next.mode = normalizeMode(next.mode);
        next.revision = isSafeRevision(next.revision);

        const resetReady = (
            Object.prototype.hasOwnProperty.call(patch, 'workerUrl') && next.workerUrl !== current.workerUrl
        ) || (
            Object.prototype.hasOwnProperty.call(patch, 'apiCode') && next.apiCode !== current.apiCode
        );

        const payload = {
            [KEYS.workerUrl]: next.workerUrl,
            [KEYS.apiCode]: next.apiCode,
            [KEYS.mode]: next.mode,
            [KEYS.ready]: resetReady ? false : next.ready,
            [KEYS.profile]: next.profile === 'mobile' ? 'mobile' : 'macbook',
            [KEYS.autosyncMacbook]: next.autosyncMacbook === true,
            [KEYS.autosyncMobile]: next.autosyncMobile === true
        };

        if (resetReady) {
            payload[KEYS.revision] = null;
            next.ready = false;
            next.revision = null;
        } else if (next.revision !== null) {
            payload[KEYS.revision] = next.revision;
        }

        await setLocal(payload);
        return next;
    };

    const assertConfigured = (settings) => {
        const endpoint = getEndpoint(settings.workerUrl);
        const headers = getHeaders(settings.apiCode);

        if (!endpoint) throw new Error('Please enter Worker URL first');
        if (!headers) throw new Error('Please enter API code first');

        return { endpoint, headers };
    };

    const saveRevision = async (revision) => {
        if (!Number.isSafeInteger(revision)) return null;
        await setLocal({ [KEYS.revision]: revision });
        return revision;
    };

    const markReady = async (revision) => {
        const payload = { [KEYS.ready]: true };
        if (Number.isSafeInteger(revision)) {
            payload[KEYS.revision] = revision;
        }
        await setLocal(payload);
    };

    const buildPayload = (config, baseRevision, profileId) => ({
        version: 1,
        appId: APP_ID,
        profileId: profileId || 'macbook',
        baseRevision,
        links: [],
        groups: { list: [] },
        profile: {
            settings: {
                schema: 1,
                config: normalizeConfig(config)
            },
            pinned: [],
            selected: ''
        }
    });

    const extractConfig = (state, profileId) => {
        const activeProfile = profileId || 'macbook';
        const syncedConfig = state?.profiles?.[activeProfile]?.settings?.config || state?.config;
        if (!syncedConfig || typeof syncedConfig !== 'object') {
            throw new Error('Cloud does not have Gesture config yet. Please push from source machine first.');
        }
        return normalizeConfig(syncedConfig);
    };

    const requestState = async (method, body, overrideSettings = {}) => {
        const settings = {
            ...await loadSettings(),
            ...overrideSettings
        };
        const { endpoint, headers } = assertConfigured(settings);
        const res = await fetch(endpoint, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        if (res.status === 409) {
            throw new Error('Cloud has newer data. Please pull and verify first before pushing.');
        }
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const state = await res.json();
        if (Number.isSafeInteger(state?.revision)) {
            await saveRevision(state.revision);
        }
        return state;
    };

    const verify = async (overrideSettings = {}) => requestState('GET', null, overrideSettings);

    const pullConfig = async (overrideSettings = {}) => {
        const settings = {
            ...await loadSettings(),
            ...overrideSettings
        };
        const state = await requestState('GET', null, settings);
        const config = extractConfig(state, settings.profile);
        await setLocal({ [KEYS.skipNextConfigChange]: true });
        await ext.shared.storage.saveConfig(config);
        await markReady(state.revision);
        return { config, state };
    };

    const pushConfig = async (config, overrideSettings = {}) => {
        const settings = {
            ...await loadSettings(),
            ...overrideSettings
        };
        const state = await requestState('PUT', buildPayload(config, settings.revision, settings.profile), settings);
        await markReady(state.revision);
        return state;
    };

    const consumeSkipNextConfigChange = async () => {
        const result = await getLocal([KEYS.skipNextConfigChange]);
        if (result[KEYS.skipNextConfigChange] !== true) return false;
        await setLocal({ [KEYS.skipNextConfigChange]: false });
        return true;
    };

    const scheduleAutoSync = async (getConfig, onStatus) => {
        if (autoSyncTimer) {
            clearTimeout(autoSyncTimer);
            autoSyncTimer = 0;
        }

        const settings = await loadSettings();
        const isAutosyncEnabled = settings.profile === 'mobile' ? settings.autosyncMobile : settings.autosyncMacbook;
        if (!isAutosyncEnabled || !settings.workerUrl || !settings.apiCode) return;
        if (!settings.ready) {
            onStatus?.('Auto sync is waiting for the initial pull.', '');
            return;
        }

        autoSyncTimer = setTimeout(async () => {
            if (autoSyncRunning) return;
            autoSyncRunning = true;
            try {
                const config = typeof getConfig === 'function' ? await getConfig() : null;
                if (!config) return;
                await pushConfig(config);
                onStatus?.(`Auto sync succeeded at ${new Date().toLocaleTimeString()}`, 'ok');
            } catch (error) {
                onStatus?.(`Auto sync failed: ${error.message}`, 'err');
                console.error('[GestureExtension] Cloudflare auto sync failed', error);
            } finally {
                autoSyncRunning = false;
            }
        }, AUTO_SYNC_DELAY);
    };

    ext.shared.cloudflareSync = {
        APP_ID,
        DEFAULT_WORKER_URL,
        KEYS,
        consumeSkipNextConfigChange,
        loadSettings,
        pullConfig,
        pushConfig,
        saveSettings,
        scheduleAutoSync,
        verify
    };
})();
