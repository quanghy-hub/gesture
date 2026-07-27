(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createIframeLifecycle = (ctx, deps, videoLifecycle, videoCollection) => {
        const { el, $, isFeatureEnabled, updatePlaybackOverlayUI, postToFloatedIframe } = deps;

        const resetIframePlaybackState = () => {
            Object.assign(ctx.iframePlaybackState, {
                hasVideo: false,
                paused: true,
                muted: false,
                volume: 1,
                currentTime: 0,
                duration: 0,
                bufferedEnd: 0,
                fitIdx: 0,
                zoomIdx: 0,
                rotationAngle: 0
            });
        };

        const restoreFloatedIframe = ({ clearRefs = false } = {}) => {
            if (!ctx.floatedIframe) return;
            clearInterval(ctx.iframeStatePollTimer);
            ctx.iframeStatePollTimer = 0;
            postToFloatedIframe({ command: 'set-floating-active', active: false });
            ctx.floatedIframe.setAttribute('style', ctx.iframeOrigStyle);
            ctx.iframeOrigPar?.replaceChild(ctx.floatedIframe, ctx.iframePh);
            if (!clearRefs) return;
            ctx.floatedIframe = null;
            ctx.iframeOrigPar = null;
            ctx.iframePh = null;
            resetIframePlaybackState();
        };

        const floatIframe = (iframe, restoreFunc) => {
            if (!isFeatureEnabled()) return;
            const shouldApplyLayout = !videoLifecycle.isFloatingShellOpen();
            if (ctx.floatedIframe) {
                restoreFloatedIframe();
            }
            if (ctx.curVid) {
                restoreFunc?.(false, true); // Partial restore to clear curVid
            }
            deps.ensureInitialized();
            ctx.floatedIframe = iframe;
            ctx.iframeOrigPar = iframe.parentNode;
            ctx.iframeOrigStyle = iframe.getAttribute('style') || '';
            resetIframePlaybackState();
            ctx.iframePh = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            ctx.iframePh.style.cssText = `width:${iframe.offsetWidth || 300}px;height:${iframe.offsetHeight || 200}px`;
            ctx.iframeOrigPar?.replaceChild(ctx.iframePh, iframe);
            const wrapper = $('fvp-wrapper');
            videoLifecycle.clearWrapper(wrapper);
            iframe.style.cssText = 'width:100%!important;height:100%!important;border:none!important;position:absolute;top:0;left:0;';
            wrapper.appendChild(iframe);
            videoLifecycle.showFloatingShell({
                applySavedLayout: shouldApplyLayout,
                isCurrent: () => ctx.floatedIframe === iframe
            });
            ctx.menuRef?.hide();
            videoCollection.updateVideoOrderUI(null);
            updatePlaybackOverlayUI?.();
            postToFloatedIframe({ command: 'set-floating-active', active: true });
            postToFloatedIframe({ command: 'get-state' });
            ctx.iframeStatePollTimer = setInterval(() => postToFloatedIframe({ command: 'get-state' }), 350);
        };

        return {
            resetIframePlaybackState,
            restoreFloatedIframe,
            floatIframe
        };
    };
})();
