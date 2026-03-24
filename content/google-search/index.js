(() => {
    const ext = globalThis.GestureExtension;

    const UI = {
        triggerSize: 36,
        dragThreshold: 5,
        panelOffset: 8,
        defaultPosition: {
            top: 130,
            left: 160
        }
    };

    const FILTERS = [
        { name: 'Hour', unit: 'h', values: [1, 2, 3, 4, 6, 12] },
        { name: 'Day', unit: 'd', values: [1, 2, 3, 4, 5, 6, 7] },
        { name: 'Week', unit: 'w', values: [1, 2, 3, 4] },
        { name: 'Month', unit: 'm', values: [1, 2, 3, 6, 9, 12] },
        { name: 'Year', unit: 'y', values: [1, 2, 3, 4, 5] },
        { name: 'File', unit: 'file', values: ['PDF', 'DOC', 'XLS', 'PPT', 'TXT'] }
    ];

    const STORAGE_KEY = 'gesture_google_search_position_v1';

    const clampPosition = (left, top) => {
        const maxLeft = Math.max(0, window.innerWidth - UI.triggerSize);
        const maxTop = Math.max(0, window.innerHeight - UI.triggerSize);
        return {
            left: Math.min(Math.max(0, left), maxLeft),
            top: Math.min(Math.max(0, top), maxTop)
        };
    };

    const getStoredPosition = () => new Promise((resolve) => {
        try {
            chrome.storage.local.get([STORAGE_KEY], (result) => {
                if (chrome.runtime.lastError) {
                    resolve(UI.defaultPosition);
                    return;
                }
                const value = result?.[STORAGE_KEY];
                resolve(value && typeof value === 'object' ? value : UI.defaultPosition);
            });
        } catch {
            resolve(UI.defaultPosition);
        }
    });

    const setStoredPosition = (position) => new Promise((resolve) => {
        try {
            chrome.storage.local.set({ [STORAGE_KEY]: position }, () => resolve());
        } catch {
            resolve();
        }
    });

    const createFilterPanel = ({ onApplyTime, onApplyFile }) => {
        const panel = document.createElement('div');
        panel.className = 'gesture-google-search-panel';

        const grid = document.createElement('div');
        grid.className = 'gesture-google-search-grid';

        FILTERS.forEach((filter) => {
            const header = document.createElement('div');
            header.className = 'gesture-google-search-header';
            header.textContent = filter.name;
            grid.appendChild(header);

            filter.values.forEach((value) => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'gesture-google-search-cell';
                button.textContent = filter.unit === 'file' ? value : `${value}${filter.unit.toUpperCase()}`;
                button.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (filter.unit === 'file') {
                        onApplyFile(value);
                        return;
                    }
                    onApplyTime(filter.unit, value);
                });
                grid.appendChild(button);
            });
        });

        panel.appendChild(grid);
        return panel;
    };

    ext.features.googleSearch = {
        shouldRun: ({ runtime }) => runtime.isHttpPage(),
        init: () => {
            let trigger = null;
            let panel = null;
            let isPanelOpen = false;
            let isDragging = false;
            let dragCleanup = () => { };

            const applyTriggerPosition = (position) => {
                if (!trigger) return;
                const next = clampPosition(position.left, position.top);
                trigger.style.left = `${next.left}px`;
                trigger.style.top = `${next.top}px`;
            };

            const updatePanelPosition = () => {
                if (!trigger || !panel) return;
                const rect = trigger.getBoundingClientRect();
                const preferredLeft = Math.min(rect.left, Math.max(0, window.innerWidth - panel.offsetWidth - 8));
                const preferredTop = Math.min(rect.bottom + UI.panelOffset, Math.max(0, window.innerHeight - panel.offsetHeight - 8));
                panel.style.left = `${Math.max(0, preferredLeft)}px`;
                panel.style.top = `${Math.max(0, preferredTop)}px`;
            };

            const showPanel = () => {
                updatePanelPosition();
                panel.classList.add('is-visible');
                trigger.classList.add('is-active');
                isPanelOpen = true;
            };

            const hidePanel = () => {
                panel.classList.remove('is-visible');
                trigger.classList.remove('is-active');
                isPanelOpen = false;
            };

            const togglePanel = () => {
                if (isPanelOpen) {
                    hidePanel();
                    return;
                }
                showPanel();
            };

            const urlSearchParamsFallback = () => new URL(window.location.href).searchParams.get('q') ?? '';

            const applyTimeFilter = (period, amount) => {
                const url = new URL(window.location.href);
                url.searchParams.set('tbs', `qdr:${period}${amount > 1 ? amount : ''}`);
                window.location.assign(url.toString());
            };

            const applyFileFilter = (type) => {
                const input = document.querySelector('textarea[name="q"], input[name="q"]');
                const currentQuery = (input?.value || urlSearchParamsFallback())
                    .replace(/\s*filetype:\w+/gi, '')
                    .trim();
                const url = new URL(window.location.href);
                const nextQuery = [currentQuery, `filetype:${String(type).toLowerCase()}`].filter(Boolean).join(' ');
                url.searchParams.set('q', nextQuery);
                window.location.assign(url.toString());
            };

            const savePosition = async () => {
                if (!trigger) return;
                await setStoredPosition({
                    top: trigger.offsetTop,
                    left: trigger.offsetLeft
                });
            };

            const bindDragEvents = () => {
                let startX = 0;
                let startY = 0;
                let startLeft = 0;
                let startTop = 0;

                const onPointerMove = (event) => {
                    const deltaX = event.clientX - startX;
                    const deltaY = event.clientY - startY;

                    if (Math.abs(deltaX) > UI.dragThreshold || Math.abs(deltaY) > UI.dragThreshold) {
                        isDragging = true;
                    }

                    if (!isDragging) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    applyTriggerPosition({
                        left: startLeft + deltaX,
                        top: startTop + deltaY
                    });

                    if (isPanelOpen) {
                        updatePanelPosition();
                    }
                };

                const onPointerUp = async () => {
                    trigger.classList.remove('is-dragging');
                    dragCleanup();

                    if (isDragging) {
                        await savePosition();
                    }
                };

                trigger.addEventListener('pointerdown', (event) => {
                    if (event.button !== 0 && event.pointerType !== 'touch') {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    isDragging = false;
                    startX = event.clientX;
                    startY = event.clientY;
                    startLeft = trigger.offsetLeft;
                    startTop = trigger.offsetTop;
                    trigger.classList.add('is-dragging');
                    trigger.setPointerCapture?.(event.pointerId);

                    const moveHandler = (moveEvent) => onPointerMove(moveEvent);
                    const upHandler = () => {
                        onPointerUp().catch((error) => {
                            console.error('[GestureExtension] Failed to persist google search position', error);
                        });
                        document.removeEventListener('pointermove', moveHandler);
                        document.removeEventListener('pointerup', upHandler);
                        document.removeEventListener('pointercancel', upHandler);
                    };

                    dragCleanup = () => {
                        document.removeEventListener('pointermove', moveHandler);
                        document.removeEventListener('pointerup', upHandler);
                        document.removeEventListener('pointercancel', upHandler);
                    };

                    document.addEventListener('pointermove', moveHandler, { passive: false });
                    document.addEventListener('pointerup', upHandler, { once: true });
                    document.addEventListener('pointercancel', upHandler, { once: true });
                });

                trigger.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    if (isDragging) {
                        isDragging = false;
                        return;
                    }

                    togglePanel();
                }, true);
            };

            const bindLifecycleEvents = () => {
                document.addEventListener('click', (event) => {
                    if (!isPanelOpen) {
                        return;
                    }

                    const target = event.target;
                    if (target instanceof Node && (trigger.contains(target) || panel.contains(target))) {
                        return;
                    }

                    hidePanel();
                }, true);

                window.addEventListener('resize', () => {
                    applyTriggerPosition({
                        left: trigger.offsetLeft,
                        top: trigger.offsetTop
                    });

                    if (isPanelOpen) {
                        updatePanelPosition();
                    }
                });
            };

            const ensureStyles = () => {
                if (document.getElementById('gesture-google-search-style')) {
                    return;
                }
                const style = document.createElement('style');
                style.id = 'gesture-google-search-style';
                style.textContent = `
                    .gesture-google-search-trigger {
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
                    .gesture-google-search-trigger.is-active {
                        background: #1a73e8;
                    }
                    .gesture-google-search-trigger.is-dragging {
                        cursor: grabbing;
                        opacity: 0.75;
                    }
                    .gesture-google-search-panel {
                        position: fixed;
                        z-index: 2147483645;
                        display: none;
                        padding: 10px;
                        border-radius: 12px;
                        background: #1a1a1a;
                        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
                        color: #e8eaed;
                    }
                    .gesture-google-search-panel.is-visible {
                        display: block;
                    }
                    .gesture-google-search-grid {
                        display: grid;
                        grid-template-columns: repeat(6, 32px);
                        gap: 4px;
                    }
                    .gesture-google-search-header {
                        grid-column: 1 / -1;
                        padding: 4px 2px 2px;
                        color: #9aa0a6;
                        font-size: 10px;
                        font-weight: 600;
                    }
                    .gesture-google-search-header:first-child {
                        padding-top: 0;
                    }
                    .gesture-google-search-cell {
                        width: 32px;
                        height: 28px;
                        border: none;
                        border-radius: 6px;
                        background: #2a2a2a;
                        color: #e8eaed;
                        font-size: 11px;
                        font-weight: 500;
                        cursor: pointer;
                    }
                    .gesture-google-search-cell:hover {
                        background: #4285f4;
                        color: #fff;
                    }
                `;
                (document.head || document.documentElement).appendChild(style);
            };

            const createUi = async () => {
                ensureStyles();
                trigger = document.createElement('button');
                trigger.type = 'button';
                trigger.className = 'gesture-google-search-trigger';
                trigger.setAttribute('aria-label', 'Google search filters');
                trigger.textContent = '🔍';

                panel = createFilterPanel({
                    onApplyTime: applyTimeFilter,
                    onApplyFile: applyFileFilter
                });

                document.documentElement.appendChild(trigger);
                document.documentElement.appendChild(panel);

                applyTriggerPosition(await getStoredPosition());
                bindDragEvents();
                bindLifecycleEvents();
            };

            createUi().catch((error) => {
                console.error('[GestureExtension] Failed to initialize google search feature', error);
            });

            return {
                onConfigChange() { },
                destroy() {
                    dragCleanup();
                    trigger?.remove();
                    panel?.remove();
                }
            };
        }
    };
})();