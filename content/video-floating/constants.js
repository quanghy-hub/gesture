(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};

    videoFloating.FVP_IFRAME_BRIDGE = 'fvp-page-bridge';
    videoFloating.FIT_MODES = Object.freeze(['contain', 'cover', 'fill']);
    videoFloating.FIT_ICONS = Object.freeze(['⤢', '🔍', '↔']);
    videoFloating.ZOOM_LEVELS = Object.freeze([1, 1.5, 2, 3]);
    videoFloating.ZOOM_ICONS = Object.freeze(['+', '++', '+++', '-']);
    videoFloating.VIDEO_CHECK_INTERVAL = 2000;
    videoFloating.VIDEO_IFRAME_PATTERN = /youtube\.com|youtu\.be|youtube-nocookie\.com|player\.vimeo\.com|vimeo\.com|dailymotion\.com|twitch\.tv|tiktok\.com|facebook\.com|jwplayer|brightcove|wistia|v\.redd\.it|redditmedia\.com|reddit\.com\/media|embed|player|video/i;
    videoFloating.DEFAULT_VIDEO_FLOATING_CONFIG = Object.freeze({
        enabled: true,
        swipeLong: 0.3,
        swipeShort: 0.15,
        shortThreshold: 200,
        minSwipeDistance: 30,
        verticalTolerance: 80,
        diagonalThreshold: 1.5,
        realtimePreview: true,
        throttle: 15,
        noticeFontSize: 14
    });
})();
