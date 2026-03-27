(() => {
    const ext = globalThis.GestureExtension;

    const CONFIG = {
        buttonSize: 26,
        buttonTop: 40,
        buttonLeft: 10,
        minVideoWidth: 200,
        minVideoHeight: 150,
        fadeDelay: 3000,
        hideDelay: 3000,
        fadeOpacity: 0.4,
        minOpacity: 0.15,
        tapThreshold: 20,
        shortcutKey: 's'
    };

    const ICON = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
    `;

    const IS_MOBILE = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const managedVideos = new WeakMap();

    const buildFilename = () => {
        const base = ext.shared.domUtils.sanitizeFilename(document.title || 'screenshot') || 'screenshot';
        return `${base}_${Date.now()}.png`;
    };
    const fallbackDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };

    ext.features.videoScreenshot = {
        shouldRun: ({ runtime }) => runtime.isHttpPage(),
        init: () => {
            let observer = null;

            const ensureStyles = () => {
                if (document.getElementById('gesture-video-screenshot-style')) {
                    return;
                }
                const style = document.createElement('style');
                style.id = 'gesture-video-screenshot-style';
                style.textContent = `
                    .gesture-video-screenshot-container {
                        position: absolute;
                        top: 40px;
                        left: 10px;
                        z-index: 2147483644;
                        opacity: 1;
                        transition: opacity 0.5s ease;
                        pointer-events: auto;
                    }
                    .gesture-video-screenshot-button {
                        width: 26px;
                        height: 26px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 0;
                        border: none;
                        border-radius: 18px;
                        background: rgba(18, 18, 18, 0.7);
                        color: rgba(255, 255, 255, 0.45);
                        cursor: pointer;
                        backdrop-filter: blur(1px);
                        transition: background 0.15s ease, transform 0.15s ease, color 0.15s ease;
                        touch-action: manipulation;
                        -webkit-tap-highlight-color: transparent;
                    }
                    .gesture-video-screenshot-button:hover,
                    .gesture-video-screenshot-button:active {
                        background: rgba(26, 26, 26, 0.9);
                        color: #fff;
                    }
                    .gesture-video-screenshot-button:hover {
                        transform: scale(1.08);
                    }
                    .gesture-video-screenshot-button:active {
                        transform: scale(0.95);
                    }
                    .gesture-video-screenshot-button svg {
                        width: 20px;
                        height: 20px;
                    }
                `;
                (document.head || document.documentElement).appendChild(style);
            };

            const isExcludedPage = () => /(^|\.)tiktok\.com$/i.test(window.location.hostname);
            const isEligibleVideo = (video) => Boolean(
                video &&
                video.isConnected &&
                video.offsetWidth >= CONFIG.minVideoWidth &&
                video.offsetHeight >= CONFIG.minVideoHeight
            );

            const ensureRelativeParent = (video) => {
                const parent = video.parentElement;
                if (!parent) {
                    return null;
                }
                const currentPosition = window.getComputedStyle(parent).position;
                if (currentPosition === 'static') {
                    parent.dataset.gestureVideoScreenshotPositionManaged = 'true';
                    parent.style.position = 'relative';
                }
                return parent;
            };

            const captureVideoFrame = async (video) => {
                if (!video?.videoWidth || !video?.videoHeight) {
                    return false;
                }

                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const context = canvas.getContext('2d');
                if (!context) {
                    throw new Error('Canvas 2D context unavailable');
                }
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const url = canvas.toDataURL('image/png');
                const filename = buildFilename();

                try {
                    const downloadId = await chrome.downloads.download({
                        url,
                        filename,
                        saveAs: false
                    });
                    return !!downloadId;
                } catch {
                    fallbackDownload(url, filename);
                    return true;
                }
            };

            const createAutoHideController = (container) => {
                let fadeTimer = 0;
                let hideTimer = 0;
                const clearTimers = () => {
                    window.clearTimeout(fadeTimer);
                    window.clearTimeout(hideTimer);
                };
                const startHide = () => {
                    clearTimers();
                    fadeTimer = window.setTimeout(() => {
                        container.style.opacity = String(CONFIG.fadeOpacity);
                        hideTimer = window.setTimeout(() => {
                            container.style.opacity = String(CONFIG.minOpacity);
                        }, CONFIG.hideDelay);
                    }, CONFIG.fadeDelay);
                };
                const show = () => {
                    clearTimers();
                    container.style.opacity = '1';
                    startHide();
                };
                return {
                    show,
                    startHide,
                    destroy: clearTimers
                };
            };

            const createButton = (video, showControls) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gesture-video-screenshot-button';
                button.title = 'Chụp màn hình video (S)';
                button.setAttribute('aria-label', 'Chụp màn hình video');
                button.innerHTML = ICON;

                const handleCapture = async (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    showControls();
                    try {
                        await captureVideoFrame(video);
                    } catch (error) {
                        console.error('[GestureExtension] Video capture failed', error);
                    }
                };

                button.addEventListener('click', (event) => {
                    handleCapture(event).catch((error) => {
                        console.error('[GestureExtension] Capture click failed', error);
                    });
                });

                if (IS_MOBILE) {
                    let touchPoint = null;
                    button.addEventListener('touchstart', (event) => {
                        const touch = event.touches[0];
                        touchPoint = touch ? { x: touch.clientX, y: touch.clientY } : null;
                        event.stopPropagation();
                    }, { passive: true });
                    button.addEventListener('touchmove', () => {
                        touchPoint = null;
                    }, { passive: true });
                    button.addEventListener('touchend', (event) => {
                        if (!touchPoint) {
                            return;
                        }
                        const touch = event.changedTouches[0];
                        if (!touch) {
                            return;
                        }
                        const deltaX = Math.abs(touch.clientX - touchPoint.x);
                        const deltaY = Math.abs(touch.clientY - touchPoint.y);
                        touchPoint = null;
                        if (deltaX < CONFIG.tapThreshold && deltaY < CONFIG.tapThreshold) {
                            handleCapture(event).catch((error) => {
                                console.error('[GestureExtension] Capture touch failed', error);
                            });
                        }
                    }, { passive: false });
                }
                return button;
            };

            const attachOverlay = (video) => {
                if (managedVideos.has(video) || !isEligibleVideo(video)) {
                    return;
                }
                const parent = ensureRelativeParent(video);
                if (!parent) {
                    return;
                }
                const container = document.createElement('div');
                container.className = 'gesture-video-screenshot-container';
                const autoHide = createAutoHideController(container);
                const button = createButton(video, autoHide.show);
                container.appendChild(button);
                parent.appendChild(container);

                const onShow = () => autoHide.show();
                const onLeave = () => autoHide.startHide();

                video.addEventListener('click', onShow);
                video.addEventListener('pointerenter', onShow);
                if (IS_MOBILE) {
                    video.addEventListener('touchstart', onShow, { passive: true });
                }
                container.addEventListener('mouseenter', onShow);
                container.addEventListener('mouseleave', onLeave);
                autoHide.show();

                managedVideos.set(video, {
                    container,
                    cleanup: () => {
                        autoHide.destroy();
                        video.removeEventListener('click', onShow);
                        video.removeEventListener('pointerenter', onShow);
                        if (IS_MOBILE) {
                            video.removeEventListener('touchstart', onShow);
                        }
                        container.removeEventListener('mouseenter', onShow);
                        container.removeEventListener('mouseleave', onLeave);
                        container.remove();
                    }
                });
            };

            const cleanupDetachedVideos = () => {
                document.querySelectorAll('video').forEach((video) => {
                    if (!managedVideos.has(video) && isEligibleVideo(video)) {
                        attachOverlay(video);
                    }
                });
            };

            const findActiveVideo = () => {
                for (const video of document.querySelectorAll('video')) {
                    const rect = video.getBoundingClientRect();
                    const isVisible =
                        rect.top < window.innerHeight &&
                        rect.bottom > 0 &&
                        rect.left < window.innerWidth &&
                        rect.right > 0;
                    if (isVisible && video.videoWidth && video.videoHeight) {
                        return video;
                    }
                }
                return null;
            };

            const bindKeyboardShortcut = () => {
                document.addEventListener('keydown', (event) => {
                    const target = event.target;
                    if (
                        !(target instanceof HTMLElement) ||
                        target.tagName === 'INPUT' ||
                        target.tagName === 'TEXTAREA' ||
                        target.isContentEditable ||
                        event.ctrlKey ||
                        event.altKey ||
                        event.metaKey
                    ) {
                        return;
                    }
                    if (event.key.toLowerCase() !== CONFIG.shortcutKey) {
                        return;
                    }
                    const activeVideo = findActiveVideo();
                    if (!activeVideo) {
                        return;
                    }
                    event.preventDefault();
                    captureVideoFrame(activeVideo).catch((error) => {
                        console.error('[GestureExtension] Shortcut capture failed', error);
                    });
                });
            };

            const startObserver = () => {
                observer = new MutationObserver(() => {
                    cleanupDetachedVideos();
                });
                observer.observe(document.body, {
                    childList: true,
                    subtree: true
                });
            };

            if (isExcludedPage()) {
                return {
                    onConfigChange() { },
                    destroy() { }
                };
            }

            ensureStyles();
            cleanupDetachedVideos();
            bindKeyboardShortcut();
            if (document.body) {
                startObserver();
            } else {
                window.addEventListener('DOMContentLoaded', () => {
                    cleanupDetachedVideos();
                    startObserver();
                }, { once: true });
            }

            return {
                onConfigChange() { },
                destroy() {
                    observer?.disconnect();
                    managedVideos.forEach?.(() => { });
                    document.querySelectorAll('video').forEach((video) => {
                        managedVideos.get(video)?.cleanup();
                    });
                }
            };
        }
    };
})();