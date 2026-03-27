(() => {
    const ext = globalThis.GestureExtension;

    ext.shared.uiCore = {
        createShadowContainer: (id, styleContent) => {
            const container = document.createElement('div');
            if (id) container.id = id;
            container.style.position = 'static';
            const shadow = container.attachShadow({ mode: 'open' });
            
            if (styleContent) {
                const style = document.createElement('style');
                style.textContent = styleContent;
                shadow.appendChild(style);
            }
            
            return { container, shadow };
        }
    };
})();
