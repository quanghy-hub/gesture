(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    const { FIT_MODES } = videoFloating;

    videoFloating.createVideoSwitcher = (ctx, deps, videoCollection, videoLifecycle) => {
        const { el, $, updatePlaybackOverlayUI } = deps;
        const {
            restoreVideoNode,
            restoreVideoPresentation,
            captureVideoPresentation,
            createTransitionLayer
        } = videoFloating.presentationHelper;

        const cleanupSwitchTransition = () => {
            const transition = ctx.state.switchTransition;
            if (!transition) return false;
            const {
                currentVideo,
                previousPlaceholder,
                previousParent,
                nextVideo,
                nextPlaceholder,
                nextParent
            } = transition;
            restoreVideoNode(currentVideo, previousParent, previousPlaceholder);
            restoreVideoNode(nextVideo, nextParent, nextPlaceholder);
            restoreVideoPresentation(currentVideo);
            restoreVideoPresentation(nextVideo);
            currentVideo.onplay = currentVideo.onpause = currentVideo.onended = null;
            nextVideo.onplay = nextVideo.onpause = nextVideo.onended = null;
            currentVideo.pause?.();
            nextVideo.pause?.();
            ctx.state.switchTransition = null;
            ctx.curVid = null;
            ctx.origPar = null;
            ctx.ph = null;
            return true;
        };

        const switchVid = (dir, floatFunc, onEnded) => {
            if (ctx.state.isSwitchingVideo) return;
            const sequence = videoCollection.getOrderedVideoSequence();
            if (!sequence.length) return;
            const currentIndex = ctx.curVid && sequence.includes(ctx.curVid) ? sequence.indexOf(ctx.curVid) : 0;
            const nextIndex = (currentIndex + dir + sequence.length) % sequence.length;
            const nextVideo = sequence[nextIndex];
            if (!nextVideo || nextVideo === ctx.curVid) return;
            if (!ctx.curVid || !ctx.box || ctx.box.style.display === 'none') {
                floatFunc?.(nextVideo);
                return;
            }
            const wrapper = $('fvp-wrapper');
            if (!wrapper) {
                floatFunc?.(nextVideo);
                return;
            }

            const currentVideo = ctx.curVid;
            const previousPlaceholder = ctx.ph;
            const previousParent = ctx.origPar;
            const nextParent = nextVideo.parentNode;
            if (!previousPlaceholder || !previousParent || !nextParent) {
                floatFunc?.(nextVideo);
                return;
            }

            videoLifecycle.stopProgressLoop();
            ctx.state.isSwitchingVideo = true;
            currentVideo.onplay = currentVideo.onpause = currentVideo.onended = null;
            currentVideo.pause?.();

            captureVideoPresentation(nextVideo);
            const nextPlaceholder = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
            nextPlaceholder.style.cssText = `width:${nextVideo.offsetWidth || 300}px;height:${nextVideo.offsetHeight || 200}px`;
            nextParent.replaceChild(nextPlaceholder, nextVideo);
            ctx.state.switchTransition = {
                currentVideo,
                previousPlaceholder,
                previousParent,
                nextVideo,
                nextPlaceholder,
                nextParent
            };

            videoLifecycle.clearWrapper(wrapper, [currentVideo]);
            const outgoingLayer = createTransitionLayer(currentVideo, dir > 0 ? 'is-outgoing-up' : 'is-outgoing-down', el);
            const incomingLayer = createTransitionLayer(nextVideo, dir > 0 ? 'is-incoming-from-bottom' : 'is-incoming-from-top', el);
            if (!outgoingLayer || !incomingLayer) {
                ctx.state.switchTransition = null;
                restoreVideoNode(nextVideo, nextParent, nextPlaceholder);
                restoreVideoPresentation(nextVideo);
                ctx.state.isSwitchingVideo = false;
                floatFunc?.(nextVideo);
                return;
            }

            wrapper.appendChild(outgoingLayer);
            wrapper.appendChild(incomingLayer);
            nextVideo.style.objectFit = FIT_MODES[0];
            nextVideo.play().catch(() => {
                updatePlaybackOverlayUI?.();
            });
            videoCollection.updateVideoOrderUI(nextVideo);

            requestAnimationFrame(() => {
                outgoingLayer.classList.add('is-animating');
                incomingLayer.classList.add('is-animating');
            });

            const finalizeSwitch = () => {
                if (!ctx.state.isSwitchingVideo) return;
                clearTimeout(ctx.state.transitionTimer);
                ctx.state.transitionTimer = 0;
                ctx.state.isSwitchingVideo = false;
                restoreVideoNode(currentVideo, previousParent, previousPlaceholder);
                restoreVideoPresentation(currentVideo);
                currentVideo.pause?.();
                ctx.state.switchTransition = null;
                ctx.origPar = nextParent;
                ctx.ph = nextPlaceholder;
                wrapper.appendChild(nextVideo);
                outgoingLayer.remove();
                incomingLayer.remove();
                videoLifecycle.clearWrapper(wrapper, [nextVideo]);
                videoLifecycle.activateCurrentVideo(nextVideo, onEnded);
            };

            ctx.state.transitionTimer = setTimeout(finalizeSwitch, 260);
        };

        return {
            cleanupSwitchTransition,
            switchVid
        };
    };
})();
