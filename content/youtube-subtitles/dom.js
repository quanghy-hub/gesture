(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = ext.youtubeSubtitles = ext.youtubeSubtitles || {};
    const floating = ext.shared.floatingCore;
    const { SELECTORS } = youtubeSubtitles;
    const ICONS = floating.icons;

    const getToggleButton = () => document.querySelector(SELECTORS.translateButton);
    const getDefaultTogglePosition = () => ({
        left: Math.max(12, window.innerWidth - 66),
        top: Math.max(12, window.innerHeight - 158)
    });
    const togglePosStorage = floating.createPositionStorage(
        'gesture_youtube_subtitles_toggle_pos_v1',
        getDefaultTogglePosition()
    );

    youtubeSubtitles.dom = {
        mountControlButtons({ onToggleTranslate }) {
            floating.ensureSharedActionButtonStyles();
            getToggleButton()?.remove();
            const buttonRef = floating.createActionButton({
                id: 'gesture-youtube-subtitles-toggle',
                className: 'gesture-youtube-subtitles-toggle',
                title: 'Dịch phụ đề',
                ariaLabel: 'Dịch phụ đề',
                htmlContent: ICONS.translate,
                hidden: false,
                parent: document.documentElement,
                position: 'fixed',
                zIndex: '2147483644'
            });

            togglePosStorage.load().then(({ left, top }) => {
                const pos = floating.clampFixedPosition({
                    left,
                    top,
                    width: 46,
                    height: 46,
                    margin: 12
                });
                buttonRef.setPosition(pos.left, pos.top);
            });

            floating.bindDragBehavior({
                target: buttonRef.element,
                threshold: 4,
                getInitialPosition: () => ({
                    left: buttonRef.element.offsetLeft,
                    top: buttonRef.element.offsetTop
                }),
                onMove: ({ event, deltaX, deltaY, origin }) => {
                    floating.stopFloatingEvent(event);
                    const next = floating.clampFixedPosition({
                        left: origin.left + deltaX,
                        top: origin.top + deltaY,
                        width: 46,
                        height: 46,
                        margin: 12
                    });
                    buttonRef.setPosition(next.left, next.top);
                    buttonRef.element.classList.add('is-dragging');
                },
                onDragEnd: () => {
                    buttonRef.element.classList.remove('is-dragging');
                    togglePosStorage.save(buttonRef.element.offsetLeft, buttonRef.element.offsetTop);
                },
                onClick: ({ event }) => {
                    floating.stopFloatingEvent(event);
                    onToggleTranslate();
                }
            });
        },
        setTranslateButtonState(enabled) {
            const button = getToggleButton();
            if (!button) {
                return;
            }
            button.classList.toggle('is-active', enabled);
            button.innerHTML = enabled ? ICONS.translateActive : ICONS.translate;
            button.title = enabled ? 'Tắt dịch (T)' : 'Dịch phụ đề (T)';
            button.setAttribute('aria-label', enabled ? 'Tắt dịch phụ đề' : 'Dịch phụ đề');
        },
        removeTranslateButtons() {
            getToggleButton()?.remove();
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
                #gesture-youtube-subtitles-toggle {
                    z-index: 2147483644;
                }
                #gesture-youtube-subtitles-toggle svg,
                #gesture-youtube-subtitles-toggle > * {
                    width: 28px !important;
                    height: 28px !important;
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
                    touch-action: none !important;
                    -webkit-user-select: none !important;
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
                #yt-bilingual-subtitles .sub-translated.sub-error {
                    color: #ffb347 !important;
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
            floating.bindDragBehavior({
                target: container,
                threshold: 3,
                getInitialPosition: () => {
                    const rect = container.getBoundingClientRect();
                    return { left: rect.left, top: rect.top };
                },
                onMove: ({ event, deltaX, deltaY, origin }) => {
                    if (window.getSelection()?.toString()) {
                        return;
                    }
                    event.preventDefault();
                    const nextLeft = Math.max(0, Math.min(origin.left + deltaX, window.innerWidth - container.offsetWidth));
                    const nextTop = Math.max(0, Math.min(origin.top + deltaY, window.innerHeight - container.offsetHeight));
                    const alignment = nextLeft > (window.innerWidth - container.offsetWidth) * 0.7
                        ? 'right'
                        : nextLeft < (window.innerWidth - container.offsetWidth) * 0.3
                            ? 'left'
                            : 'center';

                    container.classList.add('yt-sub-dragging');
                    container.style.left = alignment === 'right' ? 'auto' : `${nextLeft}px`;
                    container.style.right = alignment === 'right' ? `${window.innerWidth - nextLeft - container.offsetWidth}px` : 'auto';
                    container.style.top = `${nextTop}px`;
                    container.style.bottom = 'auto';
                    container.style.transform = alignment === 'center' ? 'translateX(-50%)' : 'none';
                    container.dataset.dragAlignment = alignment;
                    container.dataset.dragLeft = String(nextLeft);
                    container.dataset.dragTop = String(nextTop);
                },
                onDragEnd: () => {
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
                }
            });
        }
    };
})();
