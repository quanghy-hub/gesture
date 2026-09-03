(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.SELECTORS = Object.freeze({
        player: '#movie_player, .html5-video-player',
        translateButton: '#gesture-youtube-subtitles-toggle',
        container: '#yt-bilingual-subtitles'
    });

    // Trở lại nhịp nhanh “như cũ”: chunk đầu ~5 từ, các chunk sau ~6 từ.
    // Đủ nhanh để bám sát phụ đề gốc; gom 8-10 từ trước đó làm trễ tích luỹ.
    youtubeSubtitles.EARLY_VISIBLE_CAPTION_WORDS = 5;
    youtubeSubtitles.MIN_VISIBLE_CAPTION_WORDS = 6;
    youtubeSubtitles.MAX_VISIBLE_CAPTION_WORDS = 18;
    // Độ trễ gom mutation của player trước khi render lại phụ đề — giảm storm
    // sự kiện khi YouTube thay đổi DOM liên tục (buffering, hover, tua).
    youtubeSubtitles.CAPTION_MUTATION_DEBOUNCE_MS = 100;
    // Dung sai độ lệch giữa thời gian video và đồng hồ thực để phát hiện tua
    // (được theo dõi liên tục mỗi lần render; chỉ tính khi video đang phát).
    youtubeSubtitles.SEEK_DRIFT_TOLERANCE_SECONDS = 1;
    // Khoảng thời gian giữ nguyên phụ đề cuối khi nguồn caption trống thoáng qua
    // (chuyển cue, ASR re-time) trước khi xoá container + reset chunking state.
    youtubeSubtitles.CAPTION_EMPTY_GRACE_MS = 3000;
    // Dịch trước (prefetch) các cue sắp phát: quét track trong cửa sổ nhìn
    // trước này và dịch ngầm với số request song song giới hạn để khử độ trễ
    // mạng khỏi đường hiển thị.
    youtubeSubtitles.PREFETCH_LOOKAHEAD_SECONDS = 90;
    // Chỉ dịch trước cue bắt đầu sau khoảng lead này, tách khỏi vùng cue đang
    // phát/sắp active (ASR tự viết lại text liên tục → prefetch snapshot đó
    // vừa phí request vừa dọa rate-limit provider).
    youtubeSubtitles.PREFETCH_MIN_LEAD_SECONDS = 4;
    youtubeSubtitles.PREFETCH_MAX_CONCURRENT = 2;
    youtubeSubtitles.PREFETCH_SCAN_INTERVAL_MS = 800;
    // Sau khi một key prefetch thất bại, chờ khoảng này mới thử lại để không
    // dập provider khi có lỗi tạm thời.
    youtubeSubtitles.PREFETCH_FAIL_COOLDOWN_MS = 8000;
    // ---- TTS đọc phụ đề (Tier 1: Web Speech API) ----
    youtubeSubtitles.TTS_QUEUE_MAX = 2;
    youtubeSubtitles.TTS_DUCK_VOLUME = 0.15;
    youtubeSubtitles.TTS_LANG_PREFIX = 'vi';
    // Câu chờ quá X giây so với vị trí video hiện tại → bỏ, đọc câu kế tiếp
    // (giữ nhịp dubbing thay vì trễ tích luỹ vô hạn).
    youtubeSubtitles.TTS_STALE_SECONDS = 8;
    // Trong window này kể từ lúc bắt đầu tổng hợp/dubbing, dịch văn bản (MT)
    // nhường offscreen → đi thẳng đường online cho kịp phụ đề.
    youtubeSubtitles.TTS_DUB_ACTIVE_WINDOW_MS = 6000;
    // Ngân sách chờ kết quả dịch offline mỗi câu: quá hạn → fallback online
    // (chống xếp hàng sau VITS inference đang chiếm thread offscreen).
    youtubeSubtitles.OFFLINE_TRANSLATE_FAST_BUDGET_MS = 1200;
    // Trần chờ kết quả dịch trên đường hiển thị: request bị treo (provider
    // chậm/bị chặn) không được phép đóng băng phụ đề vĩnh viễn.
    youtubeSubtitles.LIVE_TRANSLATE_TIMEOUT_MS = 15000;
    youtubeSubtitles.isWatchPage = () => /\/watch|[?&]v=/.test(window.location.href);
})();
