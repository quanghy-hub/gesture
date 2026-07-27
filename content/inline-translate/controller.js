(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});

    inlineTranslate.createController = ({ getConfig }) => {
        let settings = getConfig().inlineTranslate;
        const dom = inlineTranslate.dom;
        const actions = inlineTranslate.createActions({
            getSettings: () => settings
        });

        const state = {
            editableSelectionTimer: 0,
            editableSelectionRequestId: 0,
            snapshot: null,
            translatedText: '',
            error: ''
        };

        const hideEditableSelectionPanelRef = { current: null };

        const editableSelectionManager = inlineTranslate.createEditableSelectionManager({
            getSettings: () => settings,
            dom,
            hideEditableSelectionPanelRef,
            getEditableSelectionState: () => state
        });

        const blockTranslationManager = inlineTranslate.createBlockTranslationManager({
            dom,
            actions
        });

        const eventHandler = inlineTranslate.createEventHandler({
            dom,
            getSettings: () => settings,
            editableSelectionManager,
            blockTranslationManager
        });

        dom.ensureStyles();
        dom.applyInlineTranslateCssVars(settings);

        const uninstallEvents = eventHandler.install();

        return {
            onConfigChange(nextConfig) {
                settings = nextConfig.inlineTranslate;
                dom.applyInlineTranslateCssVars(settings);
                if (!settings.selectionTranslateEnabled) {
                    editableSelectionManager.hideEditableSelectionPanel();
                    return;
                }
                editableSelectionManager.scheduleEditableSelectionEvaluation(0);
            },
            destroy() {
                window.clearTimeout(state.editableSelectionTimer);
                if (hideEditableSelectionPanelRef.current) {
                    hideEditableSelectionPanelRef.current();
                }
                uninstallEvents();
            }
        };
    };
})();
