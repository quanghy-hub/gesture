(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    videoFloating.interactions.createSeekNoticeUI = () => {
        let noticeEl = null;
        let hideTimer = 0;

        const ensureNotice = (video) => {
            if (!video) return null;
            const fs = videoFloating.core.utils.getFullscreenEl();
            const container =
                video instanceof Element && fs && (fs === video || fs.contains(video))
                    ? fs
                    : video.parentElement || document.body;
            if (!noticeEl || !container.contains(noticeEl)) {
                noticeEl?.remove();
                noticeEl = document.createElement('div');
                noticeEl.className = 'vf-notice';
                if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
                container.appendChild(noticeEl);
            }
            noticeEl.style.fontSize = `${videoFloating.core.config.getFeatureConfig().noticeFontSize}px`;
            return noticeEl;
        };

        const showSeekNotice = (video, delta) => {
            const notice = ensureNotice(video);
            if (!notice) return;
            notice.textContent = `${delta >= 0 ? '▶ +' : '◀ '}${delta}s`;
            notice.classList.add('show');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(() => notice.classList.remove('show'), 700);
        };

        return {
            showSeekNotice
        };
    };
})();
