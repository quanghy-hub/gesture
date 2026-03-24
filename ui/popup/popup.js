(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, updateForumHostConfig, getGestureSettings, applyGestureSettings } = ext.shared.config;
    const storage = ext.shared.storage;

    const hostLabel = document.getElementById('current-host');
    const statusLabel = document.getElementById('status');
    const saveButton = document.getElementById('save-settings');
    const closeButton = document.getElementById('close-popup');
    const clipboardEnabled = document.getElementById('clipboard-enabled');
    const googleSearchEnabled = document.getElementById('google-search-enabled');
    const quickSearchEnabled = document.getElementById('quick-search-enabled');
    const inlineTranslateEnabled = document.getElementById('inline-translate-enabled');
    const inlineTranslateHotkey = document.getElementById('inline-translate-hotkey');
    const inlineTranslateSwipeEnabled = document.getElementById('inline-translate-swipe-enabled');
    const inlineTranslateSwipeDir = document.getElementById('inline-translate-swipe-dir');
    const inlineTranslateFontScale = document.getElementById('inline-translate-font-scale');
    const inlineTranslateMutedColor = document.getElementById('inline-translate-muted-color');
    const youtubeSubtitlesEnabled = document.getElementById('youtube-subtitles-enabled');
    const youtubeSubtitlesTargetLang = document.getElementById('youtube-subtitles-target-lang');
    const youtubeSubtitlesFontSize = document.getElementById('youtube-subtitles-font-size');
    const youtubeSubtitlesTranslatedFontSize = document.getElementById('youtube-subtitles-translated-font-size');
    const youtubeSubtitlesDisplayMode = document.getElementById('youtube-subtitles-display-mode');
    const youtubeSubtitlesShowOriginal = document.getElementById('youtube-subtitles-show-original');
    const youtubeSubtitlesOriginalColor = document.getElementById('youtube-subtitles-original-color');
    const youtubeSubtitlesTranslatedColor = document.getElementById('youtube-subtitles-translated-color');
    const trustedTypesEnabled = document.getElementById('trusted-types-enabled');
    const trustedTypesAllowDomains = document.getElementById('trusted-types-allow-domains');
    const inlineTranslateSwipePx = document.getElementById('inline-translate-swipe-px');
    const clipboardMaxHistory = document.getElementById('clipboard-max-history');
    const clipboardClear = document.getElementById('clipboard-clear');
    const forumEnabled = document.getElementById('forum-enabled');
    const forumWide = document.getElementById('forum-wide');
    const forumMinWidth = document.getElementById('forum-min-width');
    const forumGap = document.getElementById('forum-gap');
    const forumFade = document.getElementById('forum-fade');
    const forumDelay = document.getElementById('forum-delay');
    const gesturesEnabled = document.getElementById('gestures-enabled');
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
    const hostBoundControls = [forumEnabled, forumWide, forumMinWidth, forumGap, forumFade, forumDelay];

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

    const render = () => {
        if (!config) return;

        const gestures = getGestureSettings(config);
        clipboardEnabled.checked = config.clipboard.enabled !== false;
        googleSearchEnabled.checked = config.googleSearch?.enabled !== false;
        quickSearchEnabled.checked = config.quickSearch?.enabled !== false;
        inlineTranslateEnabled.checked = config.inlineTranslate?.enabled !== false;
        inlineTranslateHotkey.value = config.inlineTranslate?.hotkey || 'f2';
        inlineTranslateSwipeEnabled.checked = config.inlineTranslate?.swipeEnabled !== false;
        inlineTranslateSwipeDir.value = config.inlineTranslate?.swipeDir || 'both';
        inlineTranslateSwipePx.value = config.inlineTranslate?.swipePx || 60;
        inlineTranslateFontScale.value = config.inlineTranslate?.fontScale || 0.95;
        inlineTranslateMutedColor.value = config.inlineTranslate?.mutedColor || '#00bfff';
        youtubeSubtitlesEnabled.checked = !!config.youtubeSubtitles?.enabled;
        youtubeSubtitlesTargetLang.value = config.youtubeSubtitles?.targetLang || 'vi';
        youtubeSubtitlesFontSize.value = config.youtubeSubtitles?.fontSize || 16;
        youtubeSubtitlesTranslatedFontSize.value = config.youtubeSubtitles?.translatedFontSize || 16;
        youtubeSubtitlesOriginalColor.value = config.youtubeSubtitles?.originalColor || '#ffffff';
        youtubeSubtitlesTranslatedColor.value = config.youtubeSubtitles?.translatedColor || '#0e8cef';
        youtubeSubtitlesDisplayMode.value = config.youtubeSubtitles?.displayMode || 'compact';
        youtubeSubtitlesShowOriginal.checked = config.youtubeSubtitles?.showOriginal !== false;
        trustedTypesEnabled.checked = !!config.trustedTypes?.enabled;
        trustedTypesAllowDomains.value = Array.isArray(config.trustedTypes?.allowDomains) ? config.trustedTypes.allowDomains.join(', ') : '';
        clipboardMaxHistory.value = config.clipboard.maxHistory || 5;
        gesturesEnabled.checked = !!gestures.enabled;
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
            setHostControlsState(false);
            return;
        }

        const forumConfig = getForumConfig(config, activeHost);
        hostLabel.textContent = activeHost;
        setHostControlsState(true);
        forumEnabled.checked = !!forumConfig.enabled;
        forumWide.checked = !!forumConfig.wide;
        forumMinWidth.value = forumConfig.minWidth;
        forumGap.value = forumConfig.gap;
        forumFade.value = forumConfig.fadeTime;
        forumDelay.value = forumConfig.initDelay;
    };

    const save = async () => {
        if (!config) return;

        const next = applyGestureSettings(ext.shared.config.deepClone(config), {
            enabled: gesturesEnabled.checked,
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

        next.clipboard.enabled = clipboardEnabled.checked;
        next.clipboard.maxHistory = Number(clipboardMaxHistory.value);
        next.googleSearch.enabled = googleSearchEnabled.checked;
        next.quickSearch.enabled = quickSearchEnabled.checked;
        next.inlineTranslate.enabled = inlineTranslateEnabled.checked;
        next.inlineTranslate.hotkey = inlineTranslateHotkey.value;
        next.inlineTranslate.swipeEnabled = inlineTranslateSwipeEnabled.checked;
        next.inlineTranslate.swipeDir = inlineTranslateSwipeDir.value;
        next.inlineTranslate.swipePx = Number(inlineTranslateSwipePx.value);
        next.inlineTranslate.fontScale = Number(inlineTranslateFontScale.value);
        next.inlineTranslate.mutedColor = inlineTranslateMutedColor.value;
        next.youtubeSubtitles.enabled = youtubeSubtitlesEnabled.checked;
        next.youtubeSubtitles.targetLang = youtubeSubtitlesTargetLang.value;
        next.youtubeSubtitles.fontSize = Number(youtubeSubtitlesFontSize.value);
        next.youtubeSubtitles.translatedFontSize = Number(youtubeSubtitlesTranslatedFontSize.value);
        next.youtubeSubtitles.originalColor = youtubeSubtitlesOriginalColor.value;
        next.youtubeSubtitles.translatedColor = youtubeSubtitlesTranslatedColor.value;
        next.youtubeSubtitles.displayMode = youtubeSubtitlesDisplayMode.value;
        next.youtubeSubtitles.showOriginal = youtubeSubtitlesShowOriginal.checked;
        next.trustedTypes.enabled = trustedTypesEnabled.checked;
        next.trustedTypes.allowDomains = trustedTypesAllowDomains.value
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);

        let normalized = next;
        if (activeHost) {
            normalized = updateForumHostConfig(next, activeHost, {
                enabled: forumEnabled.checked,
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
})();
