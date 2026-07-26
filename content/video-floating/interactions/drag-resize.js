(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createDragResizeHandler = (ctx, layoutManager, shell) => {
        const { getCoord } = videoFloating.core.utils;
        const touch = ext?.shared?.touchCore;

        let activeBoxPointerId = null;
        let activeBoxPointerEl = null;

        const beginBoxInteraction = (event, mode, resizeDir = '') => {
            if (event.button !== undefined && event.button !== 0) return;
            if (touch?.isTouchLikeEvent?.(event)) touch.preventCancelable(event);
            const c = getCoord(event);
            activeBoxPointerId = event.pointerId ?? 'mouse';
            activeBoxPointerEl = event.currentTarget instanceof Element ? event.currentTarget : null;
            ctx.state.isDrag = mode === 'drag';
            ctx.state.isResize = mode === 'resize';
            ctx.state.resizeDir = resizeDir;
            ctx.state.startX = c.x;
            ctx.state.startY = c.y;
            ctx.state.initX = ctx.box.offsetLeft;
            ctx.state.initY = ctx.box.offsetTop;
            ctx.state.initW = ctx.box.offsetWidth;
            ctx.state.initH = ctx.box.offsetHeight;
            try {
                activeBoxPointerEl?.setPointerCapture?.(event.pointerId);
            } catch {
            }
            shell.resetIdle();
        };

        const handleBoxPointerMove = (event) => {
            if ((event.pointerId ?? 'mouse') !== activeBoxPointerId) return;
            if (!ctx.state.isDrag && !ctx.state.isResize) return;
            if (touch?.isTouchLikeEvent?.(event)) touch.preventCancelable(event);
            const c = getCoord(event);
            const dx = c.x - ctx.state.startX;
            const dy = c.y - ctx.state.startY;
            if (ctx.state.isDrag) {
                const next = layoutManager.clampBoxPosition({ left: ctx.state.initX + dx, top: ctx.state.initY + dy, width: ctx.box.offsetWidth, height: ctx.box.offsetHeight });
                ctx.box.style.left = `${next.left}px`;
                ctx.box.style.top = `${next.top}px`;
                layoutManager.updateLeftPanelLayout();
            } else if (ctx.state.isResize) {
                const { vertical } = layoutManager.getBoxViewportInsets();
                const width = Math.min(Math.max(ctx.state.resizeDir === 'bl' ? ctx.state.initW - dx : ctx.state.initW + dx, 200), layoutManager.getMaxBoxWidth());
                const height = Math.min(Math.max(ctx.state.initH + dy, 120), Math.max(120, window.innerHeight - vertical * 2));
                const left = ctx.state.resizeDir === 'bl' ? ctx.state.initX + (ctx.state.initW - width) : ctx.state.initX;
                const next = layoutManager.clampBoxPosition({ left, top: ctx.state.initY, width, height });
                ctx.box.style.width = `${Math.round(width)}px`;
                ctx.box.style.height = `${Math.round(height)}px`;
                ctx.box.style.left = `${Math.round(next.left)}px`;
                ctx.box.style.top = `${Math.round(next.top)}px`;
                layoutManager.updateLeftPanelLayout();
            }
            shell.resetIdle();
        };

        const handleBoxPointerEnd = (event) => {
            if ((event.pointerId ?? 'mouse') !== activeBoxPointerId) return;
            if (ctx.state.isDrag || ctx.state.isResize) {
                ctx.state.isDrag = false;
                ctx.state.isResize = false;
                layoutManager.persistCurrentBoxLayout();
            }
            activeBoxPointerId = null;
        };
        
        return {
            beginBoxInteraction,
            handleBoxPointerMove,
            handleBoxPointerEnd
        };
    };
})();
