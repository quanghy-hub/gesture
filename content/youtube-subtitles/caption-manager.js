(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createCaptionManager = (deps) => {
        const { state, settings, persistSettings, speaker } = deps;

        const getCurrentVideo = () => ext.shared.domUtils.queryDeep('video') || document.querySelector('video');
        const getNativeCaptionButton = () =>
            ext.shared.domUtils.queryDeep('.ytp-subtitles-button') || document.querySelector('.ytp-subtitles-button');
        const isNativeCaptionEnabled = (video = getCurrentVideo()) => {
            const button = getNativeCaptionButton();
            if (button?.getAttribute('aria-pressed') === 'true') {
                return true;
            }
            if (youtubeSubtitles.captionSource.getActiveCaptionTrack(video)) {
                return true;
            }
            return youtubeSubtitles.captionSource.hasDomCaptionText();
        };

        const resetCaptionState = () => {
            state.lastSource = '';
            state.lastRenderedSource = '';
            state.consumedWordCount = 0;
            state.lastSyncMediaTime = null;
            state.lastSyncWallTime = null;
            state.lastCaptionActivityAt = null;
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
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }

            let source;
            const captionTrack = youtubeSubtitles.captionSource.getActiveCaptionTrack(video);
            if (captionTrack) {
                // CỐ TÌNH KHÔNG đổi track.mode sang 'hidden': YouTube chỉ bơm
                // dữ liệu ASR đều đặn khi track đang 'showing' — chuyển 'hidden'
                // làm cue nhả chậm hẳn (độ trễ nằm ở NGUỒN phát, trước cả bước
                // dịch). Chặn hiển thị phụ đề native bằng CSS (.yt-translating)
                // là đủ, luồng cue giữ nguyên nhịp như khi tắt extension.
                source = youtubeSubtitles.captionSource.extractCaptionText(video, captionTrack);
            } else if (!youtubeSubtitles.captionSource.getSubtitleTracks(video).length) {
                source = youtubeSubtitles.captionSource.extractCaptionText(video, null);
            } else {
                youtubeSubtitles.dom.removeSubtitleContainer();
                youtubeSubtitles.dom.setPlayerTranslating(false);
                resetCaptionState();
                return;
            }
            if (!source) {
                // Cue trống thoáng qua (chuyển cue, ASR re-time): giữ nguyên phụ
                // đề đang hiển thị trong grace window thay vì xoá ngay — xoá ngay
                // gây nháy phụ đề + mất state chunking → câu kế tiếp bị dịch lại
                // từ đầu (lặp lại câu đã dịch).
                const containerMissing = !document.querySelector(youtubeSubtitles.SELECTORS.container);
                const graceExpired =
                    Number.isFinite(state.lastCaptionActivityAt) &&
                    Date.now() - state.lastCaptionActivityAt > (youtubeSubtitles.CAPTION_EMPTY_GRACE_MS || 3000);
                if (containerMissing || graceExpired) {
                    youtubeSubtitles.dom.removeSubtitleContainer();
                    youtubeSubtitles.dom.setPlayerTranslating(!!captionTrack);
                    resetCaptionState();
                }
                return;
            }
            state.lastCaptionActivityAt = Date.now();

            // Theo dõi vị trí phát ở MỌI lần render (kể cả khi text không đổi)
            // và phát hiện tua bằng độ lệch giữa thời gian video và đồng hồ thực.
            // Cách cũ (so khoảng cách giữa 2 lần caption đổi text, ngưỡng 0.6s)
            // bị false-positive gần như liên tục với auto caption: text chỉ về
            // theo burst 1-3s/lần dù video phát bình thường → consumedWordCount
            // bị xoá giữa câu → cả câu đã dịch bị render/dịch lại từ đầu.
            const currentTime = Number(video.currentTime) || 0;
            const nowMs = Date.now();
            if (
                Number.isFinite(state.lastSyncMediaTime) &&
                Number.isFinite(state.lastSyncWallTime) &&
                !video.paused &&
                state.consumedWordCount > 0
            ) {
                const wallDeltaSeconds = (nowMs - state.lastSyncWallTime) / 1000;
                const expectedMediaTime = state.lastSyncMediaTime + wallDeltaSeconds * (Number(video.playbackRate) || 1);
                if (Math.abs(currentTime - expectedMediaTime) > (youtubeSubtitles.SEEK_DRIFT_TOLERANCE_SECONDS || 1)) {
                    state.consumedWordCount = 0;
                }
            }
            state.lastSyncMediaTime = currentTime;
            state.lastSyncWallTime = nowMs;

            if (source === state.lastSource) {
                return;
            }

            const previousSource = state.lastSource;
            state.lastSource = source;

            const displaySource = youtubeSubtitles.captionSource.getDisplayCaptionText(source, previousSource, state);
            if (!displaySource || displaySource === state.lastRenderedSource) {
                return;
            }

            // Hiện câu gốc NGAY để bám sát phụ đề gốc; bản dịch về sau sẽ đổ
            // vào dòng dưới. Trước đây cả hai dòng chỉ hiện sau khi dịch xong
            // → độ trễ mạng cộng thẳng vào độ lệch với phụ đề gốc.
            const container = youtubeSubtitles.dom.ensureSubtitleContainer();
            youtubeSubtitles.dom.makeContainerDraggable(container, persistSettings);
            const originalNode = container.querySelector('.sub-original');
            const translatedNode = container.querySelector('.sub-translated');
            originalNode.textContent = displaySource;
            originalNode.style.display = settings().showOriginal ? '' : 'none';
            // GIỮ bản dịch cũ hiển thị cho tới khi bản mới về — tránh khoảng
            // trống kéo dài khiến cảm giác "trễ". Chỉ cập nhật style/cờ.
            youtubeSubtitles.dom.applySettingsStyles(settings());
            youtubeSubtitles.dom.setPlayerTranslating(true);

            const renderGeneration = state.renderGeneration;
            state.liveTranslatePending = true;
            let translation;
            try {
                // Trần chờ an toàn: request dịch bị treo (provider chậm/bị rate-
                // limit) phải thoát sau timeout thay vì đóng băng phụ đề mãi.
                translation = await Promise.race([
                    youtubeSubtitles.translator.translateCaption(displaySource, settings()),
                    new Promise((resolve) => {
                        window.setTimeout(
                            () => resolve({ text: '', error: 'Dịch quá chậm, thử lại...' }),
                            youtubeSubtitles.LIVE_TRANSLATE_TIMEOUT_MS || 15000
                        );
                    })
                ]);
            } finally {
                // Bỏ cờ TRƯỚC khi ghi DOM để prefetch được phép chạy lại ngay.
                state.liveTranslatePending = false;
            }
            if (!state.enabled || renderGeneration !== state.renderGeneration) {
                return;
            }
            const translated = translation?.text || '';
            const errorMessage = translation?.error || '';
            if ((!translated || translated === displaySource) && !errorMessage) {
                return;
            }

            translatedNode.textContent = translated || errorMessage;
            translatedNode.classList.toggle('sub-error', !translated && !!errorMessage);
            translatedNode.style.display = translatedNode.textContent ? '' : 'none';
            state.lastRenderedSource = displaySource;
            // Đọc bản dịch (Tier 1 TTS): chỉ đọc nhánh thành công; speaker tự
            // bỏ qua khi toggle tắt / trình duyệt không hỗ trợ.
            speaker?.enqueue?.(translated);
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
