(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.ui = videoFloating.ui || {};

    videoFloating.ui.createShell = (ctx) => {
        const { el, $ } = videoFloating.core.utils;
        const floating = ext?.shared?.floatingCore;
        const config = videoFloating.core.config;

        const resetIdle = () => {
            if (ctx.iconRef) ctx.iconRef.setOpacity(1);
            const panel = $('fvp-left-panel');
            if (panel) panel.style.opacity = '1';
            clearTimeout(ctx.state.idleTimer);
            ctx.state.idleTimer = setTimeout(() => {
                if (ctx.iconRef && !ctx.menuRef?.element.isConnected) ctx.iconRef.setOpacity(0.4);
                const p = $('fvp-left-panel');
                if (p) p.style.opacity = '';
            }, 3000);
        };

        const ensureInitialized = (menuVideoIcon) => {
            if (ctx.box) return;

            ctx.iconRef = floating.createTriggerElement({
                className: 'fvp-idle',
                htmlContent: menuVideoIcon.replace('fvp-menu-icon-svg', 'fvp-master-icon-svg'),
                hidden: true
            });
            ctx.iconRef.element.id = 'fvp-master-icon';
            config.iconPosStorage.load().then((pos) => ctx.iconRef.setPosition(pos.left, pos.top));
            config.ensureLayoutReady();

            ctx.menuRef = floating.createPanelRoot({ className: 'fvp-menu', hidden: true });
            ctx.menuRef.element.id = 'fvp-menu';

            ctx.box = el('div', '', `
                <div id="fvp-wrapper"></div>
                <button id="fvp-center-play" type="button" aria-label="Resume video" hidden>⏸</button>
                <div id="fvp-left-drag"></div>
                <div id="fvp-left-panel">
                    <div id="fvp-video-order" class="fvp-side-badge" hidden>1/1</div>
                    <button id="fvp-vol-btn" class="fvp-btn">🔊</button>
                    <button id="fvp-speed" class="fvp-btn" style="font-size:11px;font-weight:700">1.0x</button>
                    <div id="fvp-speed-popup" class="fvp-res-popup" style="display:none; flex-direction:column; align-items:center; padding:10px 5px; gap:8px; border-radius:8px; background:rgba(0,0,0,0.85); bottom: 50%; transform: translateY(50%);">
                        <span id="fvp-speed-value" style="font-size:11px; font-weight:bold; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.8);">1.0x</span>
                        <input type="range" id="fvp-speed-slider" min="0.1" max="4.0" step="0.1" value="1.0" style="writing-mode:vertical-lr; direction:rtl; width:8px; height:120px; margin:0; cursor:pointer;">
                    </div>
                    <button id="fvp-res" class="fvp-btn" style="font-size:11px;font-weight:700">HD</button>
                    <div id="fvp-res-popup"></div>
                    <button id="fvp-rotate" class="fvp-btn">↻</button>
                    <button id="fvp-zoom" class="fvp-btn">+</button>
                    <button id="fvp-fit" class="fvp-btn">⤢</button>
                    <button id="fvp-full" class="fvp-btn">⛶</button>
                    <button id="fvp-close" class="fvp-btn">✕</button>
                </div>
                <div class="fvp-resize-handle fvp-resize-br"></div>
                <div class="fvp-resize-handle fvp-resize-bl"></div>
                <div id="fvp-ctrl" class="fvp-overlay">
                    <div id="fvp-seek-row">
                        <span id="fvp-time-display">0.00/0.00</span>
                        <div id="fvp-seek-container">
                            <div id="fvp-seek-track"><div id="fvp-buffer"></div></div>
                            <input type="range" id="fvp-seek" min="0" max="10000" step="1" value="0">
                        </div>
                    </div>
                </div>
            `);
            ctx.box.id = 'fvp-container';
            ctx.box.style.display = 'none';
            document.body.appendChild(ctx.box);
        };

        const setupOutsideClickGuard = () => {
            const removeOutsideClick = floating.bindOutsideClickGuard({
                isOpen: () => ctx.menuRef.element.style.display !== 'none',
                containsTarget: (target) => ctx.iconRef.element.contains(target)
                    || ctx.menuRef.element.contains(target),
                onOutside: () => ctx.menuRef.hide()
            });
            ctx.cleanup.push(removeOutsideClick);
        };

        return {
            ensureInitialized,
            resetIdle,
            setupOutsideClickGuard
        };
    };
})();
