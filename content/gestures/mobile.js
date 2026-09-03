(() => {
    const ext = globalThis.GestureExtension;
    const gestures = (ext.gestures = ext.gestures || {});
    const touch = ext.shared.touchCore;
    const { isEditable, isInteractive, getValidLink, dist, openTab, closeCurrentTab, addListenerHelper } = gestures.gestureUtils;
    const scroll = gestures.mobileScroll;
    const stateManagers = gestures.stateManagers;

    gestures.createMobileController = (context) => {
        const TOLERANCE = { move: 20 };
        const listeners = [];
        const state = {
            suppressUntil: 0,
            lpFired: false,
            lp: { timer: null, active: false, x: 0, y: 0 },
            tap: { start: null, last: null },
            edge: {
                active: false,
                lastY: 0,
                lastTime: 0,
                velocity: 0,
                targetScrollTop: 0,
                renderRAF: null,
                renderTime: 0
            },
            momentumRAF: null,
            momentumTime: 0
        };

        const addListener = (target, event, handler, options) => {
            addListenerHelper(listeners, target, event, handler, options);
        };

        const getConfig = () => {
            const cfg = context.getConfig().gestures.mobile;
            if (ext.shared.config.isGestureHostExcluded?.(context.getConfig(), location.hostname)) {
                return { ...cfg, enabled: false };
            }
            return cfg;
        };
        const suppress = (ms = 500) => {
            state.suppressUntil = Date.now() + ms;
        };
        const preventDefaultIfCancelable = (event) => {
            if (event.cancelable) {
                event.preventDefault();
            }
        };

        const guard = (event) => {
            if (Date.now() < state.suppressUntil) {
                preventDefaultIfCancelable(event);
                event.stopPropagation();
                return true;
            }
            return false;
        };

        const { stopMomentum, stopEdgeRender, requestEdgeRender, startMomentum } = scroll.createScrollManager(state);
        const { clearTapStart } = stateManagers.createTapManager(state);
        const { cancelLongPress } = stateManagers.createLongPressManager(state);

        ['click', 'auxclick'].forEach((eventName) => {
            addListener(window, eventName, guard, true);
        });

        addListener(
            window,
            'contextmenu',
            (event) => {
                if (state.lpFired || state.lp.active || Date.now() < state.suppressUntil) {
                    preventDefaultIfCancelable(event);
                    event.stopPropagation();
                }
            },
            true
        );

        addListener(
            window,
            'touchstart',
            (event) => {
                const cfg = getConfig();
                state.lpFired = false;
                stopMomentum();
                if (touch.isExtensionUiTarget(event)) {
                    cancelLongPress();
                    state.edge.active = false;
                    return;
                }
                if (!cfg.enabled || isEditable(event.target)) return;

                if (!event.touches || event.touches.length !== 1) {
                    cancelLongPress();
                    clearTapStart();
                    return;
                }

                const touchPoint = event.touches[0];
                state.tap.start = {
                    x: touchPoint.clientX,
                    y: touchPoint.clientY,
                    time: Date.now(),
                    target: event.target,
                    cancelled: false
                };
                const edgeStrength = cfg.edge.enabled ? scroll.getEdgeStrength(touchPoint.clientX, cfg.edge.width, cfg.edge.side) : 0;
                if (edgeStrength > 0) {
                    const element = document.scrollingElement || document.documentElement;
                    state.edge.active = true;
                    state.edge.lastY = touchPoint.clientY;
                    state.edge.lastTime = Date.now();
                    state.edge.velocity = 0;
                    state.edge.targetScrollTop = element.scrollTop;
                }

                if (!cfg.lpress.enabled) return;
                const link = getValidLink(event);
                if (!link) return;

                state.lp = { timer: null, active: true, x: touchPoint.clientX, y: touchPoint.clientY };
                state.lp.timer = setTimeout(() => {
                    if (!state.lp.active) return;
                    state.lp.active = false;
                    state.lpFired = true;
                    openTab(link.href, getConfig().lpress.mode, context, suppress);
                }, cfg.lpress.ms);
            },
            { capture: true, passive: false }
        );

        addListener(
            window,
            'touchmove',
            (event) => {
                if (touch.isExtensionUiTarget(event)) {
                    cancelLongPress();
                    state.edge.active = false;
                    clearTapStart();
                    return;
                }
                if (!event.touches) {
                    clearTapStart();
                    return;
                }

                if (state.lp.active && event.touches.length === 1) {
                    const touchPoint = event.touches[0];
                    if (dist(touchPoint.clientX, touchPoint.clientY, state.lp.x, state.lp.y) > TOLERANCE.move) {
                        cancelLongPress();
                    }
                }

                if (!state.edge.active || event.touches.length !== 1) {
                    clearTapStart();
                    return;
                }

                const touchPoint = event.touches[0];
                const deltaY = state.edge.lastY - touchPoint.clientY;
                const now = Date.now();
                const deltaTime = Math.max(1, now - state.edge.lastTime);

                const cfg = getConfig();
                const strength = scroll.getEdgeStrength(touchPoint.clientX, cfg.edge.width, cfg.edge.side);
                if (strength <= 0) {
                    state.edge.active = false;
                    clearTapStart();
                    return;
                }

                const speedMultiplier = Math.max(1, Number(cfg.edge.speed) || 3);
                const scrollDelta = deltaY * strength * speedMultiplier;
                state.edge.targetScrollTop += scrollDelta;
                requestEdgeRender();

                state.edge.velocity = (scrollDelta * 1000) / deltaTime;
                state.edge.lastY = touchPoint.clientY;
                state.edge.lastTime = now;

                if (state.tap.start && dist(touchPoint.clientX, touchPoint.clientY, state.tap.start.x, state.tap.start.y) > 12) {
                    state.tap.start.cancelled = true;
                }

                preventDefaultIfCancelable(event);
            },
            { capture: true, passive: false }
        );

        addListener(
            window,
            'touchend',
            (event) => {
                cancelLongPress();
                if (state.edge.active) {
                    state.edge.active = false;
                    if (Math.abs(state.edge.velocity) > 120) {
                        startMomentum(state.edge.velocity);
                    }
                }

                const start = state.tap.start;
                clearTapStart();
                if (!start || start.cancelled || Date.now() - start.time > 250) {
                    return;
                }

                const cfg = getConfig();
                if (!cfg.enabled || !cfg.closeTab?.enabled) return;

                const target = start.target;
                if (isEditable(target) || isInteractive(target)) {
                    return;
                }

                const now = Date.now();
                const lastTap = state.tap.last;
                const maxMs = Number(cfg.closeTab.ms) || 150;
                if (lastTap && now - lastTap.time <= maxMs && dist(start.x, start.y, lastTap.x, lastTap.y) <= 40) {
                    preventDefaultIfCancelable(event);
                    event.stopPropagation();
                    state.tap.last = null;
                    closeCurrentTab(context, suppress);
                    return;
                }

                state.tap.last = { x: start.x, y: start.y, time: now };
            },
            { capture: true, passive: false }
        );

        addListener(
            window,
            'touchcancel',
            () => {
                cancelLongPress();
                state.edge.active = false;
                clearTapStart();
            },
            { capture: true, passive: false }
        );

        return {
            destroy() {
                cancelLongPress();
                stopMomentum();
                stopEdgeRender();
                clearTapStart();
                listeners.splice(0).forEach((remove) => remove());
            }
        };
    };
})();
