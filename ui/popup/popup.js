(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, updateForumHostConfig, getGestureSettings, applyGestureSettings, isHostExcluded, setHostExcluded, isVideoFloatingBackgroundSeekExcluded, setVideoFloatingBackgroundSeekExcluded, isGestureHostExcluded, setGestureHostExcluded, normalizeHost, deepClone } = ext.shared.config;
    const { TRANSLATE_PROVIDER_OPTIONS, OCR_PROVIDER_OPTIONS } = ext.shared.apiServices;
    const storage = ext.shared.storage;
    const { safeGetElementById, fillProviderOptions, getHostFromUrl, setCardState, setHostControlsState } = ext.ui.popupUtils;
    const { FIELD_MAP, renderFields, collectFields, applyPatches } = ext.ui.popupFieldMap;
    const { initSyncPanel } = ext.ui.popupSyncPanel;
    const { initPanelReorder } = ext.ui.popupPanelReorder;

    // ── Element lookups ──
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
    const apiTranslateProvider = safeGetElementById('api-translate-provider');
    const apiTranslateFallbackProvider = safeGetElementById('api-translate-fallback-provider');
    const apiTranslateApiKey = safeGetElementById('api-translate-api-key');
    const apiTranslateFallbackApiKey = safeGetElementById('api-translate-fallback-api-key');
    const apiOcrProvider = safeGetElementById('api-ocr-provider');
    const apiOcrFallbackProvider = safeGetElementById('api-ocr-fallback-provider');
    const apiOcrApiKey = safeGetElementById('api-ocr-api-key');
    const apiOcrFallbackApiKey = safeGetElementById('api-ocr-fallback-api-key');
    const videoFloatingBackgroundSeekHost = safeGetElementById('video-floating-background-seek-host');
    const videoFloatingBackgroundSeekBlocked = safeGetElementById('video-floating-background-seek-blocked');
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
    const clipboardClear = safeGetElementById('clipboard-clear');
    const gestureBlockHostToggle = safeGetElementById('gesture-block-host-toggle');
    const gestureBlockHostLabel = safeGetElementById('gesture-block-host-label');
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

    // Build elements lookup for field map
    const fieldMapElements = Object.fromEntries(
        FIELD_MAP.map((f) => [f.elementId, safeGetElementById(f.elementId)])
    );

    // ── State ──
    let activeHost = null;
    let config = null;
    let isReady = false;
    let saveTimer = 0;
    let pendingSave = null;

    // ── Fill provider select options ──
    fillProviderOptions(apiTranslateProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(apiTranslateFallbackProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(apiOcrProvider, OCR_PROVIDER_OPTIONS);
    fillProviderOptions(apiOcrFallbackProvider, OCR_PROVIDER_OPTIONS);

    // ── Init submodules ──
    const panelReorder = initPanelReorder({
        popupRoot, panelCards, dragHandles,
        getConfig: () => config,
        scheduleAutoSave: () => scheduleAutoSave()
    });

    const syncPanel = initSyncPanel({
        getConfig: () => config,
        setConfig: (c) => { config = c; },
        render: () => render(),
        getPendingSave: () => pendingSave
    });

    // ── Feature card sync ──
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
        setHostControlsState(hostBoundControls, hostOnlyRows, canUseForumControls);
    };

    // ── Render ──
    const render = () => {
        if (!config) return;

        panelReorder.applyPanelOrder(config.runtime?.popupPanelOrder);

        // Declarative fields
        renderFields(FIELD_MAP, fieldMapElements, config);

        // Complex fields: gestures (read from getGestureSettings)
        const gestures = getGestureSettings(config);
        featureGesturesEnabled.checked = !!gestures.enabled;
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

        // Complex fields: API provider keys (depend on currently selected provider)
        apiTranslateApiKey.value = config.apiServices?.translate?.providers?.[apiTranslateProvider.value]?.apiKey || '';
        apiTranslateFallbackApiKey.value = config.apiServices?.translate?.providers?.[apiTranslateFallbackProvider.value]?.apiKey || '';
        apiOcrApiKey.value = config.apiServices?.ocr?.providers?.[apiOcrProvider.value]?.apiKey || '';
        apiOcrFallbackApiKey.value = config.apiServices?.ocr?.providers?.[apiOcrFallbackProvider.value]?.apiKey || '';

        // Complex fields: quick search providers
        const enabledProviderIds = Array.isArray(config.quickSearch?.enabledProviderIds) ? config.quickSearch.enabledProviderIds : quickSearchProviderIds;
        quickSearchProviderIds.forEach((providerId) => {
            if (quickSearchProviderInputs[providerId]) {
                quickSearchProviderInputs[providerId].checked = enabledProviderIds.includes(providerId);
            }
        });

        // Complex fields: host-scoped
        const normalizedActiveHost = normalizeHost(activeHost);
        videoFloatingBackgroundSeekHost.textContent = normalizedActiveHost || 'No host';
        videoFloatingBackgroundSeekBlocked.disabled = !normalizedActiveHost;
        videoFloatingBackgroundSeekBlocked.checked = normalizedActiveHost
            ? isVideoFloatingBackgroundSeekExcluded(config, normalizedActiveHost)
            : false;
        hostBlacklistToggle.disabled = !normalizedActiveHost;
        hostBlacklistToggle.checked = normalizedActiveHost ? isHostExcluded(config, normalizedActiveHost) : false;
        hostBlacklistLabel.textContent = normalizedActiveHost || 'No host';
        gestureBlockHostToggle.disabled = !normalizedActiveHost;
        gestureBlockHostToggle.checked = normalizedActiveHost ? isGestureHostExcluded(config, normalizedActiveHost) : false;
        gestureBlockHostLabel.textContent = normalizedActiveHost || 'No host';

        // Complex fields: forum (host-scoped)
        featureForumEnabled.checked = !!getForumConfig(config, activeHost).enabled;

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

    // ── Save ──
    const save = async () => {
        if (!config) return;

        const next = applyGestureSettings(deepClone(config), {
            enabled: featureGesturesEnabled.checked,
            longPress: { enabled: gLpEnabled.checked, mode: gLpMode.value, ms: Number(gLpMs.value) },
            rightClick: { enabled: gRcEnabled.checked, mode: gRcMode.value },
            closeTab: { enabled: gCloseTabEnabled.checked, ms: Number(gCloseTabMs.value) },
            pager: { enabled: gPagerEnabled.checked, hops: Number(gPagerHops.value) },
            edgeSwipe: { enabled: gEdgeEnabled.checked, side: gEdgeSide.value, width: Number(gEdgeWidth.value), speed: Number(gEdgeSpeed.value) }
        });
        let nextScoped = activeHost ? setHostExcluded(next, activeHost, hostBlacklistToggle.checked) : next;
        nextScoped = activeHost
            ? setGestureHostExcluded(nextScoped, activeHost, gestureBlockHostToggle.checked)
            : nextScoped;
        nextScoped = activeHost
            ? setVideoFloatingBackgroundSeekExcluded(nextScoped, activeHost, videoFloatingBackgroundSeekBlocked.checked)
            : nextScoped;

        // Apply declarative field patches
        const patches = collectFields(FIELD_MAP, fieldMapElements);
        applyPatches(nextScoped, patches);

        // Complex save: API provider keys
        nextScoped.apiServices.translate.providers[apiTranslateProvider.value].enabled = true;
        nextScoped.apiServices.translate.providers[apiTranslateProvider.value].apiKey = apiTranslateApiKey.value.trim();
        if (nextScoped.apiServices.translate.providers[apiTranslateFallbackProvider.value]) {
            nextScoped.apiServices.translate.providers[apiTranslateFallbackProvider.value].enabled = true;
            nextScoped.apiServices.translate.providers[apiTranslateFallbackProvider.value].apiKey = apiTranslateFallbackApiKey.value.trim();
        }
        nextScoped.apiServices.ocr.providers[apiOcrProvider.value].enabled = true;
        nextScoped.apiServices.ocr.providers[apiOcrProvider.value].apiKey = apiOcrApiKey.value.trim();
        if (nextScoped.apiServices.ocr.providers[apiOcrFallbackProvider.value]) {
            nextScoped.apiServices.ocr.providers[apiOcrFallbackProvider.value].enabled = true;
            nextScoped.apiServices.ocr.providers[apiOcrFallbackProvider.value].apiKey = apiOcrFallbackApiKey.value.trim();
        }
        nextScoped.inlineTranslate.provider = nextScoped.apiServices.translate.activeProvider;

        // Complex save: quick search providers
        nextScoped.googleSearch.enabled = nextScoped.googleSearch?.enabled !== false;
        nextScoped.quickSearch.enabledProviderIds = quickSearchProviderIds.filter((providerId) => quickSearchProviderInputs[providerId]?.checked);

        // Complex save: forum (host-scoped)
        let normalized = nextScoped;
        if (activeHost) {
            normalized = updateForumHostConfig(nextScoped, activeHost, {
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
            runSave().catch(() => {
                // runSave already reports the failure.
            });
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

    // ── Init ──
    const getActiveTab = () => new Promise((resolve) => {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    });

    Promise.all([storage.getConfig(), getActiveTab()]).then(([loadedConfig, activeTab]) => {
        config = loadedConfig;
        activeHost = getHostFromUrl(activeTab?.url || '');
        render();
        isReady = true;
        return ext.shared.cloudflareSync.loadSettings();
    }).then((syncSettings) => {
        syncPanel.renderSyncSettings(syncSettings);
        return syncPanel.loadBackupStatus();
    }).catch((error) => {
        console.error('[GestureExtension][popup] init failed', error);
    });

    // ── Event registration ──
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

    // Feature toggle auto-save
    [
        featureUnblockCopyEnabled, featureGesturesEnabled, featureClipboardEnabled,
        featureVideoFloatingEnabled, featureVideoScreenshotEnabled, featureQuickSearchEnabled,
        featureInlineTranslateEnabled, featureYoutubeSubtitlesEnabled, featureForumEnabled
    ].forEach((control) => {
        registerAutoSave(control, 'change', { syncCards: true });
    });

    // Simple change auto-save
    [
        safeGetElementById('inline-translate-hotkey-enabled'),
        safeGetElementById('inline-translate-hotkey'),
        safeGetElementById('inline-translate-selection-translate-enabled'),
        safeGetElementById('inline-translate-swipe-enabled'),
        safeGetElementById('inline-translate-swipe-dir'),
        safeGetElementById('youtube-subtitles-show-original'),
        safeGetElementById('quick-search-image-search-enabled'),
        forumWide,
        gLpEnabled, gLpMode, gRcEnabled, gRcMode, gCloseTabEnabled,
        gEdgeEnabled, gEdgeSide, gPagerEnabled,
        hostBlacklistToggle, videoFloatingBackgroundSeekBlocked, gestureBlockHostToggle
    ].forEach((control) => {
        registerAutoSave(control, 'change');
    });

    // API provider select auto-save (re-render to update API key fields)
    [apiTranslateProvider, apiTranslateFallbackProvider, apiOcrProvider, apiOcrFallbackProvider].forEach((control) => {
        registerAutoSave(control, 'change', { renderAfter: true });
    });

    // API fallback toggles
    [safeGetElementById('api-translate-fallback-enabled'), safeGetElementById('api-ocr-fallback-enabled')].forEach((control) => {
        registerAutoSave(control, 'change');
    });

    // Text/color inputs with input+change dual-save
    [
        safeGetElementById('inline-translate-muted-color'),
        apiTranslateApiKey, apiTranslateFallbackApiKey,
        apiOcrApiKey, apiOcrFallbackApiKey,
        safeGetElementById('youtube-subtitles-target-lang'),
        safeGetElementById('youtube-subtitles-original-color'),
        safeGetElementById('youtube-subtitles-translated-color')
    ].forEach((control) => {
        registerAutoSave(control, 'input', { skipWhenEmpty: false });
        registerAutoSave(control, 'change', { restoreWhenEmpty: true });
    });

    // Number inputs with restore-on-empty
    [
        safeGetElementById('inline-translate-swipe-px'),
        safeGetElementById('inline-translate-swipe-max-duration-ms'),
        safeGetElementById('inline-translate-font-scale'),
        safeGetElementById('youtube-subtitles-font-size'),
        safeGetElementById('youtube-subtitles-translated-font-size'),
        safeGetElementById('quick-search-columns'),
        safeGetElementById('clipboard-max-history'),
        safeGetElementById('video-floating-min-distance'),
        safeGetElementById('video-floating-swipe-short'),
        safeGetElementById('video-floating-swipe-long'),
        safeGetElementById('video-floating-short-threshold'),
        safeGetElementById('video-floating-vertical-tolerance'),
        safeGetElementById('video-floating-diagonal-threshold'),
        safeGetElementById('video-floating-throttle'),
        safeGetElementById('video-floating-notice-font-size'),
        forumMinWidth, forumGap, forumFade, forumDelay,
        gLpMs, gCloseTabMs, gPagerHops, gEdgeWidth, gEdgeSpeed
    ].forEach((control) => {
        registerAutoSave(control, 'change', { restoreWhenEmpty: true });
    });

    // Quick search provider checkboxes
    Object.values(quickSearchProviderInputs).forEach((control) => {
        registerAutoSave(control, 'change');
    });
})();
