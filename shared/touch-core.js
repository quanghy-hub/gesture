(() => {
    const ext = globalThis.GestureExtension;
    const uiGuard = ext.shared.extensionUiGuard;

    const getPrimaryPoint = (event) => {
        const point = event?.touches?.[0] || event?.changedTouches?.[0] || event;
        return point ? { x: point.clientX, y: point.clientY } : { x: 0, y: 0 };
    };

    const getDistance = (pointA, pointB) => Math.hypot((pointA?.x || 0) - (pointB?.x || 0), (pointA?.y || 0) - (pointB?.y || 0));

    const isTouchLikeEvent = (event) => !!(event?.touches || event?.changedTouches);

    const preventCancelable = (event) => {
        if (event?.cancelable) {
            event.preventDefault();
        }
    };

    const isExtensionUiTarget = (eventOrTarget, extraSelectors = []) => uiGuard?.isExtensionUiTarget?.(eventOrTarget, extraSelectors) || false;

    const createLongPress = () => {
        let timer = 0;
        let active = false;

        return {
            start(delay, callback) {
                this.cancel();
                active = true;
                timer = window.setTimeout(() => {
                    if (!active) return;
                    active = false;
                    timer = 0;
                    callback?.();
                }, delay);
            },
            cancel() {
                if (timer) {
                    window.clearTimeout(timer);
                    timer = 0;
                }
                active = false;
            },
            isActive() {
                return active;
            }
        };
    };

    ext.shared.touchCore = {
        createLongPress,
        getDistance,
        getPrimaryPoint,
        isExtensionUiTarget,
        isTouchLikeEvent,
        preventCancelable,
        BASE_EXTENSION_UI_SELECTORS: uiGuard?.BASE_EXTENSION_UI_SELECTORS || []
    };
})();
