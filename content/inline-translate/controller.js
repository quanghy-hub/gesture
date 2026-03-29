(() => {
    const ext = globalThis.GestureExtension;
    const inlineTranslate = ext.inlineTranslate = ext.inlineTranslate || {};
    const touch = ext.shared.touchCore;
    const { TRANSLATION_PENDING } = inlineTranslate;

    inlineTranslate.createController = ({ getConfig }) => {
        let settings = getConfig().inlineTranslate;
        let lastPointer = { x: 0, y: 0 };
        let startX = 0;
        let startY = 0;
        let startTime = 0;
        let startedInVideo = false;

        const dom = inlineTranslate.dom;
        const actions = inlineTranslate.createActions({
            getSettings: () => settings
        });

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

            const box = dom.createTranslationBox(hit.text, hit.node);
            dom.insertTranslationBox(hit.node, box);

            try {
                const translatedText = await actions.translateText(hit.text);
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
                box.firstElementChild.textContent = `⚠ ${String(error.message || 'Unknown error').slice(0, 80)}`;
                box.firstElementChild.style.color = '#ff6b6b';
                box.firstElementChild.style.fontStyle = 'normal';
                box.firstElementChild.style.fontSize = '0.8em';
                window.setTimeout(() => box.remove(), 5000);
            }
        };

        const onMouseMove = (event) => {
            lastPointer = touch.getPrimaryPoint(event);
        };

        const onKeyDown = (event) => {
            if (!settings.hotkeyEnabled) {
                return;
            }

            const activeElement = document.activeElement;
            if (
                activeElement instanceof HTMLElement &&
                (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
            ) {
                return;
            }

            const hotkey = settings.hotkey;
            const matches =
                (hotkey === 'f2' && event.code === 'F2') ||
                (hotkey === 'f4' && event.code === 'F4') ||
                (hotkey === 'f8' && event.code === 'F8');

            if (!matches) {
                return;
            }

            event.preventDefault();
            toggleTranslationAtPoint(lastPointer.x, lastPointer.y);
        };

        const onTouchStart = (event) => {
            if (!settings.swipeEnabled || event.touches.length !== 1) {
                return;
            }
            const point = touch.getPrimaryPoint(event);
            startX = point.x;
            startY = point.y;
            startTime = Date.now();
            startedInVideo = dom.isInVideoZone(startX, startY);
        };

        const onTouchEnd = (event) => {
            if (!settings.swipeEnabled || !startX || Date.now() - startTime > 500) {
                startX = 0;
                return;
            }

            const point = touch.getPrimaryPoint(event);
            const endX = point.x;
            const endY = point.y;

            if (startedInVideo || dom.isInVideoZone(endX, endY)) {
                startX = 0;
                return;
            }

            const deltaX = endX - startX;
            const deltaY = endY - startY;
            startX = 0;

            const validDirection =
                settings.swipeDir === 'both' ||
                (settings.swipeDir === 'right' && deltaX > 0) ||
                (settings.swipeDir === 'left' && deltaX < 0);

            if (
                Math.abs(deltaX) > settings.swipePx &&
                Math.abs(deltaY) < Math.abs(deltaX) * settings.swipeSlopeMax &&
                validDirection
            ) {
                toggleTranslationAtPoint(endX - deltaX / 2, endY - deltaY / 2);
            }
        };

        dom.ensureStyles();
        dom.applyInlineTranslateCssVars(settings);

        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('keydown', onKeyDown, true);
        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });

        return {
            onConfigChange(nextConfig) {
                settings = nextConfig.inlineTranslate;
                dom.applyInlineTranslateCssVars(settings);
            },
            destroy() {
                document.removeEventListener('mousemove', onMouseMove, { passive: true });
                document.removeEventListener('keydown', onKeyDown, true);
                document.removeEventListener('touchstart', onTouchStart, { passive: true });
                document.removeEventListener('touchend', onTouchEnd, { passive: true });
            }
        };
    };
})();
