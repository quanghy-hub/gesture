(() => {
    const ext = globalThis.GestureExtension;
    const utils = ext.background.translateUtils;

    const GOOGLE_RETRY_COOLDOWN_MS = 2 * 60 * 1000;
    let googleCooldownUntil = 0;
    const SESSION_COOLDOWN_KEY = 'gesture_google_cooldown_until';

    const isGoogleCooldownActive = async () => {
        if (Date.now() < googleCooldownUntil) return true;
        try {
            const storageApi = globalThis.chrome?.storage?.session || globalThis.chrome?.storage?.local;
            if (storageApi?.get) {
                const res = await new Promise((resolve) => storageApi.get([SESSION_COOLDOWN_KEY], resolve));
                if (res?.[SESSION_COOLDOWN_KEY] && Date.now() < res[SESSION_COOLDOWN_KEY]) {
                    googleCooldownUntil = res[SESSION_COOLDOWN_KEY];
                    return true;
                }
            }
        } catch {
            // Storage session fallback
        }
        return false;
    };

    const setGoogleCooldown = () => {
        googleCooldownUntil = Date.now() + GOOGLE_RETRY_COOLDOWN_MS;
        try {
            const storageApi = globalThis.chrome?.storage?.session || globalThis.chrome?.storage?.local;
            if (storageApi?.set) {
                storageApi.set({ [SESSION_COOLDOWN_KEY]: googleCooldownUntil }).catch(() => {});
            }
        } catch {
            // Storage session fallback
        }
    };

    const getGoogleCooldownError = async () => {
        await isGoogleCooldownActive();
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
            fallbackError?.message || primaryError?.message || fallbackError || primaryError || 'Lỗi dịch tạm thời. Thử lại sau.'
        );
    };

    const buildGoogleEndpoint = (endpoint) => {
        return endpoint || 'https://translate.googleapis.com/translate_a/single';
    };

    const translateWithGoogleChunk = async (text, targetLanguage, providerSettings) => {
        if (await isGoogleCooldownActive()) {
            throw await getGoogleCooldownError();
        }

        const url = new URL(buildGoogleEndpoint(providerSettings.endpoint));
        url.searchParams.set('client', 'gtx');
        url.searchParams.set('sl', 'auto');
        url.searchParams.set('tl', targetLanguage);
        url.searchParams.set('dt', 't');

        const body = new URLSearchParams();
        body.set('q', text);

        const response = await utils.fetchWithTimeout(
            url.toString(),
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
                },
                redirect: 'follow',
                body: body.toString()
            },
            utils.TRANSLATE_API_TIMEOUT_MS,
            'Google Translate request timed out'
        );

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
        const translated = utils.parseGoogleTranslateResponse(data);
        if (!translated) {
            throw new Error('Google Translate returned empty translation');
        }
        return translated;
    };

    ext.background.translateGoogle = {
        isGoogleRateLimitError,
        getFriendlyTranslateError,
        translateWithGoogleChunk
    };
})();
