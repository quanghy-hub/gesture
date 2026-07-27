(() => {
    const ext = globalThis.GestureExtension;
    const videoFloating = (ext.videoFloating = ext.videoFloating || {});
    videoFloating.interactions = videoFloating.interactions || {};

    const targetFinder = videoFloating.interactions.createVideoTargetFinder();
    const noticeUI = videoFloating.interactions.createSeekNoticeUI();

    videoFloating.interactions.installTouchSwipeSeek = videoFloating.interactions.createTouchSwipeSeek(targetFinder, noticeUI).install;
    videoFloating.interactions.installWheelKeyboardSeek = videoFloating.interactions.createWheelKeyboardSeek(
        targetFinder,
        noticeUI
    ).install;
})();
