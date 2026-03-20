(() => {
    const ext = globalThis.GestureExtension;

    const SELECTORS = [
        { container: '.block-body.js-replyNewMessageContainer', items: 'article.message--post, article.message' },
        { container: '.structItemContainer', items: '.structItem--thread, .structItem' }
    ];

    const fitWrapperToViewport = (wrapper) => {
        if (!wrapper?.isConnected) return;

        wrapper.style.removeProperty('--fs-overflow-fix');

        const rect = wrapper.getBoundingClientRect();
        const viewportWidth = document.documentElement.clientWidth || innerWidth || 0;
        const overflowLeft = Math.max(0, -rect.left);
        const overflowRight = Math.max(0, rect.right - viewportWidth);
        const overflow = Math.ceil(overflowLeft + overflowRight);

        if (overflow > 0) {
            wrapper.style.setProperty('--fs-overflow-fix', `${overflow}px`);
        }
    };

    const createMasonry = (container, itemSelector, gap) => {
        const items = Array.from(container.querySelectorAll(`:scope > ${itemSelector}`));
        if (items.length < 3) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'fs-wrapper';
        wrapper.style.setProperty('--fs-gap', `${gap}px`);

        const left = document.createElement('div');
        const right = document.createElement('div');
        left.className = 'fs-column';
        right.className = 'fs-column';
        wrapper.append(left, right);

        container.parentNode?.insertBefore(wrapper, container);
        items.forEach((item) => {
            (left.offsetHeight <= right.offsetHeight ? left : right).appendChild(item);
        });

        const scheduleFit = () => requestAnimationFrame(() => fitWrapperToViewport(wrapper));
        scheduleFit();

        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => scheduleFit());
            resizeObserver.observe(wrapper);
            resizeObserver.observe(left);
            resizeObserver.observe(right);
        }

        container.classList.add('fs-original-hidden');
        return { wrapper, container, items, resizeObserver };
    };

    const destroyMasonry = (instance) => {
        if (!instance) return;
        instance.resizeObserver?.disconnect();
        instance.items.forEach((item) => instance.container.appendChild(item));
        instance.container.classList.remove('fs-original-hidden');
        instance.wrapper.remove();
    };

    ext.features.forumLayout = {
        selectors: SELECTORS,
        createMasonry,
        destroyMasonry,
        fitWrapperToViewport
    };
})();