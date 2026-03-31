(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = ext.youtubeSubtitles = ext.youtubeSubtitles || {};

    youtubeSubtitles.SELECTORS = Object.freeze({
        player: '#movie_player, .html5-video-player',
        translateButton: '#gesture-youtube-subtitles-toggle',
        container: '#yt-bilingual-subtitles',
        nativeCaptionNodes: '.ytp-caption-window-container, .caption-window, .captions-text, .ytp-caption-segment'
    });

    youtubeSubtitles.EARLY_VISIBLE_CAPTION_WORDS = 3;
    youtubeSubtitles.MIN_VISIBLE_CAPTION_WORDS = 6;
    youtubeSubtitles.MAX_VISIBLE_CAPTION_WORDS = 12;
    youtubeSubtitles.isWatchPage = () => /\/watch|[?&]v=/.test(window.location.href);
})();
