(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const utils = ext.shared.floatingUtils;
    
    const SHARED_ACTION_STYLE_ID = 'gesture-shared-floating-action-style';
    const SHARED_ICONS = Object.freeze({
        camera: `
            <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 4H6a2 2 0 0 0-2 2v2"></path>
                <path d="M16 4h2a2 2 0 0 1 2 2v2"></path>
                <path d="M20 16v2a2 2 0 0 1-2 2h-2"></path>
                <path d="M8 20H6a2 2 0 0 1-2-2v-2"></path>
                <rect x="7" y="7" width="10" height="10" rx="2"></rect>
                <circle cx="12" cy="12" r="2.5"></circle>
            </svg>
        `,
        translate: `
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 6h8"></path>
                <path d="M8 4v2"></path>
                <path d="M6 6c0 2.8-1.2 5.2-3.5 7.1"></path>
                <path d="M4.8 10.2c1 1.3 2.3 2.4 4 3.3"></path>
                <path d="M13 8h7"></path>
                <path d="M16.5 5v3"></path>
                <path d="M14.5 19 17 12l2.5 7"></path>
                <path d="M15.4 16.6h3.2"></path>
                <path d="M10.5 17.5 12 19l2.5-2.5"></path>
            </svg>
        `,
        translateActive: `
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 6h8"></path>
                <path d="M8 4v2"></path>
                <path d="M6 6c0 2.8-1.2 5.2-3.5 7.1"></path>
                <path d="M4.8 10.2c1 1.3 2.3 2.4 4 3.3"></path>
                <path d="M13 8h7"></path>
                <path d="M16.5 5v3"></path>
                <path d="M14.5 19 17 12l2.5 7"></path>
                <path d="M15.4 16.6h3.2"></path>
                <path d="M10.5 17.5 12 19l2.5-2.5"></path>
            </svg>
        `
    });

    const ensureSharedActionButtonStyles = () => {
        if (document.getElementById(SHARED_ACTION_STYLE_ID)) {
            return;
        }
        const style = document.createElement('style');
        style.id = SHARED_ACTION_STYLE_ID;
        style.textContent = `
            .gesture-floating-action-button {
                width: 46px;
                height: 46px;
                padding: 0;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: none;
                border-radius: 0;
                background: transparent;
                color: #fff;
                box-shadow: none;
                cursor: pointer;
                transition: transform 0.15s ease, opacity 0.2s ease, filter 0.15s ease, color 0.15s ease;
                touch-action: manipulation;
                outline: none;
            }
            .gesture-floating-action-button:hover {
                transform: scale(1.04);
                filter: brightness(1.08);
            }
            .gesture-floating-action-button:active,
            .gesture-floating-action-button.is-dragging {
                transform: scale(0.96);
            }
            .gesture-floating-action-button svg {
                display: block;
                flex: 0 0 auto;
                overflow: visible;
                filter:
                    drop-shadow(0 2px 8px rgba(0, 0, 0, 0.55))
                    drop-shadow(0 0 1px rgba(0, 0, 0, 0.7));
            }
            .gesture-floating-action-button.is-active {
                color: #5bb8ff;
            }
        `;
        utils.getFloatingRoot()?.appendChild(style);
    };

    const createFloatingElementApi = (element) => ({
        element,
        show(display) {
            if (!element) {
                return;
            }
            element.hidden = false;
            if (!utils.hasStyleApi(element)) {
                return;
            }
            if (display) {
                element.style.display = display;
            } else {
                // Fallback to a sensible default if it was hidden via inline style
                if (element.style.display === 'none') {
                    const isPanel = element.tagName === 'DIV' || element.classList.contains('gesture-panel') || element.className.includes('panel');
                    if (isPanel) {
                        element.style.display = 'flex';
                        element.style.flexDirection = 'column';
                    } else {
                        element.style.display = 'block';
                    }
                }
            }
        },
        hide() { 
            if (!element) {
                return;
            }
            element.hidden = true; 
            if (utils.hasStyleApi(element)) {
                element.style.display = 'none';
            }
        },
        setPosition(left, top) {
            if (!utils.hasStyleApi(element)) {
                return;
            }
            element.style.left = typeof left === 'number' ? `${left}px` : left;
            element.style.top = typeof top === 'number' ? `${top}px` : top;
        },
        setOpacity(value) {
            if (!utils.hasStyleApi(element)) {
                return;
            }
            element.style.opacity = value;
        },
        setBadge(text) {
            if (!element || typeof element.querySelector !== 'function') {
                return;
            }
            let badge = element.querySelector('.gesture-floating-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'gesture-floating-badge';
                element.appendChild(badge);
            }
            badge.textContent = text;
            if (utils.hasStyleApi(badge)) {
                badge.style.display = text ? 'flex' : 'none';
            }
        },
        setActive(value) {
            element?.classList?.toggle?.('is-active', !!value);
        },
        destroy() { element?.remove?.(); }
    });

    const createTriggerElement = ({ className, textContent, htmlContent, hidden = false }) => {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = className;
        if (htmlContent) utils.appendHtmlFragment(element, htmlContent);
        else if (textContent) element.textContent = textContent;
        element.hidden = hidden;
        if (hidden && utils.hasStyleApi(element)) element.style.display = 'none';
        if (utils.hasStyleApi(element)) {
            element.style.position = 'fixed';
            element.style.zIndex = '2147483646';
        }
        utils.getFloatingRoot()?.appendChild(element);
        return createFloatingElementApi(element);
    };

    const createActionButton = ({ id, className = '', title = '', ariaLabel = '', htmlContent = '', hidden = false, parent, position = 'fixed', zIndex = '2147483646' }) => {
        ensureSharedActionButtonStyles();
        const element = document.createElement('button');
        element.type = 'button';
        if (id) {
            element.id = id;
        }
        element.className = `gesture-floating-action-button ${className}`.trim();
        if (title) {
            element.title = title;
        }
        if (ariaLabel) {
            element.setAttribute('aria-label', ariaLabel);
        }
        if (htmlContent) {
            utils.appendHtmlFragment(element, htmlContent);
        }
        element.hidden = hidden;
        if (hidden && utils.hasStyleApi(element)) {
            element.style.display = 'none';
        }
        if (utils.hasStyleApi(element)) {
            element.style.position = position;
            element.style.zIndex = zIndex;
        }
        (parent || utils.getFloatingRoot())?.appendChild(element);
        return createFloatingElementApi(element);
    };

    const createPanelRoot = ({ className, hidden = false }) => {
        const element = document.createElement('div');
        element.className = className;
        element.hidden = hidden;
        if (hidden && utils.hasStyleApi(element)) element.style.display = 'none';
        if (utils.hasStyleApi(element)) {
            element.style.position = 'fixed';
            element.style.zIndex = '2147483645';
        }
        utils.getFloatingRoot()?.appendChild(element);
        return createFloatingElementApi(element);
    };

    ext.shared.floatingUI = {
        icons: SHARED_ICONS,
        ensureSharedActionButtonStyles,
        createFloatingElementApi,
        createTriggerElement,
        createActionButton,
        createPanelRoot
    };
})();
