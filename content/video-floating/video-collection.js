(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createVideoCollection = (ctx, deps) => {
        const { $, getDirectVideos, getDirectVideoSequence, getTrackedIframeEntries, isFeatureEnabled, updateLeftPanelLayout } = deps;

        const getSwitchVideos = () => (typeof getDirectVideoSequence === 'function' ? getDirectVideoSequence() : getDirectVideos());

        const getVideos = () => {
            const liveVideos = getSwitchVideos();
            const merged = [];
            const seen = new Set();

            for (const video of liveVideos) {
                if (!video || seen.has(video)) continue;
                seen.add(video);
                merged.push(video);
            }

            const insertAtPlaceholder = (video, placeholder) => {
                if (!video?.isConnected || seen.has(video)) return;
                let inserted = false;
                if (placeholder?.isConnected) {
                    const utils = videoFloating.core.utils;
                    const allNodes = utils?.queryAllDeep
                        ? utils.queryAllDeep('video, audio, .fvp-ph')
                        : typeof document !== 'undefined'
                          ? [...document.querySelectorAll('video, audio, .fvp-ph')]
                          : [];
                    const phIndex = allNodes.indexOf(placeholder);
                    if (phIndex >= 0) {
                        let insertAt = 0;
                        for (let i = 0; i < phIndex; i++) {
                            const node = allNodes[i];
                            if (seen.has(node)) {
                                insertAt = merged.indexOf(node) + 1;
                            }
                        }
                        merged.splice(insertAt, 0, video);
                        seen.add(video);
                        inserted = true;
                    }
                }
                if (!inserted) {
                    merged.push(video);
                    seen.add(video);
                }
            };

            if (ctx.state.switchTransition?.nextVideo) {
                insertAtPlaceholder(ctx.state.switchTransition.nextVideo, ctx.state.switchTransition.nextPlaceholder);
            }
            if (ctx.curVid) {
                insertAtPlaceholder(ctx.curVid, ctx.ph);
            }

            return merged;
        };

        const getVideoOrderInfo = (video = ctx.curVid) => {
            if (!video) return { index: 0, total: 0 };
            const list = getVideos();
            const index = list.indexOf(video);
            return {
                index: index >= 0 ? index + 1 : 1,
                total: Math.max(list.length, 1)
            };
        };

        const updateVideoOrderUI = (video = ctx.curVid) => {
            const badge = $('fvp-video-order');
            if (!badge) return;
            if (ctx.floatedIframe || !video) {
                badge.hidden = true;
                badge.textContent = '';
                updateLeftPanelLayout?.();
                return;
            }
            const order = getVideoOrderInfo(video);
            badge.hidden = false;
            badge.textContent = `${order.index}/${order.total}`;
            badge.title = `Video ${order.index} / ${order.total}`;
            updateLeftPanelLayout?.();
        };

        const getOrderedVideoSequence = () => {
            return getVideos();
        };

        const updateVideoDetectionUI = () => {
            if (!ctx.iconRef) return;
            if (!isFeatureEnabled()) {
                ctx.iconRef.hide();
                ctx.menuRef?.hide();
                return;
            }
            for (const frame of [...ctx.iframeVideoMap.keys()]) if (!frame?.isConnected) ctx.iframeVideoMap.delete(frame);
            const directVideos = getVideos();
            const tracked = getTrackedIframeEntries(ctx.iframeVideoMap).length;
            let fallbackIframeCount = 0;
            try {
                const detector = videoFloating.media.detector;
                const utils = videoFloating.core.utils;
                const allIframes = utils?.queryAllDeep ? utils.queryAllDeep('iframe') : [...document.querySelectorAll('iframe')];
                const seen = new Set([...ctx.iframeVideoMap.keys()]);
                for (const iframe of allIframes) {
                    if (seen.has(iframe)) continue;
                    if (iframe.closest?.('#fvp-wrapper')) continue;
                    if (!detector.isLikelyVideoIframe?.(iframe)) continue;
                    if (detector.isRedundantIframeCandidate?.(iframe, directVideos)) continue;
                    const rect = iframe.getBoundingClientRect?.();
                    const w = Math.max(iframe.offsetWidth || 0, rect?.width || 0);
                    const h = Math.max(iframe.offsetHeight || 0, rect?.height || 0);
                    if (w > 0 && h > 0 && (w < 32 || h < 32)) continue;
                    fallbackIframeCount++;
                }
            } catch {
                void 0;
            }
            const count = directVideos.length + tracked + fallbackIframeCount;
            if (count > 0) {
                ctx.iconRef.show();
                ctx.iconRef.setBadge(count);
            } else {
                ctx.iconRef.hide();
            }
        };

        return {
            getSwitchVideos,
            getVideos,
            getOrderedVideoSequence,
            updateVideoDetectionUI,
            updateVideoOrderUI
        };
    };
})();
