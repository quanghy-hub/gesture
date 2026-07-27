(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});
    const floating = ext.shared.floatingCore;

    videoScreenshot.ensureStyles = () => {
        if (document.getElementById('gesture-video-screenshot-style')) {
            return;
        }
        floating.ensureSharedActionButtonStyles();
        const style = document.createElement('style');
        style.id = 'gesture-video-screenshot-style';
        style.textContent = `
            .gesture-video-screenshot-trigger {
                width: 46px;
                height: 46px;
                touch-action: none;
            }
            .gesture-video-screenshot-trigger svg {
                width: 28px !important;
                height: 28px !important;
            }
            .gesture-screen-screenshot-overlay {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                cursor: crosshair;
                user-select: none;
                touch-action: none;
            }
            .gesture-screen-screenshot-shade {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, .32);
            }
            .gesture-screen-screenshot-box {
                position: absolute;
                display: none;
                border: 2px solid #2f8cff;
                background: rgba(47, 140, 255, .16);
                box-shadow: 0 0 0 9999px rgba(0, 0, 0, .2);
                box-sizing: border-box;
            }
            .gesture-screen-screenshot-hint {
                position: absolute;
                left: 50%;
                top: 18px;
                transform: translateX(-50%);
                padding: 7px 10px;
                border-radius: 6px;
                background: rgba(18, 22, 30, .92);
                color: #fff;
                font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                white-space: nowrap;
                pointer-events: none;
            }
            .gesture-screen-record-badge {
                position: fixed;
                left: 50%;
                top: 18px;
                z-index: 2147483646;
                transform: translateX(-50%);
                padding: 7px 10px;
                border-radius: 6px;
                background: rgba(185, 28, 28, .94);
                color: #fff;
                font: 13px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                pointer-events: none;
                user-select: none;
            }
            .gesture-screen-record-border {
                position: fixed;
                z-index: 2147483646;
                pointer-events: none;
                outline: 2px solid #ef4444;
                outline-offset: 0;
                box-shadow: 0 0 0 1px rgba(255, 255, 255, .9), 0 0 0 9999px rgba(0, 0, 0, .08);
            }
            .gesture-screen-record-control {
                position: fixed;
                z-index: 2147483646;
                display: flex;
                gap: 6px;
                padding: 4px;
                border-radius: 6px;
                background: rgba(18, 22, 30, .92);
                box-shadow: 0 2px 10px rgba(0, 0, 0, .35);
                touch-action: none;
            }
            .gesture-screen-record-button {
                position: relative;
                width: 34px;
                height: 34px;
                border: 0;
                border-radius: 5px;
                background: rgba(185, 28, 28, .94);
                cursor: pointer;
                touch-action: none;
            }
            .gesture-screen-record-button::before,
            .gesture-screen-record-button::after {
                content: "";
                position: absolute;
                background: #fff;
            }
            .gesture-screen-record-stop::before {
                left: 10px;
                top: 10px;
                width: 14px;
                height: 14px;
                border-radius: 2px;
            }
            .gesture-screen-record-pause::before,
            .gesture-screen-record-pause::after {
                top: 9px;
                width: 5px;
                height: 16px;
                border-radius: 1px;
            }
            .gesture-screen-record-pause::before {
                left: 10px;
            }
            .gesture-screen-record-pause::after {
                right: 10px;
            }
            .gesture-screen-record-pause.is-paused::before {
                left: 12px;
                top: 8px;
                width: 0;
                height: 0;
                border-top: 9px solid transparent;
                border-bottom: 9px solid transparent;
                border-left: 13px solid #fff;
                border-radius: 0;
                background: transparent;
            }
            .gesture-screen-record-pause.is-paused::after {
                display: none;
            }
        `;
        (document.head || document.documentElement).appendChild(style);
    };
})();
