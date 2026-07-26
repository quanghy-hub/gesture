(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createWheelKeyboardSeek = (targetFinder, noticeUI) => {
        const wheel = {
            video: null,
            baseTime: 0,
            deltaX: 0,
            resetTimer: 0
        };
        const pointer = {
            active: false,
            x: 0,
            y: 0
        };
        const resetWheelGesture = () => {
            wheel.video = null;
            wheel.baseTime = 0;
            wheel.deltaX = 0;
            wheel.resetTimer = 0;
        };
        const scheduleWheelReset = () => {
            clearTimeout(wheel.resetTimer);
            wheel.resetTimer = window.setTimeout(resetWheelGesture, videoFloating.WHEEL_GESTURE?.idleMs || 300);
        };
        const seekVideoBy = (video, deltaSeconds) => {
            if (!video?.duration) return false;
            const nextTime = videoFloating.core.utils.clamp((video.currentTime || 0) + deltaSeconds, 0, video.duration);
            video.currentTime = nextTime;
            noticeUI.showSeekNotice(video, Math.round(deltaSeconds));
            return true;
        };
        const seekVideoFromWheel = (video, deltaX) => {
            if (!video?.duration) return false;
            if (wheel.video !== video) {
                wheel.video = video;
                wheel.baseTime = video.currentTime || 0;
                wheel.deltaX = 0;
            }
            wheel.deltaX -= deltaX;
            const nextTime = videoFloating.core.utils.clamp(
                wheel.baseTime + wheel.deltaX * (videoFloating.WHEEL_GESTURE?.seekSecondsPerPixel || 0.1),
                0,
                video.duration
            );
            video.currentTime = nextTime;
            noticeUI.showSeekNotice(video, Math.round(nextTime - wheel.baseTime));
            return true;
        };
        const stopSeekEvent = (event) => {
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        };
        const updatePointerPosition = (event) => {
            pointer.active = true;
            pointer.x = event.clientX || 0;
            pointer.y = event.clientY || 0;
        };
        const blurFocusedControl = () => {
            const active = document.activeElement;
            if (!(active instanceof HTMLElement) || targetFinder.isVideoSeekEditableTarget(active)) return;
            if (active.matches('button, a, label, [role="button"], [tabindex]')) {
                active.blur();
            }
        };
        const onWheel = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            if (targetFinder.isVideoSeekWheelBlockedTarget(event.target)) return;
            const absX = Math.abs(event.deltaX || 0);
            const absY = Math.abs(event.deltaY || 0);
            if (!absX || absX < absY * 0.8) return;

            let video = targetFinder.getSeekableVideoAtPoint(event.clientX || 0, event.clientY || 0, { includeFloating: true });
            if (!video) {
                const activeMedia = targetFinder.getVideo();
                if (activeMedia && (activeMedia.tagName === 'AUDIO' || location.hostname.includes('music.youtube.com'))) {
                    video = activeMedia;
                }
            }
            if (!video) return;
            if (videoFloating.core.config.isBackgroundSeekExcluded() && !video.closest?.('#fvp-wrapper')) return;

            stopSeekEvent(event);
            scheduleWheelReset();
            seekVideoFromWheel(video, event.deltaX || 0);
        };
        const onKeyDown = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled() || videoFloating.core.config.getFeatureConfig().hotkeys === false) return;
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (!pointer.active || targetFinder.isVideoSeekEditableTarget(event.target)) return;

            let video = targetFinder.getSeekableVideoAtPoint(pointer.x, pointer.y, { includeFloating: true });
            if (!video) {
                const activeMedia = targetFinder.getVideo();
                if (activeMedia && (activeMedia.tagName === 'AUDIO' || location.hostname.includes('music.youtube.com'))) {
                    video = activeMedia;
                }
            }
            if (!video) return;
            if (videoFloating.core.config.isBackgroundSeekExcluded() && !video.closest?.('#fvp-wrapper')) return;

            const step = Math.max(1, Number(videoFloating.core.config.getFeatureConfig().forwardStep) || 5);
            stopSeekEvent(event);
            blurFocusedControl();
            seekVideoBy(video, event.key === 'ArrowRight' ? step : -step);
        };

        const install = () => {
            window.addEventListener('pointermove', updatePointerPosition, { capture: true, passive: true });
            window.addEventListener('pointerdown', updatePointerPosition, { capture: true, passive: true });
            window.addEventListener('wheel', onWheel, { capture: true, passive: false });
            document.addEventListener('keydown', onKeyDown, true);

            return () => {
                window.removeEventListener('pointermove', updatePointerPosition, { capture: true, passive: true });
                window.removeEventListener('pointerdown', updatePointerPosition, { capture: true, passive: true });
                window.removeEventListener('wheel', onWheel, { capture: true, passive: false });
                document.removeEventListener('keydown', onKeyDown, true);
                clearTimeout(wheel.resetTimer);
            };
        };

        return { install };
    };
})();
