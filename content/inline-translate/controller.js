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
        let orphanObserver = null;
        const startOrphanObserver = () => {
            if (orphanObserver || typeof MutationObserver === 'undefined') return;
            const target = document.body || document.documentElement;
            if (!target) {
                document.addEventListener('DOMContentLoaded', startOrphanObserver, { once: true });
                return;
            }
            try {
                orphanObserver = new MutationObserver(() => {
                    for (const box of document.querySelectorAll('.gesture-inline-translate-box')) {
                        const src = box.__gestureSourceNode;
                        if (src instanceof Node && !src.isConnected) {
                            box.remove();
                        }
                    }
                });
                orphanObserver.observe(target, { childList: true, subtree: true });
            } catch {
                orphanObserver = null;
            }
        };
        startOrphanObserver();

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
                if (orphanObserver) {
                    orphanObserver.disconnect();
                    orphanObserver = null;
                }
                for (const box of document.querySelectorAll('.gesture-inline-translate-box')) {
                    box.remove();
                }
            }
        };
    };
})();
