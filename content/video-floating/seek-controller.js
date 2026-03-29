(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};

    videoFloating.createSeekController = (ctx, deps) => {
        const { $, getCoord, getRect, clamp, formatTime, touch } = deps;
        const POINTER_CAPTURE = { capture: true };
        const TOUCH_START_CAPTURE = { capture: true, passive: true };
        const TOUCH_MOVE_CAPTURE = { capture: true, passive: false };
        const TOUCH_END_CAPTURE = { capture: true, passive: true };

        const getActiveSeekDuration = () => ctx.floatedIframe ? (ctx.iframePlaybackState.duration || 0) : (ctx.curVid?.duration || 0);
        const getSeekRatioFromClientX = (clientX) => {
            const container = $('fvp-seek-container');
            const rect = getRect(container);
            if (!rect.width) return 0;
            return clamp((clientX - rect.left) / rect.width, 0, 1);
        };
        const renderSeekPreview = (ratio) => {
            const seek = $('fvp-seek');
            if (seek) seek.value = Math.round(clamp(ratio, 0, 1) * 10000);
            const duration = getActiveSeekDuration();
            const currentTime = duration > 0 ? clamp(ratio, 0, 1) * duration : 0;
            const td = $('fvp-time-display');
            if (td) td.textContent = `${formatTime(currentTime)}/${formatTime(duration)}`;
        };
        const flushPendingSeek = (force = false) => {
            ctx.state.seekApplyRaf = 0;
            if (ctx.state.pendingSeekRatio === null) return;
            const ratio = clamp(ctx.state.pendingSeekRatio, 0, 1);
            const now = performance.now();
            if (!force && now - ctx.state.lastSeekCommitAt < 70) {
                ctx.state.seekApplyRaf = requestAnimationFrame(() => flushPendingSeek(false));
                return;
            }
            ctx.state.lastSeekCommitAt = now;
            if (ctx.floatedIframe) {
                deps.postToFloatedIframe({ command: 'seek-to-ratio', ratio });
            } else if (ctx.curVid?.duration) {
                ctx.curVid.currentTime = ratio * ctx.curVid.duration;
            }
        };
        const scheduleSeekApply = (ratio) => {
            ctx.state.pendingSeekRatio = ratio;
            ctx.state.seekPreviewRatio = ratio;
            renderSeekPreview(ratio);
            if (ctx.state.seekApplyRaf) return;
            ctx.state.seekApplyRaf = requestAnimationFrame(() => flushPendingSeek(false));
        };
        const endSeekInteraction = () => {
            ctx.state.isSeeking = false;
            ctx.state.seekDragActive = false;
            if (ctx.state.pendingSeekRatio !== null) {
                flushPendingSeek(true);
                ctx.state.pendingSeekRatio = null;
            }
            ctx.state.seekPreviewRatio = null;
        };

        const bind = () => {
            const seekEl = $('fvp-seek');
            const beginSeekInteraction = (event) => {
                // Seek is throttled separately from UI preview so drag stays responsive without spamming currentTime writes.
                ctx.state.isSeeking = true;
                ctx.state.seekDragActive = true;
                const point = getCoord(event);
                const ratio = getSeekRatioFromClientX(point.x);
                renderSeekPreview(ratio);
                scheduleSeekApply(ratio);
            };
            const handleSeekDragMove = (event) => {
                if (!ctx.state.seekDragActive) return;
                if (touch?.isTouchLikeEvent?.(event)) touch.preventCancelable(event);
                const point = getCoord(event);
                const ratio = getSeekRatioFromClientX(point.x);
                renderSeekPreview(ratio);
                scheduleSeekApply(ratio);
            };
            const stopSeekDrag = () => {
                if (!ctx.state.seekDragActive && !ctx.state.isSeeking) return;
                endSeekInteraction();
            };

            seekEl.addEventListener('pointerdown', beginSeekInteraction, POINTER_CAPTURE);
            seekEl.addEventListener('touchstart', beginSeekInteraction, TOUCH_START_CAPTURE);
            document.addEventListener('pointermove', handleSeekDragMove, POINTER_CAPTURE);
            document.addEventListener('touchmove', handleSeekDragMove, TOUCH_MOVE_CAPTURE);
            document.addEventListener('pointerup', stopSeekDrag, POINTER_CAPTURE);
            document.addEventListener('touchend', stopSeekDrag, TOUCH_END_CAPTURE);
            document.addEventListener('touchcancel', stopSeekDrag, TOUCH_END_CAPTURE);

            return () => {
                seekEl.removeEventListener('pointerdown', beginSeekInteraction, POINTER_CAPTURE);
                seekEl.removeEventListener('touchstart', beginSeekInteraction, TOUCH_START_CAPTURE);
                document.removeEventListener('pointermove', handleSeekDragMove, POINTER_CAPTURE);
                document.removeEventListener('touchmove', handleSeekDragMove, TOUCH_MOVE_CAPTURE);
                document.removeEventListener('pointerup', stopSeekDrag, POINTER_CAPTURE);
                document.removeEventListener('touchend', stopSeekDrag, TOUCH_END_CAPTURE);
                document.removeEventListener('touchcancel', stopSeekDrag, TOUCH_END_CAPTURE);
            };
        };

        return {
            bind,
            renderSeekPreview,
            endSeekInteraction
        };
    };
})();
