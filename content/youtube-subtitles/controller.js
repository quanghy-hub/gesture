(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createController = ({ getConfig, storage }) => {
        let settings = getConfig().youtubeSubtitles;
        const state = {
            enabled: false,
            lastSource: '',
            lastRenderedSource: '',
            consumedWordCount: 0,
            renderGeneration: 0,
            mounted: false,
            pageEventsBound: false,
            video: null,
            detachTrackListener: null,
            videoSyncHandler: null,
            navigateTimer: 0,
            locationPollTimer: 0
        };

        const invalidatePendingRender = () => {
            state.renderGeneration += 1;
        };

        const persistSettings = async (partial) => {
            settings = {
                ...settings,
                ...partial,
                containerPosition: {
                    ...settings.containerPosition,
                    ...(partial.containerPosition ?? {})
                }
            };
            const nextConfig = await storage.updateConfig((draft) => {
                draft.youtubeSubtitles = {
                    ...draft.youtubeSubtitles,
                    ...partial,
                    containerPosition: {
                        ...draft.youtubeSubtitles.containerPosition,
                        ...(partial.containerPosition ?? {})
                    }
                };
                return draft;
            });
            settings = nextConfig.youtubeSubtitles;
            youtubeSubtitles.dom.applySettingsStyles(settings);
        };

        // Guard: mọi lỗi khởi tạo TTS không được phép làm chết pipeline phụ đề
        let speaker = null;
        try {
            speaker = youtubeSubtitles.createSpeaker({ settings: () => settings });
        } catch (error) {
            console.warn('[gesture][tts] speaker init failed:', String(error?.message || error));
        }

        const captionManager = youtubeSubtitles.createCaptionManager({
            state,
            settings: () => settings,
            persistSettings,
            invalidatePendingRender,
            speaker
        });

        const prefetcher = youtubeSubtitles.createPrefetcher({
            state,
            settings: () => settings,
            translator: youtubeSubtitles.translator,
            // Bản dịch live đang chờ → prefetch nhường đường, không khởi request mới.
            shouldDefer: () => !!state.liveTranslatePending
        });

        const videoSync = youtubeSubtitles.createVideoSync({
            state,
            renderCurrentCaption: captionManager.renderCurrentCaption,
            onVideoEvent(event) {
                const type = event?.type;
                // Tua/đổi video/track mới nạp: quét lại ngay không throttle.
                // 'change' chỉ throttle thường — tránh khuếch đại nếu mode track
                // bị flap liên tục.
                const force = type === 'seeked' || type === 'loadedmetadata' || type === 'addtrack';
                prefetcher.pump({ force });
            },
            onSeekReset() {
                // Vô hiệu hóa mọi bản dịch đang bay của vị trí cũ + xóa state
                // chunking để caption tại vị trí mới được render lại từ đầu.
                invalidatePendingRender();
                captionManager.resetCaptionState();
                // Tua video → im TTS ngay, hàng đợi đọc theo vị trí mới.
                speaker.cancel();
            }
        });

        const stopTranslationMode = () => {
            observer?.stop();
            state.enabled = false;
            prefetcher.reset();
            speaker.cancel();
            captionManager.resetCaptionState();
            invalidatePendingRender();
            state.detachTrackListener?.();
            state.detachTrackListener = null;
            if (state.video && state.videoSyncHandler) {
                state.video.removeEventListener('timeupdate', state.videoSyncHandler);
                state.video.removeEventListener('seeked', state.videoSyncHandler);
                state.video.removeEventListener('loadedmetadata', state.videoSyncHandler);
            }
            state.video = null;
            state.videoSyncHandler = null;
            youtubeSubtitles.dom.removeSubtitleContainer();
            youtubeSubtitles.dom.setPlayerTranslating(false);
            youtubeSubtitles.dom.setTranslateButtonState(false);
        };

        const startTranslationMode = () => {
            const video = captionManager.getCurrentVideo();
            if (!video) {
                return false;
            }
            state.enabled = true;
            observer?.start();
            videoSync.bindVideoSync(video);
            youtubeSubtitles.dom.setTranslateButtonState(true);
            captionManager.renderCurrentCaption().catch(() => {});
            // Track/cues nạp bất đồng bộ sau khi bật: quét prefetch sớm thêm
            // một nhịp nữa để dịch được trước đoạn sắp phát.
            window.setTimeout(() => {
                if (state.enabled) {
                    prefetcher.pump({ force: true });
                }
            }, 1200);
            return true;
        };

        const toggleTranslationMode = () => {
            if (state.enabled) {
                stopTranslationMode();
                persistSettings({ enabled: false }).catch(() => {});
                return;
            }
            startTranslationMode();
            persistSettings({ enabled: true }).catch(() => {});
        };

        const pageEvents = youtubeSubtitles.createPageEvents({
            state,
            settings: () => settings,
            toggleTranslationMode,
            stopTranslationMode,
            startTranslationMode
        });

        youtubeSubtitles.dom.ensureStyles();
        const observer = videoSync.createCaptionObserver(() => {
            if (state.enabled) {
                captionManager.renderCurrentCaption().catch(() => {});
            }
        });
        pageEvents.bindPageEvents();

        return {
            state,
            settings: () => settings,
            startTranslationMode,
            stopTranslationMode,
            toggleTranslationMode,
            renderCurrentCaption: captionManager.renderCurrentCaption,
            bindVideoSync: videoSync.bindVideoSync,
            persistSettings,
            onConfigChange(nextConfig) {
                settings = nextConfig.youtubeSubtitles;
                youtubeSubtitles.dom.applySettingsStyles(settings);
                if (!settings.enabled && state.enabled) {
                    stopTranslationMode();
                }
            },
            destroy() {
                stopTranslationMode();
                observer?.stop();
                pageEvents.destroy();
            }
        };
    };
})();
