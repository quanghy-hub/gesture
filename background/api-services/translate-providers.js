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
        // MyMemory chặn q > 500 bytes server-side → tự chia nhỏ theo byte
        const chunks = utils.splitTranslateTextByBytes(text, utils.MYMEMORY_CHUNK_LIMIT_BYTES);
        const translated = [];
        for (const chunk of chunks) {
            url.searchParams.set('q', chunk);
            url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);
            const response = await utils.fetchWithTimeout(
                url.toString(),
                {
                    method: 'GET',
                    redirect: 'follow'
                },
                utils.TRANSLATE_API_TIMEOUT_MS,
                'MyMemory request timed out'
            );
            if (!response.ok) {
                throw new Error(`MyMemory HTTP ${response.status}`);
            }
            const data = await response.json();
            const part = utils.parseMyMemoryResponse(data);
            if (!part) {
                throw new Error('MyMemory returned empty translation');
            }
            translated.push(part);
        }
        return translated.join(' ').trim();
    };

    const translateWithDeepL = async (text, sourceLanguage, targetLanguage, providerSettings) => {
        const apiKey = String(providerSettings.apiKey || '').trim();
        if (!apiKey) {
            throw new Error('DeepL requires API key');
        }

        const response = await utils.fetchWithTimeout(
            buildDeepLEndpoint(providerSettings.endpoint),
            {
                method: 'POST',
                headers: {
                    Authorization: `DeepL-Auth-Key ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: [text],
                    source_lang: sourceLanguage.toUpperCase(),
                    target_lang: targetLanguage.toUpperCase()
                })
            },
            utils.TRANSLATE_API_TIMEOUT_MS,
            'DeepL request timed out'
        );
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
