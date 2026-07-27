(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { WHEEL_GESTURE } = videoFloating;
    const { clamp } = videoFloating.core.utils;
    const { TOUCH_SWITCH_VIDEO_EVENT } = videoFloating.core.config;

    videoFloating.createIframeGestures = (deps) => {
        const { videoManager, getFloatingActive, postIframeState } = deps;

        let wheelDeltaY = 0;
        let wheelGestureResetTimer = 0;
        let wheelSeekBaseTime = null;
        let wheelSeekDeltaX = 0;
        let lastWheelSwitchAt = 0;
        let hasSwitchedInCurrentGesture = false;

        const scheduleWheelGestureReset = () => {
            clearTimeout(wheelGestureResetTimer);
            wheelGestureResetTimer = window.setTimeout(() => {
                wheelDeltaY = 0;
                wheelSeekBaseTime = null;
                wheelSeekDeltaX = 0;
                wheelGestureResetTimer = 0;
                hasSwitchedInCurrentGesture = false;
            }, WHEEL_GESTURE.idleMs);
        };

        const getWheelDeltaPixels = (event) => {
            const delta = Number(event?.deltaY) || 0;
            if (event?.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
            if (event?.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * Math.max(1, innerHeight);
            return delta;
        };

        const seekFromWheel = (deltaX) => {
            const video = videoManager.getCurrentIframeVideo();
            if (!video?.duration) return false;
            if (wheelSeekBaseTime === null) {
                wheelSeekBaseTime = video.currentTime || 0;
                wheelSeekDeltaX = 0;
            }
            wheelSeekDeltaX -= deltaX;
            video.currentTime = clamp(wheelSeekBaseTime + wheelSeekDeltaX * WHEEL_GESTURE.seekSecondsPerPixel, 0, video.duration);
            postIframeState();
            return true;
        };

        const onWheel = (event) => {
            if (!getFloatingActive()) return;
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
            scheduleWheelGestureReset();

            const absX = Math.abs(event.deltaX || 0);
            const absY = Math.abs(event.deltaY || 0);
            if (absX > 0 && absX >= absY * 0.8) {
                seekFromWheel(event.deltaX || 0);
                return;
            }

            if (hasSwitchedInCurrentGesture) return;

            wheelDeltaY += getWheelDeltaPixels(event);
            if (Math.abs(wheelDeltaY) < WHEEL_GESTURE.switchThreshold) return;

            const now = performance.now();
            if (now - lastWheelSwitchAt < WHEEL_GESTURE.switchCooldownMs) return;

            const dir = wheelDeltaY > 0 ? 1 : -1;
            videoManager.switchIframeVideo(dir);
            hasSwitchedInCurrentGesture = true;
            wheelDeltaY -= dir * WHEEL_GESTURE.switchThreshold;
            if (Math.sign(wheelDeltaY) !== dir) wheelDeltaY = 0;
            lastWheelSwitchAt = now;
            postIframeState();
            setTimeout(postIframeState, 80);
        };

        const onTouchSwitchVideo = (event) => {
            const dir = Number(event.detail?.dir) || 0;
            if (!dir) return;
            videoManager.switchIframeVideo(dir > 0 ? 1 : -1);
            postIframeState();
        };

        const install = () => {
            window.addEventListener('wheel', onWheel, { capture: true, passive: false });
            window.addEventListener(TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);

            return () => {
                window.removeEventListener('wheel', onWheel, { capture: true, passive: false });
                window.removeEventListener(TOUCH_SWITCH_VIDEO_EVENT, onTouchSwitchVideo);
                clearTimeout(wheelGestureResetTimer);
            };
        };

        return { install };
    };
})();
