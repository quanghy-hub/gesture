(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});

    videoFloating.createVideoCollection = (ctx, deps) => {
        const { $, getDirectVideos, getDirectVideoSequence, getTrackedIframeEntries, isFeatureEnabled, updateLeftPanelLayout } = deps;

        const getSwitchVideos = () => (typeof getDirectVideoSequence === 'function' ? getDirectVideoSequence() : getDirectVideos());

        const getVideos = () => {
            const liveVideos = getSwitchVideos();
            const snapshot = Array.isArray(ctx.videoSequence)
                ? ctx.videoSequence.filter(
                      (video) =>
                          video?.isConnected &&
                          (video === ctx.curVid || video === ctx.state.switchTransition?.nextVideo || !video.closest?.('#fvp-wrapper'))
                  )
                : [];
            const merged = [];
            const seen = new Set();
            for (const video of [...snapshot, ...liveVideos]) {
                if (!video || seen.has(video)) {
                    continue;
                }
                seen.add(video);
                merged.push(video);
            }
            if (ctx.curVid?.isConnected && !merged.includes(ctx.curVid)) {
                merged.unshift(ctx.curVid);
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
            const list = getVideos();
            if (!ctx.curVid) return list;
            const currentIndex = list.indexOf(ctx.curVid);
            if (currentIndex < 0) return [ctx.curVid, ...list];
            return [...list.slice(currentIndex), ...list.slice(0, currentIndex)];
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
                    if (rect && (rect.width < 160 || rect.height < 90)) continue;
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
