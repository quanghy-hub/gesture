(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = ext.videoFloating = ext.videoFloating || {};
    videoFloating.core = videoFloating.core || {};

    const viewport = ext?.shared?.viewportCore;
    const touch = ext?.shared?.touchCore;

    const el = (tag, cls, html) => {
        const element = document.createElement(tag);
        if (cls) element.className = cls;
        if (html) element.innerHTML = html;
        return element;
    };

    const $ = (id) => document.getElementById(id);
    
    const getCoord = (event) => touch?.getPrimaryPoint?.(event) || { x: 0, y: 0 };
    
    const formatTime = (seconds) => `${Math.floor(seconds / 60)}.${(Math.floor(seconds) % 60).toString().padStart(2, '0')}`;
    
    const clamp = (value, min, max) => viewport?.clamp?.(value, min, max) ?? Math.max(min, Math.min(max, value));
    
    const getRect = (node) => node?.getBoundingClientRect?.() || { width: 0, height: 0, left: 0, right: 0, top: 0, bottom: 0 };
    
    const queryAllDeep = (selector, root = document) => {
        const results = [];
        const visited = new Set();
        const walk = (currentRoot) => {
            if (!currentRoot || visited.has(currentRoot)) {
                return;
            }
            visited.add(currentRoot);

            if (typeof currentRoot.querySelectorAll === 'function') {
                for (const node of currentRoot.querySelectorAll(selector)) {
                    results.push(node);
                }
                for (const host of currentRoot.querySelectorAll('*')) {
                    if (host.shadowRoot) {
                        walk(host.shadowRoot);
                    }
                }
            }
        };

        walk(root);
        return results;
    };

    const getViewportIntersection = (rect) => {
        if (!rect?.width || !rect?.height) {
            return { area: 0, ratio: 0 };
        }
        const left = Math.max(0, rect.left);
        const right = Math.min(window.innerWidth || 0, rect.right);
        const top = Math.max(0, rect.top);
        const bottom = Math.min(window.innerHeight || 0, rect.bottom);
        const width = Math.max(0, right - left);
        const height = Math.max(0, bottom - top);
        const area = width * height;
        return {
            area,
            ratio: area / Math.max(1, rect.width * rect.height)
        };
    };

    const getViewportCenterDistance = (rect) => {
        const centerX = (window.innerWidth || 0) / 2;
        const centerY = (window.innerHeight || 0) / 2;
        const videoX = rect.left + (rect.width / 2);
        const videoY = rect.top + (rect.height / 2);
        return Math.hypot(videoX - centerX, videoY - centerY);
    };

    const getTopVideoAtPoint = (x, y) => {
        if (typeof document.elementsFromPoint === 'function') {
            for (const node of document.elementsFromPoint(x, y)) {
                if (!(node instanceof Element)) continue;
                const video = (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') ? node : node.closest?.('video, audio');
                if (video?.isConnected && !video.closest('#fvp-wrapper')) return video;
            }
        }
        return null;
    };

    const isPointInFloatingUI = (x, y) => {
        for (const id of ['fvp-container', 'fvp-master-icon', 'fvp-menu']) {
            const node = $(id);
            if (node?.isConnected) {
                const rect = getRect(node);
                if (rect.width > 0 && rect.height > 0 && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                    return true;
                }
            }
        }
        return false;
    };

    const getFullscreenEl = () => document.fullscreenElement || document.webkitFullscreenElement || null;

    videoFloating.core.utils = {
        el,
        $,
        getCoord,
        formatTime,
        clamp,
        getRect,
        queryAllDeep,
        getViewportIntersection,
        getViewportCenterDistance,
        getTopVideoAtPoint,
        isPointInFloatingUI,
        getFullscreenEl
    };
})();
