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
            get(key) {
                return store.get(key);
            },
            set(key, value) {
                store.set(key, { ...value, ts: value?.ts ?? Date.now() });
                trim();
            },
            delete(key) {
                store.delete(key);
            },
            clear() {
                store.clear();
            }
        };
    };

    const sendRuntimeMessage = (type, payload = {}) => ext.shared.messaging.sendRuntimeMessage(type, payload, { unwrapResult: true });

    const translateDetailed = async (text, { cache, provider, targetLanguage, cleanResult = false } = {}) => {
        const key = String(text || '').trim();
        if (!key) {
            return {
                text: '',
                translatedText: '',
                provider: provider || '',
                sourceLanguage: 'auto',
                targetLanguage: targetLanguage || '',
                fallbackReason: '',
                error: ''
            };
        }

        if (cache) {
            const cached = cache.get(key);
            if (cached?.result) {
                return {
                    text: key,
                    translatedText: cached.result,
                    provider: cached.provider || provider || '',
                    sourceLanguage: cached.sourceLanguage || 'auto',
                    targetLanguage: cached.targetLanguage || targetLanguage || '',
                    fallbackReason: cached.fallbackReason || '',
                    error: ''
                };
            }
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
            cache.set(key, {
                result,
                provider: payload?.provider || provider || '',
                sourceLanguage: payload?.sourceLanguage || 'auto',
                targetLanguage: payload?.targetLanguage || targetLanguage || '',
                fallbackReason: payload?.fallbackReason || '',
                ts: Date.now()
            });
        }

        return {
            text: key,
            translatedText: result,
            provider: payload?.provider || provider || '',
            sourceLanguage: payload?.sourceLanguage || 'auto',
            targetLanguage: payload?.targetLanguage || targetLanguage || '',
            fallbackReason: payload?.fallbackReason || '',
            error: result ? '' : 'Khong co noi dung dich tra ve'
        };
    };

    const translate = async (text, options = {}) => {
        const result = await translateDetailed(text, options);
        return result.translatedText || '';
    };

    ext.shared.translateCore = { createMemoryCache, sendRuntimeMessage, translate, translateDetailed };
})();
