(() => {
    const ext = globalThis.GestureExtension;

    const parseGoogleTranslateResponse = (data) => data?.[0]?.map((item) => item?.[0] ?? '').join('').trim() ?? '';
    const parseMyMemoryResponse = (data) => String(data?.responseData?.translatedText || '').trim();

    const GOOGLE_TRANSLATE_CHUNK_LIMIT = 1400;
    const GOOGLE_RETRY_COOLDOWN_MS = 2 * 60 * 1000;
    const TRANSLATE_API_TIMEOUT_MS = 30000;
    let googleCooldownUntil = 0;

    const detectTargetLanguage = (text) => /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text)
        ? 'en'
        : 'vi';

    const detectSourceLanguage = (text, targetLanguage = '') => {
        const normalizedTarget = String(targetLanguage || '').trim().toLowerCase();
        if (normalizedTarget === 'vi') {
            return 'en';
        }
        if (normalizedTarget === 'en') {
            return 'vi';
        }
        return /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text)
            ? 'vi'
            : 'en';
    };

    const normalizeTranslateText = (text) => String(text || '')
        .replace(/\r\n?/g, '\n')
        .replaceAll('\u0000', '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const splitTranslateText = (text, limit = GOOGLE_TRANSLATE_CHUNK_LIMIT) => {
        const normalized = normalizeTranslateText(text);
        if (!normalized) {
            return [];
        }
        if (normalized.length <= limit) {
            return [normalized];
        }

        const segments = normalized.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
        const chunks = [];
        let current = '';

        const pushCurrent = () => {
            const value = current.trim();
            if (value) {
                chunks.push(value);
            }
            current = '';
        };

        const splitLongSegment = (segment) => {
            const parts = segment.match(new RegExp(`.{1,${limit}}`, 'gu')) || [];
            for (const part of parts) {
                chunks.push(part.trim());
            }
        };

        for (const segment of segments) {
            if (segment.length > limit) {
                pushCurrent();
                splitLongSegment(segment);
                continue;
            }

            const candidate = current ? `${current}\n\n${segment}` : segment;
            if (candidate.length > limit) {
                pushCurrent();
                current = segment;
            } else {
                current = candidate;
            }
        }

        pushCurrent();
        return chunks.length ? chunks : [normalized];
    };

    const fetchWithTimeout = async (url, options = {}, timeoutMs, timeoutMessage) => {
        const timeout = Math.max(1, Number(timeoutMs) || 1);
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, timeout);
        try {
            return await fetch(url, {
                ...options,
                signal: controller.signal
            });
        } catch (error) {
            if (timedOut || error?.name === 'AbortError') {
                throw new Error(timeoutMessage);
            }
            throw error;
        } finally {
            clearTimeout(timer);
        }
    };

    const isGoogleCooldownActive = () => Date.now() < googleCooldownUntil;
    const setGoogleCooldown = () => {
        googleCooldownUntil = Date.now() + GOOGLE_RETRY_COOLDOWN_MS;
    };
    const getGoogleCooldownError = () => {
        const remainingMs = Math.max(0, googleCooldownUntil - Date.now());
        const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
        return new Error(`Google Translate đang tạm khóa, thử lại sau ${remainingSeconds}s`);
    };
    const isGoogleRateLimitError = (error) => {
        const message = String(error?.message || error || '').toLowerCase();
        return (
            message.includes('google translate http 429') ||
            message.includes('sorry') ||
            message.includes('unexpected content-type') ||
            message.includes('tạm khóa') ||
            message.includes('tam khoa')
        );
    };
    const getFriendlyTranslateError = (primaryError, fallbackError) => {
        if (isGoogleRateLimitError(primaryError)) {
            return `Google Translate đang bị giới hạn. Fallback cũng thất bại: ${String(fallbackError?.message || fallbackError || 'Unknown error')}`;
        }
        return String(
            fallbackError?.message ||
            primaryError?.message ||
            fallbackError ||
            primaryError ||
            'Lỗi dịch tạm thời. Thử lại sau.'
        );
    };

    const getStoredConfig = () => ext.shared.storage.getConfig();

    const getProviderSettings = (config, serviceType, providerId) => {
        return config?.apiServices?.[serviceType]?.providers?.[providerId] || {};
    };

    const buildTranslateEndpoint = (providerId, endpoint) => {
        if (endpoint) {
            return endpoint;
        }
        if (providerId === 'mymemory') {
            return 'https://api.mymemory.translated.net/get';
        }
        if (providerId === 'deepl') {
            return 'https://api-free.deepl.com/v2/translate';
        }
        return 'https://translate.googleapis.com/translate_a/single';
    };

    const translateWithGoogleChunk = async (text, targetLanguage, providerSettings) => {
        if (isGoogleCooldownActive()) {
            throw getGoogleCooldownError();
        }

        const url = new URL(buildTranslateEndpoint('google', providerSettings.endpoint));
        url.searchParams.set('client', 'gtx');
        url.searchParams.set('sl', 'auto');
        url.searchParams.set('tl', targetLanguage);
        url.searchParams.set('dt', 't');

        const body = new URLSearchParams();
        body.set('q', text);

        const response = await fetchWithTimeout(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            redirect: 'follow',
            body: body.toString()
        }, TRANSLATE_API_TIMEOUT_MS, 'Google Translate request timed out');
        if (!response.ok) {
            if (response.status === 429) {
                setGoogleCooldown();
            }
            throw new Error(`Google Translate HTTP ${response.status}`);
        }
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            setGoogleCooldown();
            throw new Error(`Google Translate unexpected content-type: ${contentType || 'unknown'}`);
        }

        const data = await response.json();
        const translated = parseGoogleTranslateResponse(data);
        if (!translated) {
            throw new Error('Google Translate returned empty translation');
        }
        return translated;
    };

    const translateWithMyMemoryChunk = async (text, sourceLanguage, targetLanguage, providerSettings) => {
        const url = new URL(buildTranslateEndpoint('mymemory', providerSettings.endpoint));
        url.searchParams.set('q', text);
        url.searchParams.set('langpair', `${sourceLanguage}|${targetLanguage}`);
        const response = await fetchWithTimeout(url.toString(), {
            method: 'GET',
            redirect: 'follow'
        }, TRANSLATE_API_TIMEOUT_MS, 'MyMemory request timed out');
        if (!response.ok) {
            throw new Error(`MyMemory HTTP ${response.status}`);
        }
        const data = await response.json();
        const translated = parseMyMemoryResponse(data);
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

        const response = await fetchWithTimeout(buildTranslateEndpoint('deepl', providerSettings.endpoint), {
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
        }, TRANSLATE_API_TIMEOUT_MS, 'DeepL request timed out');
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

    const translateWithProvider = async (providerId, text, targetLanguage, config) => {
        const providerSettings = getProviderSettings(config, 'translate', providerId);
        if (providerSettings.enabled === false) {
            throw new Error(`${providerId} provider disabled`);
        }

        if (providerId === 'deepl') {
            const sourceLanguage = detectSourceLanguage(text, targetLanguage);
            return translateWithDeepL(text, sourceLanguage, targetLanguage, providerSettings);
        }

        if (providerId === 'mymemory') {
            const sourceLanguage = detectSourceLanguage(text, targetLanguage);
            return translateWithMyMemoryChunk(text, sourceLanguage, targetLanguage, providerSettings);
        }

        const chunks = splitTranslateText(text);
        const translated = [];
        for (const chunk of chunks) {
            translated.push(await translateWithGoogleChunk(chunk, targetLanguage, providerSettings));
        }
        return translated.join('\n\n').trim();
    };

    const executeTranslate = async ({ text, targetLanguage, provider }) => {
        const config = await getStoredConfig();
        const translateConfig = config.apiServices.translate;
        const requestedProvider = provider && translateConfig.providers[provider] ? provider : translateConfig.activeProvider;
        const effectiveTargetLanguage = targetLanguage || detectTargetLanguage(text);

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
                    sourceLanguage: detectSourceLanguage(text, effectiveTargetLanguage)
                };
            } catch (fallbackError) {
                throw new Error(getFriendlyTranslateError(primaryError, fallbackError));
            }
        }
    };

    ext.background = ext.background || {};
    ext.background.translateApi = {
        detectTargetLanguage,
        detectSourceLanguage,
        splitTranslateText,
        executeTranslate,
        fetchWithTimeout // shared for OCR
    };
})();
