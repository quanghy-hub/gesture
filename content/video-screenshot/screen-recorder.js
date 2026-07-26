(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = ext.videoScreenshot = ext.videoScreenshot || {};

    videoScreenshot.createScreenRecorder = (ctx, regionCapture) => {
        const { CONFIG, buildRecordingFilename, fallbackDownload } = videoScreenshot;

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
            if (!ctx.isFeatureEnabled() || !canUseScreenRecorder() || recorder) {
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
            if (!ctx.isFeatureEnabled() || !canUseScreenRecorder() || recorder || regionCapture.isRegionModeActive()) {
                return;
            }
            regionCapture.startRegionMode({
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

        const isRecording = () => !!recorder;

        return {
            toggleScreenRecording,
            stopScreenRecording,
            canUseScreenRecorder,
            isRecording
        };
    };
})();
