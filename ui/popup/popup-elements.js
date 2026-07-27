(() => {
    const ext = globalThis.GestureExtension;
    const { safeGetElementById } = ext.ui.popupUtils;

    ext.ui.popupElements = {
        hostLabel: safeGetElementById('current-host'),
        closeButton: safeGetElementById('close-popup'),
        hostBlacklistLabel: safeGetElementById('host-blacklist-label'),
        hostBlacklistToggle: safeGetElementById('host-blacklist-toggle'),
        featureUnblockCopyEnabled: safeGetElementById('feature-unblock-copy-enabled'),
        featureGesturesEnabled: safeGetElementById('feature-gestures-enabled'),
        featureClipboardEnabled: safeGetElementById('feature-clipboard-enabled'),
        featureVideoFloatingEnabled: safeGetElementById('feature-video-floating-enabled'),
        featureVideoScreenshotEnabled: safeGetElementById('feature-video-screenshot-enabled'),
        featureQuickSearchEnabled: safeGetElementById('feature-quick-search-enabled'),
        featureInlineTranslateEnabled: safeGetElementById('feature-inline-translate-enabled'),
        featureYoutubeSubtitlesEnabled: safeGetElementById('feature-youtube-subtitles-enabled'),
        featureForumEnabled: safeGetElementById('feature-forum-enabled'),
        forumScopeLabel: safeGetElementById('forum-scope'),
        apiTranslateProvider: safeGetElementById('api-translate-provider'),
        apiTranslateFallbackProvider: safeGetElementById('api-translate-fallback-provider'),
        apiTranslateApiKey: safeGetElementById('api-translate-api-key'),
        apiTranslateFallbackApiKey: safeGetElementById('api-translate-fallback-api-key'),
        apiOcrProvider: safeGetElementById('api-ocr-provider'),
        apiOcrFallbackProvider: safeGetElementById('api-ocr-fallback-provider'),
        apiOcrApiKey: safeGetElementById('api-ocr-api-key'),
        apiOcrFallbackApiKey: safeGetElementById('api-ocr-fallback-api-key'),
        videoFloatingBackgroundSeekHost: safeGetElementById('video-floating-background-seek-host'),
        videoFloatingBackgroundSeekBlocked: safeGetElementById('video-floating-background-seek-blocked'),
        forumWide: safeGetElementById('forum-wide'),
        forumMinWidth: safeGetElementById('forum-min-width'),
        forumGap: safeGetElementById('forum-gap'),
        forumFade: safeGetElementById('forum-fade'),
        forumDelay: safeGetElementById('forum-delay'),
        gLpEnabled: safeGetElementById('g-lp-enabled'),
        gLpMode: safeGetElementById('g-lp-mode'),
        gLpMs: safeGetElementById('g-lp-ms'),
        gRcEnabled: safeGetElementById('g-rc-enabled'),
        gRcMode: safeGetElementById('g-rc-mode'),
        gCloseTabEnabled: safeGetElementById('g-close-tab-enabled'),
        gCloseTabMs: safeGetElementById('g-close-tab-ms'),
        gPagerEnabled: safeGetElementById('g-pager-enabled'),
        gPagerHops: safeGetElementById('g-pager-hops'),
        gEdgeEnabled: safeGetElementById('g-edge-enabled'),
        gEdgeSide: safeGetElementById('g-edge-side'),
        gEdgeWidth: safeGetElementById('g-edge-width'),
        gEdgeSpeed: safeGetElementById('g-edge-speed'),
        clipboardClear: safeGetElementById('clipboard-clear'),
        gestureBlockHostToggle: safeGetElementById('gesture-block-host-toggle'),
        gestureBlockHostLabel: safeGetElementById('gesture-block-host-label'),
        hostOnlyRows: Array.from(document.querySelectorAll('.host-only')),
        popupRoot: document.querySelector('.popup'),
        panelCards: Array.from(document.querySelectorAll('.card[data-panel-id]')),
        panelHeaderTriggers: Array.from(document.querySelectorAll('[data-panel-header]')),
        dragHandles: Array.from(document.querySelectorAll('[data-drag-handle]'))
    };

    ext.ui.popupElements.hostBoundControls = [
        ext.ui.popupElements.forumWide,
        ext.ui.popupElements.forumMinWidth,
        ext.ui.popupElements.forumGap,
        ext.ui.popupElements.forumFade,
        ext.ui.popupElements.forumDelay
    ];

    ext.ui.popupElements.unblockCopyCard = ext.ui.popupElements.featureUnblockCopyEnabled.closest('.card');
    ext.ui.popupElements.gesturesCard = ext.ui.popupElements.featureGesturesEnabled.closest('.card');
    ext.ui.popupElements.clipboardCard = ext.ui.popupElements.featureClipboardEnabled.closest('.card');
    ext.ui.popupElements.videoFloatingCard = ext.ui.popupElements.featureVideoFloatingEnabled.closest('.card');
    ext.ui.popupElements.videoScreenshotCard = ext.ui.popupElements.featureVideoScreenshotEnabled.closest('.card');
    ext.ui.popupElements.quickSearchCard = ext.ui.popupElements.featureQuickSearchEnabled.closest('.card');
    ext.ui.popupElements.inlineTranslateCard = ext.ui.popupElements.featureInlineTranslateEnabled.closest('.card');
    ext.ui.popupElements.youtubeSubtitlesCard = ext.ui.popupElements.featureYoutubeSubtitlesEnabled.closest('.card');
    ext.ui.popupElements.forumCard = ext.ui.popupElements.featureForumEnabled.closest('.card');

    ext.ui.popupElements.quickSearchProviderIds = [
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
    ];
    ext.ui.popupElements.quickSearchProviderInputs = Object.fromEntries(
        ext.ui.popupElements.quickSearchProviderIds.map((providerId) => [
            providerId,
            safeGetElementById(`quick-search-provider-${providerId}`)
        ])
    );
})();
