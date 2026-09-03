(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});
    const { queryAllDeep } = ext.shared.domUtils;

    videoScreenshot.createCaptureVideo = (ctx) => {
        const { CONFIG, buildFilename, fallbackDownload } = videoScreenshot;

        const showCaptureToast = (message, video) => {
            const rect = video?.getBoundingClientRect?.();
            const x = rect && rect.width ? Math.round(rect.left + rect.width / 2) : Math.round(window.innerWidth / 2);
            const y = rect && rect.height ? Math.round(rect.top + rect.height / 2) : Math.round(window.innerHeight / 2);
            ext.shared.toastCore?.createToast?.(message, x, y, 2200);
        };

        const isEligibleVideo = (video) =>
            Boolean(
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
                .filter(({ rect }) => rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0)
                .sort((left, right) => right.rect.width * right.rect.height - left.rect.width * left.rect.height);
            return candidates[0]?.video || null;
        };

        const captureVideoFrame = async (video) => {
            if (!video?.videoWidth || !video?.videoHeight) {
                return false;
            }

            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const canvasContext = canvas.getContext('2d');
            if (!canvasContext) {
                throw new Error('Canvas 2D context unavailable');
            }
            canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
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
            if (!ctx.isFeatureEnabled()) {
                return;
            }
            const activeVideo = findActiveVideo();
            if (!activeVideo) {
                showCaptureToast('Không tìm thấy video phù hợp để chụp', null);
                return;
            }
            captureVideoFrame(activeVideo)
                .then(() => {
                    showCaptureToast('Đã lưu ảnh chụp video', activeVideo);
                })
                .catch((error) => {
                    // Canvas bị "taint" khi video cross-origin thiếu CORS header.
                    if (error?.name === 'SecurityError') {
                        showCaptureToast('Video bị bảo vệ (cross-origin), không thể chụp', activeVideo);
                    } else {
                        showCaptureToast('Chụp ảnh video thất bại', activeVideo);
                    }
                    console.error('[GestureExtension] Capture failed', error);
                });
        };

        return {
            findActiveVideo,
            captureActiveVideo
        };
    };
})();
