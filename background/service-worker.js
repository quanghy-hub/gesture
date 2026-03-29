const detectTargetLanguage = (text) => /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text)
    ? 'en'
    : 'vi';

const parseGoogleTranslateResponse = (data) => data?.[0]?.map((item) => item?.[0] ?? '').join('').trim() ?? '';

const GOOGLE_TRANSLATE_CHUNK_LIMIT = 1400;

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

const translateWithGoogleChunk = async (text, targetLanguage) => {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
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
        body: body.toString()
    });
    if (!response.ok) {
        throw new Error(`Google Translate HTTP ${response.status}`);
    }

    const data = await response.json();
    return parseGoogleTranslateResponse(data);
};

const translateWithGoogle = async (text, targetLanguage) => {
    const chunks = splitTranslateText(text);
    if (!chunks.length) {
        return '';
    }

    const translated = [];
    for (const chunk of chunks) {
        translated.push(await translateWithGoogleChunk(chunk, targetLanguage));
    }
    return translated.join('\n\n').trim();
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') {
        return false;
    }

    (async () => {
        switch (message.type) {
            case 'gesture-ext/open-tab': {
                const url = message.payload?.url;
                if (!url) {
                    sendResponse({ ok: false, error: 'Missing url' });
                    return;
                }

                const active = message.payload?.mode === 'fg';
                const openerTabId = sender.tab?.id;
                const index = typeof sender.tab?.index === 'number' ? sender.tab.index + 1 : undefined;

                const tab = await chrome.tabs.create({
                    url,
                    active,
                    openerTabId,
                    index
                });

                sendResponse({ ok: true, tabId: tab.id });
                return;
            }

            case 'gesture-ext/close-current-tab': {
                if (!sender.tab?.id) {
                    sendResponse({ ok: false, error: 'No sender tab' });
                    return;
                }

                await chrome.tabs.remove(sender.tab.id);
                sendResponse({ ok: true });
                return;
            }

            case 'gesture-ext/translate-text': {
                const text = String(message.payload?.text ?? '').trim();
                if (!text) {
                    sendResponse({ ok: false, error: 'Missing text for translation' });
                    return;
                }

                const provider = 'google';
                const targetLanguage = message.payload?.targetLanguage ?? detectTargetLanguage(text);
                const translatedText = await translateWithGoogle(text, targetLanguage);

                sendResponse({
                    ok: true,
                    result: {
                        provider,
                        text,
                        translatedText,
                        sourceLanguage: message.payload?.sourceLanguage ?? 'auto',
                        targetLanguage
                    }
                });
                return;
            }

            case 'gesture-ext/perform-ocr': {
                const imageUrl = message.payload?.imageUrl;
                if (!imageUrl) {
                    sendResponse({ ok: false, error: 'Missing imageUrl' });
                    return;
                }

                (async () => {
                    try {
                        const res = await fetch(imageUrl);
                        const blob = await res.blob();

                        const formData = new FormData();
                        formData.append('file', blob, 'image.jpg');
                        formData.append('language', 'auto');
                        formData.append('OCREngine', '3');
                        formData.append('apikey', 'helloworld');

                        const ocrRes = await fetch('https://api.ocr.space/parse/image', {
                            method: 'POST',
                            body: formData
                        });
                        
                        const data = await ocrRes.json();
                        if (data.IsErroredOnProcessing) {
                            throw new Error(data.ErrorMessage?.[0] || 'Lỗi OCR (E201/Máy chủ)');
                        }
                        const text = data.ParsedResults?.[0]?.ParsedText?.trim() || '';
                        sendResponse({ ok: true, text });
                    } catch (error) {
                        sendResponse({ ok: false, error: error.message });
                    }
                })();
                return true;
            }

            default:
                sendResponse({ ok: false, error: `Unsupported message type: ${message.type}` });
        }
    })().catch((error) => {
        sendResponse({ ok: false, error: error?.message || String(error) });
    });

    return true;
});
