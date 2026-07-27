(() => {
    const ext = globalThis.GestureExtension;
    const utils = ext.background.translateUtils;
    const google = ext.background.translateGoogle;
    const providers = ext.background.translateProviders;

    const getStoredConfig = () => ext.shared.storage.getConfig();

    const getProviderSettings = (config, serviceType, providerId) => {
        return config?.apiServices?.[serviceType]?.providers?.[providerId] || {};
    };

    const translateWithProvider = async (providerId, text, targetLanguage, config) => {
        const providerSettings = getProviderSettings(config, 'translate', providerId);
        if (providerSettings.enabled === false) {
            throw new Error(`${providerId} provider disabled`);
        }

        if (providerId === 'deepl') {
            const sourceLanguage = utils.detectSourceLanguage(text, targetLanguage);
            return providers.translateWithDeepL(text, sourceLanguage, targetLanguage, providerSettings);
        }

        if (providerId === 'mymemory') {
            const sourceLanguage = utils.detectSourceLanguage(text, targetLanguage);
            return providers.translateWithMyMemoryChunk(text, sourceLanguage, targetLanguage, providerSettings);
        }

        const chunks = utils.splitTranslateText(text);
        const translated = [];
        for (const chunk of chunks) {
            translated.push(await google.translateWithGoogleChunk(chunk, targetLanguage, providerSettings));
        }
        return translated.join('\n\n').trim();
    };

    const executeTranslate = async ({ text, targetLanguage, provider }) => {
        const config = await getStoredConfig();
        const translateConfig = config.apiServices.translate;
        const requestedProvider = provider && translateConfig.providers[provider] ? provider : translateConfig.activeProvider;
        const effectiveTargetLanguage = targetLanguage || utils.detectTargetLanguage(text);

        try {
            return {
                provider: requestedProvider,
                translatedText: await translateWithProvider(requestedProvider, text, effectiveTargetLanguage, config)
            };
        } catch (primaryError) {
            const fallbackProvider = translateConfig.fallbackEnabled ? translateConfig.fallbackProvider : '';
            if (!fallbackProvider || fallbackProvider === requestedProvider) {
                throw primaryError;
            }
            try {
                const translatedText = await translateWithProvider(fallbackProvider, text, effectiveTargetLanguage, config);
                return {
                    provider: fallbackProvider,
                    translatedText,
                    fallbackReason: primaryError?.message || String(primaryError),
                    sourceLanguage: utils.detectSourceLanguage(text, effectiveTargetLanguage)
                };
            } catch (fallbackError) {
                throw new Error(google.getFriendlyTranslateError(primaryError, fallbackError), { cause: fallbackError });
            }
        }
    };

    ext.background.translateApi = {
        detectTargetLanguage: utils.detectTargetLanguage,
        detectSourceLanguage: utils.detectSourceLanguage,
        splitTranslateText: utils.splitTranslateText,
        executeTranslate,
        fetchWithTimeout: utils.fetchWithTimeout // shared for OCR
    };
})();
