importScripts(
    chrome.runtime.getURL('shared/namespace.js'),
    chrome.runtime.getURL('shared/api-services.js'),
    chrome.runtime.getURL('shared/config.js'),
    chrome.runtime.getURL('background/api-service-registry.js')
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
            'shared/api-services.js',
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
            'content/forum/styles.js',
            'content/forum/layout.js',
            'content/forum/cache.js',
            'content/forum/early-style.js',
            'content/forum/controller.js',
            'content/forum/index.js',
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
            'content/quick-search/controller.js',
            'content/quick-search/index.js',
            'shared/translate-core.js',
            'content/inline-translate/constants.js',
            'content/inline-translate/dom.js',
            'content/inline-translate/actions.js',
            'content/inline-translate/controller.js',
            'content/inline-translate/index.js',
            'content/video-screenshot/index.js',
            'content/video-floating/constants.js',
            'content/video-floating/helpers.js',
            'content/video-floating/iframe-mode.js',
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

const getStoredConfig = () => new Promise((resolve, reject) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
        const runtimeError = getRuntimeErrorMessage();
        if (runtimeError) {
            reject(new Error(runtimeError));
            return;
        }
        resolve(normalizeConfig(result?.[STORAGE_KEY]));
    });
});

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
});

queueContentScriptSync();

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
