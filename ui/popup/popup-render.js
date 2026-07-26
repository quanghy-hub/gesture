(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, getGestureSettings, isHostExcluded, isVideoFloatingBackgroundSeekExcluded, isGestureHostExcluded, normalizeHost } = ext.shared.config;
    const { setCardState, setHostControlsState } = ext.ui.popupUtils;
    const { renderFields } = ext.ui.popupFieldMap;

    ext.ui.popupRender = {
        syncFeatureCards: (activeHost, els) => {
            const canUseForumControls = !!activeHost && els.featureForumEnabled.checked;
            setCardState(els.unblockCopyCard, els.featureUnblockCopyEnabled.checked);
            setCardState(els.gesturesCard, els.featureGesturesEnabled.checked);
            setCardState(els.clipboardCard, els.featureClipboardEnabled.checked);
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

            const gestures = getGestureSettings(config);
            els.featureGesturesEnabled.checked = !!gestures.enabled;
            els.gLpEnabled.checked = !!gestures.longPress.enabled;
            els.gLpMode.value = gestures.longPress.mode;
            els.gLpMs.value = gestures.longPress.ms;
            els.gRcEnabled.checked = !!gestures.rightClick.enabled;
            els.gRcMode.value = gestures.rightClick.mode;
            els.gCloseTabEnabled.checked = !!gestures.closeTab?.enabled;
            els.gCloseTabMs.value = gestures.closeTab?.ms || 150;
            els.gPagerEnabled.checked = !!gestures.pager.enabled;
            els.gPagerHops.value = gestures.pager.hops;
            els.gEdgeEnabled.checked = !!gestures.edgeSwipe.enabled;
            els.gEdgeSide.value = gestures.edgeSwipe.side;
            els.gEdgeWidth.value = gestures.edgeSwipe.width;
            els.gEdgeSpeed.value = gestures.edgeSwipe.speed;

            els.apiTranslateApiKey.value = config.apiServices?.translate?.providers?.[els.apiTranslateProvider.value]?.apiKey || '';
            els.apiTranslateFallbackApiKey.value = config.apiServices?.translate?.providers?.[els.apiTranslateFallbackProvider.value]?.apiKey || '';
            els.apiOcrApiKey.value = config.apiServices?.ocr?.providers?.[els.apiOcrProvider.value]?.apiKey || '';
            els.apiOcrFallbackApiKey.value = config.apiServices?.ocr?.providers?.[els.apiOcrFallbackProvider.value]?.apiKey || '';

            const enabledProviderIds = Array.isArray(config.quickSearch?.enabledProviderIds) ? config.quickSearch.enabledProviderIds : els.quickSearchProviderIds;
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
                if (els.forumScopeLabel) els.forumScopeLabel.textContent = 'Only applicable for XenForo sites. The current page has no valid host.';
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
