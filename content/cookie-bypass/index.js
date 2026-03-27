(() => {
    const ext = globalThis.GestureExtension;
    const { isVisible } = ext.shared.domUtils;
    const { getConfig } = ext.shared.storage;

    const COOKIE_CONTEXT_KEYWORDS = [
        'cookie', 'consent', 'privacy', 'gdpr', 
        'chấp nhận cookie', 'quyền riêng tư'
    ];

    const ACCEPT_BUTTON_KEYWORDS = [
        'accept', 'agree', 'allow', 'consent', 'ok', 
        'i understand', 'got it', 'đồng ý', 'chấp nhận', 'cho phép'
    ];

    const ACTION_SELECTORS = [
        'button[id*="accept" i]', 'button[class*="accept" i]',
        'button[id*="agree" i]', 'button[class*="agree" i]',
        'button[id*="allow" i]', 'button[class*="allow" i]',
        'button[id*="consent" i]', 'button[class*="consent" i]',
        '[role="button"][aria-label*="accept" i]',
        '[role="button"][aria-label*="agree" i]',
        'a[class*="cookie" i][class*="accept" i]'
    ];

    const BANNER_SELECTORS = [
        '#onetrust-consent-sdk', '#usercentrics-root', '#CybotCookiebotDialog',
        '.CybotCookiebotDialog', '.cookie-banner', '.cookie-consent',
        '.cookie-notice', '.cc-window', '[id*="cookie" i][id*="banner" i]',
        '[class*="cookie" i][class*="banner" i]', '[id*="consent" i]', '[class*="consent" i]'
    ];

    const CLICKED_MARK = 'cookieBypassHandled';
    const OBSERVER_TIMEOUT_MS = 10000;

    let bypassActive = false;
    let bypassedCount = 0;

    function normalizeText(value) {
        return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function hasCookieContext(element) {
        const ownText = normalizeText(element.textContent);
        const closestBanner = element.closest(BANNER_SELECTORS.join(','));
        return closestBanner || COOKIE_CONTEXT_KEYWORDS.some((keyword) => ownText.includes(keyword));
    }

    function isMatchingAction(element) {
        const text = normalizeText(element.textContent || element.getAttribute('aria-label'));
        return ACCEPT_BUTTON_KEYWORDS.some((keyword) => text.includes(keyword));
    }

    function unlockPageScrollIfNeeded() {
        const root = document.documentElement;
        const body = document.body;
        if (!body) return;
        const targets = [root, body];
        for (const target of targets) {
            const style = window.getComputedStyle(target);
            if (style.overflow === 'hidden' || style.overflowY === 'hidden') {
                target.style.setProperty('overflow', 'auto', 'important');
                target.style.setProperty('overflow-y', 'auto', 'important');
            }
        }
    }

    function clickConsentAction() {
        let clicked = false;
        for (const selector of ACTION_SELECTORS) {
            const candidates = document.querySelectorAll(selector);
            for (const element of candidates) {
                if (!(element instanceof HTMLElement)) continue;
                if (element.dataset[CLICKED_MARK] === 'true') continue;
                if (!isVisible(element) || !isMatchingAction(element) || !hasCookieContext(element)) continue;
                try {
                    element.click();
                    element.dataset[CLICKED_MARK] = 'true';
                    clicked = true;
                    bypassedCount++;
                } catch (error) {}
            }
        }
        if (clicked) {
            unlockPageScrollIfNeeded();
            document.dispatchEvent(new CustomEvent('gesture:cookie-bypassed', { detail: { count: bypassedCount } }));
        }
        return clicked;
    }

    async function init() {
        const cfg = await getConfig();
        if (cfg.cookieBypass?.enabled === false) return;

        bypassActive = true;
        clickConsentAction();

        const body = document.body;
        if (!body) return;

        const observer = new MutationObserver(() => {
            if (clickConsentAction()) {
                // Not disconnecting here to catch multi-step or delayed banners
            }
        });

        observer.observe(body, { childList: true, subtree: true });
        window.setTimeout(() => observer.disconnect(), OBSERVER_TIMEOUT_MS);
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
