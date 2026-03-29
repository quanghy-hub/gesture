(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = ext.youtubeSubtitles = ext.youtubeSubtitles || {};
    const { SELECTORS, ICONS } = youtubeSubtitles;

    const getControlsContainer = () => document.querySelector(SELECTORS.controls);

    const createPlayerButton = (className, title, icon, onClick) => {
        const button = document.createElement('button');
        button.className = `ytp-button ${className}`;
        button.title = title;
        button.innerHTML = icon;
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            onClick();
        });
        return button;
    };

    youtubeSubtitles.dom = {
        mountControlButtons({ onToggleTranslate }) {
            const controls = getControlsContainer();
            if (!controls) {
                return;
            }
            document.querySelector(SELECTORS.translateButton)?.remove();
            controls.insertBefore(
                createPlayerButton('ytp-translate-button', 'Dịch phụ đề (T)', ICONS.translate, onToggleTranslate),
                controls.firstChild
            );
        },
        setTranslateButtonState(enabled) {
            const button = document.querySelector(SELECTORS.translateButton);
            if (!button) {
                return;
            }
            button.classList.toggle('active', enabled);
            button.innerHTML = enabled ? ICONS.translateActive : ICONS.translate;
            button.title = enabled ? 'Tắt dịch (T)' : 'Dịch phụ đề (T)';
        },
        ensureSubtitleContainer() {
            let container = document.querySelector(SELECTORS.container);
            if (container) {
                return container;
            }
            container = document.createElement('div');
            container.id = 'yt-bilingual-subtitles';
            container.innerHTML = '<div class="sub-original"></div><div class="sub-translated"></div>';
            document.body.appendChild(container);
            return container;
        },
        removeSubtitleContainer() {
            document.querySelector(SELECTORS.container)?.remove();
        },
        setPlayerTranslating(active) {
            const player = document.querySelector(SELECTORS.player);
            if (player) {
                player.classList.toggle('yt-translating', active);
            }
            document.documentElement.classList.toggle('ext-yt-translating', active);
            document.body?.classList.toggle('ext-yt-translating', active);
        },
        ensureStyles() {
            if (document.getElementById('gesture-youtube-subtitles-style')) {
                return;
            }
            const style = document.createElement('style');
            style.id = 'gesture-youtube-subtitles-style';
            style.textContent = `
                :root {
                    --ext-yt-font-size: 16px;
                    --ext-yt-translated-font-size: 16px;
                    --ext-yt-original-color: #ffffff;
                    --ext-yt-translated-color: #0e8cecff;
                }
                .ytp-translate-button {
                    position: relative;
                    width: 48px;
                    height: 100%;
                    display: inline-flex !important;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.9;
                    transition: opacity 0.1s ease;
                }
                .ytp-translate-button:hover,
                .ytp-translate-button.active {
                    opacity: 1;
                }
                .ytp-translate-button.active {
                    color: #1c87eb;
                }
                .yt-translating .ytp-caption-window-container,
                .yt-translating .caption-window,
                .yt-translating .captions-text,
                .yt-translating .ytp-caption-segment,
                .ext-yt-translating .ytp-caption-window-container,
                .ext-yt-translating .caption-window,
                .ext-yt-translating .captions-text,
                .ext-yt-translating .ytp-caption-segment {
                    opacity: 0 !important;
                    visibility: hidden !important;
                    pointer-events: none !important;
                    display: none !important;
                }
                #yt-bilingual-subtitles {
                    position: fixed !important;
                    z-index: 9998 !important;
                    display: inline-flex !important;
                    flex-direction: column !important;
                    gap: 4px !important;
                    min-width: 200px !important;
                    max-width: 90% !important;
                    padding: 8px 12px !important;
                    border-radius: 6px !important;
                    background: rgba(8, 8, 8, 0.85) !important;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
                    backdrop-filter: blur(4px) !important;
                    cursor: move !important;
                    user-select: none !important;
                }
                #yt-bilingual-subtitles:hover {
                    background: rgba(15, 15, 15, 0.9) !important;
                }
                #yt-bilingual-subtitles.yt-sub-dragging {
                    opacity: 0.8 !important;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4) !important;
                    z-index: 9999 !important;
                }
                #yt-bilingual-subtitles .sub-original {
                    color: var(--ext-yt-original-color) !important;
                    font-size: var(--ext-yt-font-size) !important;
                    line-height: 1.3 !important;
                    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9) !important;
                    white-space: normal !important;
                    word-wrap: break-word !important;
                }
                #yt-bilingual-subtitles .sub-translated {
                    color: var(--ext-yt-translated-color) !important;
                    font-size: var(--ext-yt-translated-font-size) !important;
                    line-height: 1.3 !important;
                    text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.9) !important;
                    white-space: normal !important;
                    word-wrap: break-word !important;
                }
            `;
            (document.head || document.documentElement).appendChild(style);
        },
        applySettingsStyles(settings) {
            const style = document.documentElement.style;
            style.setProperty('--ext-yt-font-size', `${settings.fontSize}px`);
            style.setProperty('--ext-yt-translated-font-size', `${settings.translatedFontSize}px`);
            style.setProperty('--ext-yt-original-color', settings.originalColor);
            style.setProperty('--ext-yt-translated-color', settings.translatedColor);

            const container = document.querySelector(SELECTORS.container);
            if (!container) {
                return;
            }
            const align = settings.containerAlignment;
            container.style.left = align === 'right' ? 'auto' : align === 'center' ? '50%' : settings.containerPosition.x;
            container.style.right = align === 'right' ? settings.containerPosition.x : 'auto';
            container.style.top = settings.containerPosition.y.includes('%') ? 'auto' : settings.containerPosition.y;
            container.style.bottom = settings.containerPosition.y.includes('%') ? settings.containerPosition.y : 'auto';
            container.style.transform = align === 'center' ? 'translateX(-50%)' : 'none';
        },
        makeContainerDraggable(container, persistSettings) {
            if (container.dataset.extDragMounted === 'true') {
                return;
            }
            container.dataset.extDragMounted = 'true';
            let startX = 0;
            let startY = 0;
            let initialLeft = 0;
            let initialTop = 0;

            container.addEventListener('pointerdown', (event) => {
                if (window.getSelection()?.toString()) {
                    return;
                }
                event.preventDefault();
                startX = event.clientX;
                startY = event.clientY;
                const rect = container.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;
                container.classList.add('yt-sub-dragging');

                const onMove = (moveEvent) => {
                    moveEvent.preventDefault();
                    const deltaX = moveEvent.clientX - startX;
                    const deltaY = moveEvent.clientY - startY;
                    const nextLeft = Math.max(0, Math.min(initialLeft + deltaX, window.innerWidth - container.offsetWidth));
                    const nextTop = Math.max(0, Math.min(initialTop + deltaY, window.innerHeight - container.offsetHeight));
                    const alignment = nextLeft > (window.innerWidth - container.offsetWidth) * 0.7 ? 'right' : nextLeft < (window.innerWidth - container.offsetWidth) * 0.3 ? 'left' : 'center';

                    container.style.left = alignment === 'right' ? 'auto' : `${nextLeft}px`;
                    container.style.right = alignment === 'right' ? `${window.innerWidth - nextLeft - container.offsetWidth}px` : 'auto';
                    container.style.top = `${nextTop}px`;
                    container.style.bottom = 'auto';
                    container.style.transform = alignment === 'center' ? 'translateX(-50%)' : 'none';
                    container.dataset.dragAlignment = alignment;
                    container.dataset.dragLeft = String(nextLeft);
                    container.dataset.dragTop = String(nextTop);
                };

                const onUp = () => {
                    container.classList.remove('yt-sub-dragging');
                    if (container.dataset.dragLeft && container.dataset.dragTop) {
                        persistSettings({
                            containerPosition: {
                                x: `${container.dataset.dragLeft}px`,
                                y: `${container.dataset.dragTop}px`
                            },
                            containerAlignment: container.dataset.dragAlignment || 'left'
                        }).catch(() => { });
                    }
                    document.removeEventListener('pointermove', onMove);
                    document.removeEventListener('pointerup', onUp);
                    document.removeEventListener('pointercancel', onUp);
                };

                document.addEventListener('pointermove', onMove, { passive: false });
                document.addEventListener('pointerup', onUp, { once: true });
                document.addEventListener('pointercancel', onUp, { once: true });
            });
        }
    };
})();
