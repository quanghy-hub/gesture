(() => {
    const ext = globalThis.GestureExtension;

    const createMemoryCache = ({ maxSize = 200 } = {}) => {
        const store = new Map();
        const trim = () => {
            if (store.size <= maxSize) return;
            const oldestKeys = [...store.entries()]
                .sort((a, b) => (a[1]?.ts ?? 0) - (b[1]?.ts ?? 0))
                .slice(0, store.size - maxSize)
                .map(([key]) => key);
            oldestKeys.forEach((key) => store.delete(key));
        };
        return {
            get(key) { return store.get(key); },
            set(key, value) {
                store.set(key, { ...value, ts: value?.ts ?? Date.now() });
                trim();
            },
            delete(key) { store.delete(key); },
            clear() { store.clear(); }
        };
    };

    const sendRuntimeMessage = (type, payload = {}) => new Promise((resolve, reject) => {
        try {
            chrome.runtime.sendMessage({ type, payload }, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response?.ok === false) {
                    reject(new Error(response.error || 'Unknown runtime messaging error'));
                    return;
                }
                resolve(response?.result ?? response);
            });
        } catch (error) {
            reject(error);
        }
    });

    /**
     * Translate text using the background service worker.
     *
     * @param {string} text - Raw text to translate.
     * @param {object} options
     * @param {object}   options.cache         - A cache instance from createMemoryCache() (required).
     * @param {string}   [options.provider]    - Provider id, e.g. 'google'. Falls back to background default.
     * @param {string}   [options.targetLanguage] - BCP-47 target language code.
     * @param {boolean}  [options.cleanResult] - Strip leading/trailing punctuation from the result.
     * @returns {Promise<string>} Translated text or empty string on failure.
     */
    const translate = async (text, { cache, provider, targetLanguage, cleanResult = false } = {}) => {
        const key = String(text || '').trim();
        if (!key) return '';

        if (cache) {
            const cached = cache.get(key);
            if (cached?.result) return cached.result;
        }

        const payload = await sendRuntimeMessage('gesture-ext/translate-text', {
            text: key,
            ...(provider ? { provider } : {}),
            ...(targetLanguage ? { targetLanguage } : {})
        });

        let result = payload?.translatedText ?? '';

        if (cleanResult && result) {
            result = String(result)
                .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gmu, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        if (cache && result) {
            cache.set(key, { result, ts: Date.now() });
        }

        return result;
    };

    ext.shared.translateCore = { createMemoryCache, sendRuntimeMessage, translate };
})();
