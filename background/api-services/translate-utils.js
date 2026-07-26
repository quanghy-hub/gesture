(() => {
    const ext = globalThis.GestureExtension;

    const parseGoogleTranslateResponse = (data) => data?.[0]?.map((item) => item?.[0] ?? '').join('').trim() ?? '';
    const parseMyMemoryResponse = (data) => String(data?.responseData?.translatedText || '').trim();

    const GOOGLE_TRANSLATE_CHUNK_LIMIT = 1400;
    const TRANSLATE_API_TIMEOUT_MS = 30000;

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

    ext.background = ext.background || {};
    ext.background.translateUtils = {
        parseGoogleTranslateResponse,
        parseMyMemoryResponse,
        detectTargetLanguage,
        detectSourceLanguage,
        normalizeTranslateText,
        splitTranslateText,
        fetchWithTimeout,
        GOOGLE_TRANSLATE_CHUNK_LIMIT,
        TRANSLATE_API_TIMEOUT_MS
    };
})();
