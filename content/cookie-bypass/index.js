(() => {
    const ext = globalThis.GestureExtension;
    const { isVisible } = ext.shared.domUtils;
    const { getConfig } = ext.shared.storage;

    const COOKIE_CONTEXT_KEYWORDS = [
        'cookie', 'consent', 'privacy', 'gdpr', 'tracking', 'we use cookies',
        'chấp nhận cookie', 'quyền riêng tư', 'đồng ý cookie'
    ];

    const ACCEPT_BUTTON_KEYWORDS = [
        'accept', 'accept all', 'agree', 'allow', 'allow all', 'consent', 'ok',
        'i understand', 'got it', 'continue', 'yes, i agree',
        'đồng ý', 'chấp nhận', 'cho phép', 'tiếp tục'
    ];

    const DISMISS_BUTTON_KEYWORDS = [
        'close', 'dismiss', 'skip', 'not now', 'no thanks', 'later', 'x', '×',
        'đóng', 'bỏ qua', 'để sau', 'không, cảm ơn'
    ];

    const GENERIC_ACTION_SELECTORS = [
        'button[id*="accept" i]', 'button[class*="accept" i]', 'button[data-testid*="accept" i]',
        'button[id*="agree" i]', 'button[class*="agree" i]', 'button[id*="allow" i]',
        'button[class*="allow" i]', 'button[id*="consent" i]', 'button[class*="consent" i]',
        '[role="button"][aria-label*="accept" i]', '[role="button"][aria-label*="agree" i]',
        'input[type="button"][value*="accept" i]', 'input[type="submit"][value*="accept" i]',
        'a[class*="cookie" i][class*="accept" i]'
    ];

    const GENERIC_BANNER_SELECTORS = [
        '#onetrust-consent-sdk', '#usercentrics-root', '#CybotCookiebotDialog',
        '.CybotCookiebotDialog', '.cookie-banner', '.cookie-consent',
        '.cookie-notice', '.cc-window', '.didomi-popup-container', '.didomi-notice',
        '.truste_overlay', '.truste_box_overlay', '.iubenda-cs-overlay',
        '.iubenda-cs-container', '[id*="cookie" i][id*="banner" i]',
        '[class*="cookie" i][class*="banner" i]', '[id*="consent" i]', '[class*="consent" i]',
        '[aria-modal="true"]', '[role="dialog"]'
    ];

    const GENERIC_OVERLAY_SELECTORS = [
        '.modal-backdrop', '.overlay', '.backdrop', '[class*="overlay" i]', '[id*="overlay" i]'
    ];

    const CMP_ADAPTERS = [
        {
            selectors: ['#onetrust-accept-btn-handler', '.onetrust-accept-btn-handler', 'button[aria-label*="Accept All" i]'],
            api() {
                try {
                    if (typeof window.OneTrust?.AllowAll === 'function') {
                        window.OneTrust.AllowAll();
                        return true;
                    }
                } catch { }
                return false;
            }
        },
        {
            selectors: ['#didomi-notice-agree-button', '[data-testid="notice-cta-accept-all"]', '.didomi-components-button--color'],
            api() {
                try {
                    if (typeof window.Didomi?.setUserAgreeToAll === 'function') {
                        window.Didomi.setUserAgreeToAll();
                        return true;
                    }
                } catch { }
                return false;
            }
        },
        {
            selectors: ['[data-testid="uc-accept-all-button"]', 'button[id*="accept" i][data-testid*="uc" i]', '#accept'],
            api() {
                try {
                    if (typeof window.UC_UI?.acceptService === 'function') {
                        window.UC_UI.acceptService('all');
                        return true;
                    }
                    if (typeof window.Usercentrics?.acceptAllConsents === 'function') {
                        window.Usercentrics.acceptAllConsents();
                        return true;
                    }
                } catch { }
                return false;
            }
        },
        {
            selectors: ['#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll', '#CybotCookiebotDialogBodyButtonAccept'],
            api() {
                try {
                    if (typeof window.Cookiebot?.submitCustomConsent === 'function') {
                        window.Cookiebot.submitCustomConsent(true, true, true);
                        return true;
                    }
                } catch { }
                return false;
            }
        },
        {
            selectors: ['.cc-btn', '.cc-dismiss', '.cc-allow', '.cc-compliance .cc-btn'],
            api() {
                try {
                    if (typeof window.cookieconsent?.dismiss === 'function') {
                        window.cookieconsent.dismiss(true);
                        return true;
                    }
                } catch { }
                return false;
            }
        },
        {
            selectors: ['.iubenda-cs-accept-btn', '#iub-accept-btn'],
            api() {
                try {
                    if (typeof window._iub?.cs?.api?.acceptAll === 'function') {
                        window._iub.cs.api.acceptAll();
                        return true;
                    }
                } catch { }
                return false;
            }
        }
    ];

    const CLICKED_MARK = 'cookieBypassHandled';
    const SCAN_SCHEDULE_MS = [0, 300, 1200, 3000, 7000, 15000];
    const OBSERVER_TIMEOUT_MS = 30000;

    let bypassActive = false;
    let bypassedCount = 0;
    let observer = null;
    let stopped = false;
    let scanScheduled = false;

    const normalizeText = (value) => (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const unique = (items) => [...new Set(items.filter(Boolean))];

    const visitRoots = (root, callback) => {
        if (!root || typeof callback !== 'function') return;
        callback(root);

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
        let current = walker.currentNode;
        while (current) {
            if (current.shadowRoot) {
                visitRoots(current.shadowRoot, callback);
            }
            current = walker.nextNode();
        }
    };

    const queryAllDeep = (selectors) => {
        const selectorList = unique(Array.isArray(selectors) ? selectors : [selectors]).join(', ');
        if (!selectorList) return [];

        const results = [];
        visitRoots(document, (root) => {
            if (typeof root.querySelectorAll !== 'function') return;
            results.push(...root.querySelectorAll(selectorList));
        });
        return unique(results);
    };

    const getInteractiveCandidates = () => queryAllDeep([
        'button',
        '[role="button"]',
        'input[type="button"]',
        'input[type="submit"]',
        'a',
        '[aria-label]',
        '[onclick]'
    ]);

    const getVisibleBanners = () => queryAllDeep(GENERIC_BANNER_SELECTORS)
        .filter((element) => element instanceof HTMLElement && isVisible(element));

    const getOverlayCandidates = () => queryAllDeep(GENERIC_OVERLAY_SELECTORS)
        .filter((element) => element instanceof HTMLElement && isVisible(element));

    const getPopupCloseCandidates = () => queryAllDeep([
        '.modal.show .close',
        '.modal.popup .close',
        '.popup .close',
        '[role="dialog"] .close',
        '[aria-modal="true"] .close',
        '.modal.show [data-dismiss="modal"]',
        '.popup [data-dismiss="modal"]'
    ]).filter((element) => element instanceof HTMLElement && isVisible(element));

    const hasCookieContext = (element, banners = getVisibleBanners()) => {
        const ownText = normalizeText(element.textContent || element.getAttribute?.('aria-label'));
        if (COOKIE_CONTEXT_KEYWORDS.some((keyword) => ownText.includes(keyword))) return true;

        for (const banner of banners) {
            if (banner.contains(element)) return true;
            const bannerText = normalizeText(banner.textContent);
            if (bannerText && COOKIE_CONTEXT_KEYWORDS.some((keyword) => bannerText.includes(keyword))) {
                const rect = banner.getBoundingClientRect();
                const elRect = element.getBoundingClientRect();
                const nearBanner = elRect.bottom >= rect.top - 24 && elRect.top <= rect.bottom + 24;
                if (nearBanner) return true;
            }
        }

        const closest = element.closest?.(GENERIC_BANNER_SELECTORS.join(', '));
        return !!closest;
    };

    const isMatchingAction = (element) => {
        const text = normalizeText(element.textContent || element.value || element.getAttribute?.('aria-label'));
        return ACCEPT_BUTTON_KEYWORDS.some((keyword) => text.includes(keyword));
    };

    const isDismissAction = (element) => {
        const text = normalizeText(element.textContent || element.value || element.getAttribute?.('aria-label'));
        if (!text && element.classList.contains('close')) return true;
        return DISMISS_BUTTON_KEYWORDS.some((keyword) => text === keyword || text.includes(keyword));
    };

    const dispatchRealClick = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const clientX = rect.left + Math.min(Math.max(rect.width / 2, 1), Math.max(rect.width - 1, 1));
        const clientY = rect.top + Math.min(Math.max(rect.height / 2, 1), Math.max(rect.height - 1, 1));
        const eventInit = { bubbles: true, cancelable: true, composed: true, clientX, clientY, button: 0 };

        try {
            element.dispatchEvent(new PointerEvent('pointerdown', eventInit));
            element.dispatchEvent(new MouseEvent('mousedown', eventInit));
            element.dispatchEvent(new PointerEvent('pointerup', eventInit));
            element.dispatchEvent(new MouseEvent('mouseup', eventInit));
            element.dispatchEvent(new MouseEvent('click', eventInit));
            element.click?.();
            return true;
        } catch {
            try {
                element.click?.();
                return true;
            } catch {
                return false;
            }
        }
    };

    const unlockPageScrollIfNeeded = () => {
        const root = document.documentElement;
        const body = document.body;
        if (!body) return;

        for (const target of [root, body]) {
            const style = window.getComputedStyle(target);
            if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
                target.style.setProperty('overflow', 'auto', 'important');
                target.style.setProperty('overflow-y', 'auto', 'important');
            }
            if (style.position === 'fixed' && (target === body || target === root)) {
                target.style.removeProperty('position');
                target.style.removeProperty('width');
            }
        }
    };

    const finalizePageUnlock = () => {
        suppressBlockingUi();
        unlockPageScrollIfNeeded();
    };

    const suppressBlockingUi = () => {
        let changed = false;
        const banners = getVisibleBanners();
        const overlays = getOverlayCandidates();

        for (const element of [...banners, ...overlays]) {
            const text = normalizeText(element.textContent);
            const rect = element.getBoundingClientRect();
            const areaRatio = (rect.width * rect.height) / Math.max(window.innerWidth * window.innerHeight, 1);
            const looksCookieUi = COOKIE_CONTEXT_KEYWORDS.some((keyword) => text.includes(keyword)) || banners.includes(element);
            const looksBlockingOverlay = areaRatio > 0.2 && (looksCookieUi || element.matches?.(GENERIC_OVERLAY_SELECTORS.join(', ')));

            if (!looksBlockingOverlay) continue;
            element.style.setProperty('display', 'none', 'important');
            element.style.setProperty('visibility', 'hidden', 'important');
            element.style.setProperty('pointer-events', 'none', 'important');
            element.setAttribute('aria-hidden', 'true');
            changed = true;
        }

        if (changed) unlockPageScrollIfNeeded();
        return changed;
    };

    const closeIntrusivePopups = () => {
        let changed = false;

        for (const element of getPopupCloseCandidates()) {
            const modal = element.closest('.modal, [role="dialog"], [aria-modal="true"]');
            if (!(modal instanceof HTMLElement) || !isVisible(modal)) continue;

            const modalText = normalizeText(modal.textContent);
            const containsAuthForm = !!modal.querySelector('input[type="password"], input[type="email"], form[action*="login" i], form[action*="signup" i]');
            const looksCookie = COOKIE_CONTEXT_KEYWORDS.some((keyword) => modalText.includes(keyword));
            const looksPromo = !!modal.querySelector('img, a[href], .modal-body');

            if (!looksCookie && !looksPromo && containsAuthForm) continue;
            if (!isDismissAction(element) && !element.classList.contains('close')) continue;

            if (dispatchRealClick(element)) {
                changed = true;
            }
        }

        return changed;
    };

    const runCmpAdapters = () => {
        let changed = false;

        for (const adapter of CMP_ADAPTERS) {
            if (adapter.api?.()) {
                bypassedCount += 1;
                changed = true;
            }

            for (const element of queryAllDeep(adapter.selectors)) {
                if (!(element instanceof HTMLElement) || element.dataset[CLICKED_MARK] === 'true') continue;
                if (!isVisible(element)) continue;
                if (dispatchRealClick(element)) {
                    element.dataset[CLICKED_MARK] = 'true';
                    bypassedCount += 1;
                    changed = true;
                }
            }
        }

        return changed;
    };

    const clickConsentActions = () => {
        let clicked = false;
        const banners = getVisibleBanners();
        const candidates = unique([
            ...queryAllDeep(GENERIC_ACTION_SELECTORS),
            ...getInteractiveCandidates()
        ]);

        for (const element of candidates) {
            if (!(element instanceof HTMLElement)) continue;
            if (element.dataset[CLICKED_MARK] === 'true') continue;
            if (!isVisible(element) || !isMatchingAction(element) || !hasCookieContext(element, banners)) continue;

            if (dispatchRealClick(element)) {
                element.dataset[CLICKED_MARK] = 'true';
                bypassedCount += 1;
                clicked = true;
            }
        }

        if (clicked) {
            finalizePageUnlock();
            document.dispatchEvent(new CustomEvent('gesture:cookie-bypassed', { detail: { count: bypassedCount } }));
        }

        return clicked;
    };

    const scanOnce = () => {
        if (stopped) return;
        const adapterChanged = runCmpAdapters();
        const clicked = clickConsentActions();
        const popupClosed = closeIntrusivePopups();
        const cleaned = suppressBlockingUi();
        if (adapterChanged || clicked || popupClosed || cleaned) {
            finalizePageUnlock();
        }
    };

    const scheduleScan = () => {
        if (scanScheduled || stopped) return;
        scanScheduled = true;
        window.requestAnimationFrame(() => {
            scanScheduled = false;
            scanOnce();
        });
    };

    const stop = () => {
        stopped = true;
        observer?.disconnect();
        observer = null;
    };

    async function init() {
        const cfg = await getConfig();
        if (cfg.cookieBypass?.enabled === false || bypassActive) return;

        bypassActive = true;
        stopped = false;

        for (const delay of SCAN_SCHEDULE_MS) {
            window.setTimeout(scanOnce, delay);
        }

        const root = document.documentElement || document.body;
        if (!root) return;

        observer = new MutationObserver(() => {
            scheduleScan();
        });
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'id', 'hidden', 'aria-hidden'] });
        window.setTimeout(stop, OBSERVER_TIMEOUT_MS);
    }

    ext.features.cookieBypass = {
        init,
        isActive: () => bypassActive,
        getBypassedCount: () => bypassedCount
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
