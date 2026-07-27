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
            captionTrack: null,
            detachTrackListener: null,
            videoSyncHandler: null,
            navigateTimer: 0,
            locationPollTimer: 0
        };

        const releaseCaptionTrack = () => {
            state.captionTrack = null;
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

        const captionManager = youtubeSubtitles.createCaptionManager({
            state,
            settings: () => settings,
            persistSettings,
            invalidatePendingRender,
            releaseCaptionTrack
        });

        const videoSync = youtubeSubtitles.createVideoSync({
            state,
            releaseCaptionTrack,
            renderCurrentCaption: captionManager.renderCurrentCaption
        });

        const stopTranslationMode = () => {
            observer?.stop();
            state.enabled = false;
            captionManager.resetCaptionState();
            invalidatePendingRender();
            state.detachTrackListener?.();
            state.detachTrackListener = null;
            releaseCaptionTrack();
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
