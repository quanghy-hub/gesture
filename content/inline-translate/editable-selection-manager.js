(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const selectionCore = ext.shared.selectionCore;
    const { VIETNAMESE_CHAR_PATTERN } = inlineTranslate;

    inlineTranslate.createEditableSelectionManager = (deps) => {
        const { getSettings, dom, hideEditableSelectionPanelRef, getEditableSelectionState } = deps;

        const isVietnameseSelection = (text) => VIETNAMESE_CHAR_PATTERN.test(String(text || ''));
        const editableCache = ext.shared.translateCore.createMemoryCache
            ? ext.shared.translateCore.createMemoryCache({ maxSize: 120 })
            : { get() {}, set() {}, clear() {} };
        const editablePending = new Map();

        const areSameEditableSnapshots = (left, right) => {
            return !!left && !!right && left.target === right.target && left.key === right.key && left.text === right.text;
        };

        const hideEditableSelectionPanel = ({ invalidateRequest = true } = {}) => {
            const state = getEditableSelectionState();
            if (invalidateRequest) {
                state.editableSelectionRequestId += 1;
            }
            state.snapshot = null;
            state.translatedText = '';
            state.error = '';
            dom.hideEditableSelectionPanel();
        };

        // Export this so others can use it
        hideEditableSelectionPanelRef.current = hideEditableSelectionPanel;

        const applyEditableSelectionTranslation = () => {
            const state = getEditableSelectionState();
            const snapshot = state.snapshot;
            const translatedText = state.translatedText;
            if (!snapshot || !translatedText || !selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                hideEditableSelectionPanel();
                return;
            }
            selectionCore.replaceSelectionSnapshot(snapshot, translatedText);
            hideEditableSelectionPanel();
        };

        const syncEditableSelectionPanel = () => {
            const state = getEditableSelectionState();
            const snapshot = state.snapshot;
            if (!snapshot) {
                return;
            }
            const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
            if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                hideEditableSelectionPanel();
                return;
            }
            state.snapshot = currentSnapshot;
            if (state.translatedText) {
                dom.showEditableSelectionResult({
                    anchor: currentSnapshot.anchor,
                    text: state.translatedText,
                    onApply: applyEditableSelectionTranslation
                });
                return;
            }
            if (state.error) {
                dom.showEditableSelectionError({
                    anchor: currentSnapshot.anchor,
                    message: state.error
                });
                return;
            }
            dom.repositionEditableSelectionPanel(currentSnapshot.anchor);
        };

        const evaluateEditableSelection = async () => {
            const state = getEditableSelectionState();
            window.clearTimeout(state.editableSelectionTimer);
            const settings = getSettings();

            if (!settings.selectionTranslateEnabled) {
                hideEditableSelectionPanel();
                return;
            }

            const snapshot = selectionCore.getEditableSelectionSnapshot();
            const trimmedText = String(snapshot?.text || '').trim();
            if (!snapshot || !trimmedText || trimmedText.length < 4 || trimmedText.length > 1800 || !isVietnameseSelection(trimmedText)) {
                hideEditableSelectionPanel();
                return;
            }

            if (areSameEditableSnapshots(state.snapshot, snapshot)) {
                state.snapshot = snapshot;
                syncEditableSelectionPanel();
                return;
            }

            const cached = editableCache.get(trimmedText);
            if (cached?.result && Date.now() - cached.ts < (settings.dedupeSeconds || 0.7) * 1000) {
                hideEditableSelectionPanel();
                state.snapshot = snapshot;
                state.translatedText = cached.result;
                state.error = '';
                const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                if (
                    currentSnapshot &&
                    areSameEditableSnapshots(snapshot, currentSnapshot) &&
                    selectionCore.isSelectionSnapshotCurrent(snapshot)
                ) {
                    state.snapshot = currentSnapshot;
                    dom.showEditableSelectionResult({
                        anchor: currentSnapshot.anchor,
                        text: cached.result,
                        onApply: applyEditableSelectionTranslation
                    });
                }
                return;
            }

            if (editablePending.has(trimmedText)) {
                hideEditableSelectionPanel();
                state.snapshot = snapshot;
                dom.showEditableSelectionLoading(snapshot.anchor);
                try {
                    const pendingResult = await editablePending.get(trimmedText);
                    if (state.snapshot !== snapshot) return;
                    const text = String(pendingResult?.translatedText || pendingResult || '').trim();
                    if (!text || text === trimmedText || !selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                        hideEditableSelectionPanel();
                        return;
                    }
                    const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                    if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                        hideEditableSelectionPanel();
                        return;
                    }
                    state.snapshot = currentSnapshot;
                    state.translatedText = text;
                    state.error = '';
                    dom.showEditableSelectionResult({
                        anchor: currentSnapshot.anchor,
                        text,
                        onApply: applyEditableSelectionTranslation
                    });
                } catch {
                    hideEditableSelectionPanel();
                }
                return;
            }

            hideEditableSelectionPanel();
            state.snapshot = snapshot;
            dom.showEditableSelectionLoading(snapshot.anchor);

            const requestId = ++state.editableSelectionRequestId;
            const translatePromise = (async () => {
                const result = await ext.shared.translateCore.translateDetailed(trimmedText, {
                    provider: settings.provider,
                    targetLanguage: 'en',
                    cleanResult: true
                });
                const translatedText = String(result?.translatedText || '').trim();
                if (translatedText && translatedText !== trimmedText) {
                    editableCache.set(trimmedText, { result: translatedText, ts: Date.now() });
                }
                return result;
            })();
            editablePending.set(trimmedText, translatePromise);
            try {
                const result = await translatePromise;

                if (requestId !== state.editableSelectionRequestId) {
                    return;
                }
                if (!selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                const translatedText = String(result?.translatedText || '').trim();
                if (!translatedText || translatedText === trimmedText) {
                    hideEditableSelectionPanel();
                    return;
                }

                const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                state.snapshot = currentSnapshot;
                state.translatedText = translatedText;
                state.error = '';
                dom.showEditableSelectionResult({
                    anchor: currentSnapshot.anchor,
                    text: translatedText,
                    onApply: applyEditableSelectionTranslation
                });
            } catch (error) {
                if (requestId !== state.editableSelectionRequestId) {
                    return;
                }
                if (!selectionCore.isSelectionSnapshotCurrent(snapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                const currentSnapshot = selectionCore.getEditableSelectionSnapshot(snapshot.target);
                if (!currentSnapshot || !areSameEditableSnapshots(snapshot, currentSnapshot)) {
                    hideEditableSelectionPanel();
                    return;
                }

                state.snapshot = currentSnapshot;
                state.translatedText = '';
                state.error = String(error?.message || 'Lỗi dịch tạm thời');
                dom.showEditableSelectionError({
                    anchor: currentSnapshot.anchor,
                    message: state.error
                });
            } finally {
                editablePending.delete(trimmedText);
            }
        };

        const scheduleEditableSelectionEvaluation = (delay = 220) => {
            const state = getEditableSelectionState();
            window.clearTimeout(state.editableSelectionTimer);
            state.editableSelectionTimer = window.setTimeout(() => {
                evaluateEditableSelection().catch(() => {
                    hideEditableSelectionPanel();
                });
            }, delay);
        };

        return {
            hideEditableSelectionPanel,
            syncEditableSelectionPanel,
            applyEditableSelectionTranslation,
            evaluateEditableSelection,
            scheduleEditableSelectionEvaluation
        };
    };
})();
