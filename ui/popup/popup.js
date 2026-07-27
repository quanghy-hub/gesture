(() => {
    const ext = globalThis.GestureExtension;
    const { TRANSLATE_PROVIDER_OPTIONS, OCR_PROVIDER_OPTIONS } = ext.shared.apiServices;
    const storage = ext.shared.storage;
    const { fillProviderOptions, getHostFromUrl, safeGetElementById } = ext.ui.popupUtils;
    const { FIELD_MAP } = ext.ui.popupFieldMap;
    const { initSyncPanel } = ext.ui.popupSyncPanel;
    const { initPanelReorder } = ext.ui.popupPanelReorder;

    const els = ext.ui.popupElements;
    const renderEngine = ext.ui.popupRender;
    const saveEngine = ext.ui.popupSave;
    const eventsEngine = ext.ui.popupEvents;

    const fieldMapElements = Object.fromEntries(FIELD_MAP.map((f) => [f.elementId, safeGetElementById(f.elementId)]));

    const appState = {
        config: null,
        activeHost: null,
        isReady: false,
        saveTimer: 0,
        pendingSave: null,
        render: () => {
            renderEngine.render(appState.config, appState.activeHost, els, panelReorder, FIELD_MAP, fieldMapElements);
        },
        scheduleAutoSave: () => {
            if (!appState.isReady || !appState.config) {
                return;
            }
            if (appState.saveTimer) {
                window.clearTimeout(appState.saveTimer);
            }
            appState.saveTimer = window.setTimeout(() => {
                appState.saveTimer = 0;
                runSave().catch(() => {
                    // runSave already reports the failure.
                });
            }, 250);
        }
    };

    fillProviderOptions(els.apiTranslateProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(els.apiTranslateFallbackProvider, TRANSLATE_PROVIDER_OPTIONS);
    fillProviderOptions(els.apiOcrProvider, OCR_PROVIDER_OPTIONS);
    fillProviderOptions(els.apiOcrFallbackProvider, OCR_PROVIDER_OPTIONS);

    const panelReorder = initPanelReorder({
        popupRoot: els.popupRoot,
        panelCards: els.panelCards,
        dragHandles: els.dragHandles,
        getConfig: () => appState.config,
        scheduleAutoSave: () => appState.scheduleAutoSave()
    });

    const syncPanel = initSyncPanel({
        getConfig: () => appState.config,
        setConfig: (c) => {
            appState.config = c;
        },
        render: () => appState.render(),
        getPendingSave: () => appState.pendingSave
    });

    const runSave = async () => {
        if (appState.pendingSave) {
            return appState.pendingSave;
        }
        appState.pendingSave = saveEngine
            .save(appState.config, appState.activeHost, els, storage, FIELD_MAP, fieldMapElements)
            .then((savedConfig) => {
                appState.config = savedConfig;
                appState.render();
                return savedConfig;
            })
            .catch((error) => {
                console.error('[GestureExtension][popup] save failed', error);
                throw error;
            })
            .finally(() => {
                appState.pendingSave = null;
            });
        return appState.pendingSave;
    };

    const getActiveTab = () =>
        new Promise((resolve) => {
            chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => resolve(tabs?.[0] || null));
        });

    Promise.all([storage.getConfig(), getActiveTab()])
        .then(([loadedConfig, activeTab]) => {
            appState.config = loadedConfig;
            appState.activeHost = getHostFromUrl(activeTab?.url || '');
            appState.render();
            appState.isReady = true;
            return ext.shared.cloudflareSync.loadSettings();
        })
        .then((syncSettings) => {
            syncPanel.renderSyncSettings(syncSettings);
            return syncPanel.loadBackupStatus();
        })
        .catch((error) => {
            console.error('[GestureExtension][popup] init failed', error);
        });

    eventsEngine.registerAll(els, appState, storage);
})();
