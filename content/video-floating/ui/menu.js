(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.ui = videoFloating.ui || {};

    const menuVideoIcon =
        '<svg class="fvp-menu-icon-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16h-4.4l-3.3 3.1c-.65.62-1.8.16-1.8-.74V16H6.5A2.5 2.5 0 0 1 4 13.5zm6.2 1.9v3.2c0 .62.67 1 1.2.68l2.7-1.6a.8.8 0 0 0 0-1.36l-2.7-1.6a.8.8 0 0 0-1.2.68Z"/></svg>';

    videoFloating.ui.createMenu = (ctx) => {
        let floatingSession = null;

        const setFloatingSession = (fs) => {
            floatingSession = fs;
        };
        const { el } = videoFloating.core.utils;
        const { isFeatureEnabled } = videoFloating.core.config;

        const getAvailableMediaItems = () => {
            const videoItems = floatingSession.getOrderedVideoSequence().map((video, index) => ({
                type: 'video',
                key: `video-${index}`,
                label: `Video ${index + 1}`,
                active: video === ctx.curVid,
                onSelect: () => floatingSession.float(video)
            }));
            const tracked = videoFloating.media.detector.getTrackedIframeEntries(ctx.iframeVideoMap);
            const trackedSet = new Set(tracked.map(([iframe]) => iframe));
            let fallback = [];
            try {
                const detector = videoFloating.media.detector;
                const utils = videoFloating.core.utils;
                const allIframes = utils?.queryAllDeep ? utils.queryAllDeep('iframe') : [...document.querySelectorAll('iframe')];
                const directVideos = videoFloating.media.detector.getDirectVideos?.() || [];
                fallback = allIframes
                    .filter((iframe) => !trackedSet.has(iframe))
                    .filter((iframe) => !iframe.closest?.('#fvp-wrapper'))
                    .filter((iframe) => detector.isLikelyVideoIframe?.(iframe))
                    .filter((iframe) => !detector.isRedundantIframeCandidate?.(iframe, directVideos))
                    .filter((iframe) => {
                        const rect = iframe.getBoundingClientRect?.();
                        const w = Math.max(iframe.offsetWidth || 0, rect?.width || 0);
                        const h = Math.max(iframe.offsetHeight || 0, rect?.height || 0);
                        if (w > 0 && h > 0 && (w < 32 || h < 32)) return false;
                        return true;
                    })
                    .map((iframe) => [iframe, 0]);
            } catch {
                void 0;
            }
            const allIframeEntries = [...tracked, ...fallback];
            const iframeItems = allIframeEntries.map(([iframe], index) => {
                const domain = (() => {
                    try {
                        return new URL(iframe.src).hostname;
                    } catch {
                        return 'iframe';
                    }
                })();
                return {
                    type: 'iframe',
                    key: `iframe-${index}`,
                    label: `iFrame: ${domain}`,
                    active: iframe === ctx.floatedIframe,
                    onSelect: () => floatingSession.floatIframe(iframe)
                };
            });
            return [...videoItems, ...iframeItems];
        };

        const renderMenu = () => {
            const items = getAvailableMediaItems();
            const menu = ctx.menuRef.element;
            menu.innerHTML = '';
            if (!items.length) {
                menu.innerHTML = '<div class="fvp-menu-item" style="opacity:0.5">No videos found</div>';
                return;
            }
            items.forEach((entry) => {
                const item = el(
                    'div',
                    `fvp-menu-item${entry.active ? ' active' : ''}`,
                    `<span class="fvp-menu-icon">${menuVideoIcon}</span><span>${entry.label}</span>`
                );
                item.onclick = () => {
                    entry.onSelect();
                    ctx.menuRef.hide();
                };
                menu.appendChild(item);
            });
        };

        const openMenuAtAnchor = (anchor) => {
            if (!ctx.menuRef || !anchor) return;
            if (!isFeatureEnabled()) {
                ctx.menuRef.hide();
                return;
            }
            const rect = anchor.getBoundingClientRect();
            ctx.menuRef.element.style.width = '';
            ctx.menuRef.element.style.maxHeight = '';

            const clamp = videoFloating.core.utils.clamp;
            ctx.menuRef.setPosition(clamp(rect.left, 10, innerWidth - 206), innerHeight - rect.bottom < 300 ? 'auto' : rect.bottom + 10);
            if (innerHeight - rect.bottom < 300) ctx.menuRef.element.style.bottom = `${innerHeight - rect.top + 10}px`;
            else ctx.menuRef.element.style.bottom = 'auto';

            renderMenu();
            ctx.menuRef.show('flex');
        };

        const floatFirstAvailableMedia = () => {
            if (!isFeatureEnabled()) return;
            const preferredVideo = videoFloating.media.detector.getDirectVideos()[0];
            if (preferredVideo) {
                ctx.menuRef?.hide();
                floatingSession.float(preferredVideo);
                return;
            }
            floatFirstAvailableMedia.fallbackToMenuItems?.();
        };

        // Exposed so core/controller.js's override can delegate the iframe fallback
        // back here instead of silently dropping it.
        floatFirstAvailableMedia.fallbackToMenuItems = () => {
            const [firstItem] = getAvailableMediaItems();
            if (!firstItem) {
                ctx.menuRef?.hide();
                return;
            }
            ctx.menuRef?.hide();
            firstItem.onSelect();
        };

        return {
            openMenuAtAnchor,
            floatFirstAvailableMedia,
            menuVideoIcon,
            setFloatingSession
        };
    };
})();
