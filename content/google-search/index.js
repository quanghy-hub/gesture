(() => {
    const ext = globalThis.GestureExtension;
    const floating = ext.shared.floatingCore;
    const { createShadowContainer } = ext.shared.uiCore;

    const UI = {
        triggerSize: 36,
        panelOffset: 8,
        defaultPosition: { top: 130, left: 160 }
    };

    const FILTERS = [
        { name: 'Hour', unit: 'h', values: [1, 2, 3, 4, 6, 12] },
        { name: 'Day', unit: 'd', values: [1, 2, 3, 4, 5, 6, 7] },
        { name: 'Week', unit: 'w', values: [1, 2, 3, 4] },
        { name: 'Month', unit: 'm', values: [1, 2, 3, 6, 9, 12] },
        { name: 'Year', unit: 'y', values: [1, 2, 3, 4, 5] },
        { name: 'File', unit: 'file', values: ['PDF', 'DOC', 'XLS', 'PPT', 'TXT'] },
        { name: 'Tools', unit: 'tool', values: ['OCR'] }
    ];

    const STORAGE_KEY = 'gesture_google_search_position_v1';

    const getStoredPosition = () => new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const value = result?.[STORAGE_KEY];
            resolve(value && typeof value === 'object' ? value : UI.defaultPosition);
        });
    });

    const setStoredPosition = (position) => chrome.storage.local.set({ [STORAGE_KEY]: position });

    const createFilterPanel = ({ onApplyTime, onApplyFile }) => {
        const panel = document.createElement('div');
        panel.className = 'panel';

        const grid = document.createElement('div');
        grid.className = 'grid';

        FILTERS.forEach((filter) => {
            const header = document.createElement('div');
            header.className = 'header';
            header.textContent = filter.name;
            grid.appendChild(header);

            filter.values.forEach((value) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'cell';
                if (filter.unit === 'tool' && value === 'OCR') {
                    button.textContent = 'OCR';
                } else {
                    button.textContent = filter.unit === 'file' ? value : `${value}${filter.unit.toUpperCase()}`;
                }
                button.addEventListener('click', (event) => {
                    floating.stopFloatingEvent(event);
                    if (filter.unit === 'file') onApplyFile(value);
                    else if (filter.unit === 'tool' && value === 'OCR') {
                        // For google-search, we might not have a specific image, 
                        // so we could trigger a general OCR mode or just info.
                        // Let's assume they want to OCR the most likely image or just show how.
                        ext.shared.toastCore.createToast('Di chuột vào ảnh để dùng OCR', event.clientX, event.clientY, 2000);
                    }
                    else onApplyTime(filter.unit, value);
                });
                grid.appendChild(button);
            });
        });

        panel.appendChild(grid);
        return panel;
    };

    const isGoogleSearchPage = () => {
        const host = window.location.hostname.toLowerCase();
        return (host === 'www.google.com' || host === 'google.com') && /^https?:$/i.test(window.location.protocol);
    };

    const STYLES = `
        :host { all: initial; }
        .trigger {
            position: fixed;
            z-index: 2147483646;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 50%;
            background: #4285f4;
            color: #fff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.28);
            cursor: grab;
            font-size: 16px;
            line-height: 1;
            user-select: none;
            touch-action: none;
        }
        .trigger.is-active { background: #1a73e8; }
        .trigger.is-dragging { cursor: grabbing; opacity: 0.75; }
        .panel {
            position: fixed;
            z-index: 2147483645;
            display: none;
            padding: 10px;
            border-radius: 12px;
            background: #1a1a1a;
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
            color: #e8eaed;
            font-family: system-ui, -apple-system, sans-serif;
        }
        .panel.is-visible { display: block; }
        .grid {
            display: grid;
            grid-template-columns: repeat(6, 32px);
            gap: 4px;
        }
        .header {
            grid-column: 1 / -1;
            padding: 4px 2px 2px;
            color: #9aa0a6;
            font-size: 10px;
            font-weight: 600;
        }
        .cell {
            width: 32px;
            height: 28px;
            border: none;
            border-radius: 6px;
            background: #2a2a2a;
            color: #e8eaed;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        .cell:hover { background: #4285f4; color: #fff; }
    `;

    ext.features.googleSearch = {
        shouldRun: () => isGoogleSearchPage(),
        init: () => {
            let config = { left: 0, top: 0, open: false };
            const { container, shadow } = createShadowContainer('gesture-google-search-ui', STYLES);
            
            const trigger = document.createElement('button');
            trigger.className = 'trigger';
            trigger.textContent = '🔍';
            
            const applyTimeFilter = (period, amount) => {
                const url = new URL(window.location.href);
                url.searchParams.set('tbs', `qdr:${period}${amount > 1 ? amount : ''}`);
                window.location.assign(url.toString());
            };

            const applyFileFilter = (type) => {
                const input = document.querySelector('textarea[name="q"], input[name="q"]');
                const url = new URL(window.location.href);
                const currentQuery = (input?.value || url.searchParams.get('q') || '').replace(/\s*filetype:\w+/gi, '').trim();
                url.searchParams.set('q', [currentQuery, `filetype:${String(type).toLowerCase()}`].filter(Boolean).join(' '));
                window.location.assign(url.toString());
            };

            const panel = createFilterPanel({ onApplyTime: applyTimeFilter, onApplyFile: applyFileFilter });
            shadow.append(trigger, panel);
            document.documentElement.appendChild(container);

            const updateUI = () => {
                trigger.style.left = `${config.left}px`;
                trigger.style.top = `${config.top}px`;
                panel.classList.toggle('is-visible', config.open);
                trigger.classList.toggle('is-active', config.open);
                if (config.open) {
                    const rect = trigger.getBoundingClientRect();
                    const pPos = floating.clampFixedPosition({
                        left: rect.left,
                        top: rect.bottom + UI.panelOffset,
                        width: panel.offsetWidth,
                        height: panel.offsetHeight
                    });
                    panel.style.left = `${pPos.left}px`;
                    panel.style.top = `${pPos.top}px`;
                }
            };

            const unbindDrag = floating.bindDragBehavior({
                target: trigger,
                getInitialPosition: () => ({ left: config.left, top: config.top }),
                onMove: ({ deltaX, deltaY, origin }) => {
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: UI.triggerSize,
                        height: UI.triggerSize,
                        margin: 0
                    });
                    config.left = next.left;
                    config.top = next.top;
                    trigger.classList.add('is-dragging');
                    updateUI();
                },
                onDragEnd: () => {
                    trigger.classList.remove('is-dragging');
                    setStoredPosition({ left: config.left, top: config.top });
                },
                onClick: () => {
                    config.open = !config.open;
                    updateUI();
                }
            });

            const unbindOutside = floating.bindOutsideClickGuard({
                isOpen: () => config.open,
                containsTarget: (t) => trigger.contains(t) || panel.contains(t),
                onOutside: () => { config.open = false; updateUI(); }
            });

            getStoredPosition().then((pos) => {
                const initial = floating.clampFixedPosition({
                    left: pos.left,
                    top: pos.top,
                    width: UI.triggerSize,
                    height: UI.triggerSize,
                    margin: 0
                });
                config.left = initial.left;
                config.top = initial.top;
                updateUI();
            });

            return {
                onConfigChange() { },
                destroy() {
                    unbindDrag();
                    unbindOutside();
                    container.remove();
                }
            };
        }
    };
})();