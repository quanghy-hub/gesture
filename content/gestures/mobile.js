(() => {
    const ext = globalThis.GestureExtension;
    const gestures = ext.gestures = ext.gestures || {};
    const touch = ext.shared.touchCore;
    const { isEditable, isInteractive, getValidLink, dist, openTab, closeCurrentTab, addListenerHelper } = gestures.gestureUtils;

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

        const getConfig = () => context.getConfig().gestures.mobile;
        const suppress = (ms = 500) => { state.suppressUntil = Date.now() + ms; };
        const preventDefaultIfCancelable = (event) => {
            if (event.cancelable) {
                event.preventDefault();
            }
        };

        const stopMomentum = () => {
            cancelAnimationFrame(state.momentumRAF);
            state.momentumRAF = null;
            state.momentumTime = 0;
        };

        const stopEdgeRender = () => {
            cancelAnimationFrame(state.edge.renderRAF);
            state.edge.renderRAF = null;
            state.edge.renderTime = 0;
        };

        const clearTapStart = () => {
            state.tap.start = null;
        };

        const clampScrollTop = (value, element) => Math.max(0, Math.min(value, element.scrollHeight - element.clientHeight));
        const getEdgeStrength = (x) => {
            const { edge } = getConfig();
            const width = Math.max(edge.width, 1);

            if (edge.side === 'left') {
                return Math.max(0, 1 - (x / width));
            }
            if (edge.side === 'right') {
                return Math.max(0, 1 - ((innerWidth - x) / width));
            }

            if (x <= width) {
                return Math.max(0, 1 - (x / width));
            }
            if (x >= innerWidth - width) {
                return Math.max(0, 1 - ((innerWidth - x) / width));
            }
            return 0;
        };

        const requestEdgeRender = () => {
            if (state.edge.renderRAF) return;

            const step = (time) => {
                const element = document.scrollingElement || document.documentElement;
                const target = clampScrollTop(state.edge.targetScrollTop, element);
                const current = element.scrollTop;
                const delta = target - current;

                if (Math.abs(delta) < 0.5) {
                    if (current !== target) {
                        element.scrollTop = target;
                    }
                    state.edge.renderRAF = null;
                    state.edge.renderTime = 0;
                    return;
                }

                const deltaTime = state.edge.renderTime ? Math.min(Math.max(time - state.edge.renderTime, 8), 32) : 16;
                state.edge.renderTime = time;
                const follow = state.edge.active ? 0.95 : 0.35;
                const maxStep = Math.max(12, deltaTime * 2.8);
                const next = current + Math.sign(delta) * Math.min(Math.abs(delta) * follow, Math.abs(delta), maxStep + Math.abs(delta) * 0.25);
                element.scrollTop = next;
                state.edge.renderRAF = requestAnimationFrame(step);
            };

            state.edge.renderRAF = requestAnimationFrame(step);
        };

        const startMomentum = (velocity) => {
            stopMomentum();
            stopEdgeRender();
            const element = document.scrollingElement || document.documentElement;
            const decayPerFrame = 0.94;
            const minVelocity = 8;

            const step = (time) => {
                const deltaTime = state.momentumTime ? Math.min(Math.max(time - state.momentumTime, 8), 34) : 16;
                state.momentumTime = time;
                const decay = Math.pow(decayPerFrame, deltaTime / 16);
                velocity *= decay;
                if (Math.abs(velocity) < minVelocity) {
                    state.momentumRAF = null;
                    state.momentumTime = 0;
                    return;
                }
                const previous = element.scrollTop;
                element.scrollTop = clampScrollTop(previous + ((velocity * deltaTime) / 1000), element);
                if (element.scrollTop === previous) {
                    state.momentumRAF = null;
                    state.momentumTime = 0;
                    return;
                }
                state.momentumRAF = requestAnimationFrame(step);
            };

            state.momentumRAF = requestAnimationFrame(step);
        };

        const guard = (event) => {
            if (Date.now() < state.suppressUntil) {
                preventDefaultIfCancelable(event);
                event.stopPropagation();
                return true;
            }
            return false;
        };

        const cancelLongPress = () => {
            clearTimeout(state.lp.timer);
            state.lp.timer = null;
            state.lp.active = false;
        };

        ['click', 'auxclick'].forEach((eventName) => {
            addListener(window, eventName, guard, true);
        });

        addListener(window, 'contextmenu', (event) => {
            if (state.lpFired || state.lp.active || Date.now() < state.suppressUntil) {
                preventDefaultIfCancelable(event);
                event.stopPropagation();
            }
        }, true);

        addListener(window, 'touchstart', (event) => {
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
            const edgeStrength = cfg.edge.enabled ? getEdgeStrength(touchPoint.clientX) : 0;
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
        }, { capture: true, passive: false });

        addListener(window, 'touchmove', (event) => {
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

            const strength = getEdgeStrength(touchPoint.clientX);
            if (strength <= 0) {
                state.edge.active = false;
                clearTapStart();
                return;
            }

            const cfg = getConfig();
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
        }, { capture: true, passive: false });

        addListener(window, 'touchend', (event) => {
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
        }, { capture: true, passive: false });

        addListener(window, 'touchcancel', () => {
            cancelLongPress();
            state.edge.active = false;
            clearTapStart();
        }, { capture: true, passive: false });

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
};
