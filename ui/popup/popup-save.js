(() => {
    const ext = globalThis.GestureExtension;
    const {
        updateForumHostConfig,
        applyGestureSettings,
        setHostExcluded,
        setVideoFloatingBackgroundSeekExcluded,
        setGestureHostExcluded,
        deepClone
    } = ext.shared.config;
    const { collectFields, applyPatches } = ext.ui.popupFieldMap;

    ext.ui.popupSave = {
        save: async (config, activeHost, els, storage, fieldMap, fieldMapElements) => {
            if (!config) return config;

            const next = applyGestureSettings(deepClone(config), {
                enabled: els.featureGesturesEnabled.checked,
                longPress: { enabled: els.gLpEnabled.checked, mode: els.gLpMode.value, ms: Number(els.gLpMs.value) },
                rightClick: { enabled: els.gRcEnabled.checked, mode: els.gRcMode.value },
                closeTab: { enabled: els.gCloseTabEnabled.checked, ms: Number(els.gCloseTabMs.value) },
                pager: { enabled: els.gPagerEnabled.checked, hops: Number(els.gPagerHops.value) },
                edgeSwipe: {
                    enabled: els.gEdgeEnabled.checked,
                    side: els.gEdgeSide.value,
                    width: Number(els.gEdgeWidth.value),
                    speed: Number(els.gEdgeSpeed.value)
                }
            });
            let nextScoped = activeHost ? setHostExcluded(next, activeHost, els.hostBlacklistToggle.checked) : next;
            nextScoped = activeHost ? setGestureHostExcluded(nextScoped, activeHost, els.gestureBlockHostToggle.checked) : nextScoped;
            nextScoped = activeHost
                ? setVideoFloatingBackgroundSeekExcluded(nextScoped, activeHost, els.videoFloatingBackgroundSeekBlocked.checked)
                : nextScoped;

            const patches = collectFields(fieldMap, fieldMapElements);
            applyPatches(nextScoped, patches);

            nextScoped.apiServices.translate.providers[els.apiTranslateProvider.value].enabled = true;
            nextScoped.apiServices.translate.providers[els.apiTranslateProvider.value].apiKey = els.apiTranslateApiKey.value.trim();
            if (nextScoped.apiServices.translate.providers[els.apiTranslateFallbackProvider.value]) {
                nextScoped.apiServices.translate.providers[els.apiTranslateFallbackProvider.value].enabled = true;
                nextScoped.apiServices.translate.providers[els.apiTranslateFallbackProvider.value].apiKey =
                    els.apiTranslateFallbackApiKey.value.trim();
            }
            nextScoped.apiServices.ocr.providers[els.apiOcrProvider.value].enabled = true;
            nextScoped.apiServices.ocr.providers[els.apiOcrProvider.value].apiKey = els.apiOcrApiKey.value.trim();
            if (nextScoped.apiServices.ocr.providers[els.apiOcrFallbackProvider.value]) {
                nextScoped.apiServices.ocr.providers[els.apiOcrFallbackProvider.value].enabled = true;
                nextScoped.apiServices.ocr.providers[els.apiOcrFallbackProvider.value].apiKey = els.apiOcrFallbackApiKey.value.trim();
            }
            nextScoped.inlineTranslate.provider = nextScoped.apiServices.translate.activeProvider;

            nextScoped.googleSearch.enabled = nextScoped.googleSearch?.enabled !== false;
            nextScoped.quickSearch.enabledProviderIds = els.quickSearchProviderIds.filter(
                (providerId) => els.quickSearchProviderInputs[providerId]?.checked
            );

            let normalized = nextScoped;
            if (activeHost) {
                normalized = updateForumHostConfig(nextScoped, activeHost, {
                    enabled: els.featureForumEnabled.checked,
                    wide: els.forumWide.checked,
                    minWidth: Number(els.forumMinWidth.value),
                    gap: Number(els.forumGap.value),
                    fadeTime: Number(els.forumFade.value),
                    initDelay: Number(els.forumDelay.value)
                });
            }

            return await storage.saveConfig(normalized);
        }
    };
})();
