(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = ext.quickSearch = ext.quickSearch || {};
    const { imageBubbleOffsetY, minImageSidePx, minImageAreaPx, minNaturalImageSidePx } = quickSearch.CONFIG;

    const IMAGE_UI_HINT_RE = /\b(icon|logo|avatar|emoji|badge|sprite|thumbnail|thumb|favicon|mask)\b/i;

    const getPositiveNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    const hasUiImageHints = (image) => {
        const text = [
            image.className,
            image.id,
            image.getAttribute('alt'),
            image.getAttribute('aria-label'),
            image.getAttribute('data-icon'),
            image.getAttribute('itemprop')
        ].filter(Boolean).join(' ');
        return IMAGE_UI_HINT_RE.test(text);
    };

    quickSearch.imageSession = {
        getImageElement(target) {
            if (!(target instanceof Element) || target.closest('.gesture-quick-search-bubble')) {
                return null;
            }
            if (target instanceof HTMLImageElement) {
                return target;
            }
            return target.closest('picture')?.querySelector('img') ?? null;
        },
        getImageAnchor(image, event = null) {
            if (!(image instanceof HTMLImageElement)) {
                return null;
            }
            const rect = image.getBoundingClientRect();
            if (!rect || (rect.width <= 0 && rect.height <= 0)) {
                return event ? { x: event.clientX + 6, y: event.clientY + 6 } : null;
            }
            return {
                x: rect.left + (rect.width / 2),
                y: rect.bottom + imageBubbleOffsetY
            };
        },
        isSearchableImage(image) {
            if (!(image instanceof HTMLImageElement) || !image.isConnected) {
                return false;
            }

            const rect = image.getBoundingClientRect();
            if (!rect || rect.width <= 0 || rect.height <= 0) {
                return false;
            }

            const width = rect.width;
            const height = rect.height;
            const area = width * height;
            const naturalWidth = getPositiveNumber(image.naturalWidth);
            const naturalHeight = getPositiveNumber(image.naturalHeight);
            const smallestSide = Math.min(width, height);
            const smallestNaturalSide = Math.min(naturalWidth || width, naturalHeight || height);

            if (smallestSide < minImageSidePx || area < minImageAreaPx) {
                return false;
            }

            if (smallestNaturalSide < minNaturalImageSidePx) {
                return false;
            }

            if (hasUiImageHints(image) && area < minImageAreaPx * 3) {
                return false;
            }

            if (image.closest('button, a[role="button"], [role="button"], .icon, .btn, .button')) {
                return false;
            }

            return true;
        },
        resolveImageUrl(image) {
            if (!(image instanceof HTMLImageElement)) {
                return '';
            }
            const candidates = [
                image.currentSrc,
                image.src,
                image.getAttribute('data-src'),
                image.getAttribute('data-lazy-src'),
                image.getAttribute('data-original'),
                image.getAttribute('data-url')
            ];
            const preferred = candidates.find((url) => typeof url === 'string' && url && !url.startsWith('data:') && !url.startsWith('blob:'));
            return preferred || candidates.find((url) => typeof url === 'string' && url) || '';
        }
    };
})();
