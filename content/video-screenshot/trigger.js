(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = ext.videoScreenshot = ext.videoScreenshot || {};
    const floating = ext.shared.floatingCore;

    videoScreenshot.createTrigger = (ctx, captureVideo) => {
        const { CONFIG, ICON, getDefaultTriggerPosition } = videoScreenshot;

        let triggerRef = null;
        let removeDragBinding = () => { };

        const posStorage = floating.createPositionStorage(
            'gesture_video_screenshot_trigger_pos_v1',
            getDefaultTriggerPosition()
        );

        const ensureTrigger = () => {
            if (triggerRef) {
                return triggerRef;
            }

            triggerRef = floating.createActionButton({
                className: 'gesture-video-screenshot-trigger',
                htmlContent: ICON,
                title: 'Chụp màn hình video (S)',
                ariaLabel: 'Chụp màn hình video',
                hidden: true,
                position: 'fixed',
                zIndex: '2147483646'
            });
            triggerRef.element.style.touchAction = 'none';

            removeDragBinding = floating.bindDragBehavior({
                target: triggerRef.element,
                threshold: 4,
                getInitialPosition: () => ({
                    left: triggerRef.element.getBoundingClientRect().left,
                    top: triggerRef.element.getBoundingClientRect().top
                }),
                onMove: ({ event, deltaX, deltaY, origin }) => {
                    floating.stopFloatingEvent(event);
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: CONFIG.triggerSize,
                        height: CONFIG.triggerSize,
                        margin: CONFIG.triggerMargin
                    });
                    triggerRef.setPosition(next.left, next.top);
                    triggerRef.element.classList.add('is-dragging');
                },
                onDragEnd: () => {
                    triggerRef.element.classList.remove('is-dragging');
                    const rect = triggerRef.element.getBoundingClientRect();
                    posStorage.save(rect.left, rect.top);
                },
                onClick: ({ event }) => {
                    floating.stopFloatingEvent(event);
                    captureVideo.captureActiveVideo();
                }
            });

            triggerRef.element.addEventListener('pointerdown', (event) => {
                floating.stopFloatingEvent(event);
            }, true);

            posStorage.load().then(({ left, top }) => {
                const pos = floating.clampFixedPosition({
                    left,
                    top,
                    width: CONFIG.triggerSize,
                    height: CONFIG.triggerSize,
                    margin: CONFIG.triggerMargin
                });
                triggerRef?.setPosition(pos.left, pos.top);
            });

            return triggerRef;
        };

        const syncTrigger = () => {
            const hasVideo = !!captureVideo.findActiveVideo();
            const trigger = ensureTrigger();
            if (ctx.isFeatureEnabled() && hasVideo) {
                trigger.show('inline-flex');
            } else {
                trigger.hide();
            }
        };
        
        const destroy = () => {
            removeDragBinding();
            triggerRef?.destroy();
            triggerRef = null;
        };

        return {
            ensureTrigger,
            syncTrigger,
            destroy
        };
    };
})();
