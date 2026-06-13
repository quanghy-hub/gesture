importScripts(
    chrome.runtime.getURL('shared/namespace.js'),
    chrome.runtime.getURL('shared/api-services.js'),
    chrome.runtime.getURL('shared/config-utils.js'),
    chrome.runtime.getURL('shared/config-schema.js'),
    chrome.runtime.getURL('shared/config-normalize.js'),
    chrome.runtime.getURL('shared/config.js'),
    chrome.runtime.getURL('shared/storage.js'),
    chrome.runtime.getURL('shared/cloudflare-sync.js'),
    chrome.runtime.getURL('background/api-services/translate-api.js'),
    chrome.runtime.getURL('background/api-services/ocr-api.js'),
    chrome.runtime.getURL('background/api-service-registry.js'),
    chrome.runtime.getURL('background/message-handlers.js')
);

const { STORAGE_KEY, normalizeConfig, getExcludedMatchPatterns } = GestureExtension.shared.config;

const CONTENT_SCRIPT_DEFINITIONS = [
    {
        id: 'gesture-content-isolated',
        matches: ['<all_urls>'],
        allFrames: true,
        css: [
            'content/video-floating/styles.css',
            'content/google-search/styles.css',
            'content/clipboard/styles.css'
        ],
        js: [
            'shared/namespace.js',
            'shared/messaging.js',
            'shared/api-services.js',
            'shared/config-utils.js',
            'shared/config-schema.js',
            'shared/config-normalize.js',
            'shared/config.js',
            'shared/storage.js',
            'shared/runtime.js',
            'shared/tab-actions-client.js',
            'shared/extension-ui-guard.js',
            'shared/viewport-core.js',
            'shared/floating-core.js',
            'shared/touch-core.js',
            'shared/toast-core.js',
            'shared/selection-core.js',
            'shared/dom-utils.js',
            'shared/ocr-core.js',
            'content/unblock-copy/index.js',
            'content/forum/styles.js',
            'content/forum/layout.js',
            'content/forum/cache.js',
            'content/forum/early-style.js',
            'content/forum/controller.js',
            'content/forum/index.js',
            'content/gestures/gesture-utils.js',
            'content/gestures/desktop.js',
            'content/gestures/mobile.js',
            'content/gestures/index.js',
            'content/clipboard/constants.js',
            'content/clipboard/panel-data.js',
            'content/clipboard/actions.js',
            'content/clipboard/ui.js',
            'content/clipboard/controller.js',
            'content/clipboard/index.js',
            'content/google-search/index.js',
            'content/quick-search/constants.js',
            'content/quick-search/ui.js',
            'content/quick-search/text-session.js',
            'content/quick-search/image-session.js',
            'content/quick-search/actions.js',
            'content/quick-search/event-manager.js',
            'content/quick-search/controller.js',
            'content/quick-search/index.js',
            'shared/translate-core.js',
            'content/inline-translate/constants.js',
            'content/inline-translate/text-block-detector.js',
            'content/inline-translate/editable-selection-panel.js',
            'content/inline-translate/dom.js',
            'content/inline-translate/actions.js',
            'content/inline-translate/controller.js',
            'content/inline-translate/index.js',
            'content/video-screenshot/constants.js',
            'content/video-screenshot/ui.js',
            'content/video-screenshot/controller.js',
            'content/video-screenshot/index.js',
            'content/video-floating/constants.js',
            'content/video-floating/helpers.js',
            'content/video-floating/iframe-mode.js',
            'content/video-floating/video-presentation-helper.js',
            'content/video-floating/floating-session.js',
            'content/video-floating/seek-controller.js',
            'content/video-floating/ui-controls.js',
            'content/video-floating/top-frame.js',
            'content/video-floating/index.js',
            'content/youtube-subtitles/constants.js',
            'content/youtube-subtitles/dom.js',
            'content/youtube-subtitles/caption-source.js',
            'content/youtube-subtitles/translator.js',
            'content/youtube-subtitles/controller.js',
            'content/youtube-subtitles/index.js',
            'content/bootstrap.js'
        ],
        runAt: 'document_start'
    },
    {
        id: 'gesture-content-main',
        matches: ['<all_urls>'],
        allFrames: true,
        js: ['content/video-floating/page-api.js'],
        runAt: 'document_start',
        world: 'MAIN'
    }
];
const CONTENT_SCRIPT_IDS = CONTENT_SCRIPT_DEFINITIONS.map((definition) => definition.id);
const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunks = [];
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        chunks.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize)));
    }
    return btoa(chunks.join(''));
};
const getRuntimeErrorMessage = () => chrome.runtime?.lastError?.message || '';
const isTransientSyncError = (error) => {
    const message = String(error?.message || error || '').trim();
    if (!message) {
        return false;
    }
    return /^(No SW)$/i.test(message)
        || /Extension context invalidated/i.test(message)
        || /Service worker context closed/i.test(message);
};
const normalizeSetArray = (value) => [...new Set(Array.isArray(value) ? value : [])].sort();
const normalizeOrderedArray = (value) => Array.isArray(value) ? [...value] : [];
const areSameRegistrations = (left, right) => {
    return JSON.stringify(left.map((definition) => ({
        id: definition.id,
        matches: normalizeSetArray(definition.matches),
        excludeMatches: normalizeSetArray(definition.excludeMatches),
        js: normalizeOrderedArray(definition.js),
        css: normalizeOrderedArray(definition.css),
        allFrames: !!definition.allFrames,
        runAt: definition.runAt || '',
        world: definition.world || ''
    })).sort((a, b) => a.id.localeCompare(b.id))) === JSON.stringify(right.map((definition) => ({
        id: definition.id,
        matches: normalizeSetArray(definition.matches),
        excludeMatches: normalizeSetArray(definition.excludeMatches),
        js: normalizeOrderedArray(definition.js),
        css: normalizeOrderedArray(definition.css),
        allFrames: !!definition.allFrames,
        runAt: definition.runAt || '',
        world: definition.world || ''
    })).sort((a, b) => a.id.localeCompare(b.id)));
};

const getStoredConfig = () => GestureExtension.shared.storage.getConfig();

const syncRegisteredContentScripts = async () => {
    if (!chrome.scripting?.registerContentScripts) {
        return;
    }
    const config = await getStoredConfig();
    const excludeMatches = getExcludedMatchPatterns(config.runtime?.excludedHosts);
    const nextScripts = CONTENT_SCRIPT_DEFINITIONS.map((definition) => ({
        ...definition,
        excludeMatches
    }));
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: CONTENT_SCRIPT_IDS });
    if (areSameRegistrations(existing, nextScripts)) {
        return;
    }
    if (existing.length) {
        await chrome.scripting.unregisterContentScripts({ ids: CONTENT_SCRIPT_IDS });
    }
    await chrome.scripting.registerContentScripts(nextScripts);
};

let syncQueue = Promise.resolve();
const queueContentScriptSync = () => {
    syncQueue = syncQueue
        .catch(() => { })
        .then(() => syncRegisteredContentScripts())
        .catch((error) => {
            if (isTransientSyncError(error)) {
                return;
            }
            console.error('[GestureExtension] Failed to sync content scripts', error);
        });
    return syncQueue;
};

chrome.runtime.onInstalled.addListener(() => {
    queueContentScriptSync();
});

chrome.runtime.onStartup.addListener(() => {
    queueContentScriptSync();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[STORAGE_KEY]) {
        return;
    }
    queueContentScriptSync();
    GestureExtension.shared.cloudflareSync.consumeSkipNextConfigChange()
        .then((shouldSkip) => {
            if (shouldSkip) return;
            return GestureExtension.shared.cloudflareSync.scheduleAutoSync(getStoredConfig);
        })
        .catch((error) => {
            console.error('[GestureExtension] Failed to schedule Cloudflare sync', error);
        });
});

queueContentScriptSync();

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
            case 'gesture-ext/open-new-tab':
                sendResponse(await handlers.handleOpenNewTab(sender));
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
            default:
                sendResponse({ ok: false, error: `Unsupported message type: ${message.type}` });
        }
    })().catch((error) => {
        sendResponse({ ok: false, error: error?.message || String(error) });
    });

    return true;
});
