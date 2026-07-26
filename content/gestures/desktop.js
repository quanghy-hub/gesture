(() => {
    const ext = globalThis.GestureExtension;
    const gestures = ext.gestures = ext.gestures || {};
    const touch = ext.shared.touchCore;
    const { isEditable, isInteractive, getValidLink, dist, openTab, closeCurrentTab, addListenerHelper } = gestures.gestureUtils;
    const pager = gestures.desktopPager;
    const longPress = gestures.desktopLongPress;

    gestures.createDesktopController = (context) => {
        const TOLERANCE = { move: 20 };
        const state = {
            suppressUntil: 0,
            lpFired: false,
            rcHandled: false,
            closeClick: { last: null },
            lp: { timer: null, active: false, x: 0, y: 0 },
            pager: { acc: 0, timer: null, dir: 0, hops: 0 },
            pointer: { active: false, x: 0, y: 0 },
            pointerIndicator: null,
            pagerIndicator: null
        };
        const listeners = [];

        const addListener = (target, event, handler, options) => {
            addListenerHelper(listeners, target, event, handler, options);
        };

        const getConfig = () => {
            const cfg = context.getConfig().gestures.desktop;
            if (ext.shared.config.isGestureHostExcluded?.(context.getConfig(), location.hostname)) {
                return { ...cfg, enabled: false };
            }
            return cfg;
        };
        const getForumConfig = () => ext.shared.config.getForumConfig(context.getConfig(), location.host);
        const suppress = (ms = 500) => { state.suppressUntil = Date.now() + ms; };
        const shouldRunPagerForForum = () => {
            const forumConfig = getForumConfig();
            return forumConfig.enabled;
        };
        const updatePointerPosition = (event) => {
            state.pointer.active = true;
            state.pointer.x = event.clientX || 0;
            state.pointer.y = event.clientY || 0;
        };
        const isVideoAtPointer = () => {
            if (!state.pointer.active) return false;
            const helpers = globalThis.GestureExtension?.videoFloating?.helpers;
            return !!helpers?.getSeekableVideoAtPoint?.(state.pointer.x, state.pointer.y, { includeFloating: true });
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

        const guard = (event) => {
            if (Date.now() < state.suppressUntil) {
                event.preventDefault();
                event.stopPropagation();
                return true;
            }
            return false;
        };

        const { cancelLongPress } = longPress.createLongPressManager(state);

        pager.ensurePagerStyles();

        ['click', 'auxclick'].forEach((eventName) => {
            addListener(window, eventName, (event) => {
                guard(event);
            }, true);
        });

        addListener(window, 'contextmenu', (event) => {
            if (guard(event)) return;
            if (state.lpFired || state.lp.active) {
                event.preventDefault();
                event.stopPropagation();
            }
        }, true);

        addListener(window, 'keydown', (event) => {
            const cfg = getConfig();
            if (!cfg.enabled || !cfg.pager.enabled) return;
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (!shouldRunPagerForForum()) return;
            if (touch.isExtensionUiTarget(event) || isEditable(event.target)) return;
            if (event.target instanceof Element && event.target.closest('#fvp-container')) return;
            if (isVideoAtPointer()) return;

            const dir = event.key === 'ArrowRight' ? 1 : -1;
            const maxHops = Math.max(1, Number(cfg.pager.hops) || 3);

            event.preventDefault();
            event.stopPropagation();
            clearTimeout(state.pager.timer);
            state.pager.hops = dir !== state.pager.dir ? 1 : state.pager.hops + 1;
            state.pager.dir = dir;
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

            pager.goPage(dir, Math.min(currentHops, maxHops), currentHops > maxHops);
        }, true);

        addListener(window, 'pointerdown', (event) => {
            updatePointerPosition(event);
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
                openTab(link.href, getConfig().lpress.mode, context, suppress);
            }, getConfig().lpress.ms);
        }, true);

        addListener(window, 'pointermove', (event) => {
            updatePointerPosition(event);
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

        addListener(window, 'click', (event) => {
            const cfg = getConfig();
            if (!cfg.enabled || !cfg.closeTab?.enabled) return;
            if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
            if (touch.isExtensionUiTarget(event) || isEditable(event.target) || isInteractive(event.target)) return;

            const now = Date.now();
            const lastClick = state.closeClick.last;
            const maxMs = Number(cfg.closeTab.ms) || 150;
            if (lastClick && now - lastClick.time <= maxMs && dist(event.clientX, event.clientY, lastClick.x, lastClick.y) <= 32) {
                event.preventDefault();
                event.stopPropagation();
                state.closeClick.last = null;
                closeCurrentTab(context, suppress);
                return;
            }

            state.closeClick.last = { x: event.clientX, y: event.clientY, time: now };
        }, true);

        const pageLoadTime = Date.now();
        addListener(window, 'mousedown', (event) => {
            state.rcHandled = false;
            if (event.button !== 2 || isEditable(event.target)) return;
            if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

            const cfg = getConfig();
            const now = Date.now();
            if (now - pageLoadTime < 1000) return;

            const link = getValidLink(event);
            if (link && cfg.enabled && cfg.rclick.enabled) {
                event.preventDefault();
                event.stopPropagation();
                state.rcHandled = true;
                openTab(link.href, cfg.rclick.mode, context, suppress);
                return;
            }
        }, true);

        addListener(window, 'contextmenu', (event) => {
            if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

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
            openTab(link.href, cfg.rclick.mode, context, suppress);
        }, true);

        return {
            destroy() {
                cancelLongPress();
                clearTimeout(state.pager.timer);
                hidePagerIcon();
                state.pagerIndicator?.remove();
                listeners.splice(0).forEach((remove) => remove());
            }
        };
    };
})();
