(() => {
    const ext = globalThis.GestureExtension;

    const SELECTORS = [
        { container: '.block-body.js-replyNewMessageContainer', items: 'article.message--post, article.message' },
        { container: '.structItemContainer-group.js-threadList', items: '.structItem--thread, .structItem' },
        { container: '.structItemContainer', items: '.structItem--thread, .structItem' }
    ];

    const fitWrapperToViewport = (wrapper) => {
        if (!wrapper?.isConnected) return;

        const rect = wrapper.getBoundingClientRect();
        if (!rect.width) return;
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
        if (!viewportWidth) return;
        const overflowLeft = Math.max(0, -rect.left);
        const overflowRight = Math.max(0, rect.right - viewportWidth);
        const overflow = Math.ceil(overflowLeft + overflowRight + 0.5);

        // Chỉ ghi khi giá trị đổi thật sự để tránh vòng lặp ResizeObserver.
        const nextFix = overflow > 1 ? `${overflow}px` : '';
        if ((wrapper.style.getPropertyValue('--fs-overflow-fix') || '') === nextFix) return;
        if (nextFix) {
            wrapper.style.setProperty('--fs-overflow-fix', nextFix);
        } else {
            wrapper.style.removeProperty('--fs-overflow-fix');
        }
    };

    const getDirectItems = (container, itemSelector) => {
        const scopedSelector = itemSelector
            .split(',')
            .map((selector) => selector.trim())
            .filter(Boolean)
            .map((selector) => `:scope > ${selector}`)
            .join(', ');

        return scopedSelector ? Array.from(container.querySelectorAll(scopedSelector)) : [];
    };

    const createMasonry = (container, itemSelector, gap) => {
        const items = getDirectItems(container, itemSelector);
        if (items.length < 2) return null;

        const wrapper = document.createElement('div');
        wrapper.className = 'fs-wrapper';
        wrapper.style.setProperty('--fs-gap', `${gap}px`);

        const left = document.createElement('div');
        const right = document.createElement('div');
        left.className = 'fs-column';
        right.className = 'fs-column';
        wrapper.append(left, right);

        container.parentNode?.insertBefore(wrapper, container);

        // Vòng ghi 1: trải đều items vào 2 cột để chúng đạt đúng chiều rộng cột cuối cùng.
        items.forEach((item, index) => {
            (index % 2 === 0 ? left : right).appendChild(item);
        });

        // Vòng đọc: đo chiều cao hàng loạt — chỉ flush layout một lần thay vì mỗi item.
        const heights = items.map((item) => item.offsetHeight);

        // Tính toán thuần số học: phân bổ tham lam theo cột thấp hơn.
        const columnTotals = [0, 0];
        const targets = heights.map((height) => {
            const target = columnTotals[0] <= columnTotals[1] ? 0 : 1;
            columnTotals[target] += Math.max(height, 1);
            return target;
        });

        // Vòng ghi 2: chỉ dời item đang ở sai cột.
        items.forEach((item, index) => {
            const column = targets[index] === 0 ? left : right;
            if (item.parentElement !== column) {
                column.appendChild(item);
            }
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
