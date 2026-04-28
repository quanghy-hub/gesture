(() => {
    const ext = globalThis.GestureExtension;
    const unblockCopy = ext.unblockCopy = ext.unblockCopy || {};
    const UI_GUARD = ext.shared.extensionUiGuard;

    const STYLE_ID = 'gesture-unblock-copy-style';
    const WINDOW_BLOCKED_EVENT_NAMES = [
        'contextmenu',
        'selectstart',
        'dragstart'
    ];
    const DOCUMENT_BLOCKED_EVENT_NAMES = [
        ...WINDOW_BLOCKED_EVENT_NAMES,
        'copy',
        'cut',
        'beforecopy',
        'beforecut'
    ];
    const BLOCKED_HANDLER_NAMES = [
        'oncontextmenu',
        'oncopy',
        'oncut',
        'onbeforecopy',
        'onbeforecut',
        'onselectstart',
        'ondragstart'
    ];

    const canPatchNode = (node) => node instanceof Element || node instanceof Document || node instanceof Window;

    const clearBlockingHandlers = (root) => {
        if (!root) return;
        const nodes = [];
        if (canPatchNode(root)) nodes.push(root);
        if (root instanceof Element || root instanceof Document) {
            for (const name of BLOCKED_HANDLER_NAMES) {
                const selector = `[${name}]`;
                root.querySelectorAll?.(selector).forEach((node) => nodes.push(node));
            }
        }

        for (const node of nodes) {
            if (UI_GUARD?.isExtensionUiTarget?.(node)) continue;
            for (const name of BLOCKED_HANDLER_NAMES) {
                try {
                    if (node instanceof Element && node.hasAttribute(name)) {
                        node.removeAttribute(name);
                    }
                    if (name in node && node[name]) {
                        node[name] = null;
                    }
                } catch {
                    // Some native objects expose read-only handler properties.
                }
            }
        }
    };

    const ensureStyle = () => {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            html.gesture-unblock-copy,
            html.gesture-unblock-copy body,
            html.gesture-unblock-copy body * {
                -webkit-user-select: text !important;
                user-select: text !important;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };

    const setActiveClass = (enabled) => {
        document.documentElement?.classList.toggle('gesture-unblock-copy', enabled);
    };

    unblockCopy.createController = ({ getConfig }) => {
        const listeners = [];
        let observer = null;
        let active = false;

        const isEnabled = () => getConfig()?.unblockCopy?.enabled !== false;

        const addListener = (target, event, handler, options) => {
            target.addEventListener(event, handler, options);
            listeners.push(() => target.removeEventListener(event, handler, options));
        };

        const shouldAllow = (event) => {
            if (!active || !isEnabled()) return false;
            return !UI_GUARD?.isExtensionUiTarget?.(event);
        };

        const unblockEvent = (event) => {
            if (!shouldAllow(event)) return;
            clearBlockingHandlers(event.target);
            event.stopImmediatePropagation();
        };

        const unblockCopyShortcut = (event) => {
            if (!shouldAllow(event)) return;
            if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
            const key = String(event.key || '').toLowerCase();
            if (key !== 'c' && key !== 'x' && key !== 'a') return;
            clearBlockingHandlers(event.target);
            event.stopImmediatePropagation();
        };

        const startObserver = () => {
            if (observer || !document.documentElement) return;
            observer = new MutationObserver((records) => {
                if (!active || !isEnabled()) return;
                for (const record of records) {
                    if (record.type === 'attributes') {
                        clearBlockingHandlers(record.target);
                        continue;
                    }
                    record.addedNodes.forEach((node) => clearBlockingHandlers(node));
                }
            });
            observer.observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: BLOCKED_HANDLER_NAMES
            });
        };

        const refresh = () => {
            active = isEnabled();
            ensureStyle();
            setActiveClass(active);
            if (active) {
                clearBlockingHandlers(window);
                clearBlockingHandlers(document);
                clearBlockingHandlers(document.documentElement);
                startObserver();
            }
        };

        WINDOW_BLOCKED_EVENT_NAMES.forEach((eventName) => {
            addListener(window, eventName, unblockEvent, { capture: true, passive: true });
        });
        DOCUMENT_BLOCKED_EVENT_NAMES.forEach((eventName) => {
            addListener(document, eventName, unblockEvent, { capture: true, passive: true });
        });
        addListener(window, 'keydown', unblockCopyShortcut, true);
        addListener(document, 'keydown', unblockCopyShortcut, true);

        refresh();

        return {
            onConfigChange() {
                refresh();
            },
            destroy() {
                active = false;
                setActiveClass(false);
                observer?.disconnect();
                observer = null;
                listeners.splice(0).forEach((remove) => remove());
            }
        };
    };

    ext.features.unblockCopy = {
        shouldRun: ({ runtime }) => runtime.isHttpPage() && runtime.isHtmlDocument(),
        init: ({ getConfig }) => unblockCopy.createController({ getConfig })
    };
})();
