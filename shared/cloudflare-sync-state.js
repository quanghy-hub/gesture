(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};

    const APP_ID = 'gesture';
    const DEFAULT_WORKER_URL = 'https://extension.quavav15-6.workers.dev';
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

    const getLocal = (keys) => ext.shared.storage.getLocal(keys);
    const setLocal = (payload) => ext.shared.storage.setLocal(payload);

    const normalizeWorkerUrl = (value) =>
        String(value || '')
            .trim()
            .replace(/\/+$/, '');
    const normalizeMode = (value) => (value === 'auto' ? 'auto' : 'manual');
    const normalizeProfileId = (value) => (value === 'mobile' ? 'mobile' : 'macbook');
    const isSafeRevision = (value) => (Number.isSafeInteger(value) ? value : null);

    const formatSyncStamp = (date = new Date()) =>
        date.toLocaleString('vi-VN', {
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

        const resetReady =
            (Object.prototype.hasOwnProperty.call(patch, 'workerUrl') && next.workerUrl !== current.workerUrl) ||
            (Object.prototype.hasOwnProperty.call(patch, 'apiCode') && next.apiCode !== current.apiCode);

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

    const consumeSkipNextConfigChange = async () => {
        const result = await getLocal([KEYS.skipNextConfigChange]);
        if (result[KEYS.skipNextConfigChange] !== true) return false;
        await setLocal({ [KEYS.skipNextConfigChange]: false });
        return true;
    };

    ext.shared.cloudflareSyncState = {
        APP_ID,
        DEFAULT_WORKER_URL,
        KEYS,
        statusSuffix,
        persistStatus,
        loadSettings,
        saveSettings,
        saveRevision,
        markReady,
        consumeSkipNextConfigChange,
        normalizeWorkerUrl,
        setLocal
    };
})();
