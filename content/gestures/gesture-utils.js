(() => {
    const ext = globalThis.GestureExtension;
    const gestures = (ext.gestures = ext.gestures || {});
    const touch = ext.shared.touchCore;

    const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

    const isEditable = (el) => el && (EDITABLE_TAGS.has(el.tagName) || el.isContentEditable);

    const isInteractive = (el) =>
        el instanceof Element &&
        !!el.closest('a[href], button, input, textarea, select, summary, video, audio, [role="button"], [role="link"]');

    const getValidLink = (event) => {
        for (const node of event.composedPath?.() || []) {
            if (node?.tagName === 'A' && node.href && !/^(javascript|mailto|tel|sms|#):/i.test(node.href)) {
                return node;
            }
        }
        return null;
    };

    const dist = (x1, y1, x2, y2) => touch.getDistance({ x: x1, y: y1 }, { x: x2, y: y2 });

    // Chỉ cần chặn click tổng hợp phát sinh ngay sau pointerup/touchend (bắn trong
    // vài ms). 300ms đủ an toàn mà không nuốt click thật nếu người dùng thao tác tiếp.
    const SUPPRESS_MS = 300;

    const openTab = async (url, mode, context, suppress) => {
        const response = await context.tabActions.openTab(url, mode);
        if (!response?.ok) {
            window.open(url, '_blank', mode === 'fg' ? '' : 'noopener');
        }
        suppress(SUPPRESS_MS);
    };

    const closeCurrentTab = async (context, suppress) => {
        suppress(SUPPRESS_MS);
        await context.tabActions.closeCurrentTab();
    };

    const addListenerHelper = (listeners, target, event, handler, options) => {
        target.addEventListener(event, handler, options);
        listeners.push(() => target.removeEventListener(event, handler, options));
    };

    gestures.gestureUtils = {
        isEditable,
        isInteractive,
        getValidLink,
        dist,
        openTab,
        closeCurrentTab,
        addListenerHelper
    };
})();
