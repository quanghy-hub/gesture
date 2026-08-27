(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});
    const { createMemoryCache, translateDetailed } = ext.shared.translateCore;

    // Cache lớn để chứa bản dịch prefetch của cả đoạn phía trước (phụ đề thủ
    // công của video dài có thể tới hàng trăm cue trong cửa sổ lookahead).
    const cache = createMemoryCache({ maxSize: 2000 });
    // Gom request trùng đang bay: prefetch và render live có thể yêu cầu cùng
    // một chuỗi trong cùng nhịp — chỉ gửi MỘT request lên provider.
    const pending = new Map();

    youtubeSubtitles.translator = {
        clearCache() {
            cache.clear();
        },
        hasCached(text) {
            const key = String(text || '').trim();
            return !!key && !!cache.get(key)?.result;
        },
        translateCaption(text, settings) {
            const key = String(text || '').trim();
            if (!key) {
                return Promise.resolve({ text: '', error: '' });
            }
            const cached = cache.get(key);
            if (cached?.result) {
                return Promise.resolve({ text: cached.result, error: '' });
            }
            let promise = pending.get(key);
            if (!promise) {
                promise = (async () => {
                    try {
                        const result = await translateDetailed(key, { cache, targetLanguage: settings.targetLang });
                        const translated = String(result?.translatedText || '').trim();
                        if (translated) {
                            return { text: translated, error: '' };
                        }
                        return { text: '', error: result?.error || 'Loi dich tam thoi. Thu lai sau.' };
                    } catch (error) {
                        return { text: '', error: String(error?.message || 'Loi dich tam thoi. Thu lai sau.') };
                    } finally {
                        pending.delete(key);
                    }
                })();
                pending.set(key, promise);
            }
            return promise;
        }
    };
})();
