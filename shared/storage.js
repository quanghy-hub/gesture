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
            draft.clipboard = draft.clipboard || { history: [], pinned: [] };
            draft.clipboard.history = draft.clipboard.history || [];
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
            draft.clipboard = draft.clipboard || { history: [], pinned: [] };
            draft.clipboard.pinned = draft.clipboard.pinned || [];
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
            if (!draft.clipboard) return draft;
            if (draft.clipboard.history) draft.clipboard.history = draft.clipboard.history.filter((s) => s !== trimmed);
            if (draft.clipboard.pinned) draft.clipboard.pinned = draft.clipboard.pinned.filter((s) => s !== trimmed);
            return draft;
        });
    };

    const clearClipboardHistory = async () => {
        return updateConfig((draft) => {
            if (draft.clipboard) draft.clipboard.history = [];
            return draft;
        });
    };

    const saveClipboardTriggerPosition = async (position) => {
        if (!position || typeof position !== 'object') return;
        const x = Number(position.x);
        const y = Number(position.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        return updateConfig((draft) => {
            draft.clipboard.triggerPosition = {
                x: Math.max(0, Math.round(x)),
                y: Math.max(0, Math.round(y))
            };
            return draft;
        });
    };

    const saveVideoLayout = async (layout) => {
        if (!layout || typeof layout !== 'object') return;
        return updateConfig((draft) => {
            draft.videoFloating = draft.videoFloating || {};
            draft.videoFloating.layout = {
                top: layout.top,
                left: layout.left,
                width: layout.width,
                height: layout.height,
                borderRadius: layout.borderRadius
            };
            return draft;
        });
    };

    const saveVideoIconPos = async (pos) => {
        if (!pos || typeof pos !== 'object') return;
        return updateConfig((draft) => {
            draft.videoFloating = draft.videoFloating || {};
            draft.videoFloating.iconPos = {
                top: pos.top,
                left: pos.left
            };
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
        clearClipboardHistory,
        saveClipboardTriggerPosition,
        saveVideoLayout,
        saveVideoIconPos
    };
})();
