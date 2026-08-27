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
        const detectedSource = payload?.sourceLanguage || ext.background.translateApi?.detectSourceLanguage?.(text, targetLanguage) || '';

        // Offline-first: model Bergamot en→vi / vi→en chạy local (nếu đã tải +
        // bật) giúp hội thoại nhanh không phụ thuộc mạng; lỗi thì lặng lẽ rơi online.
        let provider = '';
        let translatedText = '';
        let sourceLanguage = detectedSource || 'auto';
        let fallbackReason = '';
        const offlineApi = ext.background.offlineTranslation;
        if (offlineApi && targetLanguage && offlineApi.isPairSupported(detectedSource, targetLanguage) && (await offlineApi.isEnabled())) {
            const offlineText = await offlineApi.tryTranslate({
                text,
                sourceLanguage: detectedSource,
                targetLanguage
            });
            if (offlineText) {
                provider = 'bergamot-offline';
                translatedText = offlineText;
                sourceLanguage = detectedSource;
            }
        }

        if (!translatedText) {
            const result = await registry.executeTranslate({
                text,
                targetLanguage,
                provider: payload?.provider || ''
            });
            provider = result.provider;
            translatedText = result.translatedText;
            sourceLanguage = result.sourceLanguage || sourceLanguage;
            fallbackReason = result.fallbackReason || '';
        }

        return {
            ok: true,
            result: {
                provider,
                text,
                translatedText,
                sourceLanguage,
                targetLanguage,
                fallbackReason
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

        let response;
        try {
            response = await fetch(url, { credentials: 'include', cache: 'force-cache' });
        } catch {
            response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
        }
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

    const offlineApi = () => ext.background.offlineTranslation;

    const handleOfflineStatus = async () => {
        if (!offlineApi()) {
            return { ok: false, error: 'Offline module unavailable' };
        }
        const status = await offlineApi().getStatus();
        return { ok: true, status };
    };

    const handleOfflineDownload = async () => {
        if (!offlineApi()) {
            return { ok: false, error: 'Offline module unavailable' };
        }
        // Chạy nền: tiến độ cập nhật qua broadcast 'gesture-ext/offline-state'
        const outcome = offlineApi().startDownload();
        outcome.catch(() => {});
        return { ok: true, started: true };
    };

    const handleOfflineRemove = async () => {
        if (!offlineApi()) {
            return { ok: false, error: 'Offline module unavailable' };
        }
        return offlineApi().removeModel();
    };

    const ttsApi = () => ext.background.offlineTts;

    const handleTtsStatus = async () => {
        if (!ttsApi()) {
            return { ok: false, error: 'TTS module unavailable' };
        }
        return { ok: true, status: await ttsApi().getStatus() };
    };

    const handleTtsDownload = async () => {
        if (!ttsApi()) {
            return { ok: false, error: 'TTS module unavailable' };
        }
        return ttsApi().startWarmup();
    };

    const handleTtsRemove = async () => {
        if (!ttsApi()) {
            return { ok: false, error: 'TTS module unavailable' };
        }
        return ttsApi().removeVoice();
    };

    const handleTtsSpeak = async (payload) => {
        if (!ttsApi()) {
            return { ok: false, error: 'TTS module unavailable' };
        }
        return ttsApi().speakLine(payload?.text);
    };

    const handleTtsStop = async () => {
        if (!ttsApi()) {
            return { ok: false, error: 'TTS module unavailable' };
        }
        return ttsApi().stopSpeaking();
    };

    ext.background = ext.background || {};
    ext.background.messageHandlers = {
        handleOpenTab,
        handleCloseCurrentTab,
        handleTranslateText,
        handleDownloadDataUrl,
        handleFetchImageDataUrl,
        handleCaptureVisibleTab,
        handlePerformOcr,
        handleOfflineStatus,
        handleOfflineDownload,
        handleOfflineRemove,
        handleTtsStatus,
        handleTtsDownload,
        handleTtsRemove,
        handleTtsSpeak,
        handleTtsStop
    };
})();
