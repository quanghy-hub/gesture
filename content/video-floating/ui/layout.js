(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.ui = videoFloating.ui || {};

    videoFloating.ui.createLayoutManager = (ctx) => {
        const { $ } = videoFloating.core.utils;

        const MOBILE_VIEWPORT_MAX_WIDTH = 640;
        const MOBILE_EDGE_OVERSCAN = 2;

        const isMobileViewport = () => window.innerWidth <= MOBILE_VIEWPORT_MAX_WIDTH;

        const getBoxViewportInsets = () => ({
            horizontal: isMobileViewport() ? 0 : 8,
            vertical: 8
        });

        const getMaxBoxWidth = () => {
            const { horizontal } = getBoxViewportInsets();
            return Math.max(200, window.innerWidth - horizontal * 2 + (isMobileViewport() ? MOBILE_EDGE_OVERSCAN : 0));
        };

        const expandMobileEdgeWidth = (width) => (
            isMobileViewport() && width >= window.innerWidth - MOBILE_EDGE_OVERSCAN
                ? getMaxBoxWidth()
                : width
        );

        const clampBoxPosition = ({ left = 0, top = 0, width = 0, height = 0 }) => {
            const { horizontal, vertical } = getBoxViewportInsets();
            const minLeft = isMobileViewport() && width >= window.innerWidth
                ? -Math.ceil(MOBILE_EDGE_OVERSCAN / 2)
                : horizontal;
            return {
                left: Math.min(
                    Math.max(minLeft, left),
                    Math.max(minLeft, window.innerWidth - width - horizontal)
                ),
                top: Math.min(
                    Math.max(vertical, top),
                    Math.max(vertical, window.innerHeight - height - vertical)
                )
            };
        };

        const getDefaultLayout = () => {
            const { horizontal, vertical } = getBoxViewportInsets();
            const preferredWidth = window.innerWidth <= 640
                ? window.innerWidth - horizontal * 2 + MOBILE_EDGE_OVERSCAN
                : Math.round(window.innerWidth * 0.88);
            const width = Math.min(Math.max(preferredWidth, 260), Math.max(260, Math.min(680, getMaxBoxWidth())));
            const height = Math.min(Math.max(Math.round(width * 9 / 16), 160), Math.max(160, window.innerHeight - vertical * 2));
            const centered = {
                left: Math.max(isMobileViewport() ? -Math.ceil(MOBILE_EDGE_OVERSCAN / 2) : horizontal, Math.round((window.innerWidth - width) / 2)),
                top: Math.max(vertical, Math.round((window.innerHeight - height) / 2))
            };
            return { width: `${width}px`, height: `${height}px`, left: `${centered.left}px`, top: `${centered.top}px`, borderRadius: '12px' };
        };

        const getNormalizedLayout = (layout) => {
            const fallback = getDefaultLayout();
            const parsePx = (value, fallbackNumber) => ext.shared.viewportCore?.parsePx?.(value, fallbackNumber) ?? (() => {
                const parsed = parseFloat(String(value || ''));
                return Number.isFinite(parsed) ? parsed : fallbackNumber;
            })();
            const fallbackWidth = parsePx(fallback.width, 320);
            const fallbackHeight = parsePx(fallback.height, 180);
            const { horizontal, vertical } = getBoxViewportInsets();
            const normalized = ext.shared.viewportCore?.normalizeFixedLayout?.({
                layout,
                fallbackLayout: fallback,
                minWidth: 200,
                minHeight: 120,
                maxWidth: getMaxBoxWidth(),
                maxHeight: Math.max(120, window.innerHeight - vertical * 2),
                margin: Math.min(horizontal, vertical)
            });
            if (normalized) {
                const width = expandMobileEdgeWidth(parsePx(normalized.width, fallbackWidth));
                const height = parsePx(normalized.height, fallbackHeight);
                const pos = clampBoxPosition({
                    left: parsePx(normalized.left, parsePx(fallback.left, horizontal)),
                    top: parsePx(normalized.top, parsePx(fallback.top, vertical)),
                    width,
                    height
                });
                return {
                    width: `${Math.round(width)}px`,
                    height: `${Math.round(height)}px`,
                    left: `${Math.round(pos.left)}px`,
                    top: `${Math.round(pos.top)}px`,
                    borderRadius: layout?.borderRadius || fallback.borderRadius || '12px'
                };
            }
            const width = expandMobileEdgeWidth(Math.min(Math.max(parsePx(layout?.width, fallbackWidth), 200), getMaxBoxWidth()));
            const height = Math.min(Math.max(parsePx(layout?.height, fallbackHeight), 120), Math.max(120, window.innerHeight - vertical * 2));
            const pos = clampBoxPosition({
                left: parsePx(layout?.left, parsePx(fallback.left, horizontal)),
                top: parsePx(layout?.top, parsePx(fallback.top, vertical)),
                width,
                height
            });
            return { width: `${Math.round(width)}px`, height: `${Math.round(height)}px`, left: `${Math.round(pos.left)}px`, top: `${Math.round(pos.top)}px`, borderRadius: layout?.borderRadius || fallback.borderRadius };
        };

        const updateLeftPanelLayout = () => {
            const panel = $('fvp-left-panel');
            if (!panel || !ctx.box || ctx.box.style.display === 'none') return;
            const visibleItems = [...panel.children].filter((node) => {
                if (!(node instanceof HTMLElement)) return false;
                if (node.id === 'fvp-res-popup') return false;
                const style = getComputedStyle(node);
                return style.display !== 'none' && style.position !== 'absolute';
            });
            const itemCount = visibleItems.length;
            if (!itemCount) return;

            const panelStyle = getComputedStyle(panel);
            const rowGap = parseFloat(panelStyle.rowGap || '4') || 4;
            const cellHeight = parseFloat(panelStyle.gridAutoRows || '30') || 30;
            const reservedTop = 12;
            const reservedBottom = 68;
            const availableHeight = Math.max(cellHeight, ctx.box.clientHeight - reservedTop - reservedBottom);
            const rows = Math.max(1, Math.min(itemCount, Math.floor((availableHeight + rowGap) / (cellHeight + rowGap))));

            panel.style.gridAutoFlow = 'column';
            panel.style.gridTemplateRows = `repeat(${rows}, ${cellHeight}px)`;
            panel.style.gridAutoColumns = `${cellHeight}px`;
            panel.style.columnGap = `${rowGap}px`;
        };

        const applyBoxLayout = (layout) => {
            if (!ctx.box) return;
            const next = getNormalizedLayout(layout);
            ctx.box.style.width = next.width;
            ctx.box.style.height = next.height;
            ctx.box.style.left = next.left;
            ctx.box.style.top = next.top;
            ctx.box.style.borderRadius = next.borderRadius;
            updateLeftPanelLayout();
            return next;
        };

        const persistCurrentBoxLayout = () => {
            if (!ctx.box) return;
            videoFloating.core.config.saveLayout({ 
                top: ctx.box.style.top, 
                left: ctx.box.style.left, 
                width: ctx.box.style.width, 
                height: ctx.box.style.height, 
                borderRadius: ctx.box.style.borderRadius 
            });
        };

        return {
            getMaxBoxWidth,
            getBoxViewportInsets,
            clampBoxPosition,
            getNormalizedLayout,
            updateLeftPanelLayout,
            applyBoxLayout,
            persistCurrentBoxLayout
        };
    };
})();
