(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createTouchSwipeSeek = (targetFinder, noticeUI) => {
        const emitTouchSwitchVideo = (dir) => {
            if (!dir) return;
            window.dispatchEvent(
                new CustomEvent(videoFloating.core.config.TOUCH_SWITCH_VIDEO_EVENT || 'fvp-touch-switch-video', { detail: { dir } })
            );
        };

        const stopTouchEventForFloating = (event) => {
            if (event.cancelable) event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation?.();
        };

        const swipe = {
            active: false,
            video: null,
            bridge: null,
            startedInsideFloatingBox: false,
            startX: 0,
            startY: 0,
            startTime: 0,
            lastUpdate: 0,
            lastDelta: 0,
            cancelled: false,
            gesture: '',
            allowVerticalSwitch: false,
            pendingSwitchDir: 0
        };

        const resetSwipe = () => {
            swipe.active = false;
            swipe.cancelled = false;
            swipe.video = null;
            swipe.bridge = null;
            swipe.startedInsideFloatingBox = false;
            swipe.lastDelta = 0;
            swipe.gesture = '';
            swipe.allowVerticalSwitch = false;
            swipe.pendingSwitchDir = 0;
        };

        const onTouchStart = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            resetSwipe();
            const point = event.touches?.length === 1 ? event.touches[0] : null;
            if (!point) return;
            try {
                const floatingBox = videoFloating.core.utils.$('fvp-container');
                const isFloatingBoxVisible = !!(floatingBox && floatingBox.style.display !== 'none');
                const floatingBoxRect = isFloatingBoxVisible ? videoFloating.core.utils.getRect(floatingBox) : null;
                const startedInsideFloatingBox = !!(
                    floatingBoxRect &&
                    point.clientX >= floatingBoxRect.left &&
                    point.clientX <= floatingBoxRect.right &&
                    point.clientY >= floatingBoxRect.top &&
                    point.clientY <= floatingBoxRect.bottom
                );
                if (startedInsideFloatingBox && targetFinder.isFloatingGestureBlockedTarget(event.target)) return;
                if (!startedInsideFloatingBox && videoFloating.core.config.isBackgroundSeekExcluded()) return;

                const wrapper = startedInsideFloatingBox ? videoFloating.core.utils.$('fvp-wrapper') : null;
                const wrapperRect = wrapper ? videoFloating.core.utils.getRect(wrapper) : null;
                let video =
                    startedInsideFloatingBox && wrapperRect?.width && wrapperRect?.height
                        ? targetFinder.getFloatingActiveVideo(wrapper)
                        : targetFinder.getVideoAtPoint(point.clientX, point.clientY);

                if (!video && !startedInsideFloatingBox) {
                    const activeMedia = targetFinder.getVideo();
                    if (activeMedia) {
                        const isAudio = activeMedia.tagName === 'AUDIO';
                        const isYtMusic = location.hostname.includes('music.youtube.com');
                        const isPlaying = !activeMedia.paused && activeMedia.currentTime > 0;
                        if (isAudio || isYtMusic || isPlaying) {
                            video = activeMedia;
                        }
                    }
                }

                if (!video && startedInsideFloatingBox) {
                    const bridge = targetFinder.getFloatedIframeSeekBridge?.();
                    if (bridge && Number.isFinite(bridge.getDuration()) && bridge.getDuration() > 0) {
                        stopTouchEventForFloating(event);
                        Object.assign(swipe, {
                            bridge,
                            video: null,
                            active: true,
                            startedInsideFloatingBox,
                            startX: point.clientX,
                            startY: point.clientY,
                            startTime: bridge.getCurrentTime() || 0,
                            lastUpdate: performance.now(),
                            allowVerticalSwitch: startedInsideFloatingBox || window !== window.top
                        });
                        return;
                    }
                }

                if (!video?.isConnected || !Number.isFinite(video.duration) || video.duration <= 0) return;
                const rect =
                    startedInsideFloatingBox && wrapperRect?.width && wrapperRect?.height
                        ? wrapperRect
                        : videoFloating.core.utils.getRect(video);

                const isAudioOrHidden =
                    video.tagName === 'AUDIO' || location.hostname.includes('music.youtube.com') || !rect.width || !rect.height;
                if (!isAudioOrHidden) {
                    if (!rect.width || !rect.height) return;
                    const bottomGuard = startedInsideFloatingBox ? 60 : Math.min(44, Math.max(18, rect.height * 0.1));
                    if (point.clientY > rect.bottom - bottomGuard) return;
                }
                if (startedInsideFloatingBox) {
                    stopTouchEventForFloating(event);
                }
                Object.assign(swipe, {
                    video,
                    active: true,
                    startedInsideFloatingBox,
                    startX: point.clientX,
                    startY: point.clientY,
                    startTime: video.currentTime,
                    lastUpdate: performance.now(),
                    allowVerticalSwitch: startedInsideFloatingBox || window !== window.top
                });
            } catch {
                resetSwipe();
            }
        };

        const onTouchMove = (event) => {
            if (!swipe.active || (!swipe.video && !swipe.bridge) || swipe.cancelled) return;
            const vfConfig = videoFloating.core.config.getFeatureConfig();
            const point = event.touches?.length === 1 ? event.touches[0] : null;
            if (!point || (swipe.video && !swipe.video.isConnected)) {
                swipe.cancelled = true;
                return;
            }
            const dx = point.clientX - swipe.startX;
            const dy = point.clientY - swipe.startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if (absDx < 5 && absDy < 5) return;
            const lockDistance = Math.max(12, Math.round(vfConfig.minSwipeDistance * 0.55));
            const commitDistance = Math.max(18, Math.round(vfConfig.minSwipeDistance * 0.7));
            const diagonalRatio = Math.max(1.12, vfConfig.diagonalThreshold * 0.78);
            const horizontalSlack = Math.max(vfConfig.verticalTolerance, 120);
            if (!swipe.gesture) {
                const verticalDominant = absDy >= lockDistance && absDy > absDx && absDy / (absDx + 1) >= diagonalRatio;
                const horizontalDominant = absDx >= lockDistance && absDx > absDy && absDx / (absDy + 1) >= diagonalRatio;
                if (swipe.allowVerticalSwitch && verticalDominant) {
                    swipe.gesture = 'switch';
                } else if (horizontalDominant) {
                    swipe.gesture = 'seek';
                } else if (absDx >= commitDistance && absDy > horizontalSlack) {
                    swipe.cancelled = true;
                    return;
                }
            }
            if (swipe.gesture === 'switch') {
                if (absDy < commitDistance) return;
                swipe.pendingSwitchDir = dy < 0 ? 1 : -1;
                if (swipe.startedInsideFloatingBox) {
                    stopTouchEventForFloating(event);
                } else if (event.cancelable) event.preventDefault();
                return;
            }
            if (swipe.gesture !== 'seek') return;
            if (absDx < commitDistance) return;
            if (absDx > absDy && swipe.startedInsideFloatingBox) {
                stopTouchEventForFloating(event);
            } else if (absDx > absDy && event.cancelable) event.preventDefault();
            const scale = absDx < vfConfig.shortThreshold ? vfConfig.swipeShort : vfConfig.swipeLong;
            const effectiveMinDistance = Math.max(12, Math.round(vfConfig.minSwipeDistance * 0.45));
            const delta = Math.round((dx > 0 ? dx - effectiveMinDistance : dx + effectiveMinDistance) * scale);
            swipe.lastDelta = delta;
            const seekDuration = swipe.bridge ? swipe.bridge.getDuration() : swipe.video?.duration || 0;
            if (swipe.bridge) noticeUI.showSeekNotice({ duration: seekDuration, parentElement: videoFloating.core.utils.$('fvp-container') }, delta);
            else noticeUI.showSeekNotice(swipe.video, delta);
            const now = performance.now();
            if (vfConfig.realtimePreview && now - swipe.lastUpdate > vfConfig.throttle) {
                swipe.lastUpdate = now;
                if (swipe.bridge) {
                    if (seekDuration > 0) swipe.bridge.seekToRatio(videoFloating.core.utils.clamp(swipe.startTime + delta, 0, seekDuration) / seekDuration);
                } else {
                    swipe.video.currentTime = videoFloating.core.utils.clamp(swipe.startTime + delta, 0, swipe.video.duration);
                }
            }
        };

        const onTouchEnd = (event) => {
            if (!swipe.active || (!swipe.video && !swipe.bridge)) return;
            const vfConfig = videoFloating.core.config.getFeatureConfig();
            if (swipe.startedInsideFloatingBox) {
                stopTouchEventForFloating(event);
            }
            if (!swipe.cancelled && swipe.gesture === 'switch' && swipe.pendingSwitchDir) {
                emitTouchSwitchVideo(swipe.pendingSwitchDir);
            } else if (!swipe.cancelled && !vfConfig.realtimePreview) {
                if (swipe.bridge) {
                    const duration = swipe.bridge.getDuration();
                    if (duration > 0) swipe.bridge.seekToRatio(videoFloating.core.utils.clamp(swipe.startTime + (swipe.lastDelta || 0), 0, duration) / duration);
                } else if (swipe.video?.isConnected) {
                    swipe.video.currentTime = videoFloating.core.utils.clamp(swipe.startTime + (swipe.lastDelta || 0), 0, swipe.video.duration);
                }
            } else if (!swipe.cancelled && swipe.bridge && swipe.lastDelta) {
                const duration = swipe.bridge.getDuration();
                if (duration > 0) swipe.bridge.seekToRatio(videoFloating.core.utils.clamp(swipe.startTime + swipe.lastDelta, 0, duration) / duration);
            }
            resetSwipe();
        };

        const install = () => {
            document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
            document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
            document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });

            return () => {
                document.removeEventListener('touchstart', onTouchStart, { capture: true, passive: false });
                document.removeEventListener('touchmove', onTouchMove, { capture: true, passive: false });
                document.removeEventListener('touchend', onTouchEnd, { capture: true, passive: false });
            };
        };

        return { install };
    };
})();
