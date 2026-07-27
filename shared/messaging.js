(() => {
    const ext = globalThis.GestureExtension;

    const sendRuntimeMessage = (type, payload = {}, options = {}) =>
        new Promise((resolve, reject) => {
            const { alwaysResolve = false, unwrapResult = false } = options;
            try {
                chrome.runtime.sendMessage({ type, payload }, (response) => {
                    const lastError = chrome.runtime.lastError;
                    if (lastError) {
                        if (alwaysResolve) {
                            resolve({ ok: false, error: lastError.message });
                        } else {
                            reject(new Error(lastError.message));
                        }
                        return;
                    }
                    if (response?.ok === false && !alwaysResolve) {
                        reject(new Error(response.error || 'Unknown runtime messaging error'));
                        return;
                    }
                    if (unwrapResult && response?.ok !== false) {
                        resolve(response?.result ?? response);
                    } else {
                        resolve(response || (alwaysResolve ? { ok: false, error: 'No response' } : null));
                    }
                });
            } catch (error) {
                if (alwaysResolve) {
                    resolve({ ok: false, error: error?.message || String(error) });
                } else {
                    reject(error);
                }
            }
        });

    ext.shared = ext.shared || {};
    ext.shared.messaging = { sendRuntimeMessage };
})();
