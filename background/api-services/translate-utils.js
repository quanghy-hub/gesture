(() => {
    const ext = globalThis.GestureExtension;

    const parseGoogleTranslateResponse = (data) =>
        data?.[0]
            ?.map((item) => item?.[0] ?? '')
            .join('')
            .trim() ?? '';
    const parseMyMemoryResponse = (data) => String(data?.responseData?.translatedText || '').trim();

    const GOOGLE_TRANSLATE_CHUNK_LIMIT = 2000;
    // MyMemory (API miễn phí) chặn q > 500 BYTES phía server — chia theo byte
    // (không phải ký tự) để text tiếng Việt có dấu không bị từ chối.
    const MYMEMORY_CHUNK_LIMIT_BYTES = 450;
    const TRANSLATE_API_TIMEOUT_MS = 30000;

    const utf8ByteLength = (str) => new TextEncoder().encode(str).length;

    /**
     * Chia text thành các chunk có dung lượng UTF-8 ≤ maxBytes, ưu tiên cắt
     * tại khoảng trắng; chỉ hard-slice khi một từ dài bất thường.
     */
    const splitTranslateTextByBytes = (text, maxBytes) => {
        const normalized = normalizeTranslateText(text);
        if (!normalized) {
            return [];
        }
        if (utf8ByteLength(normalized) <= maxBytes) {
            return [normalized];
        }
        const words = normalized.split(/\s+/);
        const chunks = [];
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (utf8ByteLength(candidate) > maxBytes && current) {
                chunks.push(current);
                current = word;
            } else {
                current = candidate;
            }
            // Một từ đơn vượt giới hạn (hiếm): hard-slice theo code point
            while (utf8ByteLength(current) > maxBytes) {
                let cut = current.length - 1;
                while (cut > 0 && utf8ByteLength(current.slice(0, cut)) > maxBytes) {
                    cut -= 1;
                }
                chunks.push(current.slice(0, cut));
                current = current.slice(cut);
            }
        }
        if (current.trim()) {
            chunks.push(current);
        }
        return chunks.length ? chunks : [normalized];
    };

    const detectTargetLanguage = (text) =>
        /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text) ? 'en' : 'vi';

    const detectSourceLanguage = (text, targetLanguage = '') => {
        const normalizedTarget = String(targetLanguage || '')
            .trim()
            .toLowerCase();
        if (normalizedTarget === 'vi') {
            return 'en';
        }
        if (normalizedTarget === 'en') {
            return 'vi';
        }
        return /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text) ? 'vi' : 'en';
    };

    const normalizeTranslateText = (text) =>
        String(text || '')
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

        const segments = normalized
            .split(/\n{2,}/)
            .map((part) => part.trim())
            .filter(Boolean);
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
                throw new Error(timeoutMessage, { cause: error });
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
        splitTranslateTextByBytes,
        utf8ByteLength,
        MYMEMORY_CHUNK_LIMIT_BYTES,
        fetchWithTimeout,
        GOOGLE_TRANSLATE_CHUNK_LIMIT,
        TRANSLATE_API_TIMEOUT_MS
    };
})();
