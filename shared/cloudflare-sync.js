(() => {
    const ext = globalThis.GestureExtension;
    const { normalizeConfig } = ext.shared.config;

    const APP_ID = 'gesture';
    const DEFAULT_WORKER_URL = 'https://extension.quavav15-6.workers.dev';
    const AUTO_SYNC_DELAY = 10000;
    const PROFILE_IDS = ['macbook', 'mobile'];

    const KEYS = {
        workerUrl: 'gestureSyncWorkerUrl',
        apiCode: 'gestureSyncApiCode',
        mode: 'gestureSyncMode',
        profile: 'gestureSyncProfile',
        profiles: 'gestureSyncProfiles',
        ready: 'gestureSyncReady',
        readyProfiles: 'gestureSyncReadyProfiles',
        revision: 'gestureSyncRevision',
        status: 'gestureSyncStatus',
        statusType: 'gestureSyncStatusType',
        skipNextConfigChange: 'gestureSyncSkipNextConfigChange'
    };

    let autoSyncTimer = 0;
    let autoSyncRunning = false;

    const getLocal = (keys) => ext.shared.storage.getLocal(keys);
    const setLocal = (payload) => ext.shared.storage.setLocal(payload);
    const normalizeWorkerUrl = (value) => String(value || '').trim().replace(/\/+$/, '');
    const normalizeMode = (value) => value === 'auto' ? 'auto' : 'manual';
    const normalizeProfileId = (value) => value === 'mobile' ? 'mobile' : 'macbook';
    const isSafeRevision = (value) => Number.isSafeInteger(value) ? value : null;
    const formatSyncStamp = (date = new Date()) => date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const statusSuffix = (revision) => `revision ${Number.isSafeInteger(revision) ? revision : 0} · ${formatSyncStamp()}`;
    const persistStatus = async (message, type = '') => {
        await setLocal({
            [KEYS.status]: message,
            [KEYS.statusType]: type
        });
    };
    const normalizeReadyProfiles = (value, legacyReady, activeProfile) => {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const readyProfiles = {};
        PROFILE_IDS.forEach((profileId) => {
            if (source[profileId] === true) {
                readyProfiles[profileId] = true;
            }
        });
        if (!Object.keys(readyProfiles).length && legacyReady === true) {
            readyProfiles[normalizeProfileId(activeProfile)] = true;
        }
        return readyProfiles;
    };

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
            KEYS.readyProfiles,
            KEYS.revision,
            KEYS.profile
        ]);
        const profile = normalizeProfileId(result[KEYS.profile]);
        const readyProfiles = normalizeReadyProfiles(result[KEYS.readyProfiles], result[KEYS.ready], profile);

        return {
            workerUrl: normalizeWorkerUrl(result[KEYS.workerUrl] || DEFAULT_WORKER_URL),
            apiCode: String(result[KEYS.apiCode] || '').trim(),
            mode: normalizeMode(result[KEYS.mode]),
            ready: readyProfiles[profile] === true,
            readyProfiles,
            revision: isSafeRevision(result[KEYS.revision]),
            profile
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
        next.profile = normalizeProfileId(next.profile);
        next.revision = isSafeRevision(next.revision);
        next.readyProfiles = normalizeReadyProfiles(next.readyProfiles, next.ready, next.profile);
        next.ready = next.readyProfiles[next.profile] === true;

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
            [KEYS.readyProfiles]: resetReady ? {} : next.readyProfiles,
            [KEYS.profile]: next.profile
        };

        if (resetReady) {
            payload[KEYS.revision] = null;
            next.ready = false;
            next.readyProfiles = {};
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

    const markReady = async (revision, profileId) => {
        const settings = await loadSettings();
        const activeProfile = normalizeProfileId(profileId || settings.profile);
        const readyProfiles = {
            ...settings.readyProfiles,
            [activeProfile]: true
        };
        const payload = {
            [KEYS.ready]: readyProfiles[settings.profile] === true,
            [KEYS.readyProfiles]: readyProfiles
        };
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

    const hasProfileConfig = (state, profileId) => {
        const activeProfile = profileId || 'macbook';
        return !!(state?.profiles?.[activeProfile]?.settings?.config || state?.config);
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
            const err = new Error('Revision conflict');
            err.status = 409;
            throw err;
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
        await markReady(state.revision, settings.profile);
        return { config, state };
    };

    const bootstrapProfile = async (overrideSettings = {}) => {
        const settings = {
            ...await loadSettings(),
            ...overrideSettings
        };
        const state = await requestState('GET', null, settings);

        if (hasProfileConfig(state, settings.profile)) {
            const config = extractConfig(state, settings.profile);
            await setLocal({ [KEYS.skipNextConfigChange]: true });
            await ext.shared.storage.saveConfig(config);
            await markReady(state.revision, settings.profile);
            return { action: 'pulled', config, state };
        }

        await markReady(state.revision, settings.profile);
        return { action: 'ready', config: null, state };
    };

    const pushConfig = async (config, overrideSettings = {}) => {
        const settings = {
            ...await loadSettings(),
            ...overrideSettings
        };
        let state;
        try {
            state = await requestState('PUT', buildPayload(config, settings.revision, settings.profile), settings);
        } catch (error) {
            if (error.status !== 409) throw error;
            const latest = await requestState('GET', null, settings);
            state = await requestState('PUT', buildPayload(config, latest.revision, settings.profile), {
                ...settings,
                revision: latest.revision
            });
        }
        await markReady(state.revision, settings.profile);
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
        if (!settings.workerUrl || !settings.apiCode) return;

        autoSyncTimer = setTimeout(async () => {
            if (autoSyncRunning) return;
            autoSyncRunning = true;
            try {
                if (!settings.ready) {
                    const boot = await bootstrapProfile(settings);
                    if (boot.action === 'pulled') {
                        const message = `Pulled cloud profile · ${statusSuffix(boot.state?.revision)}`;
                        await persistStatus(message, 'ok');
                        onStatus?.(message, 'ok');
                        return;
                    }
                }
                const config = typeof getConfig === 'function' ? await getConfig() : null;
                if (!config) return;
                const state = await pushConfig(config);
                const message = `Auto sync succeeded · ${statusSuffix(state?.revision)}`;
                await persistStatus(message, 'ok');
                onStatus?.(message, 'ok');
            } catch (error) {
                const message = `Auto sync failed: ${error.message}`;
                await persistStatus(message, 'err');
                onStatus?.(message, 'err');
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
        bootstrapProfile,
        verify
    };
})();
