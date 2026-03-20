chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message.type !== 'string') {
        return false;
    }

    (async () => {
        switch (message.type) {
            case 'gesture-ext/open-tab': {
                const url = message.payload?.url;
                if (!url) {
                    sendResponse({ ok: false, error: 'Missing url' });
                    return;
                }

                const active = message.payload?.mode === 'fg';
                const openerTabId = sender.tab?.id;
                const index = typeof sender.tab?.index === 'number' ? sender.tab.index + 1 : undefined;

                const tab = await chrome.tabs.create({
                    url,
                    active,
                    openerTabId,
                    index
                });

                sendResponse({ ok: true, tabId: tab.id });
                return;
            }

            case 'gesture-ext/close-current-tab': {
                if (!sender.tab?.id) {
                    sendResponse({ ok: false, error: 'No sender tab' });
                    return;
                }

                await chrome.tabs.remove(sender.tab.id);
                sendResponse({ ok: true });
                return;
            }

            default:
                sendResponse({ ok: false, error: `Unsupported message type: ${message.type}` });
        }
    })().catch((error) => {
        sendResponse({ ok: false, error: error?.message || String(error) });
    });

    return true;
});