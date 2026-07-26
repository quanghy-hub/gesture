(() => {
    const ext = globalThis.GestureExtension;
    const youtubeSubtitles = ext.youtubeSubtitles = ext.youtubeSubtitles || {};

    youtubeSubtitles.createPageEvents = (deps) => {
        const { state, settings, toggleTranslationMode, stopTranslationMode, startTranslationMode } = deps;
        
        let locationHref = window.location.href;
        let pageEventCleanup = null;
        const NAVIGATION_RETRY_DELAY_MS = 500;
        const MAX_NAVIGATION_RETRY_ATTEMPTS = 20;

        const bindPageEvents = () => {
            if (state.pageEventsBound) {
                return;
            }
            state.pageEventsBound = true;
            const resizeContainerIntoViewport = () => {
                const container = document.querySelector('#yt-bilingual-subtitles');
                if (!container) {
                    return;
                }
                const rect = container.getBoundingClientRect();
                if (rect.left < 0) container.style.left = '0px';
                if (rect.top < 0) container.style.top = '0px';
                if (rect.right > window.innerWidth) container.style.left = `${window.innerWidth - container.offsetWidth}px`;
                if (rect.bottom > window.innerHeight) container.style.top = `${window.innerHeight - container.offsetHeight}px`;
            };

            const onKeyDown = (event) => {
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
            };

            const scheduleNavigationResume = (shouldResume, attempt = 0) => {
                window.clearTimeout(state.navigateTimer);
                state.navigateTimer = window.setTimeout(() => {
                    state.navigateTimer = 0;
                    if (youtubeSubtitles.isWatchPage()) {
                        document.body.dataset.gestureYoutubeSubtitlesMounted = 'true';
                        youtubeSubtitles.dom.mountControlButtons({ onToggleTranslate: toggleTranslationMode });
                        youtubeSubtitles.dom.applySettingsStyles(settings());
                        if (shouldResume && !startTranslationMode() && attempt < MAX_NAVIGATION_RETRY_ATTEMPTS) {
                            scheduleNavigationResume(shouldResume, attempt + 1);
                        }
                    } else {
                        delete document.body.dataset.gestureYoutubeSubtitlesMounted;
                        youtubeSubtitles.dom.removeTranslateButtons();
                    }
                }, attempt === 0 ? 300 : NAVIGATION_RETRY_DELAY_MS);
            };

            const onNavigateFinish = () => {
                locationHref = window.location.href;
                const shouldResume = state.enabled || settings()?.enabled;
                stopTranslationMode();
                youtubeSubtitles.translator.clearCache();
                scheduleNavigationResume(shouldResume);
            };

            const onLocationMaybeChanged = () => {
                if (window.location.href === locationHref) {
                    return;
                }
                locationHref = window.location.href;
                onNavigateFinish();
            };

            document.addEventListener('keydown', onKeyDown);
            document.addEventListener('yt-navigate-finish', onNavigateFinish);
            window.addEventListener('resize', resizeContainerIntoViewport);
            state.locationPollTimer = window.setInterval(onLocationMaybeChanged, 700);

            pageEventCleanup = () => {
                window.clearTimeout(state.navigateTimer);
                state.navigateTimer = 0;
                window.clearInterval(state.locationPollTimer);
                state.locationPollTimer = 0;
                document.removeEventListener('keydown', onKeyDown);
                document.removeEventListener('yt-navigate-finish', onNavigateFinish);
                window.removeEventListener('resize', resizeContainerIntoViewport);
                state.pageEventsBound = false;
                pageEventCleanup = null;
            };
        };

        const destroy = () => {
            pageEventCleanup?.();
        };

        return {
            bindPageEvents,
            destroy
        };
    };
})();
