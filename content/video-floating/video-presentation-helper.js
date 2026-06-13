(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};

    const originalVideoStyles = new WeakMap();

    const captureVideoPresentation = (video) => {
        if (video && !originalVideoStyles.has(video)) {
            originalVideoStyles.set(video, video.getAttribute('style'));
        }
    };

    const resetVideoPresentation = (video) => {
        if (!video) return;
        Object.assign(video.style, {
            width: '',
            height: '',
            objectFit: '',
            objectPosition: '',
            transform: '',
            transition: ''
        });
    };

    const restoreVideoPresentation = (video) => {
        if (!video) return;
        if (!originalVideoStyles.has(video)) {
            resetVideoPresentation(video);
            return;
        }
        const originalStyle = originalVideoStyles.get(video);
        if (originalStyle === null) {
            video.removeAttribute('style');
        } else {
            video.setAttribute('style', originalStyle);
        }
        originalVideoStyles.delete(video);
    };

    const restoreVideoNode = (video, parent, placeholder) => {
        if (!video) return false;
        if (parent?.isConnected) {
            if (placeholder?.parentNode === parent) {
                parent.replaceChild(video, placeholder);
            } else {
                parent.appendChild(video);
            }
            return true;
        }
        if (placeholder?.parentNode) {
            placeholder.parentNode.replaceChild(video, placeholder);
            return true;
        }
        video.remove();
        return false;
    };

    const createTransitionLayer = (video, className, el) => {
        if (!video) return null;
        const layer = el('div', `fvp-transition-layer ${className}`);
        layer.appendChild(video);
        return layer;
    };

    videoFloating.presentationHelper = {
        captureVideoPresentation,
        resetVideoPresentation,
        restoreVideoPresentation,
        restoreVideoNode,
        createTransitionLayer
    };
})();
