(() => {
    const ext = globalThis.GestureExtension;
    const clipboard = ext.clipboard = ext.clipboard || {};
    const { escapeHtml, encodeAttribute } = ext.shared.domUtils;

    const getPanelData = (config, copiedTextCache) => {
        const clipboardConfig = config?.clipboard || { history: [], pinned: [] };
        const pinned = Array.isArray(clipboardConfig.pinned) ? clipboardConfig.pinned.slice(0, 5) : [];
        const history = Array.isArray(clipboardConfig.history) ? clipboardConfig.history : [];
        const recent = history.filter((item) => !pinned.includes(item)).slice(0, 5);
        if (copiedTextCache && !pinned.includes(copiedTextCache) && !recent.includes(copiedTextCache)) {
            recent.unshift(copiedTextCache);
        }
        return { pinned, recent };
    };

    const createGroupMarkup = (title, items, emptyText) => {
        const rows = items.length
            ? items.map((item) => {
                const escaped = escapeHtml(item);
                const encoded = encodeAttribute(item);
                const pinLabel = title === 'Đã ghim' ? 'Bỏ ghim' : 'Ghim';
                return `
                    <div class="gesture-clipboard-item">
                        <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-item-pin" data-pin="${encoded}" aria-label="${pinLabel}" title="${pinLabel}">📌</button>
                        <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-item-paste" data-paste="${encoded}" aria-label="Paste" title="Dán nội dung">⚡</button>
                        <div class="gesture-clipboard-item-text" title="Bôi đen để copy">${escaped}</div>
                        <button type="button" class="gesture-clipboard-icon-button gesture-clipboard-icon-button-danger gesture-clipboard-item-remove" data-remove="${encoded}" aria-label="Xóa" title="Xóa">🗑</button>
                    </div>
                `;
            }).join('')
            : `<div class="gesture-clipboard-empty">${emptyText}</div>`;

        return `
            <section class="gesture-clipboard-group">
                <h4 class="gesture-clipboard-group-title">${title}</h4>
                ${rows}
            </section>
        `;
    };

    clipboard.panelData = {
        getPanelMarkup(config, copiedTextCache) {
            const panelData = getPanelData(config, copiedTextCache);
            return `
                ${createGroupMarkup('Đã ghim', panelData.pinned, 'Chưa có mục nào được ghim')}
                ${createGroupMarkup('Gần đây', panelData.recent, 'Chưa có nội dung nào được lưu')}
            `;
        },
        hasClipboardData(config) {
            const clipboardConfig = config?.clipboard || {};
            return (Array.isArray(clipboardConfig.pinned) && clipboardConfig.pinned.length > 0)
                || (Array.isArray(clipboardConfig.history) && clipboardConfig.history.length > 0);
        }
    };
})();
