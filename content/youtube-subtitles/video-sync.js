(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createVideoSync = (deps) => {
        const { state, releaseCaptionTrack, renderCurrentCaption, onSeekReset } = deps;

        const createCaptionObserver = (onChange) => {
            let mutationObserver = null;
            let debounceTimer = 0;
            // Gom nhiều mutation phát trong một nhịp trước khi render lại,
            // tránh pipeline dịch chạy hàng chục lần/giây khi player tự mutation.
            const scheduleOnChange = () => {
                window.clearTimeout(debounceTimer);
                debounceTimer = window.setTimeout(() => onChange(), youtubeSubtitles.CAPTION_MUTATION_DEBOUNCE_MS || 100);
            };
            return {
                start() {
                    if (mutationObserver) {
                        return;
                    }
                    mutationObserver = new MutationObserver(scheduleOnChange);
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
                    window.clearTimeout(debounceTimer);
                    debounceTimer = 0;
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
            // `seeked`/`loadedmetadata` báo hiệu vị trí phát nhảy đột ngột: cần
            // reset caption state + vô hiệu hóa bản dịch đang bay trước khi render,
            // nếu không phụ đề sẽ đứng yên ở text cũ (dedupe source trùng) hoặc
            // bị kết quả stale của vị trí trước ghi đè.
            state.videoSyncHandler = (event) => {
                if (!state.enabled) {
                    return;
                }
                if ((event?.type === 'seeked' || event?.type === 'loadedmetadata') && onSeekReset) {
                    onSeekReset();
                }
                renderCurrentCaption().catch(() => {});
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
