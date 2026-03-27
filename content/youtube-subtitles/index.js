(() => {
    const ext = globalThis.GestureExtension;
    const { createMemoryCache, translate: coreTranslate } = ext.shared.translateCore;

    const SELECTORS = {
        player: '#movie_player, .html5-video-player',
        controls: '.ytp-right-controls',
        translateButton: '.ytp-translate-button',
        container: '#yt-bilingual-subtitles',
        nativeCaptionNodes: '.ytp-caption-window-container, .caption-window, .captions-text, .ytp-caption-segment'
    };

    const ICONS = {
        translate: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3"></path><path d="M22 22l-5-10-5 10M14 18h6"></path></svg>',
        translateActive: '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"></path></svg>'
    };

    const AUTO_CAPTION_CONTEXT_WORDS = 1;
    const EARLY_VISIBLE_CAPTION_WORDS = 3;
    const MIN_VISIBLE_CAPTION_WORDS = 6;
    const MAX_VISIBLE_CAPTION_WORDS = 12;

    const cache = createMemoryCache({ maxSize: 500 });
    const isWatchPage = () => /\/watch|[?&]v=/.test(window.location.href);
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

    const mountControlButtons = ({ onToggleTranslate }) => {
        const controls = getControlsContainer();
        if (!controls) {
            return;
        }
        document.querySelector(SELECTORS.translateButton)?.remove();
        controls.insertBefore(
            createPlayerButton('ytp-translate-button', 'Dịch phụ đề (T)', ICONS.translate, onToggleTranslate),
            controls.firstChild
        );
    };

    const setTranslateButtonState = (enabled) => {
        const button = document.querySelector(SELECTORS.translateButton);
        if (!button) {
            return;
        }
        button.classList.toggle('active', enabled);
        button.innerHTML = enabled ? ICONS.translateActive : ICONS.translate;
        button.title = enabled ? 'Tắt dịch (T)' : 'Dịch phụ đề (T)';
    };

    const ensureSubtitleContainer = () => {
        let container = document.querySelector(SELECTORS.container);
        if (container) {
            return container;
        }
        container = document.createElement('div');
        container.id = 'yt-bilingual-subtitles';
        container.innerHTML = '<div class="sub-original"></div><div class="sub-translated"></div>';
        document.body.appendChild(container);
        return container;
    };

    const removeSubtitleContainer = () => {
        document.querySelector(SELECTORS.container)?.remove();
    };

    const setPlayerTranslating = (active) => {
        const player = document.querySelector(SELECTORS.player);
        if (player) {
            player.classList.toggle('yt-translating', active);
        }
        document.documentElement.classList.toggle('ext-yt-translating', active);
        document.body?.classList.toggle('ext-yt-translating', active);
    };

    const createCaptionObserver = (onChange) => {
        let mutationObserver = null;
        return {
            start() {
                if (mutationObserver) {
                    return;
                }
                mutationObserver = new MutationObserver(() => onChange());
                mutationObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
            },
            stop() {
                mutationObserver?.disconnect();
                mutationObserver = null;
            }
        };
    };

    const getSubtitleTracks = (video) => {
        if (!video?.textTracks) {
            return [];
        }
        const tracks = [];
        for (let index = 0; index < video.textTracks.length; index += 1) {
            const track = video.textTracks[index];
            if (track?.kind === 'captions' || track?.kind === 'subtitles') {
                tracks.push(track);
            }
        }
        return tracks;
    };

    const getPreferredTrack = (video) => {
        const tracks = getSubtitleTracks(video);
        if (!tracks.length) {
            return null;
        }
        return tracks.find((track) => track.mode === 'showing')
            || tracks.find((track) => track.language)
            || tracks[0];
    };

    const normalizeCueText = (text) => String(text || '').replace(/\s+/g, ' ').trim();

    const extractCaptionTextFromDom = () => {
        const captionWindows = document.querySelectorAll('.caption-window');
        if (!captionWindows.length) {
            return '';
        }
        const lastWindow = captionWindows[captionWindows.length - 1];
        const lines = lastWindow.querySelectorAll('.caption-visual-line');
        if (lines.length) {
            return Array.from(lines)
                .map((line) => Array.from(line.querySelectorAll('.ytp-caption-segment')).map((segment) => segment.textContent.trim()).filter(Boolean).join(' '))
                .filter(Boolean)
                .join(' ')
                .trim();
        }
        return Array.from(lastWindow.querySelectorAll('.ytp-caption-segment'))
            .map((segment) => segment.textContent.trim())
            .filter(Boolean)
            .join(' ')
            .trim();
    };

    const hasDomCaptionText = () => Boolean(extractCaptionTextFromDom());

    const hideNativeCaptionTracks = (video) => {
        getSubtitleTracks(video).forEach((track) => {
            try {
                track.mode = 'hidden';
            } catch {
                // Ignore sites that reject track mode changes.
            }
        });
    };

    const extractCaptionText = (video) => {
        const track = getPreferredTrack(video);
        if (!track) {
            return extractCaptionTextFromDom();
        }
        try {
            if (track.mode === 'disabled') {
                track.mode = 'hidden';
            }
        } catch {
            // Ignore track mode errors.
        }
        const activeCues = Array.from(track.activeCues || []);
        if (activeCues.length) {
            return activeCues
                .map((cue) => normalizeCueText(cue.text))
                .filter(Boolean)
                .join(' ')
                .trim();
        }
        const currentTime = video?.currentTime ?? 0;
        const cues = Array.from(track.cues || []);
        const currentCue = cues.find((cue) => currentTime >= cue.startTime && currentTime <= cue.endTime);
        const text = normalizeCueText(currentCue?.text);
        return text || extractCaptionTextFromDom();
    };

    const bindTrackCueChange = (video, onChange) => {
        const removers = [];
        getSubtitleTracks(video).forEach((track) => {
            if (typeof track.addEventListener === 'function') {
                track.addEventListener('cuechange', onChange);
                removers.push(() => track.removeEventListener('cuechange', onChange));
            }
        });
        return () => removers.forEach((remove) => remove());
    };

    const hasCaptionTrack = (video) => getSubtitleTracks(video).length > 0 || Boolean(extractCaptionTextFromDom());
    const clearTranslatorCache = () => cache.clear();

    const translateCaption = async (text, settings) => {
        const key = text.trim();
        if (!key) return '';
        const cached = cache.get(key);
        if (cached?.result) return cached.result;
        try {
            return await coreTranslate(key, {
                cache,
                provider: 'google',
                targetLanguage: settings.targetLang
            });
        } catch {
            return '';
        }
    };

    ext.features.youtubeSubtitles = {
        shouldRun: ({ runtime }) => runtime.isHttpPage() && /(^|\.)youtube\.com$/i.test(window.location.hostname),
        init: ({ getConfig, storage }) => {
            let settings = getConfig().youtubeSubtitles;
            let observer;
            const state = {
                enabled: false,
                lastSource: '',
                lastRenderedSource: '',
                consumedWordCount: 0,
                mounted: false,
                pageEventsBound: false,
                video: null,
                detachTrackListener: null,
                videoSyncHandler: null
            };

            const ensureStyles = () => {
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
            };

            const normalizeCaptionWords = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);

            const getDisplayCaptionText = (currentSource, previousSource) => {
                const currentWords = normalizeCaptionWords(currentSource);
                const previousWords = normalizeCaptionWords(previousSource);
                if (!currentWords.length) {
                    return '';
                }
                const isProgressiveAutoCaption =
                    previousWords.length > 0 &&
                    previousWords.length < currentWords.length &&
                    previousWords.every((word, index) => currentWords[index] === word);
                if (isProgressiveAutoCaption) {
                    const remainingWords = currentWords.slice(state.consumedWordCount);
                    const requiredWords = state.consumedWordCount === 0 ? EARLY_VISIBLE_CAPTION_WORDS : MIN_VISIBLE_CAPTION_WORDS;
                    if (remainingWords.length < requiredWords) {
                        return '';
                    }
                    const chunkWords = remainingWords.slice(0, MAX_VISIBLE_CAPTION_WORDS);
                    state.consumedWordCount += chunkWords.length;
                    return chunkWords.join(' ');
                }
                state.consumedWordCount = 0;
                if (currentWords.length <= MAX_VISIBLE_CAPTION_WORDS) {
                    return currentWords.join(' ');
                }
                const chunkWords = currentWords.slice(0, MAX_VISIBLE_CAPTION_WORDS);
                state.consumedWordCount = chunkWords.length;
                return chunkWords.join(' ');
            };

            const applySettingsStyles = () => {
                const style = document.documentElement.style;
                style.setProperty('--ext-yt-font-size', `${settings.fontSize}px`);
                style.setProperty('--ext-yt-translated-font-size', `${settings.translatedFontSize}px`);
                style.setProperty('--ext-yt-original-color', settings.originalColor);
                style.setProperty('--ext-yt-translated-color', settings.translatedColor);

                const container = document.querySelector('#yt-bilingual-subtitles');
                if (!container) {
                    return;
                }

                const align = settings.containerAlignment;
                container.style.left = align === 'right' ? 'auto' : align === 'center' ? '50%' : settings.containerPosition.x;
                container.style.right = align === 'right' ? settings.containerPosition.x : 'auto';
                container.style.top = settings.containerPosition.y.includes('%') ? 'auto' : settings.containerPosition.y;
                container.style.bottom = settings.containerPosition.y.includes('%') ? settings.containerPosition.y : 'auto';
                container.style.transform = align === 'center' ? 'translateX(-50%)' : 'none';
            };

            const persistSettings = async (partial) => {
                settings = {
                    ...settings,
                    ...partial,
                    containerPosition: {
                        ...settings.containerPosition,
                        ...(partial.containerPosition ?? {})
                    }
                };
                const nextConfig = await storage.updateConfig((draft) => {
                    draft.youtubeSubtitles = {
                        ...draft.youtubeSubtitles,
                        ...partial,
                        containerPosition: {
                            ...draft.youtubeSubtitles.containerPosition,
                            ...(partial.containerPosition ?? {})
                        }
                    };
                    return draft;
                });
                settings = nextConfig.youtubeSubtitles;
                applySettingsStyles();
            };

            const makeContainerDraggable = (container) => {
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
            };

            const renderCurrentCaption = async () => {
                const video = state.video || document.querySelector('video');
                if (!video) {
                    removeSubtitleContainer();
                    setPlayerTranslating(false);
                    state.lastSource = '';
                    state.lastRenderedSource = '';
                    state.consumedWordCount = 0;
                    return;
                }

                hideNativeCaptionTracks(video);
                const source = extractCaptionText(video);
                if (!source) {
                    removeSubtitleContainer();
                    setPlayerTranslating(false);
                    state.lastSource = '';
                    state.lastRenderedSource = '';
                    state.consumedWordCount = 0;
                    return;
                }

                if (source === state.lastSource) {
                    return;
                }

                const previousSource = state.lastSource;
                state.lastSource = source;
                const displaySource = getDisplayCaptionText(source, previousSource);
                if (!displaySource || displaySource === state.lastRenderedSource) {
                    return;
                }

                const translated = await translateCaption(displaySource, settings);
                if (!translated || translated === displaySource) {
                    return;
                }

                const container = ensureSubtitleContainer();
                makeContainerDraggable(container);
                container.querySelector('.sub-original').textContent = displaySource;
                container.querySelector('.sub-translated').textContent = translated;
                container.querySelector('.sub-original').style.display = settings.displayMode === 'compact' && !settings.showOriginal ? 'none' : '';
                state.lastRenderedSource = displaySource;
                applySettingsStyles();
                setPlayerTranslating(true);
            };

            const stopTranslationMode = () => {
                observer?.stop();
                state.enabled = false;
                state.lastSource = '';
                state.lastRenderedSource = '';
                state.consumedWordCount = 0;
                state.detachTrackListener?.();
                state.detachTrackListener = null;
                if (state.video && state.videoSyncHandler) {
                    state.video.removeEventListener('timeupdate', state.videoSyncHandler);
                    state.video.removeEventListener('seeked', state.videoSyncHandler);
                    state.video.removeEventListener('loadedmetadata', state.videoSyncHandler);
                }
                state.video = null;
                state.videoSyncHandler = null;
                removeSubtitleContainer();
                setPlayerTranslating(false);
                setTranslateButtonState(false);
            };

            const bindVideoSync = (video) => {
                if (!video) {
                    return;
                }
                const isSameVideo = state.video === video && state.videoSyncHandler;
                if (isSameVideo) {
                    return;
                }
                if (state.video && state.videoSyncHandler) {
                    state.video.removeEventListener('timeupdate', state.videoSyncHandler);
                    state.video.removeEventListener('seeked', state.videoSyncHandler);
                    state.video.removeEventListener('loadedmetadata', state.videoSyncHandler);
                }
                state.detachTrackListener?.();
                state.detachTrackListener = null;
                state.video = video;
                state.videoSyncHandler = () => {
                    if (state.enabled) {
                        renderCurrentCaption().catch(() => { });
                    }
                };
                video.addEventListener('timeupdate', state.videoSyncHandler);
                video.addEventListener('seeked', state.videoSyncHandler);
                video.addEventListener('loadedmetadata', state.videoSyncHandler);
                state.detachTrackListener = bindTrackCueChange(video, state.videoSyncHandler);
            };

            const startTranslationMode = () => {
                const video = document.querySelector('video');
                if (!video) {
                    return;
                }
                state.enabled = true;
                observer?.start();
                bindVideoSync(video);
                setTranslateButtonState(true);
                setPlayerTranslating(true);
                renderCurrentCaption().catch(() => { });
            };

            const toggleTranslationMode = () => {
                if (state.enabled) {
                    stopTranslationMode();
                    persistSettings({ enabled: false }).catch(() => { });
                    return;
                }
                startTranslationMode();
                persistSettings({ enabled: true }).catch(() => { });
            };

            const bindPageEvents = () => {
                if (state.pageEventsBound) {
                    return;
                }
                state.pageEventsBound = true;

                document.addEventListener('keydown', (event) => {
                    const activeElement = document.activeElement;
                    if (
                        activeElement instanceof HTMLElement &&
                        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
                    ) {
                        return;
                    }
                    if (event.key.toLowerCase() === 't' && !event.ctrlKey && !event.altKey && !event.metaKey && document.querySelector('video')) {
                        event.preventDefault();
                        toggleTranslationMode();
                    }
                });

                document.addEventListener('yt-navigate-finish', () => {
                    stopTranslationMode();
                    clearTranslatorCache();
                    window.setTimeout(() => {
                        if (isWatchPage()) {
                            document.body.dataset.gestureYoutubeSubtitlesMounted = 'true';
                            mountControlButtons({ onToggleTranslate: toggleTranslationMode });
                            if (settings?.enabled) {
                                startTranslationMode();
                            }
                        } else {
                            delete document.body.dataset.gestureYoutubeSubtitlesMounted;
                        }
                    }, 300);
                });

                window.addEventListener('resize', () => {
                    const container = document.querySelector('#yt-bilingual-subtitles');
                    if (!container) {
                        return;
                    }
                    const rect = container.getBoundingClientRect();
                    if (rect.left < 0) container.style.left = '0px';
                    if (rect.top < 0) container.style.top = '0px';
                    if (rect.right > window.innerWidth) container.style.left = `${window.innerWidth - container.offsetWidth}px`;
                    if (rect.bottom > window.innerHeight) container.style.top = `${window.innerHeight - container.offsetHeight}px`;
                });
            };

            const body = document.body;
            if (window.top !== window || body?.dataset?.gestureYoutubeSubtitlesMounted === 'true') {
                return {
                    onConfigChange() { },
                    destroy() { }
                };
            }

            settings = getConfig().youtubeSubtitles;
            ensureStyles();
            observer = createCaptionObserver(() => {
                if (state.enabled) {
                    renderCurrentCaption().catch(() => { });
                }
            });

            bindPageEvents();

            if (!isWatchPage()) {
                return {
                    onConfigChange(nextConfig) {
                        settings = nextConfig.youtubeSubtitles;
                    },
                    destroy() {
                        stopTranslationMode();
                        observer?.stop();
                    }
                };
            }

            if (body?.dataset) {
                body.dataset.gestureYoutubeSubtitlesMounted = 'true';
            }
            mountControlButtons({ onToggleTranslate: toggleTranslationMode });
            applySettingsStyles();

            if (settings.enabled) {
                startTranslationMode();
            }

            return {
                onConfigChange(nextConfig) {
                    settings = nextConfig.youtubeSubtitles;
                    applySettingsStyles();
                    if (!settings.enabled && state.enabled) {
                        stopTranslationMode();
                    }
                },
                destroy() {
                    stopTranslationMode();
                    observer?.stop();
                }
            };
        }
    };
})();