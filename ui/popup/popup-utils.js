(() => {
    const ext = globalThis.GestureExtension;

    const safeGetElementById = (id) => {
        const el = document.getElementById(id);
        if (el) return el;
        console.warn(`[GestureExtension][popup] Element with id "${id}" not found. Returning a fallback dummy element.`);
        return {
            addEventListener() {},
            removeEventListener() {},
            closest() { return null; },
            setAttribute() {},
            getAttribute() { return null; },
            removeAttribute() {},
            classList: {
                add() {},
                remove() {},
                toggle() {},
                contains() { return false; }
            },
            style: {},
            dataset: {},
            querySelector() { return null; },
            querySelectorAll() { return []; },
            replaceChildren() {},
            appendChild() {},
            insertBefore() {},
            value: '',
            checked: false,
            disabled: false,
            textContent: '',
            tagName: 'DIV'
        };
    };

    const fillProviderOptions = (select, options) => {
        if (!select) return;
        select.replaceChildren(...options.map(({ id, label }) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = label;
            return option;
        }));
    };

    const getHostFromUrl = (url) => {
        try {
            return new URL(url).host;
        } catch {
            return null;
        }
    };

    const setCardState = (card, enabled) => {
        if (!card) return;
        card.classList.toggle('is-disabled', !enabled);
    };

    const setHostControlsState = (controls, rows, enabled) => {
        controls.forEach((control) => {
            control.disabled = !enabled;
        });
        rows.forEach((row) => {
            row.style.opacity = enabled ? '1' : '.55';
        });
    };

    ext.ui = ext.ui || {};
    ext.ui.popupUtils = { safeGetElementById, fillProviderOptions, getHostFromUrl, setCardState, setHostControlsState };
})();
