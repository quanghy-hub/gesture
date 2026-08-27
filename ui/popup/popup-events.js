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

            // YouTube subtitles TTS: toggle + tốc độ đọc
            registerAutoSave(els.featureYoutubeSubtitlesTts, 'change');
            registerAutoSave(els.youtubeSubtitlesTtsRate, 'change');
            registerAutoSave(els.youtubeSubtitlesTtsEngine, 'change');
            registerAutoSave(els.youtubeSubtitlesTtsVoice, 'change');

            // Danh sách giọng hệ thống (engine 'os') — populate động vì Chrome
            // trả voices bất đồng bộ; lọc giọng tiếng Việt trước nếu có.
            const voiceSelect = els.youtubeSubtitlesTtsVoice;
            const refreshVoiceOptions = () => {
                if (!voiceSelect) return;
                try {
                    const all = window.speechSynthesis?.getVoices?.() || [];
                    const viVoices = all.filter((candidate) => /^vi/i.test(candidate.lang || ''));
                    const list = viVoices.length ? viVoices : all;
                    voiceSelect.innerHTML = '';
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = 'Mặc định';
                    voiceSelect.appendChild(defaultOption);
                    list.forEach((candidate) => {
                        const option = document.createElement('option');
                        option.value = candidate.name;
                        option.textContent = `${candidate.name} (${candidate.lang})`;
                        voiceSelect.appendChild(option);
                    });
                    ext.shared.storage
                        .getConfig()
                        .then((config) => {
                            const wanted = String(config?.youtubeSubtitles?.ttsVoiceName || '');
                            if (wanted && [...voiceSelect.options].some((option) => option.value === wanted)) {
                                voiceSelect.value = wanted;
                            }
                        })
                        .catch(() => {});
                } catch {
                    // Bỏ qua — speechSynthesis có thể không khả dụng.
                }
            };
            refreshVoiceOptions();
            try {
                window.speechSynthesis?.addEventListener?.('voiceschanged', refreshVoiceOptions);
            } catch {
                // Bỏ qua.
            }

            // ---- TTS offline (VITS vi trong offscreen) ----
            const setTtsOfflineUi = (info) => {
                const statusEl = els.ttsOfflineStatus;
                if (!statusEl) return;
                const data = info || {};
                const downloading = data.status === 'downloading';
                statusEl.textContent = downloading
                    ? `Đang tải ${data.progress ?? 0}%: ${data.label || ''}`
                    : data.error
                      ? `Lỗi: ${data.error}`
                      : data.installed
                        ? '✅ Giọng offline sẵn sàng'
                        : 'Chưa tải giọng offline';
                if (els.ttsOfflineDownloadBtn) els.ttsOfflineDownloadBtn.disabled = downloading;
                if (els.ttsOfflineRemoveBtn) els.ttsOfflineRemoveBtn.disabled = downloading || !data.installed;
            };
            const refreshTtsOfflineStatus = () => {
                ext.shared.messaging
                    .sendRuntimeMessage('gesture-ext/tts-status', {}, { unwrapResult: true })
                    .then((result) => setTtsOfflineUi(result && result.status))
                    .catch(() => {});
            };
            if (els.ttsOfflineDownloadBtn) {
                els.ttsOfflineDownloadBtn.addEventListener('click', () => {
                    ext.shared.messaging
                        .sendRuntimeMessage('gesture-ext/tts-download', {})
                        .then(refreshTtsOfflineStatus)
                        .catch(() => {});
                });
            }
            if (els.ttsOfflineRemoveBtn) {
                els.ttsOfflineRemoveBtn.addEventListener('click', () => {
                    ext.shared.messaging
                        .sendRuntimeMessage('gesture-ext/tts-remove', {})
                        .then(refreshTtsOfflineStatus)
                        .catch(() => {});
                });
            }
            chrome.runtime.onMessage.addListener((message) => {
                if (message && (message.type === 'gesture-ext/tts-offline-state' || message.type === 'gesture-ext/tts-state')) {
                    setTtsOfflineUi(message.payload);
                }
                return undefined;
            });
            refreshTtsOfflineStatus();

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

            // ---- Offline translation (Bergamot): trạng thái + tải/xoá model ----
            const setOfflineUi = (status) => {
                const statusEl = els.offlineTranslateStatus;
                if (!statusEl) return;
                const info = status || {};
                const downloading = info.status === 'downloading';
                statusEl.textContent = downloading
                    ? `Đang tải ${info.step}/${info.totalSteps}: ${info.label || ''}`
                    : info.error
                      ? `Lỗi: ${info.error}`
                      : info.installed
                        ? '✅ Model sẵn sàng — dịch en→vi không cần mạng'
                        : 'Chưa có model. Bật toggle và bấm Tải model.';
                if (els.offlineDownloadBtn) els.offlineDownloadBtn.disabled = downloading;
                if (els.offlineRemoveBtn) els.offlineRemoveBtn.disabled = downloading || !info.installed;
            };
            const refreshOfflineStatus = () => {
                ext.shared.messaging
                    .sendRuntimeMessage('gesture-ext/offline-status', {}, { unwrapResult: true })
                    .then((result) => setOfflineUi(result && result.status))
                    .catch(() => {});
            };
            if (els.offlineDownloadBtn) {
                els.offlineDownloadBtn.addEventListener('click', () => {
                    ext.shared.messaging
                        .sendRuntimeMessage('gesture-ext/offline-download', {})
                        .then(refreshOfflineStatus)
                        .catch(() => {});
                });
            }
            if (els.offlineRemoveBtn) {
                els.offlineRemoveBtn.addEventListener('click', () => {
                    ext.shared.messaging
                        .sendRuntimeMessage('gesture-ext/offline-remove', {})
                        .then(refreshOfflineStatus)
                        .catch(() => {});
                });
            }
            chrome.runtime.onMessage.addListener((message) => {
                if (message && message.type === 'gesture-ext/offline-state') {
                    setOfflineUi(message.payload);
                }
                return undefined;
            });
            refreshOfflineStatus();
        }
    };
})();
