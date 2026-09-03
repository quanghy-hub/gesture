/**
 * Đọc phụ đề tiếng Việt — speaker phía content script.
 *
 * Engine 'os'      : speechSynthesis built-in (giọng hệ điều hành)
 * Engine 'offline' : background tổng hợp VITS vi → WAV base64 → phát NGAY TRÊN
 *                    TRANG này bằng AudioContext (trang có user activation nên
 *                    không bị autoplay policy chặn như offscreen document).
 *
 * Ducking: đang phát/tổng hợp → volume video hạ về TTS_DUCK_VOLUME; kết thúc
 * hoặc cancel → trả đúng volume gốc.
 */
(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.createSpeaker = ({ settings }) => {
        let queue = [];
        let speaking = false;
        let voice = null;
        let voicesHooked = false;
        let restoreVideo = null;
        let originalVolume = null;

        // Audio playback cho engine offline
        let pageAudioCtx = null;
        let currentPageSource = null;

        const supported = () => typeof speechSynthesis !== 'undefined' && !!speechSynthesis;

        function pickVoice() {
            if (voice && (!settings().ttsVoiceName || voice.name === settings().ttsVoiceName)) {
                return voice;
            }
            const prefix = youtubeSubtitles.TTS_LANG_PREFIX || 'vi';
            try {
                const all = speechSynthesis.getVoices();
                const wanted = settings().ttsVoiceName;
                if (wanted) {
                    voice = all.find((candidate) => candidate.name === wanted) || null;
                    if (voice) {
                        return voice;
                    }
                }
                voice = all.find((candidate) => candidate.lang && candidate.lang.toLowerCase().startsWith(prefix)) || null;
            } catch {
                voice = null;
            }
            return voice;
        }

        function hookVoices() {
            if (voicesHooked || !supported()) {
                return;
            }
            voicesHooked = true;
            try {
                speechSynthesis.addEventListener('voiceschanged', () => {
                    voice = null;
                    pickVoice();
                });
            } catch {
                // Trình duyệt cũ không có voiceschanged — bỏ qua.
            }
        }

        const getCurrentVideo = () => ext.youtubeSubtitles.dom?.getCurrentVideo?.() || document.querySelector('video');

        function duck(video) {
            if (!video || video.muted) {
                return;
            }
            if (restoreVideo !== video) {
                restoreVideo = video;
                originalVolume = video.volume;
            }
            video.volume = Math.min(originalVolume ?? 1, youtubeSubtitles.TTS_DUCK_VOLUME ?? 0.15);
        }

        function restoreVolume() {
            if (restoreVideo && originalVolume !== null) {
                try {
                    restoreVideo.volume = originalVolume;
                } catch {
                    // Video đã bị remove giữa chừng — bỏ qua.
                }
            }
            restoreVideo = null;
            originalVolume = null;
        }

        // ---- Engine 'os': speechSynthesis ----
        function speakNext() {
            if (!supported()) {
                return;
            }
            if (!queue.length) {
                speaking = false;
                restoreVolume();
                return;
            }
            const text = queue.shift();
            hookVoices();
            pickVoice();
            const video = getCurrentVideo();
            duck(video);

            const utterance = new SpeechSynthesisUtterance(text);
            if (voice) {
                utterance.voice = voice;
            }
            utterance.lang = voice?.lang || `${youtubeSubtitles.TTS_LANG_PREFIX || 'vi'}-VN`;
            utterance.rate = Math.max(0.5, Math.min(2, Number(settings().ttsRate) || 1));
            const done = () => {
                speaking = false;
                if (queue.length) {
                    speakNext();
                } else {
                    restoreVolume();
                }
            };
            utterance.onend = done;
            utterance.onerror = done;
            speaking = true;
            speechSynthesis.speak(utterance);
        }

        // ---- Engine 'offline': nhận WAV từ background, phát trên trang ----
        function base64ToArrayBuffer(base64) {
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) {
                bytes[index] = binary.charCodeAt(index);
            }
            return bytes.buffer;
        }

        function getPageAudioContext() {
            if (!pageAudioCtx) {
                pageAudioCtx = new AudioContext();
            }
            if (pageAudioCtx.state === 'suspended') {
                pageAudioCtx.resume().catch(() => {});
            }
            return pageAudioCtx;
        }

        function playWav(wavBuffer) {
            const context = getPageAudioContext();
            const decodePromise = context.decodeAudioData(wavBuffer.slice(0));
            return decodePromise.then((audioBuffer) => {
                duck(getCurrentVideo());
                const source = context.createBufferSource();
                source.buffer = audioBuffer;
                // Tăng tốc phát theo settings; giữ nguyên cao độ giọng
                const rate = Math.max(0.5, Math.min(3, Number(settings().ttsRate) || 1));
                try {
                    source.playbackRate.value = rate;
                    source.preservesPitch = true;
                    source.webkitPreservesPitch = true;
                } catch {
                    // Trình duyệt cũ không hỗ trợ preservesPitch — vẫn đổi rate.
                }
                currentPageSource = source;
                source.onended = () => {
                    if (currentPageSource === source) {
                        currentPageSource = null;
                        restoreVolume();
                        if (offlineQueue.length && !speaking) {
                            speakNextOfflineQueue();
                        }
                    }
                };
                source.connect(context.destination);
                source.start();
            });
        }

        let offlineBusy = false;
        let offlineQueue = [];

        function speakNextOfflineQueue() {
            if (offlineBusy) {
                return;
            }
            // Bỏ các câu đã trễ so với vị trí video hiện tại — giữ nhịp
            // dubbing thay vì trễ tích luỹ vô hạn khi tổng hợp chậm.
            const video = getCurrentVideo();
            const now = video?.currentTime ?? 0;
            const staleLimit = youtubeSubtitles.TTS_STALE_SECONDS ?? 8;
            while (offlineQueue.length && offlineQueue[0].t !== undefined && now - offlineQueue[0].t > staleLimit) {
                offlineQueue.shift();
            }
            const item = offlineQueue.shift();
            if (!item) {
                return;
            }
            offlineBusy = true;
            ext.shared.messaging
                .sendRuntimeMessage('gesture-ext/tts-speak', { text: item.text }, { unwrapResult: true })
                .then((result) => {
                    const wavBase64 = result?.wavBase64;
                    if (!wavBase64) {
                        throw new Error(result?.error || 'Không nhận được audio');
                    }
                    return playWav(base64ToArrayBuffer(wavBase64));
                })
                .then(() => {
                    offlineBusy = false;
                    speakNextOfflineQueue();
                })
                .catch((error) => {
                    offlineBusy = false;
                    restoreVolume();
                    console.warn('[gesture][tts-offline]', String(error?.message || error));
                    speakNextOfflineQueue();
                });
        }

        function enqueue(text) {
            const clean = String(text || '')
                .replace(/\s+/g, ' ')
                .trim();
            if (!clean) {
                return;
            }
            hookVoices();
            if (!supported() || !settings().ttsEnabled) {
                return;
            }
            if ((settings().ttsEngine || 'os') === 'offline') {
                if (offlineQueue[offlineQueue.length - 1]?.text === clean) {
                    return;
                }
                const max = youtubeSubtitles.TTS_QUEUE_MAX ?? 2;
                while (offlineQueue.length >= max) {
                    offlineQueue.shift();
                }
                offlineQueue.push({ text: clean, t: getCurrentVideo()?.currentTime ?? 0 });
                duck(getCurrentVideo());
                speakNextOfflineQueue();
                return;
            }
            if (queue[queue.length - 1] === clean) {
                return;
            }
            const max = youtubeSubtitles.TTS_QUEUE_MAX ?? 2;
            while (queue.length >= max) {
                queue.shift();
            }
            queue.push(clean);
            if (!speaking) {
                speakNext();
            }
        }

        function cancel() {
            queue = [];
            offlineQueue = [];
            try {
                if (supported()) {
                    speechSynthesis.cancel();
                }
            } catch {
                // Bỏ qua — trạng thái sẽ tự reset qua onend/onerror.
            }
            speaking = false;
            if (currentPageSource) {
                try {
                    currentPageSource.stop();
                } catch {
                    // Bỏ qua.
                }
                currentPageSource = null;
            }
            restoreVolume();
        }

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancel();
            }
        });

        return {
            enqueue,
            cancel,
            isSupported: () => !!supported()
        };
    };
})();
