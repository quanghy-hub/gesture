(() => {
    const ext = globalThis.GestureExtension;

    const debounce = (fn, wait) => {
        let timer = null;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), wait);
        };
    };

    const isHttpPage = () => location.protocol === 'http:' || location.protocol === 'https:';
    const isMacOS = () => {
        const platform = navigator.userAgentData?.platform || navigator.platform || '';
        return /mac/i.test(platform);
    };
    const isHtmlDocument = () => {
        const root = document.documentElement;
        if (!root) {
            return false;
        }
        const contentType = String(document.contentType || '').toLowerCase();
        if (contentType.includes('html')) {
            return true;
        }
        return root.namespaceURI === 'http://www.w3.org/1999/xhtml';
    };

    ext.shared.runtime = {
        debounce,
        isMacOS,
        isHttpPage,
        isHtmlDocument
    };
})();
