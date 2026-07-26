(() => {
    const ext = globalThis.GestureExtension;
    const utils = ext.background.translateUtils;

    const buildMyMemoryEndpoint = (endpoint) => {
        return endpoint || 'https://api.mymemory.translated.net/get';
    };

    const buildDeepLEndpoint = (endpoint) => {
        return endpoint || 'https://api-free.deepl.com/v2/translate';
    };

    const translateWithMyMemoryChunk = async (text, sourceLanguage, targetLanguage, providerSettings) => {
        const url = new URL(buildMyMemoryEndpoint(providerSettings.endpoint));
        url.searchParams.set('q', text);
        url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);
        const response = await utils.fetchWithTimeout(url.toString(), {
            method: 'GET',
            redirect: 'follow'
        }, utils.TRANSLATE_API_TIMEOUT_MS, 'MyMemory request timed out');
        if (!response.ok) {
            throw new Error(`MyMemory HTTP ${response.status}`);
        }
        const data = await response.json();
        const translated = utils.parseMyMemoryResponse(data);
        if (!translated) {
            throw new Error('MyMemory returned empty translation');
        }
        return translated;
    };

    const translateWithDeepL = async (text, sourceLanguage, targetLanguage, providerSettings) => {
        const apiKey = String(providerSettings.apiKey || '').trim();
        if (!apiKey) {
            throw new Error('DeepL requires API key');
        }

        const response = await utils.fetchWithTimeout(buildDeepLEndpoint(providerSettings.endpoint), {
            method: 'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: [text],
                source_lang: sourceLanguage.toUpperCase(),
                target_lang: targetLanguage.toUpperCase()
            })
        }, utils.TRANSLATE_API_TIMEOUT_MS, 'DeepL request timed out');
        if (!response.ok) {
            throw new Error(`DeepL HTTP ${response.status}`);
        }
        const data = await response.json();
        const translated = String(data?.translations?.[0]?.text || '').trim();
        if (!translated) {
            throw new Error('DeepL returned empty translation');
        }
        return translated;
    };

    ext.background.translateProviders = {
        translateWithMyMemoryChunk,
        translateWithDeepL
    };
})();
