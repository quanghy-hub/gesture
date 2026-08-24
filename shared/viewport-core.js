(() => {
    const ext = globalThis.GestureExtension;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    const parsePx = (value, fallbackValue) => {
        const parsed = parseFloat(String(value ?? ''));
        return Number.isFinite(parsed) ? parsed : fallbackValue;
    };

    const clampFixedPosition = ({ left = 0, top = 0, width = 0, height = 0, margin = 8 }) => ({
        left: clamp(left, margin, Math.max(margin, window.innerWidth - width - margin)),
        top: clamp(top, margin, Math.max(margin, window.innerHeight - height - margin))
    });

    const normalizeFixedLayout = ({
        layout,
        fallbackLayout,
        minWidth = 0,
        minHeight = 0,
        maxWidth = Math.max(minWidth, window.innerWidth),
        maxHeight = Math.max(minHeight, window.innerHeight),
        margin = 8
    }) => {
        const fallbackWidth = parsePx(fallbackLayout?.width, minWidth);
        const fallbackHeight = parsePx(fallbackLayout?.height, minHeight);
        const width = clamp(parsePx(layout?.width, fallbackWidth), minWidth, Math.max(minWidth, maxWidth));
        const height = clamp(parsePx(layout?.height, fallbackHeight), minHeight, Math.max(minHeight, maxHeight));
        const pos = clampFixedPosition({
            left: parsePx(layout?.left, parsePx(fallbackLayout?.left, margin)),
            top: parsePx(layout?.top, parsePx(fallbackLayout?.top, margin)),
            width,
            height,
            margin
        });

        return {
            width: `${Math.round(width)}px`,
            height: `${Math.round(height)}px`,
            left: `${Math.round(pos.left)}px`,
            top: `${Math.round(pos.top)}px`
        };
    };

    const fitPanelToViewport = ({
        anchorLeft = 0,
        anchorTop = 0,
        panelWidth = 0,
        panelHeight = 0,
        preferredLeft = anchorLeft,
        preferredTop = anchorTop,
        margin = 8
    }) =>
        clampFixedPosition({
            left: preferredLeft,
            top: preferredTop,
            width: panelWidth,
            height: panelHeight,
            margin
        });

    ext.shared.viewportCore = {
        clamp,
        clampFixedPosition,
        fitPanelToViewport,
        normalizeFixedLayout,
        parsePx
    };
})();
