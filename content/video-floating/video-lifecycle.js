(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    const { FIT_MODES, ZOOM_LEVELS } = videoFloating;

    videoFloating.createVideoLifecycle = (ctx, deps, videoCollection) => {
        const {
            el,
            $,
            isFeatureEnabled,
            loadLayout,
            ensureLayoutReady,
            formatTime,
            applyBoxLayout,
            updateLeftPanelLayout,
            updateVolUI,
            updateSpeedUI,
            updatePlaybackOverlayUI
        } = deps;

        const { captureVideoPresentation, restoreVideoPresentation, restoreVideoNode } = videoFloating.presentationHelper;

        const isFloatingShellOpen = () => !!(ctx.box && ctx.box.style.display !== 'none');

        const showFloatingShell = ({ applySavedLayout = false, isCurrent = () => true } = {}) => {
            if (!ctx.box) return;
            ctx.box.style.display = 'flex';
            if (!applySavedLayout) {
                updateLeftPanelLayout?.();
                return;
            }
            applyBoxLayout(loadLayout());
            ensureLayoutReady().then((layout) => {
                if (layout && isFloatingShellOpen() && isCurrent()) applyBoxLayout(layout);
            });
        };

        const applyTransform = () => {
            if (!ctx.curVid) return;
            const zoom = ZOOM_LEVELS[ctx.zoomIdx];
            const transforms = [];
            if (ctx.rotationAngle) transforms.push(`rotate(${ctx.rotationAngle}deg)`);
            if (zoom !== 1) transforms.push(`scale(${zoom})`);
            ctx.curVid.style.transform = transforms.join(' ');
            ctx.curVid.style.objectFit = ctx.rotationAngle === 90 || ctx.rotationAngle === 270 ? 'contain' : FIT_MODES[ctx.fitIdx];
        };

        const stopProgressLoop = () => {
            if (ctx.state.rafId) {
                cancelAnimationFrame(ctx.state.rafId);
                ctx.state.rafId = null;
            }
        };

        const startProgressLoop = () => {
            stopProgressLoop();
            const updateLoop = () => {
                if (!ctx.curVid) return;
                if (!ctx.state.isSeeking && ctx.curVid.duration) {
                    const seek = $('fvp-seek');
                    if (seek) seek.value = (ctx.curVid.currentTime / ctx.curVid.duration) * 10000;
                    const td = $('fvp-time-display');
                    if (td) td.textContent = `${formatTime(ctx.curVid.currentTime)}/${formatTime(ctx.curVid.duration)}`;
                }
                if (ctx.curVid.buffered?.length && ctx.curVid.duration) {
                    const buffer = $('fvp-buffer');
                    if (buffer)
                        buffer.style.width = `${(ctx.curVid.buffered.end(ctx.curVid.buffered.length - 1) / ctx.curVid.duration) * 100}%`;
                }
                ctx.state.rafId = requestAnimationFrame(updateLoop);
            };
            ctx.state.rafId = requestAnimationFrame(updateLoop);
        };

        const clearWrapper = (wrapper, keepNodes = []) => {
            if (!wrapper) return;
            const keep = new Set(keepNodes.filter(Boolean));
            [...wrapper.childNodes].forEach((node) => {
                if (!keep.has(node)) node.remove();
            });
        };

        const bindCurrentVideo = (video, onEnded) => {
            if (!video) return;
            video.onplay = () => updatePlaybackOverlayUI?.();
            video.onpause = () => updatePlaybackOverlayUI?.();
            video.onended = () => {
                updatePlaybackOverlayUI?.();
                onEnded?.();
            };
        };

        const activateCurrentVideo = (video, onEnded) => {
            if (!video) return;
            ctx.curVid = video;
            ctx.zoomIdx = 0;
            ctx.rotationAngle = 0;
            applyTransform();
            updateVolUI();
            updateSpeedUI?.();
            videoCollection.updateVideoOrderUI(video);
            updatePlaybackOverlayUI?.();
            startProgressLoop();
            bindCurrentVideo(video, onEnded);

            if (!video.src && !video.currentSrc && !video.srcObject) {
                const detector = videoFloating.media?.detector;
                const candidate = detector?.getVideoSourceCandidate?.(video);
                if (candidate && typeof candidate === 'string') {
                    const isM3u8 = candidate.includes('.m3u8') || candidate.includes('m3u8') || video.dataset?.type === 'm3u8';
                    if (isM3u8) {
                        try {
                            window.dispatchEvent(new CustomEvent('fvp-attach-hls', { detail: { source: candidate } }));
                        } catch {
                            /* ignore */
                        }
                    } else {
                        video.src = candidate;
                    }
                }
            }

            video.play().catch(() => {
                updatePlaybackOverlayUI?.();
            });
        };

        const restore = (cleanupSwitchTransition, restoreFloatedIframe) => {
            stopProgressLoop();
            if (ctx.state.seekApplyRaf) {
                cancelAnimationFrame(ctx.state.seekApplyRaf);
                ctx.state.seekApplyRaf = 0;
            }
            clearTimeout(ctx.state.transitionTimer);
            ctx.state.transitionTimer = 0;
            ctx.state.isSwitchingVideo = false;

            const transitionRestored = cleanupSwitchTransition ? cleanupSwitchTransition() : false;
            ctx.state.pendingSeekRatio = null;
            ctx.state.seekPreviewRatio = null;
            ctx.state.isSeeking = false;
            ctx.state.seekDragActive = false;

            try {
                window.dispatchEvent(new CustomEvent('fvp-destroy-hls'));
            } catch {
                /* ignore */
            }

            if (ctx.floatedIframe) {
                restoreFloatedIframe?.({ clearRefs: true });
            } else if (!transitionRestored && ctx.curVid) {
                if (ctx.curVid._fvp_hls) {
                    try {
                        ctx.curVid._fvp_hls.destroy();
                    } catch {
                        /* ignore */
                    }
                    ctx.curVid._fvp_hls = null;
                }
                restoreVideoNode(ctx.curVid, ctx.origPar, ctx.ph);
                restoreVideoPresentation(ctx.curVid);
                ctx.curVid.onplay = ctx.curVid.onpause = ctx.curVid.onended = null;
                ctx.curVid = null;
            }

            clearWrapper($('fvp-wrapper'));
            if (ctx.box) ctx.box.style.display = 'none';
            ctx.videoSequence = [];
            ctx.zoomIdx = 0;
            ctx.rotationAngle = 0;
            updateLeftPanelLayout?.();
            videoCollection.updateVideoOrderUI(null);
            updatePlaybackOverlayUI?.();
        };

        const float = (video, restoreFunc, onEnded) => {
            if (!isFeatureEnabled()) return;
            const shouldApplyLayout = !isFloatingShellOpen();

            if (ctx.floatedIframe) {
                restoreFunc?.(false, true); // Partial restore to clear iframe
            }
            if (ctx.curVid && ctx.curVid !== video) {
                restoreFunc?.();
            }
            if (ctx.curVid === video) return;

            deps.ensureInitialized();
            ctx.videoSequence = videoCollection.getSwitchVideos();
            ctx.origPar = video.parentNode;
            ctx.curVid = video;

            captureVideoPresentation(video);
            ctx.ph = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            ctx.ph.style.cssText = `width:${video.offsetWidth || 300}px;height:${video.offsetHeight || 200}px`;
            ctx.origPar?.replaceChild(ctx.ph, video);

            const wrapper = $('fvp-wrapper');
            clearWrapper(wrapper);
            wrapper.appendChild(video);
            video.style.objectFit = FIT_MODES[ctx.fitIdx];

            showFloatingShell({
                applySavedLayout: shouldApplyLayout,
                isCurrent: () => ctx.curVid === video
            });
            ctx.menuRef?.hide();
            updatePlaybackOverlayUI?.();
            activateCurrentVideo(video, onEnded);
        };

        return {
            isFloatingShellOpen,
            showFloatingShell,
            applyTransform,
            stopProgressLoop,
            startProgressLoop,
            clearWrapper,
            activateCurrentVideo,
            restore,
            float
        };
    };
})();
