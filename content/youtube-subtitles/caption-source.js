(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});
    const { queryAllDeep } = ext.shared.domUtils;
    const { EARLY_VISIBLE_CAPTION_WORDS, MIN_VISIBLE_CAPTION_WORDS, MAX_VISIBLE_CAPTION_WORDS } = youtubeSubtitles;

    const normalizeCueText = (text) =>
        String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    const normalizeCaptionWords = (text) =>
        String(text || '')
            .trim()
            .split(/\s+/)
            .filter(Boolean);

    const getSubtitleTracks = (video) => {
        if (!video?.textTracks) {
            return [];
        }
        const tracks = [];
        for (let index = 0; index < video.textTracks.length; index += 1) {
            const track = video.textTracks[index];
            if (track?.kind === 'captions' || track?.kind === 'subtitles') {
                tracks.push(track);
            }
        }
        return tracks;
    };

    // Chỉ nhận track đang 'showing'. CỐ TÌNH không đụng vào mode của track
    // ở bất kỳ đâu trong module: YouTube chỉ bơm dữ liệu ASR đều đặn khi track
    // 'showing' — can thiệp mode làm cue nhả chậm hẳn (độ trễ nguồn phát).
    const getActiveCaptionTrack = (video) => {
        const tracks = getSubtitleTracks(video);
        if (!tracks.length) {
            return null;
        }
        return tracks.find((track) => track.mode === 'showing') || null;
    };

    const extractCaptionTextFromDom = () => {
        const captionContainers = queryAllDeep('.caption-window, .ytp-caption-window-container, .captions-text');
        for (const root of [...captionContainers].reverse()) {
            const lineNodes = root.querySelectorAll?.('.caption-visual-line, .ytp-caption-segment') || [];
            if (lineNodes.length) {
                const lineText = Array.from(lineNodes)
                    .map((line) =>
                        Array.from(line.querySelectorAll('.ytp-caption-segment, span'))
                            .map((segment) => segment.textContent.trim())
                            .filter(Boolean)
                            .join(' ')
                    )
                    .filter(Boolean)
                    .join(' ')
                    .trim();
                if (lineText) {
                    return lineText;
                }
            }

            const segmentText = Array.from(root.querySelectorAll?.('.ytp-caption-segment, span') || [])
                .map((segment) => segment.textContent.trim())
                .filter(Boolean)
                .join(' ')
                .trim();
            if (segmentText) {
                return segmentText;
            }

            const ownText = normalizeCueText(root.textContent);
            if (ownText) {
                return ownText;
            }
        }
        return '';
    };

    // So khớp từ bỏ hoa/thường + dấu câu: auto caption của YouTube thường bị
    // viết lại giữa chừng ("hello world" -> "Hello world.") nên so khớp nguyên
    // văn làm vỡ nhận diện rolling → cả câu bị đọc lại từ đầu (lặp phụ đề).
    const normalizeCompareWord = (word) =>
        String(word || '')
            .toLowerCase()
            .replace(/[^\p{L}\p{N}]/gu, '');

    // Nhận diện caption rolling (auto caption): text mới nối tiếp text cũ.
    // Tha thức tối đa 2 từ bị sửa nhưng CHỈ ở đuôi phần chung — sai số ở giữa
    // câu nghĩa là cue/mệnh đề mới, phải reset và đọc lại từ đầu.
    const isRollingContinuation = (previousWords, currentWords, state) => {
        const previousLength = previousWords.length;
        if (!previousLength) {
            return false;
        }
        const shrunk = previousLength > currentWords.length;
        // Chỉ chấp nhận caption co lại khi đang đọc dở một câu (ASR re-time rơi
        // bớt từ đuôi). Cue mới thật sự ngắn hơn sau câu dài thì consumed đã
        // vượt độ dài text mới → không rơi vào nhánh continuation.
        if (shrunk && (!(state.consumedWordCount > 0) || state.consumedWordCount > currentWords.length)) {
            return false;
        }
        const sharedLength = Math.min(previousLength, currentWords.length);
        let tailMismatches = 0;
        for (let index = 0; index < sharedLength; index += 1) {
            if (normalizeCompareWord(previousWords[index]) === normalizeCompareWord(currentWords[index])) {
                continue;
            }
            if (index < sharedLength - 2 || tailMismatches >= 2) {
                return false;
            }
            tailMismatches += 1;
        }
        return true;
    };

    youtubeSubtitles.captionSource = {
        normalizeCueText,
        getSubtitleTracks,
        getActiveCaptionTrack,
        extractCaptionTextFromDom,
        hasDomCaptionText() {
            return !!extractCaptionTextFromDom();
        },
        extractCaptionText(video, track) {
            if (!track) {
                return getSubtitleTracks(video).length ? '' : extractCaptionTextFromDom();
            }
            const activeCues = Array.from(track.activeCues || []);
            if (activeCues.length) {
                return activeCues
                    .map((cue) => normalizeCueText(cue.text))
                    .filter(Boolean)
                    .join(' ')
                    .trim();
            }
            const currentTime = video?.currentTime ?? 0;
            const cues = Array.from(track.cues || []);
            const currentCue = cues.find((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime);
            const text = normalizeCueText(currentCue?.text);
            return text || extractCaptionTextFromDom();
        },
        bindTrackCueChange(video, onChange) {
            const removers = [];
            if (typeof video?.textTracks?.addEventListener === 'function') {
                video.textTracks.addEventListener('addtrack', onChange);
                video.textTracks.addEventListener('change', onChange);
                removers.push(() => {
                    video.textTracks.removeEventListener('addtrack', onChange);
                    video.textTracks.removeEventListener('change', onChange);
                });
            }
            getSubtitleTracks(video).forEach((track) => {
                if (typeof track.addEventListener === 'function') {
                    track.addEventListener('cuechange', onChange);
                    removers.push(() => track.removeEventListener('cuechange', onChange));
                }
            });
            return () => removers.forEach((remove) => remove());
        },
        getDisplayCaptionText(currentSource, previousSource, state) {
            const currentWords = normalizeCaptionWords(currentSource);
            const previousWords = normalizeCaptionWords(previousSource);
            if (!currentWords.length) {
                return '';
            }

            let availableWords;
            if (isRollingContinuation(previousWords, currentWords, state)) {
                availableWords = currentWords.slice(state.consumedWordCount);
            } else {
                state.consumedWordCount = 0;
                availableWords = currentWords;
            }

            if (!availableWords.length) {
                return '';
            }

            const lastWord = availableWords[availableWords.length - 1] || '';
            const hasPunctuation = /[.?!;:,'"]$/.test(lastWord);
            const minWordsThreshold = state.consumedWordCount === 0 ? EARLY_VISIBLE_CAPTION_WORDS : MIN_VISIBLE_CAPTION_WORDS;
            const effectiveMinWords = hasPunctuation ? 1 : Math.max(5, minWordsThreshold);

            if (availableWords.length < effectiveMinWords) {
                return '';
            }

            const chunkWords = availableWords.slice(0, MAX_VISIBLE_CAPTION_WORDS);
            state.consumedWordCount += chunkWords.length;
            return chunkWords.join(' ');
        }
    };
})();
