(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = ext.youtubeSubtitles = ext.youtubeSubtitles || {};
    const { createMemoryCache, translate: coreTranslate } = ext.shared.translateCore;

    const cache = createMemoryCache({ maxSize: 500 });

    youtubeSubtitles.translator = {
        clearCache() {
            cache.clear();
        },
        async translateCaption(text, settings) {
            const key = text.trim();
            if (!key) return '';
            const cached = cache.get(key);
            if (cached?.result) return cached.result;
            try {
                return await coreTranslate(key, {
                    cache,
                    provider: 'google',
                    targetLanguage: settings.targetLang
                });
            } catch {
                return '';
            }
        }
    };
})();
