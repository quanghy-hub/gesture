(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, updateForumHostConfig, getGestureSettings, applyGestureSettings, isHostExcluded, setHostExcluded, normalizeHost, DEFAULT_POPUP_PANEL_ORDER, deepClone } = ext.shared.config;
    const { TRANSLATE_PROVIDER_OPTIONS, OCR_PROVIDER_OPTIONS } = ext.shared.apiServices;
    const storage = ext.shared.storage;

    const hostLabel = document.getElementById('current-host');
    const closeButton = document.getElementById('close-popup');
    const hostBlacklistLabel = document.getElementById('host-blacklist-label');
    const hostBlacklistToggle = document.getElementById('host-blacklist-toggle');
    const featureUnblockCopyEnabled = document.getElementById('feature-unblock-copy-enabled');
    const featureGesturesEnabled = document.getElementById('feature-gestures-enabled');
    const featureClipboardEnabled = document.getElementById('feature-clipboard-enabled');
    const featureVideoFloatingEnabled = document.getElementById('feature-video-floating-enabled');
    const featureVideoScreenshotEnabled = document.getElementById('feature-video-screenshot-enabled');
    const featureQuickSearchEnabled = document.getElementById('feature-quick-search-enabled');
    const featureInlineTranslateEnabled = document.getElementById('feature-inline-translate-enabled');
    const featureYoutubeSubtitlesEnabled = document.getElementById('feature-youtube-subtitles-enabled');
    const featureForumEnabled = document.getElementById('feature-forum-enabled');
    const forumScopeLabel = document.getElementById('forum-scope');
    const inlineTranslateHotkeyEnabled = document.getElementById('inline-translate-hotkey-enabled');
    const inlineTranslateHotkey = document.getElementById('inline-translate-hotkey');
    const inlineTranslateSelectionTranslateEnabled = document.getElementById('inline-translate-selection-translate-enabled');
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
    const apiTranslateProvider = document.getElementById('api-translate-provider');
    const apiTranslateFallbackEnabled = document.getElementById('api-translate-fallback-enabled');
    const apiTranslateFallbackProvider = document.getElementById('api-translate-fallback-provider');
    const apiTranslateApiKey = document.getElementById('api-translate-api-key');
    const apiTranslateFallbackApiKey = document.getElementById('api-translate-fallback-api-key');
    const apiOcrProvider = document.getElementById('api-ocr-provider');
    const apiOcrFallbackEnabled = document.getElementById('api-ocr-fallback-enabled');
    const apiOcrFallbackProvider = document.getElementById('api-ocr-fallback-provider');
    const apiOcrApiKey = document.getElementById('api-ocr-api-key');
    const apiOcrFallbackApiKey = document.getElementById('api-ocr-fallback-api-key');
    const quickSearchColumns = document.getElementById('quick-search-columns');
    const quickSearchImageSearchEnabled = document.getElementById('quick-search-image-search-enabled');
    const inlineTranslateSwipePx = document.getElementById('inline-translate-swipe-px');
    const inlineTranslateSwipeMaxDurationMs = document.getElementById('inline-translate-swipe-max-duration-ms');
    const clipboardMaxHistory = document.getElementById('clipboard-max-history');
    const clipboardClear = document.getElementById('clipboard-clear');
    const videoFloatingMinDistance = document.getElementById('video-floating-min-distance');
    const videoFloatingSwipeShort = document.getElementById('video-floating-swipe-short');
    const videoFloatingSwipeLong = document.getElementById('video-floating-swipe-long');
    const videoFloatingShortThreshold = document.getElementById('video-floating-short-threshold');
    const videoFloatingVerticalTolerance = document.getElementById('video-floating-vertical-tolerance');
    const videoFloatingDiagonalThreshold = document.getElementById('video-floating-diagonal-threshold');
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
    const gFastScrollEnabled = document.getElementById('g-fast-scroll-enabled');
    const gFastScrollStep = document.getElementById('g-fast-scroll-step');
    const gFastScrollWheelZone = document.getElementById('g-fast-scroll-wheel-zone');
    const gEdgeEnabled = document.getElementById('g-edge-enabled');
    const gEdgeSide = document.getElementById('g-edge-side');
    const gEdgeWidth = document.getElementById('g-edge-width');
    const gEdgeSpeed = document.getElementById('g-edge-speed');
    const gPagerEnabled = document.getElementById('g-pager-enabled');
    const gPagerHops = document.getElementById('g-pager-hops');
    const hostOnlyRows = Array.from(document.querySelectorAll('.host-only'));
    const hostBoundControls = [forumWide, forumMinWidth, forumGap, forumFade, forumDelay];
    const unblockCopyCard = featureUnblockCopyEnabled.closest('.card');
    const gesturesCard = featureGesturesEnabled.closest('.card');
    const clipboardCard = featureClipboardEnabled.closest('.card');
    const videoFloatingCard = featureVideoFloatingEnabled.closest('.card');
    const videoScreenshotCard = featureVideoScreenshotEnabled.closest('.card');
    const quickSearchCard = featureQuickSearchEnabled.closest('.card');
    const inlineTranslateCard = featureInlineTranslateEnabled.closest('.card');
    const youtubeSubtitlesCard = featureYoutubeSubtitlesEnabled.closest('.card');
    const forumCard = featureForumEnabled.closest('.card');
    const quickSearchProviderIds = ['google', 'perplexity', 'chatgpt', 'gemini', 'claude', 'copilot', 'bing', 'duckduckgo', 'youtube', 'google-images'];
    const quickSearchProviderInputs = Object.fromEntries(
        quickSearchProviderIds.map((providerId) => [providerId, document.getElementById(`quick-search-provider-${providerId}`)])
    );
    const popupRoot = document.querySelector('.popup');
    const panelCards = Array.from(document.querySelectorAll('.card[data-panel-id]'));
    const panelToggleButtons = Array.from(document.querySelectorAll('[data-panel-toggle]'));
    const dragHandles = Array.from(document.querySelectorAll('[data-drag-handle]'));

    let activeHost = null;
    let config = null;
    let isReady = false;
    let saveTimer = 0;
    let pendingSave = null;
    let dragArmedCard = null;
    let draggingCard = null;

    const fillProviderOptions = (select, options) => {
        if (!select) return;
        select.replaceChildren(...options.map(({ id, label }) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = label;
            return option;
        }));
    };

    const getPanelOrder = () => Array.from(popupRoot.querySelectorAll('.card[data-panel-id]'))
        .map((card) => card.dataset.panelId)
        .filter((value) => typeof value === 'string' && value);

    const clearDropIndicators = () => {
        panelCards.forEach((card) => {
            card.classList.remove('drag-over-top', 'drag-over-bottom');
        });
    };

    const applyPanelOrder = (order) => {
        const normalizedOrder = Array.isArray(order) && order.length ? order : DEFAULT_POPUP_PANEL_ORDER;
        normalizedOrder.forEach((panelId) => {
            const card = panelCards.find((entry) => entry.dataset.panelId === panelId);
            if (card) {
                popupRoot.appendChild(card);
            }
        });
    };

    fillProviderOptions(apiTranslateProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(apiTranslateFallbackProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(apiOcrProvider, OCR_PROVIDER_OPTIONS);
    fillProviderOptions(apiOcrFallbackProvider, OCR_PROVIDER_OPTIONS);

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
        setCardState(unblockCopyCard, featureUnblockCopyEnabled.checked);
        setCardState(gesturesCard, featureGesturesEnabled.checked);
        setCardState(clipboardCard, featureClipboardEnabled.checked);
        setCardState(videoFloatingCard, featureVideoFloatingEnabled.checked);
        setCardState(videoScreenshotCard, featureVideoScreenshotEnabled.checked);
        setCardState(quickSearchCard, featureQuickSearchEnabled.checked);
        setCardState(inlineTranslateCard, featureInlineTranslateEnabled.checked);
        setCardState(youtubeSubtitlesCard, featureYoutubeSubtitlesEnabled.checked);
        setCardState(forumCard, featureForumEnabled.checked);
        setHostControlsState(canUseForumControls);
    };

    const render = () => {
        if (!config) return;

        applyPanelOrder(config.runtime?.popupPanelOrder);
        const gestures = getGestureSettings(config);
        const normalizedActiveHost = normalizeHost(activeHost);
        featureUnblockCopyEnabled.checked = config.unblockCopy?.enabled !== false;
        featureGesturesEnabled.checked = !!gestures.enabled;
        featureClipboardEnabled.checked = config.clipboard?.enabled !== false;
        featureVideoFloatingEnabled.checked = config.videoFloating?.enabled !== false;
        featureVideoScreenshotEnabled.checked = config.videoScreenshot?.enabled !== false;
        featureQuickSearchEnabled.checked = config.quickSearch?.enabled !== false;
        featureInlineTranslateEnabled.checked = config.inlineTranslate?.enabled !== false;
        inlineTranslateHotkeyEnabled.checked = config.inlineTranslate?.hotkeyEnabled !== false;
        featureYoutubeSubtitlesEnabled.checked = !!config.youtubeSubtitles?.enabled;
        featureForumEnabled.checked = !!getForumConfig(config, activeHost).enabled;
        inlineTranslateHotkey.value = config.inlineTranslate?.hotkey || 'f2';
        inlineTranslateSwipeEnabled.checked = config.inlineTranslate?.swipeEnabled !== false;
        inlineTranslateSelectionTranslateEnabled.checked = config.inlineTranslate?.selectionTranslateEnabled !== false;
        inlineTranslateSwipeDir.value = config.inlineTranslate?.swipeDir || 'both';
        inlineTranslateSwipePx.value = config.inlineTranslate?.swipePx || 60;
        inlineTranslateSwipeMaxDurationMs.value = config.inlineTranslate?.swipeMaxDurationMs || 500;
        inlineTranslateFontScale.value = config.inlineTranslate?.fontScale || 0.95;
        inlineTranslateMutedColor.value = config.inlineTranslate?.mutedColor || '#00bfff';
        youtubeSubtitlesTargetLang.value = config.youtubeSubtitles?.targetLang || 'vi';
        youtubeSubtitlesFontSize.value = config.youtubeSubtitles?.fontSize || 16;
        youtubeSubtitlesTranslatedFontSize.value = config.youtubeSubtitles?.translatedFontSize || 16;
        youtubeSubtitlesOriginalColor.value = config.youtubeSubtitles?.originalColor || '#ffffff';
        youtubeSubtitlesTranslatedColor.value = config.youtubeSubtitles?.translatedColor || '#0e8cef';
        youtubeSubtitlesDisplayMode.value = config.youtubeSubtitles?.displayMode || 'compact';
        youtubeSubtitlesShowOriginal.checked = config.youtubeSubtitles?.showOriginal !== false;
        apiTranslateProvider.value = config.apiServices?.translate?.activeProvider || 'google';
        apiTranslateFallbackEnabled.checked = !!config.apiServices?.translate?.fallbackEnabled;
        apiTranslateFallbackProvider.value = config.apiServices?.translate?.fallbackProvider || 'mymemory';
        apiTranslateApiKey.value = config.apiServices?.translate?.providers?.[apiTranslateProvider.value]?.apiKey || '';
        apiTranslateFallbackApiKey.value = config.apiServices?.translate?.providers?.[apiTranslateFallbackProvider.value]?.apiKey || '';
        apiOcrProvider.value = config.apiServices?.ocr?.activeProvider || 'ocrspace';
        apiOcrFallbackEnabled.checked = !!config.apiServices?.ocr?.fallbackEnabled;
        apiOcrFallbackProvider.value = config.apiServices?.ocr?.fallbackProvider || 'ocrspace-alt';
        apiOcrApiKey.value = config.apiServices?.ocr?.providers?.[apiOcrProvider.value]?.apiKey || '';
        apiOcrFallbackApiKey.value = config.apiServices?.ocr?.providers?.[apiOcrFallbackProvider.value]?.apiKey || '';
        quickSearchColumns.value = config.quickSearch?.columns || 5;
        quickSearchImageSearchEnabled.checked = config.quickSearch?.imageSearchEnabled !== false;
        const enabledProviderIds = Array.isArray(config.quickSearch?.enabledProviderIds) ? config.quickSearch.enabledProviderIds : quickSearchProviderIds;
        quickSearchProviderIds.forEach((providerId) => {
            if (quickSearchProviderInputs[providerId]) {
                quickSearchProviderInputs[providerId].checked = enabledProviderIds.includes(providerId);
            }
        });
        clipboardMaxHistory.value = config.clipboard.maxHistory || 5;
        videoFloatingMinDistance.value = config.videoFloating?.minSwipeDistance || 30;
        videoFloatingSwipeShort.value = config.videoFloating?.swipeShort || 0.15;
        videoFloatingSwipeLong.value = config.videoFloating?.swipeLong || 0.3;
        videoFloatingShortThreshold.value = config.videoFloating?.shortThreshold || 200;
        videoFloatingVerticalTolerance.value = config.videoFloating?.verticalTolerance || 80;
        videoFloatingDiagonalThreshold.value = config.videoFloating?.diagonalThreshold || 1.5;
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
        gFastScrollEnabled.checked = !!gestures.fastScroll.enabled;
        gFastScrollStep.value = gestures.fastScroll.step;
        gFastScrollWheelZone.value = gestures.fastScroll.wheelZone;
        gEdgeEnabled.checked = !!gestures.edgeSwipe.enabled;
        gEdgeSide.value = gestures.edgeSwipe.side;
        gEdgeWidth.value = gestures.edgeSwipe.width;
        gEdgeSpeed.value = gestures.edgeSwipe.speed;
        gPagerEnabled.checked = !!gestures.pager.enabled;
        gPagerHops.value = gestures.pager.hops;
        hostBlacklistToggle.disabled = !normalizedActiveHost;
        hostBlacklistToggle.checked = normalizedActiveHost ? isHostExcluded(config, normalizedActiveHost) : false;
        hostBlacklistLabel.textContent = normalizedActiveHost || 'Không có host';

        if (!activeHost) {
            hostLabel.textContent = 'Không có host hiện tại';
            if (forumScopeLabel) forumScopeLabel.textContent = 'Chỉ áp dụng cho site XenForo. Trang hiện tại không có host hợp lệ.';
            syncFeatureCards();
            return;
        }

        const forumConfig = getForumConfig(config, activeHost);
        hostLabel.textContent = activeHost;
        if (forumScopeLabel) forumScopeLabel.textContent = `Chỉ áp dụng cho site XenForo hiện tại: ${activeHost}`;
        forumWide.checked = !!forumConfig.wide;
        forumMinWidth.value = forumConfig.minWidth;
        forumGap.value = forumConfig.gap;
        forumFade.value = forumConfig.fadeTime;
        forumDelay.value = forumConfig.initDelay;
        syncFeatureCards();
    };

    const save = async () => {
        if (!config) return;

        const next = applyGestureSettings(deepClone(config), {
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
            fastScroll: {
                enabled: gFastScrollEnabled.checked,
                step: Number(gFastScrollStep.value),
                wheelZone: Number(gFastScrollWheelZone.value)
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
        const nextWithHostBlacklist = activeHost ? setHostExcluded(next, activeHost, hostBlacklistToggle.checked) : next;

        nextWithHostBlacklist.unblockCopy.enabled = featureUnblockCopyEnabled.checked;
        nextWithHostBlacklist.clipboard.enabled = featureClipboardEnabled.checked;
        nextWithHostBlacklist.clipboard.maxHistory = Number(clipboardMaxHistory.value);
        nextWithHostBlacklist.videoFloating.enabled = featureVideoFloatingEnabled.checked;
        nextWithHostBlacklist.videoScreenshot.enabled = featureVideoScreenshotEnabled.checked;
        nextWithHostBlacklist.videoFloating.minSwipeDistance = Number(videoFloatingMinDistance.value);
        nextWithHostBlacklist.videoFloating.swipeShort = Number(videoFloatingSwipeShort.value);
        nextWithHostBlacklist.videoFloating.swipeLong = Number(videoFloatingSwipeLong.value);
        nextWithHostBlacklist.videoFloating.shortThreshold = Number(videoFloatingShortThreshold.value);
        nextWithHostBlacklist.videoFloating.verticalTolerance = Number(videoFloatingVerticalTolerance.value);
        nextWithHostBlacklist.videoFloating.diagonalThreshold = Number(videoFloatingDiagonalThreshold.value);
        nextWithHostBlacklist.videoFloating.throttle = Number(videoFloatingThrottle.value);
        nextWithHostBlacklist.videoFloating.noticeFontSize = Number(videoFloatingNoticeFontSize.value);
        nextWithHostBlacklist.googleSearch.enabled = nextWithHostBlacklist.googleSearch?.enabled !== false;
        nextWithHostBlacklist.quickSearch.enabled = featureQuickSearchEnabled.checked;
        nextWithHostBlacklist.quickSearch.columns = Number(quickSearchColumns.value);
        nextWithHostBlacklist.quickSearch.imageSearchEnabled = quickSearchImageSearchEnabled.checked;
        nextWithHostBlacklist.quickSearch.enabledProviderIds = quickSearchProviderIds.filter((providerId) => quickSearchProviderInputs[providerId]?.checked);
        nextWithHostBlacklist.inlineTranslate.enabled = featureInlineTranslateEnabled.checked;
        nextWithHostBlacklist.inlineTranslate.hotkeyEnabled = inlineTranslateHotkeyEnabled.checked;
        nextWithHostBlacklist.inlineTranslate.hotkey = inlineTranslateHotkey.value;
        nextWithHostBlacklist.inlineTranslate.selectionTranslateEnabled = inlineTranslateSelectionTranslateEnabled.checked;
        nextWithHostBlacklist.inlineTranslate.swipeEnabled = inlineTranslateSwipeEnabled.checked;
        nextWithHostBlacklist.inlineTranslate.swipeDir = inlineTranslateSwipeDir.value;
        nextWithHostBlacklist.inlineTranslate.swipePx = Number(inlineTranslateSwipePx.value);
        nextWithHostBlacklist.inlineTranslate.swipeMaxDurationMs = Number(inlineTranslateSwipeMaxDurationMs.value);
        nextWithHostBlacklist.inlineTranslate.fontScale = Number(inlineTranslateFontScale.value);
        nextWithHostBlacklist.inlineTranslate.mutedColor = inlineTranslateMutedColor.value;
        nextWithHostBlacklist.apiServices.translate.activeProvider = apiTranslateProvider.value;
        nextWithHostBlacklist.apiServices.translate.fallbackEnabled = apiTranslateFallbackEnabled.checked;
        nextWithHostBlacklist.apiServices.translate.fallbackProvider = apiTranslateFallbackProvider.value;
        nextWithHostBlacklist.apiServices.translate.providers[apiTranslateProvider.value].enabled = true;
        nextWithHostBlacklist.apiServices.translate.providers[apiTranslateProvider.value].apiKey = apiTranslateApiKey.value.trim();
        if (nextWithHostBlacklist.apiServices.translate.providers[apiTranslateFallbackProvider.value]) {
            nextWithHostBlacklist.apiServices.translate.providers[apiTranslateFallbackProvider.value].enabled = true;
            nextWithHostBlacklist.apiServices.translate.providers[apiTranslateFallbackProvider.value].apiKey = apiTranslateFallbackApiKey.value.trim();
        }
        nextWithHostBlacklist.apiServices.ocr.activeProvider = apiOcrProvider.value;
        nextWithHostBlacklist.apiServices.ocr.fallbackEnabled = apiOcrFallbackEnabled.checked;
        nextWithHostBlacklist.apiServices.ocr.fallbackProvider = apiOcrFallbackProvider.value;
        nextWithHostBlacklist.apiServices.ocr.providers[apiOcrProvider.value].enabled = true;
        nextWithHostBlacklist.apiServices.ocr.providers[apiOcrProvider.value].apiKey = apiOcrApiKey.value.trim();
        if (nextWithHostBlacklist.apiServices.ocr.providers[apiOcrFallbackProvider.value]) {
            nextWithHostBlacklist.apiServices.ocr.providers[apiOcrFallbackProvider.value].enabled = true;
            nextWithHostBlacklist.apiServices.ocr.providers[apiOcrFallbackProvider.value].apiKey = apiOcrFallbackApiKey.value.trim();
        }
        nextWithHostBlacklist.inlineTranslate.provider = nextWithHostBlacklist.apiServices.translate.activeProvider;
        nextWithHostBlacklist.youtubeSubtitles.enabled = featureYoutubeSubtitlesEnabled.checked;
        nextWithHostBlacklist.youtubeSubtitles.targetLang = youtubeSubtitlesTargetLang.value;
        nextWithHostBlacklist.youtubeSubtitles.fontSize = Number(youtubeSubtitlesFontSize.value);
        nextWithHostBlacklist.youtubeSubtitles.translatedFontSize = Number(youtubeSubtitlesTranslatedFontSize.value);
        nextWithHostBlacklist.youtubeSubtitles.originalColor = youtubeSubtitlesOriginalColor.value;
        nextWithHostBlacklist.youtubeSubtitles.translatedColor = youtubeSubtitlesTranslatedColor.value;
        nextWithHostBlacklist.youtubeSubtitles.displayMode = youtubeSubtitlesDisplayMode.value;
        nextWithHostBlacklist.youtubeSubtitles.showOriginal = youtubeSubtitlesShowOriginal.checked;
        let normalized = nextWithHostBlacklist;
        if (activeHost) {
            normalized = updateForumHostConfig(nextWithHostBlacklist, activeHost, {
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
    };

    const runSave = async () => {
        if (pendingSave) {
            return pendingSave;
        }
        pendingSave = save().catch((error) => {
            console.error('[GestureExtension][popup] save failed', error);
            throw error;
        }).finally(() => {
            pendingSave = null;
        });
        return pendingSave;
    };

    const scheduleAutoSave = () => {
        if (!isReady || !config) {
            return;
        }
        if (saveTimer) {
            window.clearTimeout(saveTimer);
        }
        saveTimer = window.setTimeout(() => {
            saveTimer = 0;
            runSave().catch(() => { });
        }, 250);
    };

    const registerAutoSave = (control, eventName = 'change', options = {}) => {
        if (!control) return;
        control.addEventListener(eventName, () => {
            if (options.skipWhenEmpty && control.value === '') {
                return;
            }
            if (options.restoreWhenEmpty && control.value === '') {
                render();
                return;
            }
            if (options.syncCards) {
                syncFeatureCards();
            }
            if (options.renderAfter) {
                render();
            }
            scheduleAutoSave();
        });
    };

    const setPanelExpanded = (button, expanded) => {
        const panel = document.getElementById(button.getAttribute('aria-controls'));
        if (!panel) return;
        const title = button.closest('.card')?.querySelector('.card-title span')?.textContent?.trim() || 'panel';
        button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        button.setAttribute('aria-label', `${expanded ? 'Đóng' : 'Mở'} cài đặt ${title}`);
        panel.classList.toggle('is-collapsed', !expanded);
    };

    const savePanelOrder = () => {
        if (!config) return;
        config.runtime = config.runtime || {};
        config.runtime.popupPanelOrder = getPanelOrder();
        scheduleAutoSave();
    };

    const setupPanelReorder = () => {
        panelCards.forEach((card) => {
            card.draggable = true;

            card.addEventListener('dragstart', (event) => {
                if (dragArmedCard !== card) {
                    event.preventDefault();
                    return;
                }
                draggingCard = card;
                card.classList.add('is-dragging');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', card.dataset.panelId || '');
            });

            card.addEventListener('dragover', (event) => {
                if (!draggingCard || draggingCard === card) return;
                event.preventDefault();
                const bounds = card.getBoundingClientRect();
                const before = event.clientY < bounds.top + bounds.height / 2;
                clearDropIndicators();
                card.classList.add(before ? 'drag-over-top' : 'drag-over-bottom');
            });

            card.addEventListener('drop', (event) => {
                if (!draggingCard || draggingCard === card) return;
                event.preventDefault();
                const bounds = card.getBoundingClientRect();
                const before = event.clientY < bounds.top + bounds.height / 2;
                popupRoot.insertBefore(draggingCard, before ? card : card.nextSibling);
                clearDropIndicators();
                savePanelOrder();
            });

            card.addEventListener('dragend', () => {
                clearDropIndicators();
                card.classList.remove('is-dragging');
                draggingCard = null;
                dragArmedCard = null;
            });
        });

        dragHandles.forEach((handle) => {
            handle.addEventListener('pointerdown', () => {
                dragArmedCard = handle.closest('.card[data-panel-id]');
            });
            handle.addEventListener('pointerup', () => {
                dragArmedCard = null;
            });
            handle.addEventListener('mouseleave', () => {
                if (!draggingCard) {
                    dragArmedCard = null;
                }
            });
        });
    };

    Promise.all([storage.getConfig(), getActiveTab()]).then(([loadedConfig, activeTab]) => {
        config = loadedConfig;
        activeHost = getHostFromUrl(activeTab?.url || '');
        render();
        isReady = true;
    }).catch((error) => {
        console.error('[GestureExtension][popup] init failed', error);
    });

    clipboardClear.addEventListener('click', () => {
        storage.clearClipboardHistory().then((nextConfig) => {
            config = nextConfig;
            render();
        }).catch((error) => {
            console.error('[GestureExtension][popup] clear clipboard failed', error);
        });
    });

    closeButton.addEventListener('click', () => {
        window.close();
    });

    panelToggleButtons.forEach((button) => {
        setPanelExpanded(button, button.getAttribute('aria-expanded') === 'true');
        button.addEventListener('click', () => {
            setPanelExpanded(button, button.getAttribute('aria-expanded') !== 'true');
        });
    });

    setupPanelReorder();

    [
        featureUnblockCopyEnabled,
        featureGesturesEnabled,
        featureClipboardEnabled,
        featureVideoFloatingEnabled,
        featureVideoScreenshotEnabled,
        featureQuickSearchEnabled,
        featureInlineTranslateEnabled,
        featureYoutubeSubtitlesEnabled,
        featureForumEnabled
    ].forEach((control) => {
        registerAutoSave(control, 'change', { syncCards: true });
    });

    [
        inlineTranslateHotkeyEnabled,
        inlineTranslateHotkey,
        inlineTranslateSelectionTranslateEnabled,
        inlineTranslateSwipeEnabled,
        inlineTranslateSwipeDir,
        youtubeSubtitlesDisplayMode,
        youtubeSubtitlesShowOriginal,
        quickSearchImageSearchEnabled,
        forumWide,
        gLpEnabled,
        gLpMode,
        gRcEnabled,
        gRcMode,
        gDblRightEnabled,
        gDblTapEnabled,
        gFastScrollEnabled,
        gEdgeEnabled,
        gEdgeSide,
        gPagerEnabled,
        hostBlacklistToggle
    ].forEach((control) => {
        registerAutoSave(control, 'change');
    });

    [
        apiTranslateProvider,
        apiTranslateFallbackProvider,
        apiOcrProvider,
        apiOcrFallbackProvider
    ].forEach((control) => {
        registerAutoSave(control, 'change', { renderAfter: true });
    });

    [
        apiTranslateFallbackEnabled,
        apiOcrFallbackEnabled
    ].forEach((control) => {
        registerAutoSave(control, 'change');
    });

    [
        inlineTranslateMutedColor,
        apiTranslateApiKey,
        apiTranslateFallbackApiKey,
        apiOcrApiKey,
        apiOcrFallbackApiKey,
        youtubeSubtitlesTargetLang,
        youtubeSubtitlesOriginalColor,
        youtubeSubtitlesTranslatedColor
    ].forEach((control) => {
        registerAutoSave(control, 'input', { skipWhenEmpty: false });
        registerAutoSave(control, 'change', { restoreWhenEmpty: true });
    });

    [
        inlineTranslateSwipePx,
        inlineTranslateSwipeMaxDurationMs,
        inlineTranslateFontScale,
        youtubeSubtitlesFontSize,
        youtubeSubtitlesTranslatedFontSize,
        quickSearchColumns,
        clipboardMaxHistory,
        videoFloatingMinDistance,
        videoFloatingSwipeShort,
        videoFloatingSwipeLong,
        videoFloatingShortThreshold,
        videoFloatingVerticalTolerance,
        videoFloatingDiagonalThreshold,
        videoFloatingThrottle,
        videoFloatingNoticeFontSize,
        forumMinWidth,
        forumGap,
        forumFade,
        forumDelay,
        gLpMs,
        gDblRight,
        gDblTapMs,
        gFastScrollStep,
        gFastScrollWheelZone,
        gEdgeWidth,
        gEdgeSpeed,
        gPagerHops
    ].forEach((control) => {
        registerAutoSave(control, 'change', { restoreWhenEmpty: true });
    });

    Object.values(quickSearchProviderInputs).forEach((control) => {
        registerAutoSave(control, 'change');
    });
})();
