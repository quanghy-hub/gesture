(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = ext.quickSearch = ext.quickSearch || {};
    const { imageBubbleOffsetY } = quickSearch.CONFIG;

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
