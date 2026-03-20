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

    ext.shared.runtime = {
        debounce,
        isHttpPage
    };
})();