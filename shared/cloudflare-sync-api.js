(() => {
    const ext = globalThis.GestureExtension;
    const { normalizeConfig } = ext.shared.config;
    const stateManager = ext.shared.cloudflareSyncState;

    const sanitizeHeaderValue = (value) => {
        if (!value) return '';
        let cleaned = String(value)
            .replace(/[\u200B-\u200D\uFEFF\u2060\u200E\u200F]/g, '')
            .trim();
        // eslint-disable-next-line no-control-regex
        if (/[^\x00-\xFF]/.test(cleaned)) {
            try {
                cleaned = encodeURIComponent(cleaned);
            } catch {
                // eslint-disable-next-line no-control-regex
                cleaned = cleaned.replace(/[^\x00-\xFF]/g, '');
            }
        }
        return cleaned;
    };

    const getHeaders = (apiCode) => {
        const token = sanitizeHeaderValue(apiCode);
        if (!token) return null;
        return {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    };

    const getEndpoint = (workerUrl) => {
        const base = stateManager.normalizeWorkerUrl(workerUrl);
        return base ? `${base}/sync/${stateManager.APP_ID}/state` : '';
    };

    const assertConfigured = (settings) => {
        const endpoint = getEndpoint(settings.workerUrl);
        const headers = getHeaders(settings.apiCode);

        if (!endpoint) throw new Error('Please enter Worker URL first');
        if (!headers) throw new Error('Please enter API code first');

        return { endpoint, headers };
    };

    const buildPayload = (config, baseRevision, profileId) => ({
        version: 1,
        appId: stateManager.APP_ID,
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
            ...(await stateManager.loadSettings()),
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
        if (res.status === 401) {
            const err = new Error(
                'HTTP 401 Unauthorized: Mã API Code không chính xác hoặc không trùng khớp với SYNC_API_KEY trên Cloudflare Worker.'
            );
            err.status = 401;
            throw err;
        }
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }

        const state = await res.json();
        if (Number.isSafeInteger(state?.revision)) {
            await stateManager.saveRevision(state.revision);
        }
        return state;
    };

    const verify = async (overrideSettings = {}) => requestState('GET', null, overrideSettings);

    const pullConfig = async (overrideSettings = {}) => {
        const settings = {
            ...(await stateManager.loadSettings()),
            ...overrideSettings
        };
        const state = await requestState('GET', null, settings);
        const config = extractConfig(state, settings.profile);
        await stateManager.setLocal({ [stateManager.KEYS.skipNextConfigChange]: true });
        await ext.shared.storage.saveConfig(config);
        await stateManager.markReady(state.revision, settings.profile);
        return { config, state };
    };

    const bootstrapProfile = async (overrideSettings = {}) => {
        const settings = {
            ...(await stateManager.loadSettings()),
            ...overrideSettings
        };
        const state = await requestState('GET', null, settings);

        if (hasProfileConfig(state, settings.profile)) {
            const config = extractConfig(state, settings.profile);
            await stateManager.setLocal({ [stateManager.KEYS.skipNextConfigChange]: true });
            await ext.shared.storage.saveConfig(config);
            await stateManager.markReady(state.revision, settings.profile);
            return { action: 'pulled', config, state };
        }

        await stateManager.markReady(state.revision, settings.profile);
        return { action: 'ready', config: null, state };
    };

    const pushConfig = async (config, overrideSettings = {}) => {
        const settings = {
            ...(await stateManager.loadSettings()),
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
        await stateManager.markReady(state.revision, settings.profile);
        return state;
    };

    ext.shared.cloudflareSyncApi = {
        verify,
        pullConfig,
        bootstrapProfile,
        pushConfig
    };
})();
