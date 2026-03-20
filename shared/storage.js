(() => {
    const ext = globalThis.GestureExtension;
    const { STORAGE_KEY, normalizeConfig, deepClone } = ext.shared.config;

    const getLocal = (keys) => new Promise((resolve, reject) => {
        chrome.storage.local.get(keys, (result) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(result || {});
        });
    });

    const setLocal = (payload) => new Promise((resolve, reject) => {
        chrome.storage.local.set(payload, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve();
        });
    });

    const getConfig = async () => {
        const result = await getLocal([STORAGE_KEY]);
        return normalizeConfig(result[STORAGE_KEY]);
    };

    const saveConfig = async (config) => {
        const normalized = normalizeConfig(config);
        await setLocal({ [STORAGE_KEY]: normalized });
        return normalized;
    };

    const updateConfig = async (updater) => {
        const current = await getConfig();
        const draft = deepClone(current);
        const nextValue = typeof updater === 'function' ? updater(draft) : updater;
        return saveConfig(nextValue || draft);
    };

    ext.shared.storage = {
        getConfig,
        saveConfig,
        updateConfig
    };
})();