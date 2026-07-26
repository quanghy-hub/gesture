(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = ext.videoScreenshot = ext.videoScreenshot || {};

    videoScreenshot.createCaptureRegion = (ctx) => {
        const { CONFIG, buildFilename, fallbackDownload } = videoScreenshot;

        let regionModeActive = false;
        let regionDragging = false;
        let regionStart = null;
        let regionOverlay = null;
        let regionShade = null;
        let regionBox = null;
        let regionHint = null;
        let regionCompleteHandler = null;

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
            if (!ctx.isFeatureEnabled() || !canUseRegionScreenshot() || regionModeActive) {
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
        
        const isRegionModeActive = () => regionModeActive;

        return {
            startRegionMode,
            downloadRegion,
            removeRegionOverlay,
            canUseRegionScreenshot,
            isRegionModeActive
        };
    };
})();
