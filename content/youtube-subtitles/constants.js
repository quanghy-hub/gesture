(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = (ext.youtubeSubtitles = ext.youtubeSubtitles || {});

    youtubeSubtitles.SELECTORS = Object.freeze({
        player: '#movie_player, .html5-video-player',
        translateButton: '#gesture-youtube-subtitles-toggle',
        container: '#yt-bilingual-subtitles',
        nativeCaptionNodes: '.ytp-caption-window-container, .caption-window, .captions-text, .ytp-caption-segment'
    });

    youtubeSubtitles.EARLY_VISIBLE_CAPTION_WORDS = 6;
    youtubeSubtitles.MIN_VISIBLE_CAPTION_WORDS = 10;
    youtubeSubtitles.MAX_VISIBLE_CAPTION_WORDS = 18;
    // Độ trễ gom mutation của player trước khi render lại phụ đề — giảm storm
    // sự kiện khi YouTube thay đổi DOM liên tục (buffering, hover, tua).
    youtubeSubtitles.CAPTION_MUTATION_DEBOUNCE_MS = 100;
    // Nhảy currentTime lớn hơn ngưỡng này coi như tua: phụ đề rolling (auto
    // caption) không còn là continuation của chunk đang đọc dở.
    youtubeSubtitles.SEEK_TIME_GAP_SECONDS = 0.6;
    youtubeSubtitles.isWatchPage = () => /\/watch|[?&]v=/.test(window.location.href);
})();
