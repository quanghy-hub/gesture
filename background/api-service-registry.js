(() => {
    const ext = globalThis.GestureExtension;

    ext.background = ext.background || {};
    ext.background.apiServiceRegistry = {
        detectTargetLanguage(text) {
            return ext.background.translateApi.detectTargetLanguage(text);
        },
        executeTranslate(args) {
            return ext.background.translateApi.executeTranslate(args);
        },
        executeOcr(args) {
            return ext.background.ocrApi.executeOcr(args);
        },
        splitTranslateText(text, limit) {
            return ext.background.translateApi.splitTranslateText(text, limit);
        }
    };
})();
