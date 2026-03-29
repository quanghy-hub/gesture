(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = ext.inlineTranslate = ext.inlineTranslate || {};
    const { TRANSLATION_PENDING } = inlineTranslate;
    const { createMemoryCache, translate: coreTranslate } = ext.shared.translateCore;

    const cache = createMemoryCache({ maxSize: 200 });

    inlineTranslate.createActions = ({ getSettings }) => ({
        async translateText(text) {
            const settings = getSettings();
            const cached = cache.get(text);
            const now = Date.now();

            if (cached?.result) {
                if (now - cached.ts < settings.dedupeSeconds * 1000) {
                    return cached.result;
                }
                cache.set(text, { result: cached.result, ts: now });
                return cached.result;
            }

            if (cached && now - cached.ts < settings.dedupeSeconds * 1000) {
                return TRANSLATION_PENDING;
            }

            cache.set(text, { result: null, ts: now });

            const translatedText = await coreTranslate(text, {
                cache: null,
                provider: settings.provider,
                cleanResult: true
            });

            if (!translatedText) {
                throw new Error('Không có nội dung dịch trả về');
            }

            cache.set(text, { result: translatedText, ts: Date.now() });
            return translatedText;
        }
    });
})();
