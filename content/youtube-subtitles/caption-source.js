(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = ext.youtubeSubtitles = ext.youtubeSubtitles || {};
    const { queryAllDeep } = ext.shared.domUtils;
    const {
        EARLY_VISIBLE_CAPTION_WORDS,
        MIN_VISIBLE_CAPTION_WORDS,
        MAX_VISIBLE_CAPTION_WORDS
    } = youtubeSubtitles;

    const normalizeCueText = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    const normalizeCaptionWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);

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

    const getPreferredTrack = (video) => {
        const tracks = getSubtitleTracks(video);
        if (!tracks.length) {
            return null;
        }
        return tracks.find((track) => track.mode === 'showing')
            || tracks.find((track) => track.language)
            || tracks[0];
    };

    const extractCaptionTextFromDom = () => {
        const captionRoots = queryAllDeep('.caption-window, .ytp-caption-window-container, .captions-text');
        for (const root of [...captionRoots].reverse()) {
            const lineNodes = root.querySelectorAll?.('.caption-visual-line') || [];
            if (lineNodes.length) {
                const lineText = Array.from(lineNodes)
                    .map((line) => Array.from(line.querySelectorAll('.ytp-caption-segment, .captions-text span')).map((segment) => segment.textContent.trim()).filter(Boolean).join(' '))
                    .filter(Boolean)
                    .join(' ')
                    .trim();
                if (lineText) {
                    return lineText;
                }
            }

            const segmentText = Array.from(root.querySelectorAll?.('.ytp-caption-segment, .captions-text, .captions-text span') || [])
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

    youtubeSubtitles.captionSource = {
        getSubtitleTracks,
        getPreferredTrack,
        hideNativeCaptionTracks(video) {
            getSubtitleTracks(video).forEach((track) => {
                try {
                    track.mode = 'hidden';
                } catch {
                    // Ignore sites that reject track mode changes.
                }
            });
        },
        extractCaptionText(video) {
            const track = getPreferredTrack(video);
            if (!track) {
                return extractCaptionTextFromDom();
            }
            try {
                if (track.mode === 'disabled') {
                    track.mode = 'hidden';
                }
            } catch {
                // Ignore track mode errors.
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
            const isProgressiveAutoCaption =
                previousWords.length > 0 &&
                previousWords.length < currentWords.length &&
                previousWords.every((word, index) => currentWords[index] === word);
            if (isProgressiveAutoCaption) {
                const remainingWords = currentWords.slice(state.consumedWordCount);
                const requiredWords = state.consumedWordCount === 0 ? EARLY_VISIBLE_CAPTION_WORDS : MIN_VISIBLE_CAPTION_WORDS;
                if (remainingWords.length < requiredWords) {
                    return '';
                }
                const chunkWords = remainingWords.slice(0, MAX_VISIBLE_CAPTION_WORDS);
                state.consumedWordCount += chunkWords.length;
                return chunkWords.join(' ');
            }
            state.consumedWordCount = 0;
            if (currentWords.length <= MAX_VISIBLE_CAPTION_WORDS) {
                return currentWords.join(' ');
            }
            const chunkWords = currentWords.slice(0, MAX_VISIBLE_CAPTION_WORDS);
            state.consumedWordCount = chunkWords.length;
            return chunkWords.join(' ');
        }
    };
})();
