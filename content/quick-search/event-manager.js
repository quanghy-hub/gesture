(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createEventManager = (handlers) => {
        const {
            onPointerUp,
            onPointerMove,
            onPointerDown,
            onTouchStart,
            onTouchMove,
            onTouchEnd,
            onTouchCancel,
            onSelectionChange,
            onKeyDown,
            onPageShow,
            onScrollOrResize
        } = handlers;

        document.addEventListener('pointerup', onPointerUp, true);
        document.addEventListener('pointermove', onPointerMove, true);
        document.addEventListener('pointerdown', onPointerDown, true);
        document.addEventListener('touchstart', onTouchStart, true);
        document.addEventListener('touchmove', onTouchMove, true);
        document.addEventListener('touchend', onTouchEnd, true);
        document.addEventListener('touchcancel', onTouchCancel, true);
        document.addEventListener('selectionchange', onSelectionChange, true);
        document.addEventListener('keydown', onKeyDown, true);
        window.addEventListener('pageshow', onPageShow, true);
        window.addEventListener('scroll', onScrollOrResize, true);
        window.addEventListener('resize', onScrollOrResize, true);

        return {
            destroy() {
                document.removeEventListener('pointerup', onPointerUp, true);
                document.removeEventListener('pointermove', onPointerMove, true);
                document.removeEventListener('pointerdown', onPointerDown, true);
                document.removeEventListener('touchstart', onTouchStart, true);
                document.removeEventListener('touchmove', onTouchMove, true);
                document.removeEventListener('touchend', onTouchEnd, true);
                document.removeEventListener('touchcancel', onTouchCancel, true);
                document.removeEventListener('selectionchange', onSelectionChange, true);
                document.removeEventListener('keydown', onKeyDown, true);
                window.removeEventListener('pageshow', onPageShow, true);
                window.removeEventListener('scroll', onScrollOrResize, true);
                window.removeEventListener('resize', onScrollOrResize, true);
            }
        };
    };
})();
