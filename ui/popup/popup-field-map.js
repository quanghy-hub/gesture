(() => {
    const ext = globalThis.GestureExtension;

    /**
     * Each entry: { elementId, configPath, type: 'checkbox'|'number'|'text'|'select'|'color', fallback }
     * configPath is a dot-separated string read from the config object.
     * Only simple 1:1 mappings belong here. Complex logic (gesture settings,
     * forum host config, API provider keys, host-scoped toggles) stays in popup.js.
     */
    const FIELD_MAP = [
        // Feature toggles
        { elementId: 'feature-offline-translate-enabled', configPath: 'offlineTranslation.enabled', type: 'checkbox', fallback: false },
        { elementId: 'feature-unblock-copy-enabled', configPath: 'unblockCopy.enabled', type: 'checkbox', fallback: true },
        { elementId: 'feature-video-floating-enabled', configPath: 'videoFloating.enabled', type: 'checkbox', fallback: true },
        { elementId: 'feature-video-screenshot-enabled', configPath: 'videoScreenshot.enabled', type: 'checkbox', fallback: true },
        { elementId: 'feature-quick-search-enabled', configPath: 'quickSearch.enabled', type: 'checkbox', fallback: true },
        { elementId: 'feature-inline-translate-enabled', configPath: 'inlineTranslate.enabled', type: 'checkbox', fallback: true },
        { elementId: 'feature-youtube-subtitles-enabled', configPath: 'youtubeSubtitles.enabled', type: 'checkbox', fallback: false },
        { elementId: 'feature-youtube-subtitles-tts', configPath: 'youtubeSubtitles.ttsEnabled', type: 'checkbox', fallback: false },
        { elementId: 'youtube-subtitles-tts-voice', configPath: 'youtubeSubtitles.ttsVoiceName', type: 'select', fallback: '' },
        { elementId: 'youtube-subtitles-tts-rate', configPath: 'youtubeSubtitles.ttsRate', type: 'select', fallback: '1' },
        { elementId: 'youtube-subtitles-tts-engine', configPath: 'youtubeSubtitles.ttsEngine', type: 'select', fallback: 'os' },

        // Inline translate settings
        { elementId: 'inline-translate-hotkey-enabled', configPath: 'inlineTranslate.hotkeyEnabled', type: 'checkbox', fallback: true },
        { elementId: 'inline-translate-hotkey', configPath: 'inlineTranslate.hotkey', type: 'select', fallback: 'ctrl+d' },
        {
            elementId: 'inline-translate-selection-translate-enabled',
            configPath: 'inlineTranslate.selectionTranslateEnabled',
            type: 'checkbox',
            fallback: true
        },
        { elementId: 'inline-translate-swipe-enabled', configPath: 'inlineTranslate.swipeEnabled', type: 'checkbox', fallback: true },
        { elementId: 'inline-translate-swipe-dir', configPath: 'inlineTranslate.swipeDir', type: 'select', fallback: 'both' },
        { elementId: 'inline-translate-swipe-px', configPath: 'inlineTranslate.swipePx', type: 'number', fallback: 60 },
        {
            elementId: 'inline-translate-swipe-max-duration-ms',
            configPath: 'inlineTranslate.swipeMaxDurationMs',
            type: 'number',
            fallback: 500
        },
        { elementId: 'inline-translate-font-scale', configPath: 'inlineTranslate.fontScale', type: 'number', fallback: 0.95 },
        { elementId: 'inline-translate-muted-color', configPath: 'inlineTranslate.mutedColor', type: 'color', fallback: '#00bfff' },

        // YouTube subtitles
        { elementId: 'youtube-subtitles-target-lang', configPath: 'youtubeSubtitles.targetLang', type: 'text', fallback: 'vi' },
        { elementId: 'youtube-subtitles-font-size', configPath: 'youtubeSubtitles.fontSize', type: 'number', fallback: 16 },
        {
            elementId: 'youtube-subtitles-translated-font-size',
            configPath: 'youtubeSubtitles.translatedFontSize',
            type: 'number',
            fallback: 16
        },
        { elementId: 'youtube-subtitles-show-original', configPath: 'youtubeSubtitles.showOriginal', type: 'checkbox', fallback: true },
        { elementId: 'youtube-subtitles-original-color', configPath: 'youtubeSubtitles.originalColor', type: 'color', fallback: '#ffffff' },
        {
            elementId: 'youtube-subtitles-translated-color',
            configPath: 'youtubeSubtitles.translatedColor',
            type: 'color',
            fallback: '#0e8cef'
        },

        // API services — simple selects/checkboxes (not the dynamic apiKey fields)
        { elementId: 'api-translate-provider', configPath: 'apiServices.translate.activeProvider', type: 'select', fallback: 'google' },
        {
            elementId: 'api-translate-fallback-enabled',
            configPath: 'apiServices.translate.fallbackEnabled',
            type: 'checkbox',
            fallback: false
        },
        {
            elementId: 'api-translate-fallback-provider',
            configPath: 'apiServices.translate.fallbackProvider',
            type: 'select',
            fallback: 'mymemory'
        },
        { elementId: 'api-ocr-provider', configPath: 'apiServices.ocr.activeProvider', type: 'select', fallback: 'ocrspace' },
        { elementId: 'api-ocr-fallback-enabled', configPath: 'apiServices.ocr.fallbackEnabled', type: 'checkbox', fallback: false },
        {
            elementId: 'api-ocr-fallback-provider',
            configPath: 'apiServices.ocr.fallbackProvider',
            type: 'select',
            fallback: 'ocrspace-alt'
        },

        // Quick search
        { elementId: 'quick-search-columns', configPath: 'quickSearch.columns', type: 'number', fallback: 5 },
        { elementId: 'quick-search-image-search-enabled', configPath: 'quickSearch.imageSearchEnabled', type: 'checkbox', fallback: true },

        // Video floating
        { elementId: 'video-floating-min-distance', configPath: 'videoFloating.minSwipeDistance', type: 'number', fallback: 30 },
        { elementId: 'video-floating-swipe-short', configPath: 'videoFloating.swipeShort', type: 'number', fallback: 0.15 },
        { elementId: 'video-floating-swipe-long', configPath: 'videoFloating.swipeLong', type: 'number', fallback: 0.3 },
        { elementId: 'video-floating-short-threshold', configPath: 'videoFloating.shortThreshold', type: 'number', fallback: 200 },
        { elementId: 'video-floating-vertical-tolerance', configPath: 'videoFloating.verticalTolerance', type: 'number', fallback: 80 },
        { elementId: 'video-floating-diagonal-threshold', configPath: 'videoFloating.diagonalThreshold', type: 'number', fallback: 1.5 },
        { elementId: 'video-floating-throttle', configPath: 'videoFloating.throttle', type: 'number', fallback: 15 },
        { elementId: 'video-floating-notice-font-size', configPath: 'videoFloating.noticeFontSize', type: 'number', fallback: 14 }
    ];

    /**
     * Resolve a dot-separated path to a value from a nested object.
     * Returns fallback when any segment is missing.
     */
    const resolveConfigPath = (config, path, fallback) => {
        const segments = path.split('.');
        let current = config;
        for (const segment of segments) {
            if (current == null || typeof current !== 'object') return fallback;
            current = current[segment];
        }
        return current;
    };

    /**
     * Determine the resolved value considering the original render() semantics:
     * - checkbox fields that default true use `!== false`
     * - checkbox fields that default false use `!!value`
     * - number/text/select/color use `value || fallback` or `value ?? fallback`
     */
    const resolveFieldValue = (raw, field) => {
        if (field.type === 'checkbox') {
            return field.fallback ? raw !== false : !!raw;
        }
        if (field.configPath === 'videoFloating.throttle') {
            return raw ?? field.fallback;
        }
        return raw || field.fallback;
    };

    /**
     * Read config paths and set element values.
     * @param {typeof FIELD_MAP} fieldMap
     * @param {Record<string, HTMLElement>} elements — keyed by elementId
     * @param {object} config
     */
    const renderFields = (fieldMap, elements, config) => {
        for (const field of fieldMap) {
            const el = elements[field.elementId];
            if (!el) continue;
            const raw = resolveConfigPath(config, field.configPath, field.fallback);
            const value = resolveFieldValue(raw, field);
            if (field.type === 'checkbox') {
                el.checked = value;
            } else {
                el.value = value;
            }
        }
    };

    /**
     * Read element values and return a flat object of config patches.
     * Keys are the configPath strings, values are the element values (typed).
     * The caller is responsible for applying these patches to the config tree.
     * @param {typeof FIELD_MAP} fieldMap
     * @param {Record<string, HTMLElement>} elements
     * @returns {Record<string, any>}
     */
    const collectFields = (fieldMap, elements) => {
        const patches = {};
        for (const field of fieldMap) {
            const el = elements[field.elementId];
            if (!el) continue;
            if (field.type === 'checkbox') {
                patches[field.configPath] = el.checked;
            } else if (field.type === 'number') {
                patches[field.configPath] = Number(el.value);
            } else {
                patches[field.configPath] = el.value;
            }
        }
        return patches;
    };

    /**
     * Apply a flat patches object (dot-separated keys → values) to a nested config.
     * Mutates and returns the config.
     */
    const applyPatches = (config, patches) => {
        for (const [path, value] of Object.entries(patches)) {
            const segments = path.split('.');
            let current = config;
            for (let i = 0; i < segments.length - 1; i++) {
                if (current[segments[i]] == null || typeof current[segments[i]] !== 'object') {
                    current[segments[i]] = {};
                }
                current = current[segments[i]];
            }
            current[segments[segments.length - 1]] = value;
        }
        return config;
    };

    ext.ui = ext.ui || {};
    ext.ui.popupFieldMap = { FIELD_MAP, renderFields, collectFields, applyPatches };
})();
