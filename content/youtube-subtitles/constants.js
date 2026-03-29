(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = ext.youtubeSubtitles = ext.youtubeSubtitles || {};

    youtubeSubtitles.SELECTORS = Object.freeze({
        player: '#movie_player, .html5-video-player',
        controls: '.ytp-right-controls',
        translateButton: '.ytp-translate-button',
        container: '#yt-bilingual-subtitles',
        nativeCaptionNodes: '.ytp-caption-window-container, .caption-window, .captions-text, .ytp-caption-segment'
    });

    youtubeSubtitles.ICONS = Object.freeze({
        translate: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3"></path><path d="M22 22l-5-10-5 10M14 18h6"></path></svg>',
        translateActive: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"></path></svg>'
    });

    youtubeSubtitles.EARLY_VISIBLE_CAPTION_WORDS = 3;
    youtubeSubtitles.MIN_VISIBLE_CAPTION_WORDS = 6;
    youtubeSubtitles.MAX_VISIBLE_CAPTION_WORDS = 12;
    youtubeSubtitles.isWatchPage = () => /\/watch|[?&]v=/.test(window.location.href);
})();
