(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, updateForumHostConfig, getGestureSettings, applyGestureSettings, isHostExcluded, setHostExcluded, normalizeHost, normalizeConfig, DEFAULT_CONFIG, DEFAULT_POPUP_PANEL_ORDER, deepClone } = ext.shared.config;
    const { TRANSLATE_PROVIDER_OPTIONS, OCR_PROVIDER_OPTIONS } = ext.shared.apiServices;
    const storage = ext.shared.storage;
    const safeGetElementById = (id) => {
        const el = document.getElementById(id);
        if (el) return el;
        console.warn(`[GestureExtension][popup] Element with id "${id}" not found. Returning a fallback dummy element.`);
        return {
            addEventListener() {},
            removeEventListener() {},
            closest() { return null; },
            setAttribute() {},
            getAttribute() { return null; },
            removeAttribute() {},
            classList: {
                add() {},
                remove() {},
                toggle() {},
                contains() { return false; }
            },
            style: {},
            dataset: {},
            querySelector() { return null; },
            querySelectorAll() { return []; },
            replaceChildren() {},
            appendChild() {},
            insertBefore() {},
            value: '',
            checked: false,
            disabled: false,
            textContent: '',
            tagName: 'DIV'
        };
    };

    const hostLabel = safeGetElementById('current-host');
    const closeButton = safeGetElementById('close-popup');
    const hostBlacklistLabel = safeGetElementById('host-blacklist-label');
    const hostBlacklistToggle = safeGetElementById('host-blacklist-toggle');
    const featureUnblockCopyEnabled = safeGetElementById('feature-unblock-copy-enabled');
    const featureGesturesEnabled = safeGetElementById('feature-gestures-enabled');
    const featureClipboardEnabled = safeGetElementById('feature-clipboard-enabled');
    const featureVideoFloatingEnabled = safeGetElementById('feature-video-floating-enabled');
    const featureVideoScreenshotEnabled = safeGetElementById('feature-video-screenshot-enabled');
    const featureQuickSearchEnabled = safeGetElementById('feature-quick-search-enabled');
    const featureInlineTranslateEnabled = safeGetElementById('feature-inline-translate-enabled');
    const featureYoutubeSubtitlesEnabled = safeGetElementById('feature-youtube-subtitles-enabled');
    const featureForumEnabled = safeGetElementById('feature-forum-enabled');
    const forumScopeLabel = safeGetElementById('forum-scope');
    const inlineTranslateHotkeyEnabled = safeGetElementById('inline-translate-hotkey-enabled');
    const inlineTranslateHotkey = safeGetElementById('inline-translate-hotkey');
    const inlineTranslateSelectionTranslateEnabled = safeGetElementById('inline-translate-selection-translate-enabled');
    const inlineTranslateSwipeEnabled = safeGetElementById('inline-translate-swipe-enabled');
    const inlineTranslateSwipeDir = safeGetElementById('inline-translate-swipe-dir');
    const inlineTranslateFontScale = safeGetElementById('inline-translate-font-scale');
    const inlineTranslateMutedColor = safeGetElementById('inline-translate-muted-color');
    const youtubeSubtitlesTargetLang = safeGetElementById('youtube-subtitles-target-lang');
    const youtubeSubtitlesFontSize = safeGetElementById('youtube-subtitles-font-size');
    const youtubeSubtitlesTranslatedFontSize = safeGetElementById('youtube-subtitles-translated-font-size');
    const youtubeSubtitlesShowOriginal = safeGetElementById('youtube-subtitles-show-original');
    const youtubeSubtitlesOriginalColor = safeGetElementById('youtube-subtitles-original-color');
    const youtubeSubtitlesTranslatedColor = safeGetElementById('youtube-subtitles-translated-color');
    const apiTranslateProvider = safeGetElementById('api-translate-provider');
    const apiTranslateFallbackEnabled = safeGetElementById('api-translate-fallback-enabled');
    const apiTranslateFallbackProvider = safeGetElementById('api-translate-fallback-provider');
    const apiTranslateApiKey = safeGetElementById('api-translate-api-key');
    const apiTranslateFallbackApiKey = safeGetElementById('api-translate-fallback-api-key');
    const apiOcrProvider = safeGetElementById('api-ocr-provider');
    const apiOcrFallbackEnabled = safeGetElementById('api-ocr-fallback-enabled');
    const apiOcrFallbackProvider = safeGetElementById('api-ocr-fallback-provider');
    const apiOcrApiKey = safeGetElementById('api-ocr-api-key');
    const apiOcrFallbackApiKey = safeGetElementById('api-ocr-fallback-api-key');
    const quickSearchColumns = safeGetElementById('quick-search-columns');
    const quickSearchImageSearchEnabled = safeGetElementById('quick-search-image-search-enabled');
    const inlineTranslateSwipePx = safeGetElementById('inline-translate-swipe-px');
    const inlineTranslateSwipeMaxDurationMs = safeGetElementById('inline-translate-swipe-max-duration-ms');
    const clipboardMaxHistory = safeGetElementById('clipboard-max-history');
    const clipboardClear = safeGetElementById('clipboard-clear');
    const videoFloatingMinDistance = safeGetElementById('video-floating-min-distance');
    const videoFloatingSwipeShort = safeGetElementById('video-floating-swipe-short');
    const videoFloatingSwipeLong = safeGetElementById('video-floating-swipe-long');
    const videoFloatingShortThreshold = safeGetElementById('video-floating-short-threshold');
    const videoFloatingVerticalTolerance = safeGetElementById('video-floating-vertical-tolerance');
    const videoFloatingDiagonalThreshold = safeGetElementById('video-floating-diagonal-threshold');
    const videoFloatingThrottle = safeGetElementById('video-floating-throttle');
    const videoFloatingNoticeFontSize = safeGetElementById('video-floating-notice-font-size');
    const forumWide = safeGetElementById('forum-wide');
    const forumMinWidth = safeGetElementById('forum-min-width');
    const forumGap = safeGetElementById('forum-gap');
    const forumFade = safeGetElementById('forum-fade');
    const forumDelay = safeGetElementById('forum-delay');
    const gLpEnabled = safeGetElementById('g-lp-enabled');
    const gLpMode = safeGetElementById('g-lp-mode');
    const gLpMs = safeGetElementById('g-lp-ms');
    const gRcEnabled = safeGetElementById('g-rc-enabled');
    const gRcMode = safeGetElementById('g-rc-mode');
    const gCloseTabEnabled = safeGetElementById('g-close-tab-enabled');
    const gCloseTabMs = safeGetElementById('g-close-tab-ms');
    const gPagerEnabled = safeGetElementById('g-pager-enabled');
    const gPagerHops = safeGetElementById('g-pager-hops');
    const gEdgeEnabled = safeGetElementById('g-edge-enabled');
    const gEdgeSide = safeGetElementById('g-edge-side');
    const gEdgeWidth = safeGetElementById('g-edge-width');
    const gEdgeSpeed = safeGetElementById('g-edge-speed');
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
        quickSearchProviderIds.map((providerId) => [providerId, safeGetElementById(`quick-search-provider-${providerId}`)])
    );
    const popupRoot = document.querySelector('.popup');
    const panelCards = Array.from(document.querySelectorAll('.card[data-panel-id]'));
    const panelHeaderTriggers = Array.from(document.querySelectorAll('[data-panel-header]'));
    const dragHandles = Array.from(document.querySelectorAll('[data-drag-handle]'));
    const backupWorkerUrl = safeGetElementById('backup-worker-url');
    const backupApiCode = safeGetElementById('backup-api-code');
    const profileMacbook = safeGetElementById('profile-macbook');
    const profileMobile = safeGetElementById('profile-mobile');
    const backupVerify = safeGetElementById('backup-verify');
    const backupPush = safeGetElementById('backup-push');
    const backupPull = safeGetElementById('backup-pull');
    const backupStatus = safeGetElementById('backup-status');
    const cloudflareSync = ext.shared.cloudflareSync;

    let activeHost = null;
    let config = null;
    let isReady = false;
    let saveTimer = 0;
    let pendingSave = null;
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

    const getOrderedPanelCards = (order) => {
        const requestedOrder = Array.isArray(order) && order.length ? order : DEFAULT_POPUP_PANEL_ORDER;
        const usedPanelIds = new Set();
        const orderedCards = requestedOrder
            .map((panelId) => panelCards.find((entry) => entry.dataset.panelId === panelId))
            .filter((card) => {
                const panelId = card?.dataset?.panelId;
                if (!panelId || usedPanelIds.has(panelId)) {
                    return false;
                }
                usedPanelIds.add(panelId);
                return true;
            });
        const missingCards = panelCards.filter((card) => !usedPanelIds.has(card.dataset.panelId));
        return [...orderedCards, ...missingCards];
    };

    const applyPanelOrder = (order) => {
        const orderedCards = getOrderedPanelCards(order);
        const currentCards = Array.from(popupRoot.querySelectorAll('.card[data-panel-id]'));
        const isAlreadyApplied = orderedCards.length === currentCards.length
            && orderedCards.every((card, index) => card === currentCards[index]);
        if (isAlreadyApplied) {
            return;
        }
        orderedCards.forEach((card) => popupRoot.appendChild(card));
    };

    fillProviderOptions(apiTranslateProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(apiTranslateFallbackProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(apiOcrProvider, OCR_PROVIDER_OPTIONS);
    fillProviderOptions(apiOcrFallbackProvider, OCR_PROVIDER_OPTIONS);

    const getActiveTab = () => new Promise((resolve) => {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    });

    const setBackupStatus = (message, type = '') => {
        if (!backupStatus) return;
        backupStatus.textContent = message;
        backupStatus.className = `section-note backup-status${type ? ` ${type}` : ''}`;
        ext.shared.storage.setLocal({
            [cloudflareSync.KEYS.status]: message,
            [cloudflareSync.KEYS.statusType]: type
        }).catch((error) => {
            console.error('[GestureExtension][popup] Failed to persist sync status', error);
        });
    };

    const loadBackupStatus = async () => {
        const result = await ext.shared.storage.getLocal([
            cloudflareSync.KEYS.status,
            cloudflareSync.KEYS.statusType
        ]);
        if (result[cloudflareSync.KEYS.status]) {
            backupStatus.textContent = result[cloudflareSync.KEYS.status];
            backupStatus.className = `section-note backup-status${result[cloudflareSync.KEYS.statusType] ? ` ${result[cloudflareSync.KEYS.statusType]}` : ''}`;
        }
    };

    const formatSyncStamp = (date = new Date()) => date.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const syncStatusSuffix = (revision) => `revision ${Number.isSafeInteger(revision) ? revision : 0} · ${formatSyncStamp()}`;

    const getSyncSettingsFromControls = () => ({
        workerUrl: backupWorkerUrl.value.trim(),
        apiCode: backupApiCode.value.trim(),
        profile: profileMobile.checked ? 'mobile' : 'macbook'
    });

    const renderSyncSettings = (settings) => {
        backupWorkerUrl.value = settings.workerUrl || cloudflareSync.DEFAULT_WORKER_URL;
        backupApiCode.value = settings.apiCode || '';
        if (settings.profile === 'mobile') {
            profileMobile.checked = true;
        } else {
            profileMacbook.checked = true;
        }
    };

    const saveSyncSettingsFromControls = async (patch = {}) => {
        const next = await cloudflareSync.saveSettings({
            ...getSyncSettingsFromControls(),
            ...patch
        });
        renderSyncSettings(next);
        return next;
    };

    const switchProfile = async (nextProfileId) => {
        if (!config || !nextProfileId) return;
        try {
            const syncSettings = await cloudflareSync.loadSettings();
            const currentProfile = syncSettings.profile;
            if (currentProfile === nextProfileId) return;
            await cloudflareSync.saveSettings({ profile: nextProfileId });

            const result = await ext.shared.storage.getLocal(['gestureSyncProfiles']);
            const profiles = result.gestureSyncProfiles || {};
            
            profiles[currentProfile] = {
                settings: {
                    schema: 1,
                    config: deepClone(config)
                }
            };
            
            const targetProfile = profiles[nextProfileId];
            let nextConfig;
            if (targetProfile?.settings?.config) {
                nextConfig = normalizeConfig(targetProfile.settings.config);
            } else {
                nextConfig = normalizeConfig(DEFAULT_CONFIG);
            }

            await ext.shared.storage.setLocal({
                gestureSyncProfile: nextProfileId,
                gestureSyncProfiles: profiles
            });

            config = await storage.saveConfig(nextConfig);
            
            const nextSyncSettings = await cloudflareSync.loadSettings();
            renderSyncSettings(nextSyncSettings);
            render();
            
            setBackupStatus(`Switched to active profile: ${nextProfileId === 'mobile' ? 'Mobile' : 'MacBook'}`);
        } catch (error) {
            console.error('[GestureExtension][popup] Failed to switch profile', error);
            setBackupStatus(`Failed to switch profile: ${error.message}`, 'err');
        }
    };

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
        inlineTranslateHotkey.value = config.inlineTranslate?.hotkey || 'ctrl+d';
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
        gCloseTabEnabled.checked = !!gestures.closeTab?.enabled;
        gCloseTabMs.value = gestures.closeTab?.ms || 150;
        gPagerEnabled.checked = !!gestures.pager.enabled;
        gPagerHops.value = gestures.pager.hops;
        gEdgeEnabled.checked = !!gestures.edgeSwipe.enabled;
        gEdgeSide.value = gestures.edgeSwipe.side;
        gEdgeWidth.value = gestures.edgeSwipe.width;
        gEdgeSpeed.value = gestures.edgeSwipe.speed;
        hostBlacklistToggle.disabled = !normalizedActiveHost;
        hostBlacklistToggle.checked = normalizedActiveHost ? isHostExcluded(config, normalizedActiveHost) : false;
        hostBlacklistLabel.textContent = normalizedActiveHost || 'No host';

        if (!activeHost) {
            hostLabel.textContent = 'No active host';
            if (forumScopeLabel) forumScopeLabel.textContent = 'Only applicable for XenForo sites. The current page has no valid host.';
            syncFeatureCards();
            return;
        }

        const forumConfig = getForumConfig(config, activeHost);
        hostLabel.textContent = activeHost;
        if (forumScopeLabel) forumScopeLabel.textContent = `Only applicable for the current XenForo site: ${activeHost}`;
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
            closeTab: {
                enabled: gCloseTabEnabled.checked,
                ms: Number(gCloseTabMs.value)
            },
            pager: {
                enabled: gPagerEnabled.checked,
                hops: Number(gPagerHops.value)
            },
            edgeSwipe: {
                enabled: gEdgeEnabled.checked,
                side: gEdgeSide.value,
                width: Number(gEdgeWidth.value),
                speed: Number(gEdgeSpeed.value)
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

    const setPanelExpanded = (trigger, expanded) => {
        const panel = document.getElementById(trigger.getAttribute('aria-controls'));
        if (!panel) return;
        const title = trigger.closest('.card')?.querySelector('.card-title span')?.textContent?.trim() || 'panel';
        trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        trigger.setAttribute('aria-label', `${expanded ? 'Close' : 'Open'} ${title} settings`);
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
            card.draggable = false;

            card.addEventListener('dragstart', (event) => {
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
                
                const nextSibling = before ? card : card.nextSibling;
                if (draggingCard.nextSibling !== nextSibling && draggingCard !== nextSibling) {
                    popupRoot.insertBefore(draggingCard, nextSibling);
                }
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('is-dragging');
                draggingCard = null;
                card.draggable = false;
                savePanelOrder();
            });
        });

        dragHandles.forEach((handle) => {
            const card = handle.closest('.card[data-panel-id]');
            if (!card) return;

            handle.addEventListener('pointerdown', () => {
                card.draggable = true;
            });

            const resetDraggable = () => {
                if (!draggingCard) {
                    card.draggable = false;
                }
            };

            handle.addEventListener('pointerup', resetDraggable);
            handle.addEventListener('pointercancel', resetDraggable);
        });
    };

    Promise.all([storage.getConfig(), getActiveTab()]).then(([loadedConfig, activeTab]) => {
        config = loadedConfig;
        activeHost = getHostFromUrl(activeTab?.url || '');
        render();
        isReady = true;
        return cloudflareSync.loadSettings();
    }).then((syncSettings) => {
        renderSyncSettings(syncSettings);
        return loadBackupStatus();
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

    panelHeaderTriggers.forEach((trigger) => {
        setPanelExpanded(trigger, trigger.getAttribute('aria-expanded') === 'true');
        trigger.addEventListener('click', (event) => {
            if (event.target.closest('input, button, select, textarea, a, label')) {
                return;
            }
            setPanelExpanded(trigger, trigger.getAttribute('aria-expanded') !== 'true');
        });
        trigger.addEventListener('keydown', (event) => {
            if (event.target !== trigger) {
                return;
            }
            if (event.key !== 'Enter' && event.key !== ' ') {
                return;
            }
            event.preventDefault();
            setPanelExpanded(trigger, trigger.getAttribute('aria-expanded') !== 'true');
        });
    });

    setupPanelReorder();

    backupWorkerUrl?.addEventListener('input', () => {
        saveSyncSettingsFromControls().catch((error) => {
            setBackupStatus(`Error saving Worker URL: ${error.message}`, 'err');
        });
    });

    backupApiCode?.addEventListener('input', () => {
        saveSyncSettingsFromControls().catch((error) => {
            setBackupStatus(`Error saving API code: ${error.message}`, 'err');
        });
    });

    profileMacbook?.addEventListener('change', () => {
        if (profileMacbook.checked) {
            switchProfile('macbook');
        }
    });

    profileMobile?.addEventListener('change', () => {
        if (profileMobile.checked) {
            switchProfile('mobile');
        }
    });

    backupVerify?.addEventListener('click', async () => {
        backupVerify.disabled = true;
        setBackupStatus('Verifying Worker connection...');
        try {
            await saveSyncSettingsFromControls();
            const result = await cloudflareSync.bootstrapProfile(getSyncSettingsFromControls());
            if (result.config) {
                config = result.config;
                render();
            }
            setBackupStatus(
                `${result.action === 'pulled' ? 'Pulled cloud profile' : 'Connected to Worker'} · ${syncStatusSuffix(result.state.revision)}`,
                'ok'
            );
        } catch (error) {
            setBackupStatus(`Connection failed: ${error.message}`, 'err');
        } finally {
            backupVerify.disabled = false;
        }
    });

    backupPush?.addEventListener('click', async () => {
        backupPush.disabled = true;
        setBackupStatus('Pushing to cloud...');
        try {
            await saveSyncSettingsFromControls();
            if (pendingSave) {
                await pendingSave;
            }
            const remote = await cloudflareSync.pushConfig(normalizeConfig(config), getSyncSettingsFromControls());
            setBackupStatus(`Push succeeded · ${syncStatusSuffix(remote.revision)}`, 'ok');
        } catch (error) {
            setBackupStatus(`Push failed: ${error.message}`, 'err');
        } finally {
            backupPush.disabled = false;
        }
    });

    backupPull?.addEventListener('click', async () => {
        backupPull.disabled = true;
        setBackupStatus('Pulling from cloud...');
        try {
            await saveSyncSettingsFromControls();
            const result = await cloudflareSync.pullConfig(getSyncSettingsFromControls());
            config = result.config;
            render();
            setBackupStatus(`Pull succeeded · ${syncStatusSuffix(result.state.revision)}`, 'ok');
        } catch (error) {
            setBackupStatus(`Pull failed: ${error.message}`, 'err');
        } finally {
            backupPull.disabled = false;
        }
    });

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
        youtubeSubtitlesShowOriginal,
        quickSearchImageSearchEnabled,
        forumWide,
        gLpEnabled,
        gLpMode,
        gRcEnabled,
        gRcMode,
        gCloseTabEnabled,
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
        gCloseTabMs,
        gPagerHops,
        gEdgeWidth,
        gEdgeSpeed
    ].forEach((control) => {
        registerAutoSave(control, 'change', { restoreWhenEmpty: true });
    });

    Object.values(quickSearchProviderInputs).forEach((control) => {
        registerAutoSave(control, 'change');
    });
})();
