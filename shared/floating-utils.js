(() => {
    const ext = globalThis.GestureExtension;
    ext.shared = ext.shared || {};
    const viewport = ext.shared.viewportCore;
    const runtime = ext.shared.runtime;
    const hasStorageApi = () => !!globalThis.chrome?.storage?.local;
    const positionMemoryStore = {};

    const isNodeLike = (value) => value instanceof Node;
    const hasStyleApi = (value) => !!value && typeof value === 'object' && !!value.style;
    const isHtmlDocument = () => runtime?.isHtmlDocument?.() ?? false;
    const getFloatingRoot = () => document.documentElement || document.body || null;
    const isExtensionContextInvalidated = (error) => /Extension context invalidated/i.test(String(error?.message || error || ''));

    const appendHtmlFragment = (element, htmlContent) => {
        if (!element || !htmlContent) {
            return;
        }
        const trimmed = String(htmlContent).trim();
        if (!trimmed) {
            element.textContent = '';
            return;
        }
        if (isHtmlDocument()) {
            const template = document.createElement('template');
            if ('content' in template && typeof element.replaceChildren === 'function') {
                template.innerHTML = trimmed;
                element.replaceChildren(template.content.cloneNode(true));
                return;
            }
        }
        element.textContent = trimmed;
    };

    ext.shared.floatingUtils = {
        isNodeLike,
        hasStyleApi,
        isHtmlDocument,
        getFloatingRoot,
        isExtensionContextInvalidated,
        appendHtmlFragment,
        clamp: (value, min, max) => viewport?.clamp?.(value, min, max) ?? Math.min(max, Math.max(min, value)),
        clampFixedPosition: (rect) =>
            viewport?.clampFixedPosition?.(rect) ?? {
                left: Math.min(
                    Math.max(rect?.margin ?? 8, rect?.left ?? 0),
                    Math.max(rect?.margin ?? 8, window.innerWidth - (rect?.width ?? 0) - (rect?.margin ?? 8))
                ),
                top: Math.min(
                    Math.max(rect?.margin ?? 8, rect?.top ?? 0),
                    Math.max(rect?.margin ?? 8, window.innerHeight - (rect?.height ?? 0) - (rect?.margin ?? 8))
                )
            },
        stopFloatingEvent: (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') {
                event.stopImmediatePropagation();
            }
        },
        createPositionStorage: (storageKey, defaultPos = { left: 20, top: 20 }) => ({
            load: () =>
                new Promise((resolve) => {
                    if (!hasStorageApi()) {
                        const v = positionMemoryStore[storageKey];
                        resolve(v && typeof v === 'object' ? v : defaultPos);
                        return;
                    }
                    try {
                        chrome.storage.local.get([storageKey], (result) => {
                            if (chrome.runtime?.lastError && isExtensionContextInvalidated(chrome.runtime.lastError)) {
                                const v = positionMemoryStore[storageKey];
                                resolve(v && typeof v === 'object' ? v : defaultPos);
                                return;
                            }
                            const v = result?.[storageKey];
                            resolve(v && typeof v === 'object' ? v : defaultPos);
                        });
                    } catch (error) {
                        if (isExtensionContextInvalidated(error)) {
                            const v = positionMemoryStore[storageKey];
                            resolve(v && typeof v === 'object' ? v : defaultPos);
                            return;
                        }
                        resolve(defaultPos);
                    }
                }),
            save: (left, top) => {
                positionMemoryStore[storageKey] = { left, top };
                if (!hasStorageApi()) {
                    return Promise.resolve();
                }
                return new Promise((resolve) => {
                    try {
                        chrome.storage.local.set({ [storageKey]: { left, top } }, () => {
                            if (chrome.runtime?.lastError && isExtensionContextInvalidated(chrome.runtime.lastError)) {
                                resolve(false);
                                return;
                            }
                            resolve(true);
                        });
                    } catch (error) {
                        if (isExtensionContextInvalidated(error)) {
                            resolve(false);
                            return;
                        }
                        resolve(false);
                    }
                });
            }
        })
    };
})();
