(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = ext.quickSearch = ext.quickSearch || {};

    quickSearch.IS_ANDROID = /Android/i.test(navigator.userAgent || '');

    quickSearch.CONFIG = Object.freeze({
        maxProviders: 10,
        textBubbleOffsetY: 36,
        imageBubbleOffsetY: 8,
        hoverDelay: 120,
        hideDelay: 220,
        minImageSidePx: 72,
        minImageAreaPx: 9000,
        minNaturalImageSidePx: 96,
        suppressSelectionMs: 900,
        selectionCleanupDelayMs: 32,
        selectionCleanupRetryMs: 180
    });

    quickSearch.DEFAULT_SETTINGS = Object.freeze({
        providers: [
            { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={{q}}', icon: 'https://www.google.com/favicon.ico' },
            { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q={{q}}', icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32' },
            { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?q={{q}}', icon: 'https://www.google.com/s2/favicons?domain=chatgpt.com&sz=32' },
            { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com/app?q={{q}}', icon: 'https://www.google.com/s2/favicons?domain=gemini.google.com&sz=32' },
            { id: 'claude', name: 'Claude', url: 'https://claude.ai/new?q={{q}}', icon: 'https://www.google.com/s2/favicons?domain=claude.ai&sz=32' },
            { id: 'copilot', name: 'Copilot', url: 'https://copilot.microsoft.com/?q={{q}}', icon: 'https://www.google.com/s2/favicons?domain=copilot.microsoft.com&sz=32' },
            { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={{q}}', icon: 'https://www.bing.com/favicon.ico' },
            { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={{q}}', icon: 'https://duckduckgo.com/favicon.ico' },
            { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query={{q}}', icon: 'https://www.youtube.com/favicon.ico' },
            { id: 'google-images', name: 'Ảnh Google', url: 'https://www.google.com/search?tbm=isch&q={{q}}', icon: 'https://www.google.com/favicon.ico' }
        ],
        imageProviders: [
            { id: 'google-lens', name: 'Google Lens', url: 'https://lens.google.com/uploadbyurl?url={{img}}', icon: 'https://www.google.com/favicon.ico' },
            { id: 'bing-visual', name: 'Bing Visual', url: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIDP&q=imgurl:{{img}}', icon: 'https://www.bing.com/favicon.ico' },
            { id: 'yandex-images', name: 'Yandex Images', url: 'https://yandex.com/images/search?rpt=imageview&url={{img}}', icon: 'https://yandex.com/favicon.ico' }
        ]
    });

    quickSearch.QUICK_GLYPHS = Object.freeze({
        copy: '⧉',
        selectAll: '⊞',
        translate: '文',
        saveImage: '↓',
        ocr: 'T',
        copyUrl: '⧉'
    });

    quickSearch.encodeQuery = (value) => encodeURIComponent(String(value || '').trim().replace(/\s+/g, ' '));
    quickSearch.buildProviderUrl = (template, { text, imageUrl }) => String(template || '')
        .replaceAll('{{q}}', quickSearch.encodeQuery(text || ''))
        .replaceAll('{{img}}', encodeURIComponent(imageUrl || ''));
})();
