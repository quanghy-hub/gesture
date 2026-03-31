importScripts('../shared/namespace.js', '../shared/api-services.js', '../shared/config.js', 'api-service-registry.js');

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

                const targetLanguage = message.payload?.targetLanguage ?? GestureExtension.background.apiServiceRegistry.detectTargetLanguage(text);

                const result = await GestureExtension.background.apiServiceRegistry.executeTranslate({
                    text,
                    targetLanguage,
                    provider: message.payload?.provider || ''
                });

                sendResponse({
                    ok: true,
                    result: {
                        provider: result.provider,
                        text,
                        translatedText: result.translatedText,
                        sourceLanguage: result.sourceLanguage || message.payload?.sourceLanguage || 'auto',
                        targetLanguage,
                        fallbackReason: result.fallbackReason || ''
                    }
                });
                return;
            }

            case 'gesture-ext/download-data-url': {
                const url = String(message.payload?.url ?? '').trim();
                const filename = String(message.payload?.filename ?? '').trim();
                if (!url) {
                    sendResponse({ ok: false, error: 'Missing url for download' });
                    return;
                }

                const downloadId = await chrome.downloads.download({
                    url,
                    filename: filename || undefined,
                    saveAs: false
                });
                sendResponse({ ok: true, downloadId });
                return;
            }

            case 'gesture-ext/perform-ocr': {
                const imageUrl = message.payload?.imageUrl;
                if (!imageUrl) {
                    sendResponse({ ok: false, error: 'Missing imageUrl' });
                    return;
                }

                const result = await GestureExtension.background.apiServiceRegistry.executeOcr({ imageUrl });
                sendResponse({ ok: true, text: result.text, provider: result.provider });
                return;
            }

            default:
                sendResponse({ ok: false, error: `Unsupported message type: ${message.type}` });
        }
    })().catch((error) => {
        sendResponse({ ok: false, error: error?.message || String(error) });
    });

    return true;
});
