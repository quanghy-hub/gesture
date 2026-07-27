(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createVideoTargetFinder = () => {
        const getFloatingActiveVideo = (wrapper = videoFloating.core.utils.$('fvp-wrapper')) => {
            if (!wrapper) return null;
            const floatingVideos = [...wrapper.querySelectorAll('video')];
            return floatingVideos.find((node) => node.parentElement === wrapper) || floatingVideos[floatingVideos.length - 1] || null;
        };

        const isPointInFloatingUI = (x, y) => {
            for (const id of ['fvp-container', 'fvp-master-icon', 'fvp-menu']) {
                const node = videoFloating.core.utils.$(id);
                if (node?.isConnected) {
                    const rect = videoFloating.core.utils.getRect(node);
                    if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                        return true;
                    }
                }
            }
            return false;
        };

        const getVideoAtPoint = (x, y) => {
            if (isPointInFloatingUI(x, y)) return null;

            if (typeof document.elementsFromPoint === 'function') {
                for (const node of document.elementsFromPoint(x, y)) {
                    if (!(node instanceof Element)) continue;
                    const video = node.tagName === 'VIDEO' || node.tagName === 'AUDIO' ? node : node.closest?.('video, audio');
                    if (!video || !video.isConnected || video.closest('#fvp-wrapper')) continue;
                    if (videoFloating.media.detector.isDetectableVideo(video)) return video;
                }
            }
            for (const video of videoFloating.media.detector.getDirectVideos()) {
                if (!videoFloating.media.detector.isDetectableVideo(video) || video.closest('#fvp-wrapper')) continue;
                const rect = videoFloating.core.utils.getRect(video);
                if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return video;
            }
            return null;
        };

        const getSeekableVideoAtPoint = (x, y, { includeFloating = false } = {}) => {
            if (includeFloating) {
                const wrapper = videoFloating.core.utils.$('fvp-wrapper');
                const box = videoFloating.core.utils.$('fvp-container');
                const isFloatingBoxVisible = !!(box && box.style.display !== 'none');
                const rect = isFloatingBoxVisible ? videoFloating.core.utils.getRect(wrapper) : null;
                if (rect?.width && rect?.height && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    const video = getFloatingActiveVideo(wrapper);
                    if (video?.isConnected && Number.isFinite(video.duration) && video.duration > 0) return video;
                }
            }
            const video = getVideoAtPoint(x, y);
            return video?.isConnected && Number.isFinite(video.duration) && video.duration > 0 ? video : null;
        };

        const isFloatingGestureBlockedTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return Boolean(
                node.closest('#fvp-left-panel, #fvp-ctrl, #fvp-res-popup, .fvp-resize-handle, button, input, select, textarea, a, label')
            );
        };

        const isVideoSeekEditableTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return Boolean(node.closest('input, select, textarea, [contenteditable]'));
        };

        const isVideoSeekWheelBlockedTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return isVideoSeekEditableTarget(node) || Boolean(node.closest('button, a, label, [role="button"]'));
        };

        const getVideo = () => {
            const fs = videoFloating.core.utils.getFullscreenEl();
            if (fs) {
                if (fs.tagName === 'VIDEO' || fs.tagName === 'AUDIO') return fs;
                const video = fs.querySelector('video, audio');
                if (video) return video;
            }
            const wrapper = videoFloating.core.utils.$('fvp-wrapper');
            if (wrapper) {
                const video = getFloatingActiveVideo(wrapper);
                if (video) return video;
            }
            return videoFloating.media.detector.getDirectVideos()[0] || null;
        };

        return {
            getFloatingActiveVideo,
            isPointInFloatingUI,
            getVideoAtPoint,
            getSeekableVideoAtPoint,
            isFloatingGestureBlockedTarget,
            isVideoSeekEditableTarget,
            isVideoSeekWheelBlockedTarget,
            getVideo
        };
    };
})();
