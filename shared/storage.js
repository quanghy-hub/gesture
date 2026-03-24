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

    const saveClipboardHistory = async (text) => {
        if (!text || typeof text !== 'string') return;
        const trimmed = text.trim();
        if (!trimmed) return;
        return updateConfig((draft) => {
            const cb = draft.clipboard;
            const max = cb.maxHistory || 5;
            cb.history = [trimmed, ...cb.history.filter((s) => s !== trimmed)].slice(0, max);
            return draft;
        });
    };

    const togglePinItem = async (text) => {
        if (!text || typeof text !== 'string') return;
        const trimmed = text.trim();
        if (!trimmed) return;
        return updateConfig((draft) => {
            const cb = draft.clipboard;
            const idx = cb.pinned.indexOf(trimmed);
            if (idx === -1) {
                cb.pinned = [trimmed, ...cb.pinned.filter((s) => s !== trimmed)].slice(0, 5);
            } else {
                cb.pinned = cb.pinned.filter((s) => s !== trimmed);
            }
            return draft;
        });
    };

    const removeClipboardItem = async (text) => {
        if (!text || typeof text !== 'string') return;
        const trimmed = text.trim();
        if (!trimmed) return;
        return updateConfig((draft) => {
            draft.clipboard.history = draft.clipboard.history.filter((s) => s !== trimmed);
            draft.clipboard.pinned = draft.clipboard.pinned.filter((s) => s !== trimmed);
            return draft;
        });
    };

    const clearClipboardHistory = async () => {
        return updateConfig((draft) => {
            draft.clipboard.history = [];
            return draft;
        });
    };

    ext.shared.storage = {
        getConfig,
        saveConfig,
        updateConfig,
        saveClipboardHistory,
        togglePinItem,
        removeClipboardItem,
        clearClipboardHistory
    };
})();
