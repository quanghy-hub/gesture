(() => {
    const ext = globalThis.GestureExtension;
    const floating = ext.shared.floatingCore;
    const { queryAllDeep } = ext.shared.domUtils;

    const CONFIG = {
        minVideoWidth: 200,
        minVideoHeight: 150,
        shortcutKey: 's',
        regionShortcutCode: 'F4',
        recordShortcutCode: 'F8',
        triggerSize: 52,
        triggerMargin: 12,
        minRegionSize: 8,
        minRecordWidth: 48,
        minRecordHeight: 48,
        recordControlGap: 8,
        recordControlSize: 34
    };

    const ICON = floating.icons.camera;

    const getDefaultTriggerPosition = () => ({
        left: Math.max(CONFIG.triggerMargin, window.innerWidth - CONFIG.triggerSize - 18),
        top: Math.max(CONFIG.triggerMargin, window.innerHeight - CONFIG.triggerSize - 96)
    });

    const buildFilename = () => {
        const base = ext.shared.domUtils.sanitizeFilename(document.title || 'screenshot') || 'screenshot';
        return `${base}_${Date.now()}.png`;
    };

    const buildRecordingFilename = () => {
        const base = ext.shared.domUtils.sanitizeFilename(document.title || 'screen-recording') || 'screen-recording';
        return `${base}_${Date.now()}.webm`;
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
        shouldRun: ({ runtime }) => runtime.isHttpPage() && runtime.isHtmlDocument(),
        init: (context) => {
            let observer = null;
            let removeShortcutListener = () => { };
            let removeDragBinding = () => { };
            let syncTimer = 0;
            let triggerRef = null;
            let regionModeActive = false;
            let regionDragging = false;
            let regionStart = null;
            let regionOverlay = null;
            let regionShade = null;
            let regionBox = null;
            let regionHint = null;
            let regionCompleteHandler = null;
            let recorder = null;
            let recorderStream = null;
            let recorderChunks = [];
            let recorderBadge = null;
            let recorderCanvas = null;
            let recorderContext = null;
            let recorderVideo = null;
            let recorderFrameId = 0;
            let recorderControl = null;
            let recorderPauseButton = null;
            let recorderStopButton = null;
            let recorderBorder = null;

            const isFeatureEnabled = () => context?.getConfig?.()?.videoScreenshot?.enabled !== false;

            const posStorage = floating.createPositionStorage(
                'gesture_video_screenshot_trigger_pos_v1',
                getDefaultTriggerPosition()
            );

            const ensureStyles = () => {
                if (document.getElementById('gesture-video-screenshot-style')) {
                    return;
                }
                floating.ensureSharedActionButtonStyles();
                const style = document.createElement('style');
                style.id = 'gesture-video-screenshot-style';
                style.textContent = `
                    .gesture-video-screenshot-trigger {
                        width: 46px;
                        height: 46px;
                        touch-action: none;
                    }
                    .gesture-video-screenshot-trigger svg {
                        width: 28px !important;
                        height: 28px !important;
                    }
                    .gesture-screen-screenshot-overlay {
                        position: fixed;
                        inset: 0;
                        z-index: 2147483647;
                        cursor: crosshair;
                        user-select: none;
                        touch-action: none;
                    }
                    .gesture-screen-screenshot-shade {
                        position: absolute;
                        inset: 0;
                        background: rgba(0, 0, 0, .32);
                    }
                    .gesture-screen-screenshot-box {
                        position: absolute;
                        display: none;
                        border: 2px solid #2f8cff;
                        background: rgba(47, 140, 255, .16);
                        box-shadow: 0 0 0 9999px rgba(0, 0, 0, .2);
                        box-sizing: border-box;
                    }
                    .gesture-screen-screenshot-hint {
                        position: absolute;
                        left: 50%;
                        top: 18px;
                        transform: translateX(-50%);
                        padding: 7px 10px;
                        border-radius: 6px;
                        background: rgba(18, 22, 30, .92);
                        color: #fff;
                        font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                        white-space: nowrap;
                        pointer-events: none;
                    }
                    .gesture-screen-record-badge {
                        position: fixed;
                        left: 50%;
                        top: 18px;
                        z-index: 2147483646;
                        transform: translateX(-50%);
                        padding: 7px 10px;
                        border-radius: 6px;
                        background: rgba(185, 28, 28, .94);
                        color: #fff;
                        font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                        pointer-events: none;
                        user-select: none;
                    }
                    .gesture-screen-record-border {
                        position: fixed;
                        z-index: 2147483646;
                        pointer-events: none;
                        outline: 2px solid #ef4444;
                        outline-offset: 0;
                        box-shadow: 0 0 0 1px rgba(255, 255, 255, .9), 0 0 0 9999px rgba(0, 0, 0, .08);
                    }
                    .gesture-screen-record-control {
                        position: fixed;
                        z-index: 2147483646;
                        display: flex;
                        gap: 6px;
                        padding: 4px;
                        border-radius: 6px;
                        background: rgba(18, 22, 30, .92);
                        box-shadow: 0 2px 10px rgba(0, 0, 0, .35);
                        touch-action: none;
                    }
                    .gesture-screen-record-button {
                        position: relative;
                        width: 34px;
                        height: 34px;
                        border: 0;
                        border-radius: 5px;
                        background: rgba(185, 28, 28, .94);
                        cursor: pointer;
                        touch-action: none;
                    }
                    .gesture-screen-record-button::before,
                    .gesture-screen-record-button::after {
                        content: "";
                        position: absolute;
                        background: #fff;
                    }
                    .gesture-screen-record-stop::before {
                        left: 10px;
                        top: 10px;
                        width: 14px;
                        height: 14px;
                        border-radius: 2px;
                    }
                    .gesture-screen-record-pause::before,
                    .gesture-screen-record-pause::after {
                        top: 9px;
                        width: 5px;
                        height: 16px;
                        border-radius: 1px;
                    }
                    .gesture-screen-record-pause::before {
                        left: 10px;
                    }
                    .gesture-screen-record-pause::after {
                        right: 10px;
                    }
                    .gesture-screen-record-pause.is-paused::before {
                        left: 12px;
                        top: 8px;
                        width: 0;
                        height: 0;
                        border-top: 9px solid transparent;
                        border-bottom: 9px solid transparent;
                        border-left: 13px solid #fff;
                        border-radius: 0;
                        background: transparent;
                    }
                    .gesture-screen-record-pause.is-paused::after {
                        display: none;
                    }
                `;
                (document.head || document.documentElement).appendChild(style);
            };

            const isExcludedPage = () => /(^|\.)tiktok\.com$/i.test(window.location.hostname);
            const isEligibleVideo = (video) => Boolean(
                video &&
                video.isConnected &&
                video.videoWidth &&
                video.videoHeight &&
                video.getBoundingClientRect &&
                video.getBoundingClientRect().width >= CONFIG.minVideoWidth &&
                video.getBoundingClientRect().height >= CONFIG.minVideoHeight
            );

            const findActiveVideo = () => {
                const candidates = queryAllDeep('video')
                    .filter((video) => isEligibleVideo(video))
                    .map((video) => ({ video, rect: video.getBoundingClientRect() }))
                    .filter(({ rect }) =>
                        rect.top < window.innerHeight &&
                        rect.bottom > 0 &&
                        rect.left < window.innerWidth &&
                        rect.right > 0
                    )
                    .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height));
                return candidates[0]?.video || null;
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
                    const response = await ext.shared.tabActions.downloadDataUrl(url, filename);
                    if (response?.ok) {
                        return true;
                    }
                } catch {
                    // Fall through to anchor download below.
                }

                fallbackDownload(url, filename);
                return true;
            };

            const captureActiveVideo = () => {
                if (!isFeatureEnabled()) {
                    return;
                }
                const activeVideo = findActiveVideo();
                if (!activeVideo) {
                    return;
                }
                captureVideoFrame(activeVideo).catch((error) => {
                    console.error('[GestureExtension] Capture failed', error);
                });
            };

            const canUseRegionScreenshot = () => window.top === window;

            const waitForNextPaint = () => new Promise((resolve) => {
                requestAnimationFrame(() => requestAnimationFrame(resolve));
            });

            const createImageFromUrl = (url) => new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => reject(new Error('Cannot load captured screenshot'));
                image.src = url;
            });

            const normalizeRegion = (start, end) => {
                const left = Math.max(0, Math.min(start.x, end.x));
                const top = Math.max(0, Math.min(start.y, end.y));
                const right = Math.min(window.innerWidth, Math.max(start.x, end.x));
                const bottom = Math.min(window.innerHeight, Math.max(start.y, end.y));
                return {
                    left,
                    top,
                    width: Math.max(0, right - left),
                    height: Math.max(0, bottom - top)
                };
            };

            const updateRegionBox = (region) => {
                if (!regionBox) {
                    return;
                }
                regionBox.style.display = region.width && region.height ? 'block' : 'none';
                regionBox.style.left = `${region.left}px`;
                regionBox.style.top = `${region.top}px`;
                regionBox.style.width = `${region.width}px`;
                regionBox.style.height = `${region.height}px`;
            };

            const removeRegionOverlay = () => {
                regionOverlay?.remove();
                regionOverlay = null;
                regionShade = null;
                regionBox = null;
                regionHint = null;
                regionModeActive = false;
                regionDragging = false;
                regionStart = null;
                regionCompleteHandler = null;
            };

            const downloadRegion = async (region) => {
                if (region.width < CONFIG.minRegionSize || region.height < CONFIG.minRegionSize) {
                    return;
                }

                await waitForNextPaint();
                const response = await ext.shared.tabActions.captureVisibleTab();
                if (!response?.ok || !response.url) {
                    throw new Error(response?.error || 'Capture visible tab failed');
                }

                const image = await createImageFromUrl(response.url);
                const scaleX = image.naturalWidth / window.innerWidth;
                const scaleY = image.naturalHeight / window.innerHeight;
                const sx = Math.round(region.left * scaleX);
                const sy = Math.round(region.top * scaleY);
                const sw = Math.max(1, Math.round(region.width * scaleX));
                const sh = Math.max(1, Math.round(region.height * scaleY));

                const canvas = document.createElement('canvas');
                canvas.width = sw;
                canvas.height = sh;
                const canvasContext = canvas.getContext('2d');
                if (!canvasContext) {
                    throw new Error('Canvas 2D context unavailable');
                }

                canvasContext.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
                const url = canvas.toDataURL('image/png');
                const filename = buildFilename();

                try {
                    const downloadResponse = await ext.shared.tabActions.downloadDataUrl(url, filename);
                    if (downloadResponse?.ok) {
                        return;
                    }
                } catch {
                    // Fall through to anchor download below.
                }

                fallbackDownload(url, filename);
            };

            const startRegionMode = ({ hintText, onComplete }) => {
                if (!isFeatureEnabled() || !canUseRegionScreenshot() || regionModeActive) {
                    return;
                }

                regionModeActive = true;
                regionCompleteHandler = typeof onComplete === 'function' ? onComplete : null;
                regionOverlay = document.createElement('div');
                regionOverlay.className = 'gesture-screen-screenshot-overlay';
                regionShade = document.createElement('div');
                regionShade.className = 'gesture-screen-screenshot-shade';
                regionBox = document.createElement('div');
                regionBox.className = 'gesture-screen-screenshot-box';
                regionHint = document.createElement('div');
                regionHint.className = 'gesture-screen-screenshot-hint';
                regionHint.textContent = hintText || 'Giữ chuột trái và kéo để chọn vùng';

                regionOverlay.append(regionShade, regionBox, regionHint);
                document.documentElement.appendChild(regionOverlay);

                regionOverlay.addEventListener('pointerdown', onRegionPointerDown, true);
                regionOverlay.addEventListener('pointermove', onRegionPointerMove, true);
                regionOverlay.addEventListener('pointerup', onRegionPointerUp, true);
                regionOverlay.addEventListener('pointercancel', onRegionPointerCancel, true);
            };

            const onRegionPointerDown = (event) => {
                if (event.button !== 0) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                regionDragging = true;
                regionStart = { x: event.clientX, y: event.clientY };
                regionHint?.remove();
                regionHint = null;
                regionOverlay?.setPointerCapture?.(event.pointerId);
                updateRegionBox({ left: event.clientX, top: event.clientY, width: 0, height: 0 });
            };

            const onRegionPointerMove = (event) => {
                if (!regionDragging || !regionStart) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                updateRegionBox(normalizeRegion(regionStart, { x: event.clientX, y: event.clientY }));
            };

            const onRegionPointerUp = (event) => {
                if (!regionDragging || !regionStart || event.button !== 0) {
                    return;
                }
                event.preventDefault();
                event.stopPropagation();
                const region = normalizeRegion(regionStart, { x: event.clientX, y: event.clientY });
                const onComplete = regionCompleteHandler;
                removeRegionOverlay();
                onComplete?.(region);
            };

            const onRegionPointerCancel = (event) => {
                event.preventDefault();
                event.stopPropagation();
                removeRegionOverlay();
            };

            const canUseScreenRecorder = () => window.top === window
                && !!navigator.mediaDevices?.getDisplayMedia
                && typeof MediaRecorder !== 'undefined';

            const getRecorderMimeType = () => {
                const candidates = [
                    'video/webm;codecs=vp9',
                    'video/webm;codecs=vp8',
                    'video/webm'
                ];
                return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
            };

            const showRecorderBadge = () => {
                if (recorderBadge) {
                    return;
                }
                recorderBadge = document.createElement('div');
                recorderBadge.className = 'gesture-screen-record-badge';
                recorderBadge.textContent = 'Đang ghi hình - F8 để dừng';
                document.documentElement.appendChild(recorderBadge);
            };

            const hideRecorderBadge = () => {
                recorderBadge?.remove();
                recorderBadge = null;
            };

            const hideRecorderControl = () => {
                recorderControl?.remove();
                recorderControl = null;
                recorderPauseButton = null;
                recorderStopButton = null;
            };

            const hideRecorderBorder = () => {
                recorderBorder?.remove();
                recorderBorder = null;
            };

            const showRecorderBorder = (region) => {
                hideRecorderBorder();
                recorderBorder = document.createElement('div');
                recorderBorder.className = 'gesture-screen-record-border';
                recorderBorder.style.left = `${region.left}px`;
                recorderBorder.style.top = `${region.top}px`;
                recorderBorder.style.width = `${region.width}px`;
                recorderBorder.style.height = `${region.height}px`;
                document.documentElement.appendChild(recorderBorder);
            };

            const getRecorderControlPosition = (region) => {
                const width = (CONFIG.recordControlSize * 2) + 14;
                const height = CONFIG.recordControlSize + 8;
                const gap = CONFIG.recordControlGap;
                const centeredLeft = region.left + (region.width - width) / 2;
                if (region.top >= height + gap) {
                    return {
                        left: Math.min(window.innerWidth - width, Math.max(0, centeredLeft)),
                        top: region.top - height - gap
                    };
                }
                if (window.innerHeight - region.top - region.height >= height + gap) {
                    return {
                        left: Math.min(window.innerWidth - width, Math.max(0, centeredLeft)),
                        top: region.top + region.height + gap
                    };
                }
                if (window.innerWidth - region.left - region.width >= width + gap) {
                    return {
                        left: region.left + region.width + gap,
                        top: Math.min(window.innerHeight - height, Math.max(0, region.top))
                    };
                }
                if (region.left >= width + gap) {
                    return {
                        left: region.left - width - gap,
                        top: Math.min(window.innerHeight - height, Math.max(0, region.top))
                    };
                }
                return {
                    left: Math.min(window.innerWidth - width, Math.max(0, centeredLeft)),
                    top: 0
                };
            };

            const syncRecorderPauseButton = () => {
                if (!recorderPauseButton || !recorder) {
                    return;
                }
                const paused = recorder.state === 'paused';
                recorderPauseButton.classList.toggle('is-paused', paused);
                recorderPauseButton.title = paused ? 'Tiếp tục ghi hình' : 'Tạm dừng ghi hình';
                recorderPauseButton.setAttribute('aria-label', paused ? 'Tiếp tục ghi hình' : 'Tạm dừng ghi hình');
                if (recorderBadge) {
                    recorderBadge.textContent = paused ? 'Đang tạm dừng - F8 để dừng' : 'Đang ghi hình - F8 để dừng';
                }
            };

            const showRecorderControl = (region) => {
                hideRecorderControl();
                const position = getRecorderControlPosition(region);
                recorderControl = document.createElement('div');
                recorderControl.className = 'gesture-screen-record-control';
                recorderControl.style.left = `${position.left}px`;
                recorderControl.style.top = `${position.top}px`;

                recorderPauseButton = document.createElement('button');
                recorderPauseButton.type = 'button';
                recorderPauseButton.className = 'gesture-screen-record-button gesture-screen-record-pause';
                recorderStopButton = document.createElement('button');
                recorderStopButton.type = 'button';
                recorderStopButton.className = 'gesture-screen-record-button gesture-screen-record-stop';
                recorderStopButton.title = 'Dừng ghi hình (F8)';
                recorderStopButton.setAttribute('aria-label', 'Dừng ghi hình');

                recorderControl.addEventListener('pointerdown', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }, true);
                recorderPauseButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    toggleScreenRecordingPause();
                }, true);
                recorderStopButton.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    stopScreenRecording();
                }, true);
                recorderControl.append(recorderPauseButton, recorderStopButton);
                document.documentElement.appendChild(recorderControl);
                syncRecorderPauseButton();
            };

            const downloadRecording = (blob) => {
                if (!blob?.size) {
                    return;
                }
                const url = URL.createObjectURL(blob);
                fallbackDownload(url, buildRecordingFilename());
                window.setTimeout(() => URL.revokeObjectURL(url), 30000);
            };

            const cleanupRecorder = () => {
                recorderStream?.getTracks?.().forEach((track) => {
                    try {
                        track.stop();
                    } catch {
                        // Track may already be stopped by the browser UI.
                    }
                });
                if (recorderFrameId) {
                    cancelAnimationFrame(recorderFrameId);
                }
                recorder = null;
                recorderStream = null;
                recorderChunks = [];
                recorderCanvas = null;
                recorderContext = null;
                recorderVideo = null;
                recorderFrameId = 0;
                hideRecorderBadge();
                hideRecorderControl();
                hideRecorderBorder();
            };

            const stopScreenRecording = () => {
                if (!recorder) {
                    cleanupRecorder();
                    return;
                }
                if (recorder.state !== 'inactive') {
                    try {
                        recorder.requestData();
                    } catch {
                        // Some engines throw if no data is currently buffered.
                    }
                    recorder.stop();
                    return;
                }
                cleanupRecorder();
            };

            const toggleScreenRecordingPause = () => {
                if (!recorder) {
                    return;
                }
                if (recorder.state === 'recording') {
                    recorder.pause();
                } else if (recorder.state === 'paused') {
                    recorder.resume();
                }
                syncRecorderPauseButton();
            };

            const startScreenRecording = async (region) => {
                if (!isFeatureEnabled() || !canUseScreenRecorder() || recorder) {
                    return;
                }
                if (region.width < CONFIG.minRecordWidth || region.height < CONFIG.minRecordHeight) {
                    return;
                }

                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: {
                        displaySurface: 'browser',
                        frameRate: 30
                    },
                    preferCurrentTab: true,
                    audio: false
                });
                const mimeType = getRecorderMimeType();
                const options = mimeType ? { mimeType } : undefined;
                recorderStream = stream;
                recorderChunks = [];
                recorderVideo = document.createElement('video');
                recorderVideo.muted = true;
                recorderVideo.playsInline = true;
                recorderVideo.srcObject = stream;
                await new Promise((resolve, reject) => {
                    recorderVideo.onloadedmetadata = resolve;
                    recorderVideo.onerror = () => reject(new Error('Cannot load screen recording stream'));
                });
                await recorderVideo.play();

                const scaleX = recorderVideo.videoWidth / window.innerWidth;
                const scaleY = recorderVideo.videoHeight / window.innerHeight;
                const sx = Math.round(region.left * scaleX);
                const sy = Math.round(region.top * scaleY);
                const sw = Math.max(1, Math.round(region.width * scaleX));
                const sh = Math.max(1, Math.round(region.height * scaleY));
                recorderCanvas = document.createElement('canvas');
                recorderCanvas.width = sw;
                recorderCanvas.height = sh;
                recorderContext = recorderCanvas.getContext('2d');
                if (!recorderContext) {
                    throw new Error('Canvas 2D context unavailable');
                }

                const drawFrame = () => {
                    if (!recorderVideo || !recorderContext || !recorderCanvas) {
                        return;
                    }
                    recorderContext.drawImage(recorderVideo, sx, sy, sw, sh, 0, 0, recorderCanvas.width, recorderCanvas.height);
                    recorderFrameId = requestAnimationFrame(drawFrame);
                };
                drawFrame();

                recorder = new MediaRecorder(recorderCanvas.captureStream(30), options);

                recorder.addEventListener('dataavailable', (event) => {
                    if (event.data?.size) {
                        recorderChunks.push(event.data);
                    }
                });
                recorder.addEventListener('stop', () => {
                    const blob = new Blob(recorderChunks, { type: mimeType || 'video/webm' });
                    cleanupRecorder();
                    downloadRecording(blob);
                }, { once: true });
                recorder.addEventListener('pause', syncRecorderPauseButton);
                recorder.addEventListener('resume', syncRecorderPauseButton);
                stream.getTracks().forEach((track) => {
                    track.addEventListener('ended', stopScreenRecording, { once: true });
                });

                recorder.start(1000);
                showRecorderBadge();
                showRecorderBorder(region);
                showRecorderControl(region);
            };

            const startRecordRegionMode = () => {
                if (!isFeatureEnabled() || !canUseScreenRecorder() || recorder || regionModeActive) {
                    return;
                }
                startRegionMode({
                    hintText: 'Giữ chuột trái và kéo để chọn vùng ghi hình',
                    onComplete: (region) => {
                        startScreenRecording(region).catch((error) => {
                            cleanupRecorder();
                            console.error('[GestureExtension] Screen recording failed', error);
                        });
                    }
                });
            };

            const toggleScreenRecording = () => {
                if (recorder) {
                    stopScreenRecording();
                    return;
                }
                startRecordRegionMode();
            };

            const ensureTrigger = () => {
                if (triggerRef) {
                    return triggerRef;
                }

                triggerRef = floating.createActionButton({
                    className: 'gesture-video-screenshot-trigger',
                    htmlContent: ICON,
                    title: 'Chụp màn hình video (S)',
                    ariaLabel: 'Chụp màn hình video',
                    hidden: true,
                    position: 'fixed',
                    zIndex: '2147483646'
                });

                removeDragBinding = floating.bindDragBehavior({
                    target: triggerRef.element,
                    threshold: 6,
                    getInitialPosition: () => ({
                        left: triggerRef.element.getBoundingClientRect().left,
                        top: triggerRef.element.getBoundingClientRect().top
                    }),
                    onMove: ({ deltaX, deltaY, origin }) => {
                        const next = floating.clampFixedPosition({
                            left: origin.left + deltaX,
                            top: origin.top + deltaY,
                            width: CONFIG.triggerSize,
                            height: CONFIG.triggerSize,
                            margin: CONFIG.triggerMargin
                        });
                        triggerRef.setPosition(next.left, next.top);
                        triggerRef.element.classList.add('is-dragging');
                    },
                    onDragEnd: () => {
                        triggerRef.element.classList.remove('is-dragging');
                        const rect = triggerRef.element.getBoundingClientRect();
                        posStorage.save(rect.left, rect.top);
                    },
                    onClick: ({ event }) => {
                        floating.stopFloatingEvent(event);
                        captureActiveVideo();
                    }
                });

                triggerRef.element.addEventListener('pointerdown', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }, true);

                posStorage.load().then(({ left, top }) => {
                    const pos = floating.clampFixedPosition({
                        left,
                        top,
                        width: CONFIG.triggerSize,
                        height: CONFIG.triggerSize,
                        margin: CONFIG.triggerMargin
                    });
                    triggerRef?.setPosition(pos.left, pos.top);
                });

                return triggerRef;
            };

            const syncTrigger = () => {
                window.clearTimeout(syncTimer);
                syncTimer = 0;
                const hasVideo = !!findActiveVideo();
                const trigger = ensureTrigger();
                if (isFeatureEnabled() && hasVideo) {
                    trigger.show('inline-flex');
                } else {
                    trigger.hide();
                }
            };

            const queueSyncTrigger = () => {
                if (syncTimer) {
                    return;
                }
                syncTimer = window.setTimeout(syncTrigger, 80);
            };

            const bindKeyboardShortcut = () => {
                const onKeyDown = (event) => {
                    if (regionModeActive && event.key === 'Escape') {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        removeRegionOverlay();
                        return;
                    }
                    if (recorder && event.code === CONFIG.recordShortcutCode) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        stopScreenRecording();
                        return;
                    }

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
                    if (event.code === CONFIG.regionShortcutCode) {
                        if (!isFeatureEnabled() || !canUseRegionScreenshot()) {
                            return;
                        }
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        startRegionMode({
                            hintText: 'Giữ chuột trái và kéo để chụp vùng',
                            onComplete: (region) => {
                                downloadRegion(region).catch((error) => {
                                    console.error('[GestureExtension] Region capture failed', error);
                                });
                            }
                        });
                        return;
                    }
                    if (event.code === CONFIG.recordShortcutCode) {
                        if (!isFeatureEnabled() || !canUseScreenRecorder()) {
                            return;
                        }
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        toggleScreenRecording();
                        return;
                    }
                    if (event.key.toLowerCase() !== CONFIG.shortcutKey) {
                        return;
                    }
                    if (!isFeatureEnabled()) {
                        return;
                    }
                    if (!findActiveVideo()) {
                        return;
                    }
                    event.preventDefault();
                    captureActiveVideo();
                };
                document.addEventListener('keydown', onKeyDown, true);
                return () => document.removeEventListener('keydown', onKeyDown, true);
            };

            const startObserver = () => {
                observer = new MutationObserver(() => {
                    queueSyncTrigger();
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
            ensureTrigger();
            syncTrigger();
            removeShortcutListener = bindKeyboardShortcut();
            window.addEventListener('resize', queueSyncTrigger);
            window.addEventListener('scroll', queueSyncTrigger, true);

            if (document.body) {
                startObserver();
            } else {
                window.addEventListener('DOMContentLoaded', () => {
                    syncTrigger();
                    startObserver();
                }, { once: true });
            }

            return {
                onConfigChange() {
                    if (!isFeatureEnabled()) {
                        removeRegionOverlay();
                        stopScreenRecording();
                    }
                    queueSyncTrigger();
                },
                destroy() {
                    observer?.disconnect();
                    removeShortcutListener();
                    removeDragBinding();
                    removeRegionOverlay();
                    stopScreenRecording();
                    window.removeEventListener('resize', queueSyncTrigger);
                    window.removeEventListener('scroll', queueSyncTrigger, true);
                    window.clearTimeout(syncTimer);
                    triggerRef?.destroy();
                }
            };
        }
    };
})();
