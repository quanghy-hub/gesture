// @ts-check
(() => {
    const ext = globalThis.GestureExtension;
    const apiServicesUtils = /** @type {GestureExtensionShared['apiServices']} */ (ext.shared.apiServices || {});
    /** @type {ApiServicesConfig} */
    const DEFAULT_API_SERVICES = apiServicesUtils.DEFAULT_API_SERVICES || {
        translate: {
            activeProvider: 'google',
            fallbackEnabled: true,
            fallbackProvider: 'mymemory',
            providers: {
                google: { enabled: true, apiKey: '', endpoint: '' },
                mymemory: { enabled: true, apiKey: '', endpoint: '' },
                deepl: { enabled: false, apiKey: '', endpoint: '' }
            }
        },
        ocr: {
            activeProvider: 'ocrspace',
            fallbackEnabled: false,
            fallbackProvider: 'ocrspace-alt',
            providers: {
                ocrspace: { enabled: true, apiKey: '', endpoint: '' },
                'ocrspace-alt': { enabled: false, apiKey: '', endpoint: '' }
            }
        }
    };

    const STORAGE_KEY = 'gesture_extension_config_v1';
    const DEFAULT_POPUP_PANEL_ORDER = Object.freeze([
        'host-blacklist',
        'unblock-copy',
        'gestures',
        'clipboard',
        'floating-video',
        'video-screenshot',
        'quick-search',
        'inline-translate',
        'youtube-subtitles',
        'api-services',
        'backup',
        'forum'
    ]);

    /** @type {GestureConfig} */
    const DEFAULT_CONFIG = Object.freeze({
        version: 1,
        clipboard: {
            enabled: true,
            maxHistory: 5,
            history: [],
            pinned: []
        },
        unblockCopy: {
            enabled: true
        },
        googleSearch: {
            enabled: true
        },
        videoFloating: {
            enabled: true,
            swipeLong: 0.3,
            swipeShort: 0.15,
            shortThreshold: 200,
            minSwipeDistance: 30,
            verticalTolerance: 80,
            diagonalThreshold: 1.5,
            realtimePreview: true,
            throttle: 15,
            forwardStep: 5,
            hotkeys: true,
            noticeFontSize: 14,
            backgroundSeekExcludedHosts: [],
            layout: null
        },
        videoScreenshot: {
            enabled: true
        },
        quickSearch: {
            enabled: true,
            enabledProviderIds: [
                'google',
                'perplexity',
                'chatgpt',
                'gemini',
                'claude',
                'copilot',
                'bing',
                'duckduckgo',
                'youtube',
                'google-images'
            ],
            columns: 5,
            imageSearchEnabled: true,
            selectionDelay: 300,
            imageLongPressMs: 320
        },
        inlineTranslate: {
            enabled: true,
            provider: 'google',
            selectionTranslateEnabled: true,
            hotkeyEnabled: true,
            hotkey: 'ctrl+d',
            swipeEnabled: true,
            swipeDir: 'both',
            swipePx: 60,
            swipeMaxDurationMs: 500,
            swipeSlopeMax: 0.4,
            fontScale: 0.95,
            mutedColor: '#00bfff',
            dedupeSeconds: 0.7
        },
        youtubeSubtitles: {
            targetLang: 'vi',
            fontSize: 16,
            translatedFontSize: 16,
            originalColor: '#ffffff',
            translatedColor: '#0e8cef',
            showOriginal: true,
            containerPosition: { x: '5%', y: '70px' },
            containerAlignment: 'left',
            enabled: false
        },
        apiServices: DEFAULT_API_SERVICES,
        forum: {
            defaults: {
                enabled: false,
                wide: true,
                minWidth: 1000,
                gap: 1,
                fadeTime: 150,
                initDelay: 100
            },
            hosts: {}
        },
        runtime: {
            excludedHosts: ['ajog.org'],
            popupPanelOrder: DEFAULT_POPUP_PANEL_ORDER
        },
        gestures: {
            excludedHosts: [],
            desktop: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                rclick: { enabled: true, mode: 'fg' },
                closeTab: { enabled: false, ms: 150 },
                pager: { enabled: true, hops: 3 }
            },
            mobile: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                closeTab: { enabled: false, ms: 150 },
                edge: { enabled: false, width: 40, speed: 3, side: 'both' }
            }
        }
    });

    ext.shared.configSchema = {
        STORAGE_KEY,
        DEFAULT_POPUP_PANEL_ORDER,
        DEFAULT_CONFIG
    };
})();
