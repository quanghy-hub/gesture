(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createActionMenu = ({
        CONFIG,
        DEFAULT_SETTINGS,
        QUICK_GLYPHS,
        buildProviderUrl,
        getFeatureConfig,
        actions,
        sessionManager,
        bubbleManager
    }) => {
        const getEnabledTextProviders = () => {
            const config = getFeatureConfig();
            const enabledProviderIds = Array.isArray(config.enabledProviderIds) ? config.enabledProviderIds : [];
            return DEFAULT_SETTINGS.providers.filter((provider) => enabledProviderIds.includes(provider.id)).slice(0, CONFIG.maxProviders);
        };

        const getImageProviders = () => DEFAULT_SETTINGS.imageProviders.slice(0, CONFIG.maxProviders);

        const showTextActions = (session) => {
            const config = getFeatureConfig();
            const items = [
                {
                    label: 'Copy',
                    title: 'Copy',
                    glyph: QUICK_GLYPHS.copy,
                    onClick: () => {
                        actions.copyText(session.text).then(() => {
                            ext.shared.toastCore.createToast('Đã chép', session.x, session.y, 1200);
                        });
                        sessionManager.suppressSelectionFor(session.key);
                        sessionManager.hideTextBubble();
                    }
                },
                {
                    label: 'Dịch',
                    title: 'Dịch văn bản đã chọn',
                    glyph: QUICK_GLYPHS.translate,
                    onClick: () => {
                        actions.translateSelectedText(session);
                        sessionManager.suppressSelectionFor(session.key);
                        sessionManager.hideTextBubble();
                    }
                },
                {
                    label: 'Select All',
                    title: 'Select All',
                    glyph: QUICK_GLYPHS.selectAll,
                    onClick: () => {
                        sessionManager.suppressSelectionFor('*');
                        quickSearch.textSession.selectAllPageText();
                        ext.shared.toastCore.createToast('Đã chọn hết', session.x, session.y, 1200);
                        sessionManager.hideTextBubble();
                    }
                },
                ...getEnabledTextProviders().map((provider) => ({
                    label: provider.name,
                    title: provider.name,
                    icon: provider.icon,
                    onClick: () => {
                        actions.openSearchTab(buildProviderUrl(provider.url, { text: session.text }));
                    }
                }))
            ];

            bubbleManager.ensureTextBubble().show(items, session.x, session.y, config.columns || 5);
        };

        const showImageActions = (session) => {
            const config = getFeatureConfig();
            if (config.imageSearchEnabled === false) {
                return;
            }
            const items = [
                {
                    label: 'Save',
                    title: 'Save image',
                    glyph: QUICK_GLYPHS.saveImage,
                    onClick: () => {
                        actions.downloadImage(session.url, session.x, session.y);
                        sessionManager.hideImageBubble();
                    }
                },
                {
                    label: 'OCR',
                    title: 'Trích xuất văn bản từ ảnh',
                    glyph: QUICK_GLYPHS.ocr,
                    onClick: () => {
                        actions.runOcr(session.url, session.x, session.y);
                        sessionManager.hideImageBubble();
                    }
                },
                {
                    label: 'Copy',
                    title: 'Copy image',
                    glyph: QUICK_GLYPHS.copyImage,
                    onClick: () => {
                        actions
                            .copyImage(session.image, session.url)
                            .then(() => {
                                ext.shared.toastCore.createToast('Đã chép ảnh', session.x, session.y, 1200);
                            })
                            .catch(() => {
                                ext.shared.toastCore.createToast('Không chép được ảnh', session.x, session.y, 1500);
                            });
                        sessionManager.hideImageBubble();
                    }
                },
                ...getImageProviders().map((provider) => ({
                    label: provider.name,
                    title: provider.name,
                    icon: provider.icon,
                    onClick: () => {
                        actions.openSearchTab(buildProviderUrl(provider.url, { imageUrl: session.url }));
                    }
                }))
            ];

            bubbleManager.ensureImageBubble().show(items, session.x, session.y, config.columns || 5);
        };

        return {
            showTextActions,
            showImageActions
        };
    };
})();
