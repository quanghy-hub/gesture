(() => {
    const ext = globalThis.GestureExtension;

    const send = (type, payload = {}) => ext.shared.messaging.sendRuntimeMessage(type, payload, { alwaysResolve: true });

    ext.shared.tabActions = {
        openTab(url, mode = 'bg') {
            return send('gesture-ext/open-tab', { url, mode });
        },
        closeCurrentTab() {
            return send('gesture-ext/close-current-tab');
        },
        downloadDataUrl(url, filename) {
            return send('gesture-ext/download-data-url', { url, filename });
        },
        captureVisibleTab() {
            return send('gesture-ext/capture-visible-tab');
        }
    };
})();
