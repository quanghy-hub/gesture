(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    // Dịch trước (prefetch) text của các cue sắp phát để khử độ trễ mạng khỏi
    // đường hiển thị: khi cue tới lượt, bản dịch thường đã có trong cache nên
    // phụ đề hiện gần như tức thì.
    // - Phụ đề tải lên thủ công: toàn bộ cues có sẵn trong TextTrack → dịch
    //   trước được cả đoạn phía trước.
    // - Auto caption (ASR): cues do player tải theo segment (thường đi trước
    //   vị trí phát vài chục giây) → lấy trước được phần đã tải; phần chưa về
    //   vẫn rơi vào đường dịch live như cũ.
    youtubeSubtitles.createPrefetcher = (deps) => {
        const { state, settings, translator, shouldDefer } = deps;
        const { MAX_VISIBLE_CAPTION_WORDS } = youtubeSubtitles;
        const { normalizeCueText } = youtubeSubtitles.captionSource;

        let queue = [];
        const queuedKeys = new Set();
        const failedAt = new Map();
        let activeCount = 0;
        let lastScanAt = 0;

        const lookaheadSeconds = () => youtubeSubtitles.PREFETCH_LOOKAHEAD_SECONDS || 90;
        const maxConcurrent = () => youtubeSubtitles.PREFETCH_MAX_CONCURRENT || 2;

        // Thu thập text cần dịch trước từ track đang bật, sắp xếp theo thứ tự
        // phát. Chunk hiển thị là các cửa sổ cố định MAX_VISIBLE_CAPTION_WORDS
        // từ (xem getDisplayCaptionText) nên prefetch đúng từng cửa sổ để khớp
        // key cache tại thời điểm render.
        //
        // CHỈ quét cue bắt đầu sau mốc currentTime + MIN_LEAD: cue đang phát/
        // sắp active là vùng ASR tự viết lại text liên tục — dịch các snapshot
        // đó là thuần phí request và có thể dọa rate-limit provider làm treo cả
        // bản dịch live. Cue thủ công thì text ổn định nên khi nó vào vùng lead
        // đủ xa, toàn bộ cửa sổ của nó đã được dịch sẵn.
        const collectCandidates = (video) => {
            const track = youtubeSubtitles.captionSource.getActiveCaptionTrack(video);
            const cues = Array.from(track?.cues || []);
            if (!cues.length) {
                return [];
            }
            const currentTime = Number(video.currentTime) || 0;
            const fromTime = currentTime + (youtubeSubtitles.PREFETCH_MIN_LEAD_SECONDS || 4);
            const toTime = currentTime + lookaheadSeconds();
            const candidates = [];
            const seenKeys = new Set();
            for (const cue of cues) {
                const startTime = Number(cue?.startTime);
                if (!Number.isFinite(startTime) || startTime < fromTime || startTime > toTime) {
                    continue;
                }
                const text = normalizeCueText(cue.text);
                if (!text) {
                    continue;
                }
                const words = text.split(/\s+/);
                for (let offset = 0; offset < words.length; offset += MAX_VISIBLE_CAPTION_WORDS) {
                    const key = words.slice(offset, offset + MAX_VISIBLE_CAPTION_WORDS).join(' ');
                    if (!key || seenKeys.has(key)) {
                        continue;
                    }
                    seenKeys.add(key);
                    candidates.push({ key, startTime });
                }
            }
            candidates.sort((a, b) => a.startTime - b.startTime);
            return candidates;
        };

        const drainQueue = () => {
            while (activeCount < maxConcurrent() && queue.length) {
                // Bản dịch live (đường hiển thị) đang chờ thì KHÔNG khởi request
                // prefetch mới — nhường trọn băng thông cho phụ đề hiển thị.
                if (shouldDefer && shouldDefer()) {
                    break;
                }
                const item = queue.shift();
                if (translator.hasCached(item.key)) {
                    queuedKeys.delete(item.key);
                    continue;
                }
                activeCount += 1;
                Promise.resolve()
                    .then(() => translator.translateCaption(item.key, settings()))
                    .then((result) => {
                        if ((!result?.text || result?.error) && !translator.hasCached(item.key)) {
                            failedAt.set(item.key, Date.now());
                        }
                    })
                    .catch(() => failedAt.set(item.key, Date.now()))
                    .finally(() => {
                        queuedKeys.delete(item.key);
                        activeCount -= 1;
                        drainQueue();
                    });
            }
        };

        // Được gọi từ mọi sự kiện video (timeupdate/cuechange/seeked...);
        // quét throttle theo interval, force=true bỏ qua throttle (sau tua,
        // khi track vừa load...). Key đã queued/đã cache/đang cooldown sẽ bị bỏ qua.
        const pump = ({ force } = {}) => {
            const video = state.video;
            if (!video || !state.enabled) {
                return;
            }
            const nowMs = Date.now();
            if (!force && nowMs - lastScanAt < (youtubeSubtitles.PREFETCH_SCAN_INTERVAL_MS || 800)) {
                return;
            }
            lastScanAt = nowMs;
            const cooldown = youtubeSubtitles.PREFETCH_FAIL_COOLDOWN_MS || 8000;
            for (const candidate of collectCandidates(video)) {
                if (queuedKeys.has(candidate.key) || translator.hasCached(candidate.key)) {
                    continue;
                }
                const lastFail = failedAt.get(candidate.key);
                if (Number.isFinite(lastFail) && nowMs - lastFail < cooldown) {
                    continue;
                }
                queuedKeys.add(candidate.key);
                queue.push(candidate);
            }
            drainQueue();
        };

        const reset = () => {
            queue = [];
            queuedKeys.clear();
            failedAt.clear();
            lastScanAt = 0;
        };

        return { pump, reset };
    };
})();
