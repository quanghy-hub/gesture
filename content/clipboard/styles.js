(() => {
    const ext = globalThis.GestureExtension;

    const STYLE_ID = 'gesture-extension-clipboard-styles';

    const ensureStyles = () => {
        if (document.getElementById(STYLE_ID)) {
            return;
        }

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .gesture-clipboard-trigger {
                position: fixed;
                z-index: 2147483646;
                width: 32px;
                height: 32px;
                border: 0;
                border-radius: 999px;
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                color: #fff;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
                cursor: grab;
                font-size: 15px;
                line-height: 1;
                padding: 0;
                touch-action: none;
                user-select: none;
                -webkit-user-select: none;
                transition: box-shadow 140ms ease, opacity 140ms ease, filter 140ms ease, background 140ms ease;
                will-change: box-shadow, filter;
                backface-visibility: hidden;
                transform-origin: center center;
            }

            .gesture-clipboard-trigger:hover {
                box-shadow: 0 12px 28px rgba(0, 0, 0, 0.26);
                filter: brightness(1.04);
            }

            .gesture-clipboard-trigger:active {
                cursor: grabbing;
                box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
                filter: brightness(0.97);
            }

            .gesture-clipboard-trigger[hidden],
            .gesture-clipboard-panel[hidden] {
                display: none !important;
            }

            .gesture-clipboard-panel {
                position: fixed;
                z-index: 2147483647;
                width: min(360px, calc(100vw - 24px));
                max-height: min(420px, calc(100vh - 24px));
                overflow: auto;
                background: rgba(17, 24, 39, 0.98);
                color: #f9fafb;
                border-radius: 14px;
                border: 0 !important;
                outline: 0 !important;
                box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35);
                padding: 8px;
                font-family: Arial, sans-serif;
                touch-action: manipulation;
                background-clip: padding-box;
            }

            .gesture-clipboard-panel-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 6px;
                margin-bottom: 6px;
                font-size: 13px;
                font-weight: 700;
            }

            .gesture-clipboard-group {
                margin-top: 8px;
            }

            .gesture-clipboard-group-title {
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                opacity: 0.72;
                margin: 0 0 4px;
            }

            .gesture-clipboard-empty {
                font-size: 12px;
                opacity: 0.68;
                padding: 7px 6px;
                border-radius: 10px;
                background: rgba(255, 255, 255, 0.05);
            }

            .gesture-clipboard-item {
                width: 100%;
                display: grid;
                grid-template-columns: 20px 20px minmax(0, 1fr) 20px;
                gap: 8px;
                align-items: center;
                padding: 7px;
                margin: 0 0 6px;
                border-radius: 12px;
                border: 0 !important;
                outline: 0 !important;
                box-shadow: none !important;
                background: rgba(255, 255, 255, 0.06);
            }

            .gesture-clipboard-item-pin,
            .gesture-clipboard-item-remove {
                margin-top: 1px;
            }

            .gesture-clipboard-item-remove {
                justify-self: end;
            }

            .gesture-clipboard-item-text {
                flex: 1;
                color: inherit;
                padding: 0;
                margin: 0;
                font-size: 12px;
                line-height: 1.45;
                white-space: pre-wrap;
                word-break: break-word;
                user-select: text;
                -webkit-user-select: text;
                cursor: text;
            }

            .gesture-clipboard-item-text:hover {
                opacity: 0.92;
            }

            .gesture-clipboard-icon-button {
                width: 20px;
                height: 20px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border: 0;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                cursor: pointer;
                padding: 0;
                font-size: 11px;
                line-height: 1;
                touch-action: manipulation;
            }

            .gesture-clipboard-icon-button:hover {
                background: rgba(255, 255, 255, 0.2);
            }

            .gesture-clipboard-icon-button-danger {
                background: rgba(239, 68, 68, 0.18);
                color: #fecaca;
            }

            .gesture-clipboard-icon-button-danger:hover {
                background: rgba(239, 68, 68, 0.28);
            }
        `;

        (document.head || document.documentElement).appendChild(style);
    };

    ext.features.clipboardStyles = {
        shouldRun: () => true,
        init: () => {
            ensureStyles();
            return {
                onConfigChange() { }
            };
        }
    };
})();
