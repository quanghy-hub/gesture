(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.core = videoFloating.core || {};

    videoFloating.core.createContext = () => {
        const ctx = {
            ui: {
                box: null,
                iconRef: null,
                menuRef: null
            },
            floating: {
                curVid: null,
                origPar: null,
                ph: null,
                videoSequence: [],
                fitIdx: 0,
                zoomIdx: 0,
                rotationAngle: 0
            },
            iframe: {
                floatedIframe: null,
                origPar: null,
                ph: null,
                origStyle: '',
                statePollTimer: 0,
                videoMap: new Map(),
                playbackState: { 
                    hasVideo: false, paused: true, muted: false, volume: 1, playbackRate: 1,
                    currentTime: 0, duration: 0, bufferedEnd: 0,  
                    fitIdx: 0, zoomIdx: 0, rotationAngle: 0 
                }
            },
            fitIdx: 0,
            zoomIdx: 0,
            rotationAngle: 0,
            state: { 
                isDrag: false, 
                isResize: false, 
                startX: 0, startY: 0, 
                initX: 0, initY: 0, initW: 0, initH: 0, 
                resizeDir: '', 
                idleTimer: null, 
                rafId: null, 
                isSeeking: false, 
                seekDragActive: false, 
                seekApplyRaf: 0, 
                pendingSeekRatio: null, 
                seekPreviewRatio: null, 
                lastSeekCommitAt: 0,
                isSwitchingVideo: false,
                switchTransition: null,
                transitionTimer: 0
            },
            cleanup: []
        };

        Object.defineProperties(ctx, {
            box: { get() { return ctx.ui.box; }, set(value) { ctx.ui.box = value; } },
            iconRef: { get() { return ctx.ui.iconRef; }, set(value) { ctx.ui.iconRef = value; } },
            menuRef: { get() { return ctx.ui.menuRef; }, set(value) { ctx.ui.menuRef = value; } },
            curVid: { get() { return ctx.floating.curVid; }, set(value) { ctx.floating.curVid = value; } },
            origPar: { get() { return ctx.floating.origPar; }, set(value) { ctx.floating.origPar = value; } },
            ph: { get() { return ctx.floating.ph; }, set(value) { ctx.floating.ph = value; } },
            videoSequence: { get() { return ctx.floating.videoSequence; }, set(value) { ctx.floating.videoSequence = value; } },
            fitIdx: { get() { return ctx.floating.fitIdx; }, set(value) { ctx.floating.fitIdx = value; } },
            zoomIdx: { get() { return ctx.floating.zoomIdx; }, set(value) { ctx.floating.zoomIdx = value; } },
            rotationAngle: { get() { return ctx.floating.rotationAngle; }, set(value) { ctx.floating.rotationAngle = value; } },
            floatedIframe: { get() { return ctx.iframe.floatedIframe; }, set(value) { ctx.iframe.floatedIframe = value; } },
            iframeOrigPar: { get() { return ctx.iframe.origPar; }, set(value) { ctx.iframe.origPar = value; } },
            iframePh: { get() { return ctx.iframe.ph; }, set(value) { ctx.iframe.ph = value; } },
            iframeOrigStyle: { get() { return ctx.iframe.origStyle; }, set(value) { ctx.iframe.origStyle = value; } },
            iframeStatePollTimer: { get() { return ctx.iframe.statePollTimer; }, set(value) { ctx.iframe.statePollTimer = value; } },
            iframeVideoMap: { get() { return ctx.iframe.videoMap; } },
            iframePlaybackState: { get() { return ctx.iframe.playbackState; } }
        });

        return ctx;
    };
})();
