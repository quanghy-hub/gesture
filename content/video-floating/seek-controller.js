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
            ctx.state.seekDragActive = false;
            if (ctx.state.pendingSeekRatio !== null) {
                flushPendingSeek(true);
                ctx.state.pendingSeekRatio = null;
            }

            // Keep isSeeking = true and preserve seekPreviewRatio for a brief period to allow the player to update its currentTime
            // and avoid snapping back to the old playback position.
            setTimeout(() => {
                if (!ctx.state.seekDragActive) {
                    ctx.state.isSeeking = false;
                    ctx.state.seekPreviewRatio = null;
                }
            }, 400);
        };

        const bind = () => {
            const seekEl = $('fvp-seek');

            const handleInput = () => {
                ctx.state.isSeeking = true;
                ctx.state.seekDragActive = true;
                const ratio = parseFloat(seekEl.value) / 10000;
                ctx.state.seekPreviewRatio = ratio;
                
                // Update the preview immediately
                const duration = getActiveSeekDuration();
                const currentTime = duration > 0 ? clamp(ratio, 0, 1) * duration : 0;
                const td = $('fvp-time-display');
                if (td) td.textContent = `${formatTime(currentTime)}/${formatTime(duration)}`;

                scheduleSeekApply(ratio);
            };

            const handleChange = () => {
                const ratio = parseFloat(seekEl.value) / 10000;
                ctx.state.pendingSeekRatio = ratio;
                endSeekInteraction();
            };

            seekEl.addEventListener('input', handleInput);
            seekEl.addEventListener('change', handleChange);

            return () => {
                seekEl.removeEventListener('input', handleInput);
                seekEl.removeEventListener('change', handleChange);
            };
        };

        return {
            bind,
            renderSeekPreview,
            endSeekInteraction
        };
    };
})();
