(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.media = videoFloating.media || {};

    const { getRect, getViewportIntersection, getViewportCenterDistance, getTopVideoAtPoint, queryAllDeep, getFullscreenEl } =
        videoFloating.core.utils || {};
    const { hasVisibleSize } = ext?.shared?.domUtils || {};

    const isTopVideoCandidate = (video, rect = getRect(video)) => {
        if (!rect?.width || !rect?.height) return false;
        const points = [
            [rect.left + rect.width / 2, rect.top + rect.height / 2],
            [rect.left + rect.width / 2, rect.top + Math.min(rect.height * 0.35, rect.height - 1)],
            [rect.left + rect.width / 2, rect.top + Math.min(rect.height * 0.65, rect.height - 1)]
        ];
        return points.some(([x, y]) => {
            if (x < 0 || y < 0 || x > (window.innerWidth || 0) || y > (window.innerHeight || 0)) return false;
            return getTopVideoAtPoint(x, y) === video;
        });
    };

    const isVideoActivelyPlaying = (video) => !!(video && !video.paused && !video.ended && video.readyState > 1);

    const getVideoPriority = (video) => {
        const rect = getRect(video);
        const viewport = getViewportIntersection(rect);
        const visibleArea = viewport.area || Math.max(0, rect.width * rect.height);
        const fullscreenEl = getFullscreenEl();
        let score = visibleArea;

        if (isVideoActivelyPlaying(video)) score += 1000000000;
        else if (video?.paused === false) score += 500000000;
        if (video === document.pictureInPictureElement) score += 900000000;
        if (fullscreenEl && (fullscreenEl === video || fullscreenEl.contains?.(video))) score += 900000000;
        if (isTopVideoCandidate(video, rect)) score += 120000000;
        score += viewport.ratio * 80000000;
        if (video?.currentTime > 0) score += 10000000;
        if (video?.readyState > 0) score += video.readyState * 1000000;
        score -= getViewportCenterDistance(rect) * 1000;
        return score;
    };

    const compareVideoPriority = (left, right) => getVideoPriority(right) - getVideoPriority(left);

    const isDetectableVideo = (video) => {
        if (!video || !video.isConnected) return false;
        if (video.tagName === 'AUDIO') return true;
        if (location.hostname.includes('music.youtube.com')) return true;
        if (video.currentTime > 0 || (Number.isFinite(video.duration) && video.duration > 0 && !video.paused)) return true;
        if (hasVisibleSize) return hasVisibleSize(video);
        const rect = getRect(video);
        return rect.width > 0 && rect.height > 0;
    };

    const AUTO_SYNC_MIN_VISIBLE_AREA = 42000;
    const AUTO_SYNC_MIN_SHORT_SIDE = 128;
    const AUTO_SYNC_MIN_LONG_SIDE = 220;
    const AUTO_SYNC_REFERENCE_AREA_RATIO = 0.45;
    const AUTO_SYNC_REFERENCE_AREA_FLOOR = 90000;

    const isVideoAutoSyncCandidate = (video, { referenceRect = null } = {}) => {
        if (!isDetectableVideo(video)) return false;
        try {
            const style = window.getComputedStyle(video);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
        } catch {
            /* ignore */
        }

        const rect = getRect(video);
        const elementArea = Math.max(0, rect.width * rect.height);
        const viewport = getViewportIntersection(rect);
        const visibleArea = viewport.area || (viewport.ratio > 0 ? elementArea : 0);
        const shortSide = Math.min(rect.width, rect.height);
        const longSide = Math.max(rect.width, rect.height);
        if (visibleArea < AUTO_SYNC_MIN_VISIBLE_AREA || shortSide < AUTO_SYNC_MIN_SHORT_SIDE || longSide < AUTO_SYNC_MIN_LONG_SIDE)
            return false;

        const referenceArea = referenceRect?.width && referenceRect?.height ? Math.max(0, referenceRect.width * referenceRect.height) : 0;
        if (referenceArea && visibleArea < AUTO_SYNC_REFERENCE_AREA_FLOOR && visibleArea < referenceArea * AUTO_SYNC_REFERENCE_AREA_RATIO) {
            return false;
        }

        return true;
    };

    const getVideoSourceCandidate = (video) => {
        const source = video?.querySelector?.('source[src], source[data-source], source[data-src], source[data-video-src]');
        return (
            video?.currentSrc ||
            video?.src ||
            video?.getAttribute?.('src') ||
            video?.dataset?.source ||
            video?.dataset?.src ||
            video?.dataset?.videoSrc ||
            video?.getAttribute?.('data-source') ||
            video?.getAttribute?.('data-src') ||
            video?.getAttribute?.('data-video-src') ||
            source?.src ||
            source?.dataset?.source ||
            source?.dataset?.src ||
            source?.dataset?.videoSrc ||
            source?.getAttribute?.('data-source') ||
            source?.getAttribute?.('data-src') ||
            source?.getAttribute?.('data-video-src') ||
            ''
        );
    };

    const getDirectVideoKey = (video, rect = getRect(video), sourceCandidate = getVideoSourceCandidate(video)) =>
        [sourceCandidate, Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)].join('|');

    const collectDirectVideos = () => {
        const unique = new Map();
        for (const video of queryAllDeep('video, audio')) {
            if (!video?.isConnected || video.closest('#fvp-wrapper')) continue;

            if (!isDetectableVideo(video)) continue;

            try {
                const style = window.getComputedStyle(video);
                if (style.display === 'none' || style.visibility === 'hidden') continue;
            } catch {
                /* ignore */
            }

            const isYouTube = location.hostname.includes('youtube.com') || location.hostname.includes('youtube-nocookie.com');
            if (isYouTube) {
                const isMainPlayer = video.classList.contains('html5-main-video') || video.closest('#movie_player');
                if (!isMainPlayer) continue;
                // YouTube re-creates a shadow video inside #movie_player when the real element is floated
                const wrapper = videoFloating.core.utils.$('fvp-wrapper');
                if (wrapper?.querySelector('video')) continue;
            }

            const rect = getRect(video);
            const sourceCandidate = getVideoSourceCandidate(video);
            const hasMediaSource = Boolean(sourceCandidate);
            const hasPlaybackState = Number.isFinite(video.duration) || video.readyState > 0 || video.currentTime > 0;
            const largeEnough = rect.width >= 160 && rect.height >= 90;
            if (!(hasMediaSource || hasPlaybackState || largeEnough)) continue;

            const key = getDirectVideoKey(video, rect, sourceCandidate);
            if (!unique.has(key)) {
                unique.set(key, video);
            }
        }

        return [...unique.values()];
    };

    const getDirectVideoSequence = () => collectDirectVideos();
    const getDirectVideos = () => collectDirectVideos().sort(compareVideoPriority);

    const getOverlapRatio = (firstRect, secondRect) => {
        const left = Math.max(firstRect.left, secondRect.left);
        const right = Math.min(firstRect.right, secondRect.right);
        const top = Math.max(firstRect.top, secondRect.top);
        const bottom = Math.min(firstRect.bottom, secondRect.bottom);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        const overlapArea = width * height;
        const baseArea = Math.max(1, firstRect.width * firstRect.height);
        return overlapArea / baseArea;
    };

    const isVisibleIframe = (iframe) => {
        if (!iframe?.isConnected || iframe.closest('#fvp-wrapper')) return false;
        const rect = getRect(iframe);
        return rect.width >= 160 && rect.height >= 90;
    };

    const getIframeSrc = (iframe) => {
        const raw = iframe?.src || iframe?.getAttribute?.('src') || '';
        if (!raw) return '';
        try {
            return new URL(raw, location.href).href;
        } catch {
            return raw;
        }
    };

    const isRedundantIframeCandidate = (iframe, directVideos = getDirectVideos()) => {
        if (!iframe?.isConnected || !directVideos.length) return false;

        let host = '';
        try {
            host = new URL(getIframeSrc(iframe)).hostname;
        } catch {
            /* ignore */
        }

        const iframeRect = getRect(iframe);
        if (!iframeRect.width || !iframeRect.height) return true;

        return directVideos.some((video) => {
            const videoRect = getRect(video);
            if (!videoRect.width || !videoRect.height) return false;

            const samePlatform =
                (/youtube\.com|youtu\.be|youtube-nocookie\.com/i.test(host) && /(^|\.)youtube\.com$/i.test(location.hostname)) ||
                (/redditmedia\.com|v\.redd\.it|reddit\.com/i.test(host) && /(^|\.)reddit\.com$/i.test(location.hostname));

            return samePlatform && getOverlapRatio(iframeRect, videoRect) >= 0.6;
        });
    };

    const isLikelyVideoIframe = (iframe) => {
        if (!isVisibleIframe(iframe)) return false;
        const src = getIframeSrc(iframe);
        if (!src || src === 'about:blank') return false;
        const attrs = [
            src,
            iframe.title || '',
            iframe.getAttribute?.('aria-label') || '',
            iframe.getAttribute?.('name') || '',
            iframe.id || '',
            iframe.className || ''
        ].join(' ');
        return videoFloating.VIDEO_IFRAME_PATTERN.test(attrs);
    };

    const getTrackedIframeEntries = (map) => {
        const directVideos = getDirectVideos();
        return [...map.entries()].filter(([iframe, count]) => {
            if (!iframe?.isConnected || !(count > 0)) return false;
            if (!isLikelyVideoIframe(iframe)) return false;
            if (isRedundantIframeCandidate(iframe, directVideos)) return false;
            return true;
        });
    };

    videoFloating.media.detector = {
        isDetectableVideo,
        getDirectVideoSequence,
        getDirectVideos,
        isVisibleIframe,
        getIframeSrc,
        isLikelyVideoIframe,
        getTrackedIframeEntries,
        compareVideoPriority,
        isVideoActivelyPlaying,
        isVideoAutoSyncCandidate
    };
})();
