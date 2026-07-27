(() => {
    const ext = globalThis.GestureExtension;
    const quickSearch = (ext.quickSearch = ext.quickSearch || {});

    quickSearch.createBubbleManager = (ui, getConfig, onImageHoverTimerReset, onImageHoverHideTimerStart) => {
        let textBubble;
        let imageBubble;

        const ensureTextBubble = () => {
            if (!textBubble) {
                textBubble = ui.createBubble('text');
            }
            return textBubble;
        };

        const hideTextBubble = () => {
            textBubble?.hide();
        };

        const ensureImageBubble = () => {
            if (!imageBubble) {
                imageBubble = ui.createBubble('image');
                imageBubble.bubble.addEventListener('mouseenter', () => {
                    onImageHoverTimerReset?.();
                });
                imageBubble.bubble.addEventListener('mouseleave', () => {
                    onImageHoverHideTimerStart?.(imageBubble);
                });
            }
            return imageBubble;
        };

        const hideImageBubble = () => {
            imageBubble?.hide();
        };

        const hideAllBubbles = () => {
            hideTextBubble();
            hideImageBubble();
        };

        const isEventInsideBubble = (event, bubbleInstance) => {
            if (!bubbleInstance?.bubble) {
                return false;
            }
            const path = event.composedPath?.();
            if (Array.isArray(path) && path.includes(bubbleInstance.bubble)) {
                return true;
            }
            return event.target instanceof Node && bubbleInstance.bubble.contains(event.target);
        };

        return {
            ensureTextBubble,
            hideTextBubble,
            ensureImageBubble,
            hideImageBubble,
            hideAllBubbles,
            isEventInsideTextBubble: (event) => isEventInsideBubble(event, textBubble),
            isEventInsideImageBubble: (event) => isEventInsideBubble(event, imageBubble),
            getTextBubble: () => textBubble,
            getImageBubble: () => imageBubble
        };
    };
})();
