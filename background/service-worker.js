const detectTargetLanguage = (text) => /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]/i.test(text)
    ? 'en'
    : 'vi';

const parseGoogleTranslateResponse = (data) => data?.[0]?.map((item) => item?.[0] ?? '').join('').trim() ?? '';

const translateWithGoogle = async (text, targetLanguage) => {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', targetLanguage);
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);

    const response = await fetch(url.toString());
    if (!response.ok) {
        throw new Error(`Google Translate HTTP ${response.status}`);
    }

    const data = await response.json();
    return parseGoogleTranslateResponse(data);
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
