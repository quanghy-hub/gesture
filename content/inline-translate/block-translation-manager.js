(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = (ext.inlineTranslate = ext.inlineTranslate || {});
    const { TRANSLATION_PENDING } = inlineTranslate;

    inlineTranslate.createBlockTranslationManager = (deps) => {
        const { dom, actions } = deps;
        const activeKeys = new Set();

        const toggleTranslationAtPoint = async (x, y) => {
            const hit = dom.hitTestTextBlock(x, y);
            if (!hit || !dom.hasMeaningfulText(hit.text)) {
                return;
            }

            const textKey = dom.getTextKey(hit.text);
            const existing = dom.findRelatedTranslationBox(hit.node, textKey);
            if (existing) {
                existing.remove();
                return;
            }
            if (activeKeys.has(textKey)) {
                return;
            }
            activeKeys.add(textKey);

            const box = dom.createTranslationBox(hit.text, hit.node);
            dom.insertTranslationBox(hit.node, box);

            try {
                let translatedText = await actions.translateText(hit.text);
                if (translatedText && typeof translatedText.then === 'function') {
                    translatedText = await translatedText;
                }
                if (!box.isConnected) return;
                if (translatedText === TRANSLATION_PENDING) {
                    box.firstElementChild.textContent = '⏳ Đang dịch, thử lại sau';
                    box.firstElementChild.style.color = '#ffd166';
                    box.firstElementChild.style.fontStyle = 'normal';
                    box.firstElementChild.style.fontSize = '0.8em';
                    window.setTimeout(() => box.remove(), 1500);
                    return;
                }

                if (!translatedText) {
                    box.firstElementChild.textContent = '⚠ Không có nội dung dịch';
                    box.firstElementChild.style.color = '#ff6b6b';
                    box.firstElementChild.style.fontStyle = 'normal';
                    box.firstElementChild.style.fontSize = '0.8em';
                    window.setTimeout(() => box.remove(), 3000);
                    return;
                }

                box.firstElementChild.textContent = translatedText;
            } catch (error) {
                if (!box.isConnected) return;
                box.firstElementChild.textContent = `⚠ ${String(error.message || 'Unknown error').slice(0, 80)}`;
                box.firstElementChild.style.color = '#ff6b6b';
                box.firstElementChild.style.fontStyle = 'normal';
                box.firstElementChild.style.fontSize = '0.8em';
                window.setTimeout(() => box.remove(), 5000);
            } finally {
                activeKeys.delete(textKey);
            }
        };

        return {
            toggleTranslationAtPoint
        };
    };
})();
