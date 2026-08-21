(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createCaptionManager = (deps) => {
        const { state, settings, persistSettings, releaseCaptionTrack } = deps;

        const getCurrentVideo = () => ext.shared.domUtils.queryDeep('video') || document.querySelector('video');
        const getNativeCaptionButton = () =>
            ext.shared.domUtils.queryDeep('.ytp-subtitles-button') || document.querySelector('.ytp-subtitles-button');
        const isNativeCaptionEnabled = (video = getCurrentVideo()) => {
            const button = getNativeCaptionButton();
            if (button?.getAttribute('aria-pressed') === 'true') {
                return true;
            }
            const activeTrack = youtubeSubtitles.captionSource.getActiveCaptionTrack(video, state.captionTrack);
            if (activeTrack) {
                return true;
            }
            return youtubeSubtitles.captionSource.hasDomCaptionText();
        };

        const resetCaptionState = () => {
            state.lastSource = '';
            state.lastRenderedSource = '';
            state.consumedWordCount = 0;
            state.lastCaptionTime = null;
        };

        const doRenderCurrentCaption = async () => {
            const video = state.video || getCurrentVideo();
            if (!video) {
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }

            if (!isNativeCaptionEnabled(video)) {
                releaseCaptionTrack();
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }

            let source;
            const captionTrack = youtubeSubtitles.captionSource.getActiveCaptionTrack(video, state.captionTrack);
            if (captionTrack) {
                state.captionTrack = captionTrack;
                youtubeSubtitles.captionSource.hideNativeCaptionTrack(captionTrack);
                source = youtubeSubtitles.captionSource.extractCaptionText(video, captionTrack);
            } else if (!youtubeSubtitles.captionSource.getSubtitleTracks(video).length) {
                releaseCaptionTrack();
                source = youtubeSubtitles.captionSource.extractCaptionText(video, null);
            } else {
                releaseCaptionTrack();
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }
            if (!source) {
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(!!captionTrack);
                resetCaptionState();
                return;
            }

            if (source === state.lastSource) {
                return;
            }

            const previousSource = state.lastSource;
            state.lastSource = source;

            // Nhảy thời gian lớn so với lần render trước (tua video) → chunk
            // rolling cũ không còn liên quan: đọc lại từ đầu caption mới.
            const currentTime = Number(video.currentTime) || 0;
            if (
                Number.isFinite(state.lastCaptionTime) &&
                Math.abs(currentTime - state.lastCaptionTime) > (youtubeSubtitles.SEEK_TIME_GAP_SECONDS || 0.6) &&
                state.consumedWordCount > 0
            ) {
                state.consumedWordCount = 0;
            }
            state.lastCaptionTime = currentTime;

            const displaySource = youtubeSubtitles.captionSource.getDisplayCaptionText(source, previousSource, state);
            if (!displaySource || displaySource === state.lastRenderedSource) {
                return;
            }

            const renderGeneration = state.renderGeneration;
            const translation = await youtubeSubtitles.translator.translateCaption(displaySource, settings());
            if (!state.enabled || renderGeneration !== state.renderGeneration) {
                return;
            }
            const translated = translation?.text || '';
            const errorMessage = translation?.error || '';
            if ((!translated || translated === displaySource) && !errorMessage) {
                return;
            }

            const container = youtubeSubtitles.dom.ensureSubtitleContainer();
            youtubeSubtitles.dom.makeContainerDraggable(container, persistSettings);
            const originalNode = container.querySelector('.sub-original');
            const translatedNode = container.querySelector('.sub-translated');
            originalNode.textContent = displaySource;
            translatedNode.textContent = translated || errorMessage;
            translatedNode.classList.toggle('sub-error', !translated && !!errorMessage);
            translatedNode.style.display = translatedNode.textContent ? '' : 'none';
            originalNode.style.display = settings().showOriginal ? '' : 'none';
            state.lastRenderedSource = displaySource;
            youtubeSubtitles.dom.applySettingsStyles(settings());
            youtubeSubtitles.dom.setPlayerTranslating(true);
        };

        // Serialize + coalescing: chỉ tối đa MỘT lần render chạy tại một thời điểm.
        // Request mới đến khi đang chạy sẽ được đánh dấu và xử lý đúng MỘT lần sau
        // khi lượt hiện tại xong (đọc lại state mới nhất) — nhờ đó các bản dịch
        // không thể ghi DOM lệch thứ tự (triệu chứng "tua nhanh rồi phụ đề
        // đứng yên" ở text cũ).
        let renderRunning = false;
        let renderQueued = false;

        const renderCurrentCaption = async () => {
            if (renderRunning) {
                renderQueued = true;
                return;
            }
            renderRunning = true;
            try {
                do {
                    renderQueued = false;
                    try {
                        await doRenderCurrentCaption();
                    } catch {
                        // Bỏ qua lỗi tạm thời khi trích xuất/dịch, giữ container hiện tại.
                    }
                } while (renderQueued);
            } finally {
                renderRunning = false;
            }
        };

        return {
            getCurrentVideo,
            isNativeCaptionEnabled,
            resetCaptionState,
            renderCurrentCaption
        };
    };
})();
