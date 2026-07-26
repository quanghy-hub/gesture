(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.interactions = videoFloating.interactions || {};

    let noticeEl = null;
    let hideTimer = 0;

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
                const video = (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') ? node : node.closest?.('video, audio');
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

    const ensureNotice = (video) => {
        if (!video) return null;
        const fs = videoFloating.core.utils.getFullscreenEl();
        const container = (fs && (fs === video || fs.contains(video))) ? fs : (video.parentElement || document.body);
        if (!noticeEl || !container.contains(noticeEl)) {
            noticeEl?.remove();
            noticeEl = document.createElement('div');
            noticeEl.className = 'vf-notice';
            if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
            container.appendChild(noticeEl);
        }
        noticeEl.style.fontSize = `${videoFloating.core.config.getFeatureConfig().noticeFontSize}px`;
        return noticeEl;
    };

    const showSeekNotice = (video, delta) => {
        const notice = ensureNotice(video);
        if (!notice) return;
        notice.textContent = `${delta >= 0 ? '▶ +' : '◀ '}${delta}s`;
        notice.classList.add('show');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => notice.classList.remove('show'), 700);
    };

    const emitTouchSwitchVideo = (dir) => {
        if (!dir) return;
        window.dispatchEvent(new CustomEvent(videoFloating.core.config.TOUCH_SWITCH_VIDEO_EVENT || 'fvp-touch-switch-video', { detail: { dir } }));
    };

    const isFloatingGestureBlockedTarget = (target) => {
        const node = target instanceof Element ? target : null;
        if (!node) return false;
        return Boolean(node.closest('#fvp-left-panel, #fvp-ctrl, #fvp-res-popup, .fvp-resize-handle, button, input, select, textarea, a, label'));
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

    const stopTouchEventForFloating = (event) => {
        if (event.cancelable) event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
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

    videoFloating.interactions.installTouchSwipeSeek = () => {
        const swipe = {
            active: false,
            video: null,
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
                const startedInsideFloatingBox = !!(floatingBoxRect
                    && point.clientX >= floatingBoxRect.left
                    && point.clientX <= floatingBoxRect.right
                    && point.clientY >= floatingBoxRect.top
                    && point.clientY <= floatingBoxRect.bottom);
                if (startedInsideFloatingBox && isFloatingGestureBlockedTarget(event.target)) return;
                if (!startedInsideFloatingBox && videoFloating.core.config.isBackgroundSeekExcluded()) return;

                const wrapper = startedInsideFloatingBox ? videoFloating.core.utils.$('fvp-wrapper') : null;
                const wrapperRect = wrapper ? videoFloating.core.utils.getRect(wrapper) : null;
                let video = (startedInsideFloatingBox && wrapperRect?.width && wrapperRect?.height)
                    ? getFloatingActiveVideo(wrapper)
                    : getVideoAtPoint(point.clientX, point.clientY);

                if (!video && !startedInsideFloatingBox) {
                    const activeMedia = getVideo();
                    if (activeMedia) {
                        const isAudio = activeMedia.tagName === 'AUDIO';
                        const isYtMusic = location.hostname.includes('music.youtube.com');
                        const isPlaying = !activeMedia.paused && activeMedia.currentTime > 0;
                        if (isAudio || isYtMusic || isPlaying) {
                            video = activeMedia;
                        }
                    }
                }

                if (!video?.isConnected || !Number.isFinite(video.duration) || video.duration <= 0) return;
                const rect = (startedInsideFloatingBox && wrapperRect?.width && wrapperRect?.height) ? wrapperRect : videoFloating.core.utils.getRect(video);

                const isAudioOrHidden = video.tagName === 'AUDIO' || location.hostname.includes('music.youtube.com') || !rect.width || !rect.height;
                if (!isAudioOrHidden) {
                    if (!rect.width || !rect.height) return;
                    const bottomGuard = startedInsideFloatingBox
                        ? 60
                        : Math.min(44, Math.max(18, rect.height * 0.1));
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
            if (!swipe.active || !swipe.video || swipe.cancelled) return;
            const vfConfig = videoFloating.core.config.getFeatureConfig();
            const point = event.touches?.length === 1 ? event.touches[0] : null;
            if (!point || !swipe.video.isConnected) {
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
                const verticalDominant = absDy >= lockDistance
                    && absDy > absDx
                    && absDy / (absDx + 1) >= diagonalRatio;
                const horizontalDominant = absDx >= lockDistance
                    && absDx > absDy
                    && absDx / (absDy + 1) >= diagonalRatio;
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
            showSeekNotice(swipe.video, delta);
            const now = performance.now();
            if (vfConfig.realtimePreview && now - swipe.lastUpdate > vfConfig.throttle) {
                swipe.lastUpdate = now;
                swipe.video.currentTime = videoFloating.core.utils.clamp(swipe.startTime + delta, 0, swipe.video.duration);
            }
        };

        const onTouchEnd = (event) => {
            if (!swipe.active || !swipe.video) return;
            const vfConfig = videoFloating.core.config.getFeatureConfig();
            if (swipe.startedInsideFloatingBox) {
                stopTouchEventForFloating(event);
            }
            if (!swipe.cancelled && swipe.gesture === 'switch' && swipe.pendingSwitchDir) {
                emitTouchSwitchVideo(swipe.pendingSwitchDir);
            } else if (!swipe.cancelled && !vfConfig.realtimePreview && swipe.video.isConnected) {
                swipe.video.currentTime = videoFloating.core.utils.clamp(swipe.startTime + (swipe.lastDelta || 0), 0, swipe.video.duration);
            }
            resetSwipe();
        };

        document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
        document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
        document.addEventListener('touchend', onTouchEnd, { capture: true, passive: false });

        return () => {
            document.removeEventListener('touchstart', onTouchStart, { capture: true, passive: false });
            document.removeEventListener('touchmove', onTouchMove, { capture: true, passive: false });
            document.removeEventListener('touchend', onTouchEnd, { capture: true, passive: false });
        };
    };

    videoFloating.interactions.installWheelKeyboardSeek = () => {
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
            showSeekNotice(video, Math.round(deltaSeconds));
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
            showSeekNotice(video, Math.round(nextTime - wheel.baseTime));
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
            if (!(active instanceof HTMLElement) || isVideoSeekEditableTarget(active)) return;
            if (active.matches('button, a, label, [role="button"], [tabindex]')) {
                active.blur();
            }
        };
        const onWheel = (event) => {
            if (!videoFloating.core.config.isFeatureEnabled()) return;
            if (isVideoSeekWheelBlockedTarget(event.target)) return;
            const absX = Math.abs(event.deltaX || 0);
            const absY = Math.abs(event.deltaY || 0);
            if (!absX || absX < absY * 0.8) return;

            let video = getSeekableVideoAtPoint(event.clientX || 0, event.clientY || 0, { includeFloating: true });
            if (!video) {
                const activeMedia = getVideo();
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
            if (!pointer.active || isVideoSeekEditableTarget(event.target)) return;

            let video = getSeekableVideoAtPoint(pointer.x, pointer.y, { includeFloating: true });
            if (!video) {
                const activeMedia = getVideo();
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
})();
