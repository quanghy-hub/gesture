(() => {
    const ext = globalThis.GestureExtension;
    const { normalizeConfig } = ext.shared.config;

    const parseGoogleTranslateResponse = (data) => data?.[0]?.map((item) => item?.[0] ?? '').join('').trim() ?? '';
    const parseMyMemoryResponse = (data) => String(data?.responseData?.translatedText || '').trim();

    const GOOGLE_TRANSLATE_CHUNK_LIMIT = 1400;
    const GOOGLE_RETRY_COOLDOWN_MS = 2 * 60 * 1000;
    const OCR_IMAGE_FETCH_TIMEOUT_MS = 15000;
    const OCR_API_TIMEOUT_MS = 45000;
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
        .replace(/\u0000/g, '')
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

    const withTimeout = async (task, timeoutMs, timeoutMessage) => {
        const timeout = Math.max(1, Number(timeoutMs) || 1);
        let timer = 0;
        try {
            return await Promise.race([
                Promise.resolve().then(task),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(timeoutMessage)), timeout);
                })
            ]);
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
        return new Error(`Google Translate dang tam khoa, thu lai sau ${remainingSeconds}s`);
    };
    const isGoogleRateLimitError = (error) => {
        const message = String(error?.message || error || '').toLowerCase();
        return (
            message.includes('google translate http 429') ||
            message.includes('sorry') ||
            message.includes('unexpected content-type') ||
            message.includes('tam khoa')
        );
    };
    const getFriendlyTranslateError = (primaryError, fallbackError) => {
        if (isGoogleRateLimitError(primaryError)) {
            return `Google Translate dang bi gioi han. Fallback cung that bai: ${String(fallbackError?.message || fallbackError || 'Unknown error')}`;
        }
        return String(
            fallbackError?.message ||
            primaryError?.message ||
            fallbackError ||
            primaryError ||
            'Loi dich tam thoi. Thu lai sau.'
        );
    };
    const getFriendlyOcrError = (primaryError, fallbackError) => String(
        fallbackError?.message ||
        primaryError?.message ||
        fallbackError ||
        primaryError ||
        'Loi OCR tam thoi. Thu lai sau.'
    );

    const getStoredConfig = async () => {
        const storageKey = ext.shared.config.STORAGE_KEY;
        const result = await chrome.storage.local.get([storageKey]);
        return normalizeConfig(result?.[storageKey]);
    };

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

        const response = await fetch(url.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            redirect: 'follow',
            body: body.toString()
        });
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
        const response = await fetch(url.toString(), {
            method: 'GET',
            redirect: 'follow'
        });
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

        const response = await fetch(buildTranslateEndpoint('deepl', providerSettings.endpoint), {
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
        });
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

    const buildOcrEndpoint = (endpoint) => endpoint || 'https://api.ocr.space/parse/image';

    const fetchImageBlob = async (imageUrl) => {
        const res = await withTimeout(
            () => fetch(imageUrl, {
                credentials: 'omit',
                cache: 'no-store',
                redirect: 'follow',
                referrerPolicy: 'no-referrer'
            }),
            OCR_IMAGE_FETCH_TIMEOUT_MS,
            'OCR image fetch timed out'
        );
        if (!res.ok) {
            throw new Error(`Image fetch HTTP ${res.status}`);
        }
        const blob = await res.blob();
        if (!blob || !blob.size) {
            throw new Error('Ảnh OCR tải về rỗng');
        }
        return blob;
    };

    const executeOcrWithProvider = async (providerId, blob, config) => {
        const ocrSettings = getProviderSettings(config, 'ocr', providerId);
        if (ocrSettings.enabled === false) {
            throw new Error(`${providerId} provider disabled`);
        }

        const formData = new FormData();
        formData.append('file', blob, 'image.jpg');
        formData.append('language', 'auto');
        formData.append('OCREngine', '3');
        formData.append('apikey', String(ocrSettings.apiKey || 'helloworld'));

        const ocrRes = await withTimeout(
            () => fetch(buildOcrEndpoint(ocrSettings.endpoint), {
                method: 'POST',
                body: formData
            }),
            OCR_API_TIMEOUT_MS,
            'OCR service request timed out'
        );
        if (!ocrRes.ok) {
            throw new Error(`OCR HTTP ${ocrRes.status}`);
        }

        const data = await ocrRes.json();
        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage?.[0] || 'Lỗi OCR (E201/Máy chủ)');
        }
        return {
            provider: providerId,
            text: data.ParsedResults?.[0]?.ParsedText?.trim() || ''
        };
    };

    const executeOcr = async ({ imageUrl }) => {
        const config = await getStoredConfig();
        const ocrConfig = config.apiServices.ocr;
        const requestedProvider = ocrConfig.activeProvider;
        const blob = await fetchImageBlob(imageUrl);

        try {
            return await executeOcrWithProvider(requestedProvider, blob, config);
        } catch (primaryError) {
            const fallbackProvider = ocrConfig.fallbackEnabled ? ocrConfig.fallbackProvider : '';
            if (!fallbackProvider || fallbackProvider === requestedProvider) {
                throw primaryError;
            }
            try {
                const result = await executeOcrWithProvider(fallbackProvider, blob, config);
                return {
                    ...result,
                    fallbackReason: primaryError?.message || String(primaryError)
                };
            } catch (fallbackError) {
                throw new Error(getFriendlyOcrError(primaryError, fallbackError));
            }
        }
    };

    ext.background = ext.background || {};
    ext.background.apiServiceRegistry = {
        detectTargetLanguage,
        executeTranslate,
        executeOcr
    };
})();
