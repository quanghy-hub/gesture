(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, isHostExcluded, isVideoFloatingBackgroundSeekExcluded, isGestureHostExcluded, normalizeHost } =
        ext.shared.config;
    const { setCardState, setHostControlsState } = ext.ui.popupUtils;
    const { renderFields } = ext.ui.popupFieldMap;

    const resolvePlatform = (els) => (els.gPlatform?.value === 'mobile' ? 'mobile' : 'desktop');

    // Đọc config thô của 1 platform (không merge desktop/mobile như getGestureSettings)
    const getGesturePlatformView = (config, platform) => {
        const cfg = config.gestures?.[platform];
        if (!cfg) return null;
        return {
            enabled: !!cfg.enabled,
            lpress: { enabled: !!cfg.lpress?.enabled, mode: cfg.lpress?.mode || 'bg', ms: cfg.lpress?.ms || 500 },
            rclick: { enabled: !!cfg.rclick?.enabled, mode: cfg.rclick?.mode || 'fg' },
            closeTab: { enabled: !!cfg.closeTab?.enabled, ms: cfg.closeTab?.ms || 150 },
            pager: { enabled: !!cfg.pager?.enabled, hops: cfg.pager?.hops || 3 },
            edge: {
                enabled: !!cfg.edge?.enabled,
                side: cfg.edge?.side || 'both',
                width: cfg.edge?.width || 40,
                speed: cfg.edge?.speed || 3
            }
        };
    };

    const renderGestureFields = (config, els) => {
        const view = getGesturePlatformView(config, resolvePlatform(els));
        if (!view) return;

        els.featureGesturesEnabled.checked = view.enabled;
        els.gLpEnabled.checked = view.lpress.enabled;
        els.gLpMode.value = view.lpress.mode;
        els.gLpMs.value = view.lpress.ms;
        els.gRcEnabled.checked = view.rclick.enabled;
        els.gRcMode.value = view.rclick.mode;
        els.gCloseTabEnabled.checked = view.closeTab.enabled;
        els.gCloseTabMs.value = view.closeTab.ms;
        els.gPagerEnabled.checked = view.pager.enabled;
        els.gPagerHops.value = view.pager.hops;
        els.gEdgeEnabled.checked = view.edge.enabled;
        els.gEdgeSide.value = view.edge.side;
        els.gEdgeWidth.value = view.edge.width;
        els.gEdgeSpeed.value = view.edge.speed;
    };

    const syncPlatformRows = (els) => {
        if (!els.gPlatform) return;
        const isMobile = els.gPlatform.value === 'mobile';
        els.gestureDesktopOnlyRows.forEach((row) => {
            row.hidden = isMobile;
        });
        els.gestureMobileOnlyRows.forEach((row) => {
            row.hidden = !isMobile;
        });
    };

    ext.ui.popupRender = {
        // Dùng chung cho render() và khi đổi platform selector trong popup
        renderGestures: (config, els) => {
            if (!config) return;
            if (els.gPlatform && !els.gPlatform.value) {
                els.gPlatform.value = 'desktop';
            }
            renderGestureFields(config, els);
            syncPlatformRows(els);
        },

        syncFeatureCards: (activeHost, els) => {
            const canUseForumControls = !!activeHost && els.featureForumEnabled.checked;
            setCardState(els.unblockCopyCard, els.featureUnblockCopyEnabled.checked);
            setCardState(els.gesturesCard, els.featureGesturesEnabled.checked);
            setCardState(els.videoFloatingCard, els.featureVideoFloatingEnabled.checked);
            setCardState(els.videoScreenshotCard, els.featureVideoScreenshotEnabled.checked);
            setCardState(els.quickSearchCard, els.featureQuickSearchEnabled.checked);
            setCardState(els.inlineTranslateCard, els.featureInlineTranslateEnabled.checked);
            setCardState(els.youtubeSubtitlesCard, els.featureYoutubeSubtitlesEnabled.checked);
            setCardState(els.forumCard, els.featureForumEnabled.checked);
            setHostControlsState(els.hostBoundControls, els.hostOnlyRows, canUseForumControls);
        },

        render: (config, activeHost, els, panelReorder, fieldMap, fieldMapElements) => {
            if (!config) return;

            panelReorder.applyPanelOrder(config.runtime?.popupPanelOrder);
            renderFields(fieldMap, fieldMapElements, config);

            ext.ui.popupRender.renderGestures(config, els);

            els.apiTranslateApiKey.value = config.apiServices?.translate?.providers?.[els.apiTranslateProvider.value]?.apiKey || '';
            els.apiTranslateFallbackApiKey.value =
                config.apiServices?.translate?.providers?.[els.apiTranslateFallbackProvider.value]?.apiKey || '';
            els.apiOcrApiKey.value = config.apiServices?.ocr?.providers?.[els.apiOcrProvider.value]?.apiKey || '';
            els.apiOcrFallbackApiKey.value = config.apiServices?.ocr?.providers?.[els.apiOcrFallbackProvider.value]?.apiKey || '';

            const enabledProviderIds = Array.isArray(config.quickSearch?.enabledProviderIds)
                ? config.quickSearch.enabledProviderIds
                : els.quickSearchProviderIds;
            els.quickSearchProviderIds.forEach((providerId) => {
                if (els.quickSearchProviderInputs[providerId]) {
                    els.quickSearchProviderInputs[providerId].checked = enabledProviderIds.includes(providerId);
                }
            });

            const normalizedActiveHost = normalizeHost(activeHost);
            els.videoFloatingBackgroundSeekHost.textContent = normalizedActiveHost || 'No host';
            els.videoFloatingBackgroundSeekBlocked.disabled = !normalizedActiveHost;
            els.videoFloatingBackgroundSeekBlocked.checked = normalizedActiveHost
                ? isVideoFloatingBackgroundSeekExcluded(config, normalizedActiveHost)
                : false;
            els.hostBlacklistToggle.disabled = !normalizedActiveHost;
            els.hostBlacklistToggle.checked = normalizedActiveHost ? isHostExcluded(config, normalizedActiveHost) : false;
            els.hostBlacklistLabel.textContent = normalizedActiveHost || 'No host';
            els.gestureBlockHostToggle.disabled = !normalizedActiveHost;
            els.gestureBlockHostToggle.checked = normalizedActiveHost ? isGestureHostExcluded(config, normalizedActiveHost) : false;
            els.gestureBlockHostLabel.textContent = normalizedActiveHost || 'No host';

            els.featureForumEnabled.checked = !!getForumConfig(config, activeHost).enabled;

            if (!activeHost) {
                els.hostLabel.textContent = 'No active host';
                if (els.forumScopeLabel)
                    els.forumScopeLabel.textContent = 'Only applicable for XenForo sites. The current page has no valid host.';
                ext.ui.popupRender.syncFeatureCards(activeHost, els);
                return;
            }

            const forumConfig = getForumConfig(config, activeHost);
            els.hostLabel.textContent = activeHost;
            if (els.forumScopeLabel) els.forumScopeLabel.textContent = `Only applicable for the current XenForo site: ${activeHost}`;
            els.forumWide.checked = !!forumConfig.wide;
            els.forumMinWidth.value = forumConfig.minWidth;
            els.forumGap.value = forumConfig.gap;
            els.forumFade.value = forumConfig.fadeTime;
            els.forumDelay.value = forumConfig.initDelay;
            ext.ui.popupRender.syncFeatureCards(activeHost, els);
        }
    };
})();
