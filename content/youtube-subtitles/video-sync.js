(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createVideoSync = (deps) => {
        const { state, releaseCaptionTrack, renderCurrentCaption } = deps;

        const createCaptionObserver = (onChange) => {
            let mutationObserver = null;
            return {
                start() {
                    if (mutationObserver) {
                        return;
                    }
                    mutationObserver = new MutationObserver(() => onChange());
                    const target = document.querySelector('#movie_player, .html5-video-player') || document.body;
                    mutationObserver.observe(target, {
                        childList: true,
                        subtree: true,
                        attributes: true,
                        attributeFilter: ['aria-pressed', 'class'],
                        characterData: true
                    });
                },
                stop() {
                    mutationObserver?.disconnect();
                    mutationObserver = null;
                }
            };
        };

        const bindVideoSync = (video) => {
            if (!video) {
                return;
            }
            const isSameVideo = state.video === video && state.videoSyncHandler;
            if (isSameVideo) {
                return;
            }
            if (state.video && state.videoSyncHandler) {
                state.video.removeEventListener('timeupdate', state.videoSyncHandler);
                state.video.removeEventListener('seeked', state.videoSyncHandler);
                state.video.removeEventListener('loadedmetadata', state.videoSyncHandler);
            }
            state.detachTrackListener?.();
            state.detachTrackListener = null;
            releaseCaptionTrack();
            state.video = video;
            state.videoSyncHandler = () => {
                if (state.enabled) {
                    renderCurrentCaption().catch(() => {});
                }
            };
            video.addEventListener('timeupdate', state.videoSyncHandler);
            video.addEventListener('seeked', state.videoSyncHandler);
            video.addEventListener('loadedmetadata', state.videoSyncHandler);
            state.detachTrackListener = youtubeSubtitles.captionSource.bindTrackCueChange(video, state.videoSyncHandler);
        };

        return {
            createCaptionObserver,
            bindVideoSync
        };
    };
})();
