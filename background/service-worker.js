/* global GestureExtension, importScripts */
// Chỉ nạp trực tiếp 2 file tối thiểu; danh sách còn lại nằm tập trung trong
// background/imports.js (single source of truth, được build.js kiểm tra).
importScripts('/shared/namespace.js', '/background/imports.js');
importScripts(...GestureExtension.background.SW_IMPORT_PATHS);

const { STORAGE_KEY } = GestureExtension.shared.config;
const CONTENT_SCRIPT_IDS = ['gesture-content-isolated', 'gesture-content-main'];

const getStoredConfig = () => GestureExtension.shared.storage.getConfig();

const cleanupLegacyDynamicScripts = async () => {
    if (!chrome.scripting?.getRegisteredContentScripts || !chrome.scripting?.unregisterContentScripts) {
        return;
    }
    try {
        const existing = await chrome.scripting.getRegisteredContentScripts({ ids: CONTENT_SCRIPT_IDS });
        if (existing && existing.length > 0) {
            await chrome.scripting.unregisterContentScripts({ ids: CONTENT_SCRIPT_IDS });
        }
    } catch {
        // Ignore errors in environments where dynamic registration API is not supported.
    }
};

chrome.runtime.onInstalled.addListener(() => {
    cleanupLegacyDynamicScripts();
});

chrome.runtime.onStartup.addListener(() => {
    cleanupLegacyDynamicScripts();
});

cleanupLegacyDynamicScripts();

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
    }
    GestureExtension.shared.cloudflareSync
        .consumeSkipNextConfigChange()
        .then((shouldSkip) => {
            if (shouldSkip) return;
            return GestureExtension.shared.cloudflareSync.scheduleAutoSync(getStoredConfig);
        })
        .catch((error) => {
            console.error('[GestureExtension] Failed to schedule Cloudflare sync', error);
        });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') {
        return false;
    }

    (async () => {
        const handlers = GestureExtension.background.messageHandlers;
        switch (message.type) {
            case 'gesture-ext/open-tab':
                sendResponse(await handlers.handleOpenTab(message.payload, sender));
                break;
            case 'gesture-ext/close-current-tab':
                sendResponse(await handlers.handleCloseCurrentTab(sender));
                break;
            case 'gesture-ext/translate-text':
                sendResponse(await handlers.handleTranslateText(message.payload));
                break;
            case 'gesture-ext/download-data-url':
                sendResponse(await handlers.handleDownloadDataUrl(message.payload));
                break;
            case 'gesture-ext/fetch-image-data-url':
                sendResponse(await handlers.handleFetchImageDataUrl(message.payload));
                break;
            case 'gesture-ext/capture-visible-tab':
                sendResponse(await handlers.handleCaptureVisibleTab(sender));
                break;
            case 'gesture-ext/perform-ocr':
                sendResponse(await handlers.handlePerformOcr(message.payload));
                break;
            case 'gesture-ext/offline-status':
                sendResponse(await handlers.handleOfflineStatus());
                break;
            case 'gesture-ext/offline-download':
                sendResponse(await handlers.handleOfflineDownload());
                break;
            case 'gesture-ext/offline-remove':
                sendResponse(await handlers.handleOfflineRemove());
                break;
            case 'gesture-ext/tts-status':
                sendResponse(await handlers.handleTtsStatus());
                break;
            case 'gesture-ext/tts-download':
                sendResponse(await handlers.handleTtsDownload());
                break;
            case 'gesture-ext/tts-remove':
                sendResponse(await handlers.handleTtsRemove());
                break;
            case 'gesture-ext/tts-speak':
                sendResponse(await handlers.handleTtsSpeak(message.payload, sender));
                break;
            case 'gesture-ext/tts-stop':
                sendResponse(await handlers.handleTtsStop());
                break;
            default:
                sendResponse({ ok: false, error: `Unsupported message type: ${message.type}` });
        }
    })().catch((error) => {
        sendResponse({ ok: false, error: error?.message || String(error) });
    });

    return true;
});
