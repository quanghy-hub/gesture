(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    const { FIT_MODES, ZOOM_LEVELS } = videoFloating;

    videoFloating.createFloatingSession = (ctx, deps) => {
        const {
            el,
            $,
            getRect,
            isDetectableVideo,
            getTrackedIframeEntries,
            isFeatureEnabled,
            loadLayout,
            ensureLayoutReady,
            formatTime,
            applyBoxLayout,
            updateVolUI,
            updatePlayPauseUI,
            getFullscreenEl,
            postToFloatedIframe
        } = deps;

        const getVideos = () => [...document.querySelectorAll('video')].filter((video) => {
            if (!video?.isConnected || video.closest('#fvp-wrapper')) return false;
            if (isDetectableVideo(video)) return true;
            const rect = getRect(video);
            const hasMediaSource = Boolean(video.currentSrc || video.src || video.querySelector('source[src]'));
            const hasPlaybackState = Number.isFinite(video.duration) || video.readyState > 0 || video.currentTime > 0;
            return hasMediaSource || hasPlaybackState || (rect.width > 0 && rect.height > 0);
        });

        const getOrderedVideoSequence = () => {
            const list = getVideos();
            if (!ctx.curVid) return list;
            const withoutCurrent = list.filter((video) => video !== ctx.curVid);
            if (!ctx.ph?.isConnected || !ctx.ph.parentNode) return [ctx.curVid, ...withoutCurrent];

            const ordered = [];
            let inserted = false;
            for (const video of withoutCurrent) {
                const pos = ctx.ph.compareDocumentPosition(video);
                if (!inserted && (pos & Node.DOCUMENT_POSITION_FOLLOWING)) {
                    ordered.push(ctx.curVid);
                    inserted = true;
                }
                ordered.push(video);
            }
            if (!inserted) ordered.push(ctx.curVid);
            return ordered;
        };

        const updateVideoDetectionUI = () => {
            if (!ctx.iconRef) return;
            if (!isFeatureEnabled()) {
                ctx.iconRef.hide();
                ctx.menuRef?.hide();
                return;
            }
            for (const frame of [...ctx.iframeVideoMap.keys()]) if (!frame?.isConnected) ctx.iframeVideoMap.delete(frame);
            const count = getVideos().length + getTrackedIframeEntries(ctx.iframeVideoMap).length + (ctx.curVid || ctx.floatedIframe ? 1 : 0);
            if (count > 0) {
                ctx.iconRef.show();
                ctx.iconRef.setBadge(count);
            } else {
                ctx.iconRef.hide();
            }
        };

        const applyTransform = () => {
            if (!ctx.curVid) return;
            const zoom = ZOOM_LEVELS[ctx.zoomIdx];
            const transforms = [];
            if (ctx.rotationAngle) transforms.push(`rotate(${ctx.rotationAngle}deg)`);
            if (zoom !== 1) transforms.push(`scale(${zoom})`);
            ctx.curVid.style.transform = transforms.join(' ');
            ctx.curVid.style.objectFit = (ctx.rotationAngle === 90 || ctx.rotationAngle === 270) ? 'contain' : FIT_MODES[ctx.fitIdx];
        };

        const restore = () => {
            if (ctx.state.rafId) {
                cancelAnimationFrame(ctx.state.rafId);
                ctx.state.rafId = null;
            }
            if (ctx.state.seekApplyRaf) {
                cancelAnimationFrame(ctx.state.seekApplyRaf);
                ctx.state.seekApplyRaf = 0;
            }
            ctx.state.pendingSeekRatio = null;
            ctx.state.seekPreviewRatio = null;
            ctx.state.isSeeking = false;
            ctx.state.seekDragActive = false;
            if (ctx.floatedIframe) {
                // Put the iframe back exactly where it came from before tearing down the floating shell state.
                clearInterval(ctx.iframeStatePollTimer);
                ctx.floatedIframe.setAttribute('style', ctx.iframeOrigStyle);
                ctx.iframeOrigPar?.replaceChild(ctx.floatedIframe, ctx.iframePh);
                ctx.floatedIframe = null;
                ctx.iframeOrigPar = null;
                ctx.iframePh = null;
            } else if (ctx.curVid) {
                // Restore the original DOM position of the video node to avoid leaving detached media behind.
                ctx.origPar?.replaceChild(ctx.curVid, ctx.ph);
                Object.assign(ctx.curVid.style, { width: '', height: '', objectFit: '', objectPosition: '', transform: '' });
                ctx.curVid.onplay = ctx.curVid.onpause = ctx.curVid.onended = null;
                ctx.curVid = null;
            }
            if (ctx.box) ctx.box.style.display = 'none';
            ctx.zoomIdx = 0;
            ctx.rotationAngle = 0;
        };

        const switchVid = (dir) => {
            const sequence = getOrderedVideoSequence();
            if (!sequence.length) return;
            const currentIndex = ctx.curVid && sequence.includes(ctx.curVid) ? sequence.indexOf(ctx.curVid) : 0;
            const nextIndex = (currentIndex + dir + sequence.length) % sequence.length;
            const nextVideo = sequence[nextIndex];
            if (!nextVideo || nextVideo === ctx.curVid) return;
            float(nextVideo);
        };

        const floatIframe = (iframe) => {
            if (!isFeatureEnabled()) return;
            if (ctx.floatedIframe) {
                clearInterval(ctx.iframeStatePollTimer);
                ctx.floatedIframe.setAttribute('style', ctx.iframeOrigStyle);
                ctx.iframeOrigPar?.replaceChild(ctx.floatedIframe, ctx.iframePh);
            }
            if (ctx.curVid) restore();
            deps.ensureInitialized();
            ctx.floatedIframe = iframe;
            ctx.iframeOrigPar = iframe.parentNode;
            ctx.iframeOrigStyle = iframe.getAttribute('style') || '';
            ctx.iframePh = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            ctx.iframePh.style.cssText = `width:${iframe.offsetWidth || 300}px;height:${iframe.offsetHeight || 200}px`;
            ctx.iframeOrigPar?.replaceChild(ctx.iframePh, iframe);
            const wrapper = $('fvp-wrapper');
            wrapper.innerHTML = '';
            iframe.style.cssText = 'width:100%!important;height:100%!important;border:none!important;position:absolute;top:0;left:0;';
            wrapper.appendChild(iframe);
            ctx.box.style.display = 'flex';
            ctx.menuRef?.hide();
            applyBoxLayout(loadLayout());
            ensureLayoutReady().then((layout) => {
                if (ctx.floatedIframe === iframe && layout) applyBoxLayout(layout);
            });
            ctx.iframeStatePollTimer = setInterval(() => postToFloatedIframe({ command: 'get-state' }), 350);
        };

        const float = (video) => {
            if (!isFeatureEnabled()) return;
            if (ctx.floatedIframe) {
                clearInterval(ctx.iframeStatePollTimer);
                ctx.floatedIframe.setAttribute('style', ctx.iframeOrigStyle);
                ctx.iframeOrigPar?.replaceChild(ctx.floatedIframe, ctx.iframePh);
                ctx.floatedIframe = null;
            }
            if (ctx.curVid && ctx.curVid !== video) restore();
            if (ctx.curVid === video) return;
            deps.ensureInitialized();
            ctx.origPar = video.parentNode;
            ctx.curVid = video;
            ctx.ph = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            ctx.ph.style.cssText = `width:${video.offsetWidth || 300}px;height:${video.offsetHeight || 200}px`;
            ctx.origPar?.replaceChild(ctx.ph, video);
            const wrapper = $('fvp-wrapper');
            wrapper.innerHTML = '';
            wrapper.appendChild(video);
            video.style.objectFit = FIT_MODES[ctx.fitIdx];
            ctx.zoomIdx = 0;
            ctx.rotationAngle = 0;
            applyTransform();
            updateVolUI();
            ctx.box.style.display = 'flex';
            ctx.menuRef?.hide();
            applyBoxLayout(loadLayout());
            ensureLayoutReady().then((layout) => {
                if (ctx.curVid === video && layout) applyBoxLayout(layout);
            });
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
                    if (buffer) buffer.style.width = `${(ctx.curVid.buffered.end(ctx.curVid.buffered.length - 1) / ctx.curVid.duration) * 100}%`;
                }
                ctx.state.rafId = requestAnimationFrame(updateLoop);
            };
            ctx.state.rafId = requestAnimationFrame(updateLoop);
            video.onplay = video.onpause = updatePlayPauseUI;
            video.onended = () => switchVid(1);
            video.play().catch(() => { });
            updatePlayPauseUI();
        };

        return {
            getVideos,
            getOrderedVideoSequence,
            updateVideoDetectionUI,
            applyTransform,
            restore,
            switchVid,
            floatIframe,
            float
        };
    };
})();
