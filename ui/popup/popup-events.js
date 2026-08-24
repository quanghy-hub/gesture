(() => {
    const ext = globalThis.GestureExtension;
    const { safeGetElementById } = ext.ui.popupUtils;

    ext.ui.popupEvents = {
        registerAll: (els, appState, storage) => {
            const setPanelExpanded = (trigger, expanded) => {
                const panel = document.getElementById(trigger.getAttribute('aria-controls'));
                if (!panel) return;
                const title = trigger.closest('.card')?.querySelector('.card-title span')?.textContent?.trim() || 'panel';
                trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                trigger.setAttribute('aria-label', `${expanded ? 'Close' : 'Open'} ${title} settings`);
                panel.classList.toggle('is-collapsed', !expanded);
            };

            els.closeButton.addEventListener('click', () => {
                window.close();
            });

            els.panelHeaderTriggers.forEach((trigger) => {
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

            const registerAutoSave = (control, eventName = 'change', options = {}) => {
                if (!control) return;
                control.addEventListener(eventName, () => {
                    if (options.skipWhenEmpty && control.value === '') {
                        return;
                    }
                    if (options.restoreWhenEmpty && control.value === '') {
                        appState.render();
                        return;
                    }
                    if (options.syncCards) {
                        ext.ui.popupRender.syncFeatureCards(appState.activeHost, els);
                    }
                    if (options.renderAfter) {
                        appState.render();
                    }
                    appState.scheduleAutoSave();
                });
            };

            // Feature toggle auto-save
            [
                els.featureUnblockCopyEnabled,
                els.featureGesturesEnabled,
                els.featureVideoFloatingEnabled,
                els.featureVideoScreenshotEnabled,
                els.featureQuickSearchEnabled,
                els.featureInlineTranslateEnabled,
                els.featureYoutubeSubtitlesEnabled,
                els.featureForumEnabled
            ].forEach((control) => {
                registerAutoSave(control, 'change', { syncCards: true });
            });

            // Platform selector: nạp lại giá trị gestures của platform mới chọn
            // (desktop/mobile có config độc lập), không cần lưu config.
            if (els.gPlatform) {
                els.gPlatform.addEventListener('change', () => {
                    ext.ui.popupRender.renderGestures(appState.config, els);
                    ext.ui.popupRender.syncFeatureCards(appState.activeHost, els);
                });
            }

            // Simple change auto-save
            [
                safeGetElementById('inline-translate-hotkey-enabled'),
                safeGetElementById('inline-translate-hotkey'),
                safeGetElementById('inline-translate-selection-translate-enabled'),
                safeGetElementById('inline-translate-swipe-enabled'),
                safeGetElementById('inline-translate-swipe-dir'),
                safeGetElementById('youtube-subtitles-show-original'),
                safeGetElementById('quick-search-image-search-enabled'),
                els.forumWide,
                els.gLpEnabled,
                els.gLpMode,
                els.gRcEnabled,
                els.gRcMode,
                els.gCloseTabEnabled,
                els.gEdgeEnabled,
                els.gEdgeSide,
                els.gPagerEnabled,
                els.hostBlacklistToggle,
                els.videoFloatingBackgroundSeekBlocked,
                els.gestureBlockHostToggle
            ].forEach((control) => {
                registerAutoSave(control, 'change');
            });

            // API provider select auto-save (re-render to update API key fields)
            [els.apiTranslateProvider, els.apiTranslateFallbackProvider, els.apiOcrProvider, els.apiOcrFallbackProvider].forEach(
                (control) => {
                    registerAutoSave(control, 'change', { renderAfter: true });
                }
            );

            // API fallback toggles
            [safeGetElementById('api-translate-fallback-enabled'), safeGetElementById('api-ocr-fallback-enabled')].forEach((control) => {
                registerAutoSave(control, 'change');
            });

            // Text/color inputs with input+change dual-save
            [
                safeGetElementById('inline-translate-muted-color'),
                els.apiTranslateApiKey,
                els.apiTranslateFallbackApiKey,
                els.apiOcrApiKey,
                els.apiOcrFallbackApiKey,
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
                safeGetElementById('video-floating-min-distance'),
                safeGetElementById('video-floating-swipe-short'),
                safeGetElementById('video-floating-swipe-long'),
                safeGetElementById('video-floating-short-threshold'),
                safeGetElementById('video-floating-vertical-tolerance'),
                safeGetElementById('video-floating-diagonal-threshold'),
                safeGetElementById('video-floating-throttle'),
                safeGetElementById('video-floating-notice-font-size'),
                els.forumMinWidth,
                els.forumGap,
                els.forumFade,
                els.forumDelay,
                els.gLpMs,
                els.gCloseTabMs,
                els.gPagerHops,
                els.gEdgeWidth,
                els.gEdgeSpeed
            ].forEach((control) => {
                registerAutoSave(control, 'change', { restoreWhenEmpty: true });
            });

            // Quick search provider checkboxes
            Object.values(els.quickSearchProviderInputs).forEach((control) => {
                registerAutoSave(control, 'change');
            });
        }
    };
})();
