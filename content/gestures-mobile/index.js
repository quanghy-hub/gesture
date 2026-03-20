(() => {
    const ext = globalThis.GestureExtension;
    const { isHttpPage } = ext.shared.runtime;

    ext.features.gesturesMobile = {
        shouldRun() {
            return isHttpPage();
        },

        init(context) {
            const TOLERANCE = { move: 20, tap: 30 };
            const listeners = [];
            const state = {
                suppressUntil: 0,
                lpFired: false,
                lp: { timer: null, active: false, x: 0, y: 0 },
                dblTap: { last: null },
                edge: { active: false, lastY: 0, lastTime: 0, velocity: 0 },
                momentumRAF: null
            };

            const addListener = (target, event, handler, options) => {
                target.addEventListener(event, handler, options);
                listeners.push(() => target.removeEventListener(event, handler, options));
            };

            const getConfig = () => context.getConfig().gestures.mobile;
            const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
            const suppress = (ms = 500) => { state.suppressUntil = Date.now() + ms; };
            const isEditable = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
            const isInteractive = (el) => {
                if (!el) return false;
                return ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'VIDEO', 'AUDIO'].includes(el.tagName) || !!el.closest?.('button, a, [role="button"], [onclick]');
            };

            const getValidLink = (event) => {
                for (const node of (event.composedPath?.() || [])) {
                    if (node?.tagName === 'A' && node.href && !/^(javascript|mailto|tel|sms|#):/i.test(node.href)) {
                        return node;
                    }
                }
                return null;
            };

            const isInEdgeZone = (x) => {
                const edge = getConfig().edge;
                if (!edge.enabled) return false;
                const width = innerWidth;
                if (edge.side === 'left') return x < edge.width;
                if (edge.side === 'right') return x > width - edge.width;
                return x < edge.width || x > width - edge.width;
            };

            const openTab = async (url, mode) => {
                const response = await context.tabActions.openTab(url, mode);
                if (!response?.ok) {
                    window.open(url, '_blank');
                }
                suppress(800);
            };

            const closeTab = async () => {
                const response = await context.tabActions.closeCurrentTab();
                if (!response?.ok) {
                    try { window.close(); } catch { /* noop */ }
                }
            };

            const cancelLongPress = () => {
                clearTimeout(state.lp.timer);
                state.lp.timer = null;
                state.lp.active = false;
            };

            const stopMomentum = () => {
                cancelAnimationFrame(state.momentumRAF);
                state.momentumRAF = null;
            };

            const startMomentum = (velocity) => {
                stopMomentum();
                const element = document.scrollingElement || document.documentElement;
                const friction = 0.97;
                const minVelocity = 0.3;

                const step = () => {
                    if (Math.abs(velocity) < minVelocity) return;
                    const previous = element.scrollTop;
                    element.scrollTop += velocity;
                    if (element.scrollTop === previous) return;
                    velocity *= friction;
                    state.momentumRAF = requestAnimationFrame(step);
                };

                step();
            };

            const guard = (event) => {
                if (Date.now() < state.suppressUntil) {
                    event.preventDefault();
                    event.stopPropagation();
                    return true;
                }
                return false;
            };

            ['click', 'auxclick'].forEach((eventName) => {
                addListener(window, eventName, guard, true);
            });

            addListener(window, 'contextmenu', (event) => {
                if (state.lpFired || state.lp.active || Date.now() < state.suppressUntil) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }, true);

            addListener(window, 'touchstart', (event) => {
                const cfg = getConfig();
                state.lpFired = false;
                stopMomentum();
                if (!cfg.enabled || isEditable(event.target) || event.touches.length !== 1) return;

                const touch = event.touches[0];
                const now = Date.now();

                if (isInEdgeZone(touch.clientX) && !event.target.closest?.('#fvp-container')) {
                    state.edge = { active: true, lastY: touch.clientY, lastTime: now, velocity: 0 };
                    return;
                }

                if (cfg.dblTap.enabled && !isInteractive(event.target)) {
                    const last = state.dblTap.last;
                    const timeSinceLast = last ? now - last.time : Infinity;
                    if (last && last.ended && timeSinceLast >= 100 && timeSinceLast < cfg.dblTap.ms && dist(touch.clientX, touch.clientY, last.x, last.y) < TOLERANCE.tap) {
                        event.preventDefault();
                        event.stopPropagation();
                        state.dblTap.last = null;
                        closeTab();
                        return;
                    }

                    if (!last || timeSinceLast > 50) {
                        state.dblTap.last = { time: now, x: touch.clientX, y: touch.clientY, ended: false };
                    }
                }

                if (!cfg.lpress.enabled) return;
                const link = getValidLink(event);
                if (!link) return;

                state.lp = { timer: null, active: true, x: touch.clientX, y: touch.clientY };
                state.lp.timer = setTimeout(() => {
                    if (!state.lp.active) return;
                    state.lp.active = false;
                    state.lpFired = true;
                    openTab(link.href, getConfig().lpress.mode);
                }, cfg.lpress.ms);
            }, { capture: true, passive: false });

            addListener(window, 'touchmove', (event) => {
                if (state.lp.active && event.touches.length === 1) {
                    const touch = event.touches[0];
                    if (dist(touch.clientX, touch.clientY, state.lp.x, state.lp.y) > TOLERANCE.move) {
                        cancelLongPress();
                    }
                }

                if (state.dblTap.last && event.touches.length === 1) {
                    const touch = event.touches[0];
                    if (dist(touch.clientX, touch.clientY, state.dblTap.last.x, state.dblTap.last.y) > TOLERANCE.tap) {
                        state.dblTap.last = null;
                    }
                }

                if (!state.edge.active || event.touches.length !== 1) {
                    state.edge.active = false;
                    return;
                }

                const cfg = getConfig();
                const touch = event.touches[0];
                const now = Date.now();
                const deltaY = state.edge.lastY - touch.clientY;
                const deltaTime = now - state.edge.lastTime;
                if (deltaTime > 0) {
                    state.edge.velocity = ((deltaY * cfg.edge.speed) / deltaTime) * 16;
                }

                state.edge.lastY = touch.clientY;
                state.edge.lastTime = now;
                (document.scrollingElement || document.documentElement).scrollTop += deltaY * cfg.edge.speed;
                event.preventDefault();
            }, { capture: true, passive: false });

            addListener(window, 'touchend', () => {
                cancelLongPress();
                if (state.edge.active && Math.abs(state.edge.velocity) > 1) {
                    startMomentum(state.edge.velocity);
                }

                state.edge.active = false;
                const cfg = getConfig();
                if (state.dblTap.last && !state.dblTap.last.ended) {
                    state.dblTap.last.ended = true;
                    state.dblTap.last.time = Date.now();
                    const savedTime = state.dblTap.last.time;
                    setTimeout(() => {
                        if (state.dblTap.last && state.dblTap.last.time === savedTime) {
                            state.dblTap.last = null;
                        }
                    }, cfg.dblTap.ms + 50);
                }
            }, true);

            addListener(window, 'touchcancel', () => {
                cancelLongPress();
                state.edge.active = false;
                state.dblTap.last = null;
            }, true);

            addListener(window, 'click', (event) => {
                if (!state.lpFired) return;
                event.preventDefault();
                event.stopPropagation();
                state.lpFired = false;
            }, true);

            return {
                destroy() {
                    stopMomentum();
                    listeners.splice(0).forEach((remove) => remove());
                }
            };
        }
    };
})();