(() => {
    const ext = globalThis.GestureExtension;

    const arrayBufferToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        const chunks = [];
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
        }
        return btoa(chunks.join(''));
    };

    const handleOpenTab = async (payload, sender) => {
        const url = payload?.url;
        if (!url) {
            return { ok: false, error: 'Missing url' };
        }

        const active = payload?.mode === 'fg';
        const openerTabId = sender.tab?.id;
        const index = typeof sender.tab?.index === 'number' ? sender.tab.index + 1 : undefined;

        const tab = await chrome.tabs.create({
            url,
            active,
            openerTabId,
            index
        });

        return { ok: true, tabId: tab.id };
    };

    const handleOpenNewTab = async (sender) => {
        const openerTabId = sender.tab?.id;
        const index = typeof sender.tab?.index === 'number' ? sender.tab.index + 1 : undefined;

        const tab = await chrome.tabs.create({
            active: true,
            openerTabId,
            index
        });

        return { ok: true, tabId: tab.id };
    };

    const handleCloseCurrentTab = async (sender) => {
        if (!sender.tab?.id) {
            return { ok: false, error: 'No sender tab' };
        }

        await chrome.tabs.remove(sender.tab.id);
        return { ok: true };
    };

    const handleTranslateText = async (payload) => {
        const text = String(payload?.text ?? '').trim();
        if (!text) {
            return { ok: false, error: 'Missing text for translation' };
        }

        const registry = ext.background.apiServiceRegistry;
        const targetLanguage = payload?.targetLanguage ?? registry.detectTargetLanguage(text);
        const result = await registry.executeTranslate({
            text,
            targetLanguage,
            provider: payload?.provider || ''
        });

        return {
            ok: true,
            result: {
                provider: result.provider,
                text,
                translatedText: result.translatedText,
                sourceLanguage: result.sourceLanguage || payload?.sourceLanguage || 'auto',
                targetLanguage,
                fallbackReason: result.fallbackReason || ''
            }
        };
    };

    const handleDownloadDataUrl = async (payload) => {
        const url = String(payload?.url ?? '').trim();
        const filename = String(payload?.filename ?? '').trim();
        if (!url) {
            return { ok: false, error: 'Missing url for download' };
        }

        const downloadId = await chrome.downloads.download({
            url,
            filename: filename || undefined,
            saveAs: false
        });
        return { ok: true, downloadId };
    };

    const handleFetchImageDataUrl = async (payload) => {
        const url = String(payload?.url ?? '').trim();
        if (!url) {
            return { ok: false, error: 'Missing image url' };
        }

        const response = await fetch(url, { credentials: 'include', cache: 'force-cache' });
        if (!response.ok) {
            return { ok: false, error: `Image request failed: ${response.status}` };
        }

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
            return { ok: false, error: 'Response is not an image' };
        }

        const dataUrl = `data:${blob.type};base64,${arrayBufferToBase64(await blob.arrayBuffer())}`;
        return { ok: true, dataUrl };
    };

    const handleCaptureVisibleTab = async (sender) => {
        const windowId = sender.tab?.windowId;
        if (typeof windowId !== 'number') {
            return { ok: false, error: 'No sender window' };
        }

        const url = await chrome.tabs.captureVisibleTab(windowId, { format: 'png' });
        return { ok: true, url };
    };

    const handlePerformOcr = async (payload) => {
        const imageUrl = payload?.imageUrl;
        if (!imageUrl) {
            return { ok: false, error: 'Missing imageUrl' };
        }

        const result = await ext.background.apiServiceRegistry.executeOcr({ imageUrl });
        return { ok: true, text: result.text, provider: result.provider };
    };

    ext.background = ext.background || {};
    ext.background.messageHandlers = {
        handleOpenTab,
        handleOpenNewTab,
        handleCloseCurrentTab,
        handleTranslateText,
        handleDownloadDataUrl,
        handleFetchImageDataUrl,
        handleCaptureVisibleTab,
        handlePerformOcr
    };
})();
