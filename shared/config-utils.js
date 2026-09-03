// @ts-check
(() => {
    const ext = globalThis.GestureExtension;

    const deepClone = (value) => JSON.parse(JSON.stringify(value));

    const mergeObjects = (defaults, incoming) => {
        if (Array.isArray(defaults)) {
            return Array.isArray(incoming) ? incoming.slice() : defaults.slice();
        }

        if (!defaults || typeof defaults !== 'object') {
            return incoming === undefined ? defaults : incoming;
        }

        const result = {};
        const source = incoming && typeof incoming === 'object' ? incoming : {};

        for (const key of Object.keys(defaults)) {
            result[key] = mergeObjects(defaults[key], source[key]);
        }

        for (const key of Object.keys(source)) {
            if (!(key in result)) {
                result[key] = source[key];
            }
        }

        return result;
    };

    const clampNumber = (value, fallback, min, max) => {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.min(max, Math.max(min, number));
    };

    const normalizeMode = (value, fallback) => (value === 'fg' || value === 'bg' ? value : fallback);
    const normalizeSide = (value) => (value === 'left' || value === 'right' || value === 'both' ? value : 'both');
    const normalizeHost = (value) => {
        if (typeof value !== 'string') return '';
        let host = value.trim().toLowerCase();
        if (!host) return '';
        host = host
            .replace(/^https?:\/\//, '')
            .replace(/^(\*\.)+/, '')
            .replace(/[/?#].*$/, '')
            .replace(/:\d+$/, '');
        host = host.replace(/^\.+|\.+$/g, '').replace(/\.+/g, '.');
        if (host.startsWith('www.') && host.split('.').length > 2) {
            host = host.slice(4);
        }
        if (!host || !host.includes('.') || !/^[a-z0-9.-]+$/.test(host)) {
            return '';
        }
        return host;
    };
    const normalizeExcludedHosts = (value) => {
        const list = Array.isArray(value) ? value : [];
        return [...new Set(list.map(normalizeHost).filter(Boolean))];
    };
    const normalizeProviderSettings = (value, fallback) => ({
        enabled: value?.enabled !== false,
        apiKey: typeof value?.apiKey === 'string' ? value.apiKey.trim() : fallback?.apiKey || '',
        endpoint: typeof value?.endpoint === 'string' ? value.endpoint.trim() : fallback?.endpoint || ''
    });

    ext.shared.configUtils = {
        deepClone,
        mergeObjects,
        clampNumber,
        normalizeMode,
        normalizeSide,
        normalizeHost,
        normalizeExcludedHosts,
        normalizeProviderSettings
    };
})();
