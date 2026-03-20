(() => {
    const ext = globalThis.GestureExtension;
    const { isHttpPage } = ext.shared.runtime;

    ext.features.gesturesDesktop = {
        shouldRun() {
            return isHttpPage();
        },

        init(context) {
            const TOLERANCE = { move: 20 };
            const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
            const state = {
                suppressUntil: 0,
                lpFired: false,
                rcHandled: false,
                lp: { timer: null, active: false, x: 0, y: 0 },
                dblRight: { timer: null, lastEvent: null },
                pager: { acc: 0, timer: null, dir: 0, hops: 0 },
                pagerIndicator: null
            };
            const listeners = [];

            const addListener = (target, event, handler, options) => {
                target.addEventListener(event, handler, options);
                listeners.push(() => target.removeEventListener(event, handler, options));
            };

            const dist = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
            const getConfig = () => context.getConfig().gestures.desktop;
            const suppress = (ms = 500) => { state.suppressUntil = Date.now() + ms; };
            const isEditable = (el) => el && (EDITABLE_TAGS.has(el.tagName) || el.isContentEditable);

            const getValidLink = (event) => {
                for (const node of (event.composedPath?.() || [])) {
                    if (node?.tagName === 'A' && node.href && !/^(javascript|mailto|tel|sms|#):/i.test(node.href)) {
                        return node;
                    }
                }
                return null;
            };

            const openTab = async (url, mode) => {
                const response = await context.tabActions.openTab(url, mode);
                if (!response?.ok) {
                    window.open(url, '_blank', mode === 'fg' ? '' : 'noopener');
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

            const findLink = (keywords, relType) => {
                if (relType) {
                    const rel = document.querySelector(`a[rel="${relType}"], link[rel="${relType}"]`);
                    if (rel?.href) return rel.href;
                }

                for (const anchor of document.querySelectorAll('a[href]')) {
                    const text = (anchor.innerText || anchor.getAttribute('aria-label') || '').toLowerCase();
                    if (keywords.some((keyword) => text.includes(keyword))) return anchor.href;
                }

                return null;
            };

            const goPage = (dir, hops = 1, isMax = false) => {
                if (isMax) {
                    const href = findLink(dir > 0 ? ['last', 'cuối', '末'] : ['first', 'đầu', '首'], dir > 0 ? 'last' : 'first');
                    if (href) location.href = href;
                    return;
                }

                const href = findLink(dir > 0 ? ['next', 'tiếp', 'sau', '»', '›', '下一'] : ['prev', 'trước', 'lùi', '«', '‹', '上一'], dir > 0 ? 'next' : 'prev');
                if (!href) return;
                if (hops <= 1) {
                    location.href = href;
                    return;
                }

                try {
                    const current = new URL(location.href);
                    const next = new URL(href, location.href);

                    for (const [key, value] of next.searchParams) {
                        if (!/^\d+$/.test(value)) continue;
                        const currentValue = current.searchParams.get(key);
                        if (currentValue === value) continue;

                        const currentNumber = currentValue !== null && /^\d+$/.test(currentValue) ? +currentValue : +value - dir;
                        const step = +value - currentNumber;
                        if (!step) continue;

                        next.searchParams.set(key, Math.max(step > 0 ? 1 : 0, currentNumber + step * hops));
                        location.href = next.href;
                        return;
                    }

                    const currentParts = current.pathname.split('/');
                    const nextParts = next.pathname.split('/');
                    const numberAtEnd = (segment) => {
                        const match = segment.match(/(\d+)$/);
                        return match ? +match[1] : null;
                    };

                    for (let i = 0; i < Math.max(currentParts.length, nextParts.length); i += 1) {
                        const currentPart = currentParts[i] || '';
                        const nextPart = nextParts[i] || '';
                        if (currentPart === nextPart) continue;

                        const nextNumber = numberAtEnd(nextPart);
                        if (nextNumber === null) continue;

                        const currentNumber = numberAtEnd(currentPart);
                        const startValue = currentNumber !== null ? currentNumber : nextNumber - dir;
                        const step = nextNumber - startValue;
                        if (!step) continue;

                        nextParts[i] = nextPart.replace(/\d+$/, Math.max(step > 0 ? 1 : 0, startValue + step * hops));
                        next.pathname = nextParts.join('/');
                        location.href = next.href;
                        return;
                    }
                } catch {
                    location.href = href;
                }
            };

            const ensurePagerStyles = () => {
                if (document.getElementById('gesture-ext-pager-style')) return;
                const style = document.createElement('style');
                style.id = 'gesture-ext-pager-style';
                style.textContent = '#gesture-ext-pager{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1ae6;color:#fff;padding:8px 16px;border-radius:20px;font:13px/1.4 system-ui;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .2s}#gesture-ext-pager.show{opacity:1}';
                (document.head || document.documentElement).appendChild(style);
            };

            const showPagerIcon = (dir, hops, maxHops) => {
                if (!state.pagerIndicator) {
                    state.pagerIndicator = document.createElement('div');
                    state.pagerIndicator.id = 'gesture-ext-pager';
                    (document.body || document.documentElement).appendChild(state.pagerIndicator);
                }

                const isMax = hops > maxHops;
                const icon = isMax ? (dir > 0 ? '⏭' : '⏮') : (dir > 0 ? '▶' : '◀');
                const label = isMax ? (dir > 0 ? 'Cuối' : 'Đầu') : `${hops} trang`;
                state.pagerIndicator.textContent = `${icon} ${label}`;
                state.pagerIndicator.classList.add('show');
            };

            const hidePagerIcon = () => {
                state.pagerIndicator?.classList.remove('show');
            };

            const hasHorizontalIntent = (event) => {
                const absX = Math.abs(event.deltaX);
                const absY = Math.abs(event.deltaY);
                if (absX < 6) return false;
                if (absY === 0) return true;
                return absX >= absY * 0.65 || (absX >= 18 && absY < 40);
            };

            const guard = (event) => {
                if (Date.now() < state.suppressUntil) {
                    event.preventDefault();
                    event.stopPropagation();
                    return true;
                }
                return false;
            };

            ensurePagerStyles();

            ['click', 'auxclick'].forEach((eventName) => {
                addListener(window, eventName, guard, true);
            });

            addListener(window, 'contextmenu', (event) => {
                if (guard(event)) return;
                if (state.lpFired || state.lp.active) {
                    event.preventDefault();
                    event.stopPropagation();
                }
            }, true);

            addListener(window, 'pointerdown', (event) => {
                state.lpFired = false;
                const cfg = getConfig();
                if (event.pointerType && event.pointerType !== 'mouse') return;
                if (event.button !== 0) return;
                if (!cfg.enabled || !cfg.lpress.enabled || isEditable(event.target)) return;

                const link = getValidLink(event);
                if (!link) return;

                state.lp = { timer: null, active: true, x: event.clientX, y: event.clientY };
                state.lp.timer = setTimeout(() => {
                    if (!state.lp.active) return;
                    state.lp.active = false;
                    state.lpFired = true;
                    openTab(link.href, getConfig().lpress.mode);
                }, getConfig().lpress.ms);
            }, true);

            addListener(window, 'pointermove', (event) => {
                if (state.lp.active && dist(event.clientX, event.clientY, state.lp.x, state.lp.y) > TOLERANCE.move) {
                    cancelLongPress();
                }
            }, true);

            ['pointerup', 'pointercancel'].forEach((eventName) => {
                addListener(window, eventName, cancelLongPress, true);
            });

            addListener(window, 'click', (event) => {
                if (!state.lpFired) return;
                event.preventDefault();
                event.stopPropagation();
                state.lpFired = false;
            }, true);

            const pageLoadTime = Date.now();
            addListener(window, 'mousedown', (event) => {
                state.rcHandled = false;
                if (event.button !== 2 || isEditable(event.target)) return;
                if (getValidLink(event)) {
                    state.dblRight.lastEvent = null;
                    return;
                }

                const cfg = getConfig();
                const now = Date.now();
                if (now - pageLoadTime < 1000) return;
                clearTimeout(state.dblRight.timer);

                if (!cfg.dblRight.enabled) return;

                if (state.dblRight.lastEvent && now - state.dblRight.lastEvent.time < cfg.dblRight.ms && dist(event.clientX, event.clientY, state.dblRight.lastEvent.x, state.dblRight.lastEvent.y) < TOLERANCE.move) {
                    event.preventDefault();
                    event.stopPropagation();
                    state.dblRight.lastEvent = null;
                    state.rcHandled = true;
                    closeTab();
                    return;
                }

                state.dblRight.lastEvent = { time: now, x: event.clientX, y: event.clientY };
                state.dblRight.timer = setTimeout(() => {
                    state.dblRight.lastEvent = null;
                }, cfg.dblRight.ms + 100);
            }, true);

            addListener(window, 'contextmenu', (event) => {
                if (state.rcHandled || guard(event)) {
                    event.preventDefault();
                    event.stopPropagation();
                    return;
                }

                const cfg = getConfig();
                if (!cfg.enabled || !cfg.rclick.enabled) return;

                const link = getValidLink(event);
                if (!link) return;

                event.preventDefault();
                event.stopPropagation();
                state.rcHandled = true;
                openTab(link.href, cfg.rclick.mode);
            }, true);

            addListener(window, 'wheel', (event) => {
                const cfg = getConfig();
                if (!cfg.enabled || !cfg.pager.enabled) return;
                if (!hasHorizontalIntent(event)) return;

                let element = event.target;
                while (element && element !== document.body) {
                    if (element.scrollWidth > element.clientWidth && ['auto', 'scroll'].includes(getComputedStyle(element).overflowX)) return;
                    if (element.tagName === 'INPUT' || element.isContentEditable) return;
                    element = element.parentElement;
                }

                const dir = event.deltaX > 0 ? 1 : -1;
                if (!dir) {
                    return;
                }

                clearTimeout(state.pager.timer);
                state.pager.hops = dir !== state.pager.dir ? 1 : state.pager.hops + 1;
                state.pager.dir = dir;
                const maxHops = Math.max(1, Number(cfg.pager.hops) || 3);

                showPagerIcon(dir, state.pager.hops, maxHops);

                const currentDir = dir;
                const currentHops = state.pager.hops;
                state.pager.timer = window.setTimeout(() => {
                    hidePagerIcon();
                    if (state.pager.dir === currentDir && state.pager.hops === currentHops) {
                        state.pager.dir = 0;
                        state.pager.hops = 0;
                    }
                }, 180);

                goPage(dir, Math.min(currentHops, maxHops), currentHops > maxHops);
            }, { capture: true, passive: true });

            return {
                destroy() {
                    cancelLongPress();
                    clearTimeout(state.dblRight.timer);
                    clearTimeout(state.pager.timer);
                    hidePagerIcon();
                    state.pagerIndicator?.remove();
                    listeners.splice(0).forEach((remove) => remove());
                }
            };
        }
    };

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
