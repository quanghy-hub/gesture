(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createGesturesHandler = (ctx, floatingSession, seekController, uiControls, shell, postToFloatedIframe) => {
        const { clamp, $ } = videoFloating.core.utils;

        const isWrapperToggleBlockedTarget = (target) => {
            const node = target instanceof Element ? target : null;
            if (!node) return false;
            return Boolean(
                node.closest('#fvp-left-panel, #fvp-ctrl, #fvp-res-popup, .fvp-resize-handle, button, input, select, textarea, a, label')
            );
        };

        const setupWrapperGestures = () => {
            const TAP_MOVE_THRESHOLD = 10;
            const POINTER_SWITCH_THRESHOLD = 28;
            const POINTER_SWITCH_DIAGONAL_RATIO = 1.3;
            const wheelGestureConfig = videoFloating.WHEEL_GESTURE || {
                idleMs: 300,
                seekSecondsPerPixel: 0.1,
                switchThreshold: 120,
                switchCooldownMs: 500
            };

            let wrapperPointerId = null;
            let wrapperStartX = 0;
            let wrapperStartY = 0;
            let wrapperPointerType = '';
            let wrapperMoved = false;
            let wrapperSwitchDir = 0;

            let wheelDeltaY = 0;
            let wheelGestureResetTimer = 0;
            let wheelSeekBaseTime = null;
            let wheelSeekDeltaX = 0;
            let lastWheelSwitchAt = 0;
            let hasSwitchedInCurrentGesture = false;

            const resetWrapperTap = () => {
                wrapperPointerId = null;
                wrapperPointerType = '';
                wrapperMoved = false;
                wrapperSwitchDir = 0;
            };

            const switchFromWrapper = (dir) => {
                if (ctx.floatedIframe) {
                    postToFloatedIframe?.({ command: dir > 0 ? 'next-video' : 'prev-video' });
                    return;
                }
                if (ctx.curVid) {
                    floatingSession.switchVid(dir);
                }
            };

            const scheduleWheelGestureReset = () => {
                clearTimeout(wheelGestureResetTimer);
                wheelGestureResetTimer = window.setTimeout(() => {
                    wheelDeltaY = 0;
                    wheelSeekBaseTime = null;
                    wheelSeekDeltaX = 0;
                    wheelGestureResetTimer = 0;
                    hasSwitchedInCurrentGesture = false;
                }, wheelGestureConfig.idleMs);
            };

            const getWheelDeltaPixels = (event) => {
                const delta = Number(event?.deltaY) || 0;
                if (event?.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
                if (event?.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * Math.max(1, innerHeight);
                return delta;
            };

            const seekFromWheel = (deltaX) => {
                if (ctx.floatedIframe) {
                    const duration = ctx.iframePlaybackState.duration || 0;
                    if (!duration) return false;
                    if (wheelSeekBaseTime === null) {
                        wheelSeekBaseTime = ctx.iframePlaybackState.currentTime || 0;
                        wheelSeekDeltaX = 0;
                    }
                    wheelSeekDeltaX += deltaX;
                    const nextTime = clamp(wheelSeekBaseTime + wheelSeekDeltaX * wheelGestureConfig.seekSecondsPerPixel, 0, duration);
                    postToFloatedIframe?.({ command: 'seek-to-ratio', ratio: nextTime / duration });
                    seekController.renderSeekPreview(nextTime / duration);
                    return true;
                }
                if (!ctx.curVid?.duration) return false;
                if (wheelSeekBaseTime === null) {
                    wheelSeekBaseTime = ctx.curVid.currentTime || 0;
                    wheelSeekDeltaX = 0;
                }
                wheelSeekDeltaX += deltaX;
                const nextTime = clamp(
                    wheelSeekBaseTime + wheelSeekDeltaX * wheelGestureConfig.seekSecondsPerPixel,
                    0,
                    ctx.curVid.duration
                );
                ctx.curVid.currentTime = nextTime;
                seekController.renderSeekPreview(nextTime / ctx.curVid.duration);
                return true;
            };

            const handleWrapperPointerDown = (event) => {
                if (event.button !== undefined && event.button !== 0) return;
                if (isWrapperToggleBlockedTarget(event.target)) return;
                if (ctx.box?.style.display === 'none') return;
                wrapperPointerId = event.pointerId ?? 'mouse';
                wrapperStartX = event.clientX ?? 0;
                wrapperStartY = event.clientY ?? 0;
                wrapperPointerType = event.pointerType || 'mouse';
                wrapperMoved = false;
                wrapperSwitchDir = 0;
            };

            const handleWrapperPointerMove = (event) => {
                if ((event.pointerId ?? 'mouse') !== wrapperPointerId) return;
                const dx = (event.clientX ?? 0) - wrapperStartX;
                const dy = (event.clientY ?? 0) - wrapperStartY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                if (!wrapperMoved && Math.hypot(dx, dy) >= TAP_MOVE_THRESHOLD) {
                    wrapperMoved = true;
                }
                if (wrapperPointerType !== 'mouse' || wrapperSwitchDir) return;
                if (absDy < POINTER_SWITCH_THRESHOLD || absDy / (absDx + 1) < POINTER_SWITCH_DIAGONAL_RATIO) return;
                wrapperSwitchDir = dy < 0 ? 1 : -1;
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
            };

            const handleWrapperPointerEnd = (event) => {
                if ((event.pointerId ?? 'mouse') !== wrapperPointerId) return;
                const switchDir = wrapperSwitchDir;
                const shouldToggle =
                    !wrapperMoved &&
                    !switchDir &&
                    !ctx.state.isDrag &&
                    !ctx.state.isResize &&
                    !ctx.state.isSeeking &&
                    !ctx.state.seekDragActive &&
                    !isWrapperToggleBlockedTarget(event.target);
                resetWrapperTap();
                if (switchDir) {
                    switchFromWrapper(switchDir);
                    if (event.cancelable) event.preventDefault();
                    event.stopPropagation();
                    return;
                }
                if (!shouldToggle) return;
                uiControls.togglePlayback();
                if (event.cancelable) event.preventDefault();
                event.stopPropagation();
            };

            const handleWrapperPointerCancel = (event) => {
                if ((event.pointerId ?? 'mouse') !== wrapperPointerId) return;
                resetWrapperTap();
            };

            const handleWrapperWheel = (event) => {
                if (ctx.box?.style.display === 'none') return;
                if (isWrapperToggleBlockedTarget(event.target)) return;
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
                if (Math.abs(wheelDeltaY) < wheelGestureConfig.switchThreshold) return;

                const now = performance.now();
                if (now - lastWheelSwitchAt < wheelGestureConfig.switchCooldownMs) return;

                const dir = wheelDeltaY > 0 ? 1 : -1;
                hasSwitchedInCurrentGesture = true;
                wheelDeltaY -= dir * wheelGestureConfig.switchThreshold;
                if (Math.sign(wheelDeltaY) !== dir) wheelDeltaY = 0;
                lastWheelSwitchAt = now;
                switchFromWrapper(dir);
            };

            const wrapperEl = $('fvp-wrapper');
            wrapperEl.addEventListener('pointerdown', handleWrapperPointerDown, true);
            wrapperEl.addEventListener('pointermove', handleWrapperPointerMove, true);
            wrapperEl.addEventListener('pointerup', handleWrapperPointerEnd, true);
            wrapperEl.addEventListener('pointercancel', handleWrapperPointerCancel, true);
            wrapperEl.addEventListener('wheel', handleWrapperWheel, { capture: true, passive: false });
            ctx.cleanup.push(() => {
                wrapperEl.removeEventListener('pointerdown', handleWrapperPointerDown, true);
                wrapperEl.removeEventListener('pointermove', handleWrapperPointerMove, true);
                wrapperEl.removeEventListener('pointerup', handleWrapperPointerEnd, true);
                wrapperEl.removeEventListener('pointercancel', handleWrapperPointerCancel, true);
                wrapperEl.removeEventListener('wheel', handleWrapperWheel, { capture: true, passive: false });
                clearTimeout(wheelGestureResetTimer);
            });
        };

        return {
            setupWrapperGestures
        };
    };
})();
