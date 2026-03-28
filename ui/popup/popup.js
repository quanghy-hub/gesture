(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, updateForumHostConfig, getGestureSettings, applyGestureSettings } = ext.shared.config;
    const storage = ext.shared.storage;

    const hostLabel = document.getElementById('current-host');
    const statusLabel = document.getElementById('status');
    const saveButton = document.getElementById('save-settings');
    const closeButton = document.getElementById('close-popup');
    const featureGesturesEnabled = document.getElementById('feature-gestures-enabled');
    const featureClipboardEnabled = document.getElementById('feature-clipboard-enabled');
    const featureVideoFloatingEnabled = document.getElementById('feature-video-floating-enabled');
    const featureInlineTranslateEnabled = document.getElementById('feature-inline-translate-enabled');
    const featureYoutubeSubtitlesEnabled = document.getElementById('feature-youtube-subtitles-enabled');
    const featureTrustedTypesEnabled = document.getElementById('feature-trusted-types-enabled');
    const featureForumEnabled = document.getElementById('feature-forum-enabled');
    const inlineTranslateHotkey = document.getElementById('inline-translate-hotkey');
    const inlineTranslateSwipeEnabled = document.getElementById('inline-translate-swipe-enabled');
    const inlineTranslateSwipeDir = document.getElementById('inline-translate-swipe-dir');
    const inlineTranslateFontScale = document.getElementById('inline-translate-font-scale');
    const inlineTranslateMutedColor = document.getElementById('inline-translate-muted-color');
    const youtubeSubtitlesTargetLang = document.getElementById('youtube-subtitles-target-lang');
    const youtubeSubtitlesFontSize = document.getElementById('youtube-subtitles-font-size');
    const youtubeSubtitlesTranslatedFontSize = document.getElementById('youtube-subtitles-translated-font-size');
    const youtubeSubtitlesDisplayMode = document.getElementById('youtube-subtitles-display-mode');
    const youtubeSubtitlesShowOriginal = document.getElementById('youtube-subtitles-show-original');
    const youtubeSubtitlesOriginalColor = document.getElementById('youtube-subtitles-original-color');
    const youtubeSubtitlesTranslatedColor = document.getElementById('youtube-subtitles-translated-color');
    const trustedTypesAllowDomains = document.getElementById('trusted-types-allow-domains');
    const inlineTranslateSwipePx = document.getElementById('inline-translate-swipe-px');
    const clipboardMaxHistory = document.getElementById('clipboard-max-history');
    const clipboardClear = document.getElementById('clipboard-clear');
    const videoFloatingEnabled = document.getElementById('video-floating-enabled');
    const videoFloatingMinDistance = document.getElementById('video-floating-min-distance');
    const videoFloatingSwipeShort = document.getElementById('video-floating-swipe-short');
    const videoFloatingSwipeLong = document.getElementById('video-floating-swipe-long');
    const videoFloatingShortThreshold = document.getElementById('video-floating-short-threshold');
    const videoFloatingVerticalTolerance = document.getElementById('video-floating-vertical-tolerance');
    const videoFloatingDiagonalThreshold = document.getElementById('video-floating-diagonal-threshold');
    const videoFloatingRealtimePreview = document.getElementById('video-floating-realtime-preview');
    const videoFloatingThrottle = document.getElementById('video-floating-throttle');
    const videoFloatingNoticeFontSize = document.getElementById('video-floating-notice-font-size');
    const forumWide = document.getElementById('forum-wide');
    const forumMinWidth = document.getElementById('forum-min-width');
    const forumGap = document.getElementById('forum-gap');
    const forumFade = document.getElementById('forum-fade');
    const forumDelay = document.getElementById('forum-delay');
    const gLpEnabled = document.getElementById('g-lp-enabled');
    const gLpMode = document.getElementById('g-lp-mode');
    const gLpMs = document.getElementById('g-lp-ms');
    const gRcEnabled = document.getElementById('g-rc-enabled');
    const gRcMode = document.getElementById('g-rc-mode');
    const gDblRightEnabled = document.getElementById('g-dbl-right-enabled');
    const gDblRight = document.getElementById('g-dbl-right');
    const gDblTapEnabled = document.getElementById('g-dbl-tap-enabled');
    const gDblTapMs = document.getElementById('g-dbl-tap-ms');
    const gEdgeEnabled = document.getElementById('g-edge-enabled');
    const gEdgeSide = document.getElementById('g-edge-side');
    const gEdgeWidth = document.getElementById('g-edge-width');
    const gEdgeSpeed = document.getElementById('g-edge-speed');
    const gPagerEnabled = document.getElementById('g-pager-enabled');
    const gPagerHops = document.getElementById('g-pager-hops');
    const hostOnlyRows = Array.from(document.querySelectorAll('.host-only'));
    const hostBoundControls = [forumWide, forumMinWidth, forumGap, forumFade, forumDelay];
    const gesturesCard = featureGesturesEnabled.closest('.card');
    const clipboardCard = featureClipboardEnabled.closest('.card');
    const videoFloatingCard = featureVideoFloatingEnabled.closest('.card');
    const inlineTranslateCard = featureInlineTranslateEnabled.closest('.card');
    const youtubeSubtitlesCard = featureYoutubeSubtitlesEnabled.closest('.card');
    const trustedTypesCard = featureTrustedTypesEnabled.closest('.card');
    const forumCard = featureForumEnabled.closest('.card');

    let activeHost = null;
    let config = null;

    const setStatus = (message, isError = false) => {
        statusLabel.textContent = message;
        statusLabel.style.color = isError ? '#fca5a5' : '#9ca3af';
    };

    const getActiveTab = () => new Promise((resolve) => {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    });

    const getHostFromUrl = (url) => {
        try {
            return new URL(url).host;
        } catch {
            return null;
        }
    };

    const setHostControlsState = (enabled) => {
        hostBoundControls.forEach((control) => {
            control.disabled = !enabled;
        });
        hostOnlyRows.forEach((row) => {
            row.style.opacity = enabled ? '1' : '.55';
        });
    };

    const setCardState = (card, enabled) => {
        if (!card) return;
        card.classList.toggle('is-disabled', !enabled);
    };

    const syncFeatureCards = () => {
        const canUseForumControls = !!activeHost && featureForumEnabled.checked;
        setCardState(gesturesCard, featureGesturesEnabled.checked);
        setCardState(clipboardCard, featureClipboardEnabled.checked);
        setCardState(videoFloatingCard, featureVideoFloatingEnabled.checked);
        setCardState(inlineTranslateCard, featureInlineTranslateEnabled.checked);
        setCardState(youtubeSubtitlesCard, featureYoutubeSubtitlesEnabled.checked);
        setCardState(trustedTypesCard, featureTrustedTypesEnabled.checked);
        setCardState(forumCard, featureForumEnabled.checked);
        setHostControlsState(canUseForumControls);
    };

    const render = () => {
        if (!config) return;

        const gestures = getGestureSettings(config);
        featureGesturesEnabled.checked = !!gestures.enabled;
        featureClipboardEnabled.checked = config.clipboard?.enabled !== false;
        featureVideoFloatingEnabled.checked = config.videoFloating?.enabled !== false;
        featureInlineTranslateEnabled.checked = config.inlineTranslate?.enabled !== false;
        featureYoutubeSubtitlesEnabled.checked = !!config.youtubeSubtitles?.enabled;
        featureTrustedTypesEnabled.checked = !!config.trustedTypes?.enabled;
        featureForumEnabled.checked = !!getForumConfig(config, activeHost).enabled;
        inlineTranslateHotkey.value = config.inlineTranslate?.hotkey || 'f2';
        inlineTranslateSwipeEnabled.checked = config.inlineTranslate?.swipeEnabled !== false;
        inlineTranslateSwipeDir.value = config.inlineTranslate?.swipeDir || 'both';
        inlineTranslateSwipePx.value = config.inlineTranslate?.swipePx || 60;
        inlineTranslateFontScale.value = config.inlineTranslate?.fontScale || 0.95;
        inlineTranslateMutedColor.value = config.inlineTranslate?.mutedColor || '#00bfff';
        youtubeSubtitlesTargetLang.value = config.youtubeSubtitles?.targetLang || 'vi';
        youtubeSubtitlesFontSize.value = config.youtubeSubtitles?.fontSize || 16;
        youtubeSubtitlesTranslatedFontSize.value = config.youtubeSubtitles?.translatedFontSize || 16;
        youtubeSubtitlesOriginalColor.value = config.youtubeSubtitles?.originalColor || '#ffffff';
        youtubeSubtitlesTranslatedColor.value = config.youtubeSubtitles?.translatedColor || '#0e8cef';
        youtubeSubtitlesDisplayMode.value = config.youtubeSubtitles?.displayMode || 'compact';
        youtubeSubtitlesShowOriginal.checked = config.youtubeSubtitles?.showOriginal !== false;
        trustedTypesAllowDomains.value = Array.isArray(config.trustedTypes?.allowDomains) ? config.trustedTypes.allowDomains.join(', ') : '';
        clipboardMaxHistory.value = config.clipboard.maxHistory || 5;
        videoFloatingEnabled.checked = config.videoFloating?.enabled !== false;
        videoFloatingMinDistance.value = config.videoFloating?.minSwipeDistance || 30;
        videoFloatingSwipeShort.value = config.videoFloating?.swipeShort || 0.15;
        videoFloatingSwipeLong.value = config.videoFloating?.swipeLong || 0.3;
        videoFloatingShortThreshold.value = config.videoFloating?.shortThreshold || 200;
        videoFloatingVerticalTolerance.value = config.videoFloating?.verticalTolerance || 80;
        videoFloatingDiagonalThreshold.value = config.videoFloating?.diagonalThreshold || 1.5;
        videoFloatingRealtimePreview.checked = config.videoFloating?.realtimePreview !== false;
        videoFloatingThrottle.value = config.videoFloating?.throttle ?? 15;
        videoFloatingNoticeFontSize.value = config.videoFloating?.noticeFontSize || 14;
        gLpEnabled.checked = !!gestures.longPress.enabled;
        gLpMode.value = gestures.longPress.mode;
        gLpMs.value = gestures.longPress.ms;
        gRcEnabled.checked = !!gestures.rightClick.enabled;
        gRcMode.value = gestures.rightClick.mode;
        gDblRightEnabled.checked = !!gestures.doubleRight.enabled;
        gDblRight.value = gestures.doubleRight.ms;
        gDblTapEnabled.checked = !!gestures.doubleTap.enabled;
        gDblTapMs.value = gestures.doubleTap.ms;
        gEdgeEnabled.checked = !!gestures.edgeSwipe.enabled;
        gEdgeSide.value = gestures.edgeSwipe.side;
        gEdgeWidth.value = gestures.edgeSwipe.width;
        gEdgeSpeed.value = gestures.edgeSwipe.speed;
        gPagerEnabled.checked = !!gestures.pager.enabled;
        gPagerHops.value = gestures.pager.hops;

        if (!activeHost) {
            hostLabel.textContent = 'Không có host hiện tại';
            syncFeatureCards();
            return;
        }

        const forumConfig = getForumConfig(config, activeHost);
        hostLabel.textContent = activeHost;
        forumWide.checked = !!forumConfig.wide;
        forumMinWidth.value = forumConfig.minWidth;
        forumGap.value = forumConfig.gap;
        forumFade.value = forumConfig.fadeTime;
        forumDelay.value = forumConfig.initDelay;
        syncFeatureCards();
    };

    const save = async () => {
        if (!config) return;

        const next = applyGestureSettings(ext.shared.config.deepClone(config), {
            enabled: featureGesturesEnabled.checked,
            longPress: {
                enabled: gLpEnabled.checked,
                mode: gLpMode.value,
                ms: Number(gLpMs.value)
            },
            rightClick: {
                enabled: gRcEnabled.checked,
                mode: gRcMode.value
            },
            doubleRight: {
                enabled: gDblRightEnabled.checked,
                ms: Number(gDblRight.value)
            },
            doubleTap: {
                enabled: gDblTapEnabled.checked,
                ms: Number(gDblTapMs.value)
            },
            edgeSwipe: {
                enabled: gEdgeEnabled.checked,
                side: gEdgeSide.value,
                width: Number(gEdgeWidth.value),
                speed: Number(gEdgeSpeed.value)
            },
            pager: {
                enabled: gPagerEnabled.checked,
                hops: Number(gPagerHops.value)
            }
        });

        next.clipboard.enabled = featureClipboardEnabled.checked;
        next.clipboard.maxHistory = Number(clipboardMaxHistory.value);
        next.videoFloating.enabled = featureVideoFloatingEnabled.checked && videoFloatingEnabled.checked;
        next.videoFloating.minSwipeDistance = Number(videoFloatingMinDistance.value);
        next.videoFloating.swipeShort = Number(videoFloatingSwipeShort.value);
        next.videoFloating.swipeLong = Number(videoFloatingSwipeLong.value);
        next.videoFloating.shortThreshold = Number(videoFloatingShortThreshold.value);
        next.videoFloating.verticalTolerance = Number(videoFloatingVerticalTolerance.value);
        next.videoFloating.diagonalThreshold = Number(videoFloatingDiagonalThreshold.value);
        next.videoFloating.realtimePreview = videoFloatingRealtimePreview.checked;
        next.videoFloating.throttle = Number(videoFloatingThrottle.value);
        next.videoFloating.noticeFontSize = Number(videoFloatingNoticeFontSize.value);
        next.googleSearch.enabled = true;
        next.quickSearch.enabled = true;
        next.inlineTranslate.enabled = featureInlineTranslateEnabled.checked;
        next.inlineTranslate.hotkey = inlineTranslateHotkey.value;
        next.inlineTranslate.swipeEnabled = inlineTranslateSwipeEnabled.checked;
        next.inlineTranslate.swipeDir = inlineTranslateSwipeDir.value;
        next.inlineTranslate.swipePx = Number(inlineTranslateSwipePx.value);
        next.inlineTranslate.fontScale = Number(inlineTranslateFontScale.value);
        next.inlineTranslate.mutedColor = inlineTranslateMutedColor.value;
        next.youtubeSubtitles.enabled = featureYoutubeSubtitlesEnabled.checked;
        next.youtubeSubtitles.targetLang = youtubeSubtitlesTargetLang.value;
        next.youtubeSubtitles.fontSize = Number(youtubeSubtitlesFontSize.value);
        next.youtubeSubtitles.translatedFontSize = Number(youtubeSubtitlesTranslatedFontSize.value);
        next.youtubeSubtitles.originalColor = youtubeSubtitlesOriginalColor.value;
        next.youtubeSubtitles.translatedColor = youtubeSubtitlesTranslatedColor.value;
        next.youtubeSubtitles.displayMode = youtubeSubtitlesDisplayMode.value;
        next.youtubeSubtitles.showOriginal = youtubeSubtitlesShowOriginal.checked;
        next.trustedTypes.enabled = featureTrustedTypesEnabled.checked;
        next.trustedTypes.allowDomains = trustedTypesAllowDomains.value
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

        let normalized = next;
        if (activeHost) {
            normalized = updateForumHostConfig(next, activeHost, {
                enabled: featureForumEnabled.checked,
                wide: forumWide.checked,
                minWidth: Number(forumMinWidth.value),
                gap: Number(forumGap.value),
                fadeTime: Number(forumFade.value),
                initDelay: Number(forumDelay.value)
            });
        }

        config = await storage.saveConfig(normalized);
        render();
        setStatus('Đã lưu cấu hình.');
    };

    Promise.all([storage.getConfig(), getActiveTab()]).then(([loadedConfig, activeTab]) => {
        config = loadedConfig;
        activeHost = getHostFromUrl(activeTab?.url || '');
        render();
        setStatus('Sẵn sàng.');
    }).catch((error) => {
        console.error('[GestureExtension][popup] init failed', error);
        setStatus(error?.message || 'Lỗi context/runtime.', true);
    });

    saveButton.addEventListener('click', () => {
        save().catch((error) => {
            console.error('[GestureExtension][popup] save failed', error);
            setStatus(error?.message || 'Không lưu được cấu hình.', true);
        });
    });

    clipboardClear.addEventListener('click', () => {
        storage.clearClipboardHistory().then((nextConfig) => {
            config = nextConfig;
            render();
            setStatus('Đã xóa lịch sử clipboard.');
        }).catch((error) => {
            console.error('[GestureExtension][popup] clear clipboard failed', error);
            setStatus(error?.message || 'Không xóa được lịch sử clipboard.', true);
        });
    });

    closeButton.addEventListener('click', () => {
        window.close();
    });

    [
        featureGesturesEnabled,
        featureClipboardEnabled,
        featureVideoFloatingEnabled,
        featureInlineTranslateEnabled,
        featureYoutubeSubtitlesEnabled,
        featureTrustedTypesEnabled,
        featureForumEnabled
    ].forEach((control) => {
        control.addEventListener('change', syncFeatureCards);
    });
})();
