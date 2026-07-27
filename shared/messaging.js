(() => {
    const ext = globalThis.GestureExtension;

    const sendRuntimeMessage = async (type, payload = {}, options = {}) => {
        const { alwaysResolve = false, unwrapResult = false } = options;
        try {
            const response = await browser.runtime.sendMessage({ type, payload });
            if (response?.ok === false && !alwaysResolve) {
                throw new Error(response.error || 'Unknown runtime messaging error');
            }
            if (unwrapResult && response?.ok !== false) {
                return response?.result ?? response;
            } else {
                return response || (alwaysResolve ? { ok: false, error: 'No response' } : null);
            }
        } catch (error) {
            if (alwaysResolve) {
                return { ok: false, error: error?.message || String(error) };
            } else {
                throw error;
            }
        }
    };

    ext.shared = ext.shared || {};
    ext.shared.messaging = { sendRuntimeMessage };
})();
