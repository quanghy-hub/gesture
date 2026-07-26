(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const findLink = (keywords, relType) => {
        if (relType) {
            const rel = document.querySelector(`a[rel="${relType}"], link[rel="${relType}"]`);
            if (rel?.href) return rel.href;
        }

        for (const anchor of document.querySelectorAll('a[href]')) {
            const text = (anchor.innerText || anchor.getAttribute('aria-label') || '').toLowerCase();
            if (keywords.some((keyword) => text.includes(keyword))) return anchor.href;
        }

        return null;
    };

    const goPage = (dir, hops = 1, isMax = false) => {
        if (isMax) {
            const href = findLink(dir > 0 ? ['last', 'cuối', '末'] : ['first', 'đầu', '首'], dir > 0 ? 'last' : 'first');
            if (href) location.href = href;
            return;
        }

        const href = findLink(dir > 0 ? ['next', 'tiếp', 'sau', '»', '›', '下一'] : ['prev', 'trước', 'lùi', '«', '‹', '上一'], dir > 0 ? 'next' : 'prev');
        if (!href) return;
        if (hops <= 1) {
            location.href = href;
            return;
        }

        try {
            const current = new URL(location.href);
            const next = new URL(href, location.href);

            for (const [key, value] of next.searchParams) {
                if (!/^\d+$/.test(value)) continue;
                const currentValue = current.searchParams.get(key);
                if (currentValue === value) continue;

                const currentNumber = currentValue !== null && /^\d+$/.test(currentValue) ? +currentValue : +value - dir;
                const step = +value - currentNumber;
                if (!step) continue;

                next.searchParams.set(key, Math.max(step > 0 ? 1 : 0, currentNumber + step * hops));
                location.href = next.href;
                return;
            }

            const currentParts = current.pathname.split('/');
            const nextParts = next.pathname.split('/');
            const numberAtEnd = (segment) => {
                const match = segment.match(/(\d+)$/);
                return match ? +match[1] : null;
            };

            for (let i = 0; i < Math.max(currentParts.length, nextParts.length); i += 1) {
                const currentPart = currentParts[i] || '';
                const nextPart = nextParts[i] || '';
                if (currentPart === nextPart) continue;

                const nextNumber = numberAtEnd(nextPart);
                if (nextNumber === null) continue;

                const currentNumber = numberAtEnd(currentPart);
                const startValue = currentNumber !== null ? currentNumber : nextNumber - dir;
                const step = nextNumber - startValue;
                if (!step) continue;

                nextParts[i] = nextPart.replace(/\d+$/, Math.max(step > 0 ? 1 : 0, startValue + step * hops));
                next.pathname = nextParts.join('/');
                location.href = next.href;
                return;
            }
        } catch {
            location.href = href;
        }
    };

    const ensurePagerStyles = () => {
        if (document.getElementById('gesture-ext-pager-style')) return;
        const style = document.createElement('style');
        style.id = 'gesture-ext-pager-style';
        style.textContent = '#gesture-ext-pager{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#1a1a1ae6;color:#fff;padding:8px 16px;border-radius:20px;font:13px/1.4 system-ui;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .2s}#gesture-ext-pager.show{opacity:1}';
        (document.head || document.documentElement).appendChild(style);
    };

    ext.gestures.desktopPager = {
        findLink,
        goPage,
        ensurePagerStyles
    };
})();
