(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const { TRANSLATION_PENDING } = inlineTranslate;
    const { createMemoryCache, translate: coreTranslate } = ext.shared.translateCore;

    const cache = createMemoryCache({ maxSize: 1000 });
    const pending = new Map();

    inlineTranslate.createActions = ({ getSettings }) => ({
        async translateText(text) {
            const settings = getSettings();
            const key = String(text || '').trim();
            if (!key) throw new Error('Không có nội dung để dịch');
            const cached = cache.get(key);
            const now = Date.now();

            if (cached?.result) {
                if (now - cached.ts < settings.dedupeSeconds * 1000) {
                    return cached.result;
                }
                cache.set(key, { result: cached.result, ts: now });
                return cached.result;
            }

            if (pending.has(key)) {
                const existing = pending.get(key);
                if (now - (cached?.ts || 0) < settings.dedupeSeconds * 1000) {
                    return existing;
                }
            }

            if (cached && now - cached.ts < settings.dedupeSeconds * 1000) {
                return TRANSLATION_PENDING;
            }

            const promise = (async () => {
                const translatedText = await coreTranslate(key, {
                    cache: null,
                    provider: settings.provider,
                    cleanResult: true
                });
                if (!translatedText) {
                    throw new Error('Không có nội dung dịch trả về');
                }
                cache.set(key, { result: translatedText, ts: Date.now() });
                return translatedText;
            })();

            pending.set(key, promise);
            cache.set(key, { result: null, ts: now });
            try {
                const result = await promise;
                return result;
            } catch (error) {
                cache.delete(key);
                throw error;
            } finally {
                pending.delete(key);
            }
        },
        clearCache() {
            cache.clear();
            pending.clear();
        }
    });
})();
