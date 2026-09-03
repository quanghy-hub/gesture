(() => {
    const ext = globalThis.GestureExtension;
    const videoScreenshot = (ext.videoScreenshot = ext.videoScreenshot || {});
    const floating = ext.shared.floatingCore;

    videoScreenshot.CONFIG = Object.freeze({
        minVideoWidth: 200,
        minVideoHeight: 150,
        shortcutKey: 's',
        regionShortcutCode: 'F4',
        recordShortcutCode: 'F8',
        triggerSize: 46,
        triggerMargin: 12,
        minRegionSize: 8,
        minRecordWidth: 48,
        minRecordHeight: 48,
        recordControlGap: 8,
        recordControlSize: 34,
        recordLabelWidth: 112
    });

    videoScreenshot.ICON = floating.icons.camera;

    videoScreenshot.getDefaultTriggerPosition = () => ({
        left: Math.max(videoScreenshot.CONFIG.triggerMargin, window.innerWidth - videoScreenshot.CONFIG.triggerSize - 18),
        top: Math.max(videoScreenshot.CONFIG.triggerMargin, window.innerHeight - videoScreenshot.CONFIG.triggerSize - 96)
    });

    videoScreenshot.buildFilename = () => {
        const base = ext.shared.domUtils.sanitizeFilename(document.title || 'screenshot') || 'screenshot';
        return `${base}_${Date.now()}.png`;
    };

    videoScreenshot.buildRecordingFilename = () => {
        const base = ext.shared.domUtils.sanitizeFilename(document.title || 'screen-recording') || 'screen-recording';
        return `${base}_${Date.now()}.webm`;
    };

    videoScreenshot.fallbackDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.rel = 'noopener';
        document.body.appendChild(link);
        link.click();
        link.remove();
    };
})();
