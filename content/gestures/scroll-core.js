(() => {
    const ext = globalThis.GestureExtension;
    const gestures = ext.gestures = ext.gestures || {};

    const DEFAULT_FAST_SCROLL = Object.freeze({
        step: 0.92,
        wheelZone: 80,
        wheelMinDelta: 10
    });

    const numberOr = (value, fallback) => {
        const number = Number(value);
        return Number.isFinite(number) ? number : fallback;
    };

    const getFastScroll = (config = {}) => {
        const fastScroll = config.fastScroll || {};
        return {
            enabled: fastScroll.enabled !== false,
            step: numberOr(fastScroll.step, DEFAULT_FAST_SCROLL.step),
            wheelZone: numberOr(fastScroll.wheelZone, DEFAULT_FAST_SCROLL.wheelZone)
        };
    };

    const getRightZoneWidth = (viewportWidth, config) => {
        const settings = getFastScroll(config);
        return Math.min(viewportWidth, settings.wheelZone);
    };

    const getWheelDeltaPixels = (event) => {
        const delta = Number(event?.deltaY) || 0;
        if (event?.deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 16;
        if (event?.deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * Math.max(1, innerHeight);
        return delta;
    };

    const hasVerticalWheelIntent = (event) => {
        const absX = Math.abs(Number(event?.deltaX) || 0);
        const absY = Math.abs(getWheelDeltaPixels(event));
        return absY >= DEFAULT_FAST_SCROLL.wheelMinDelta && absY > absX * 1.15;
    };

    const getFastScrollStepPixels = (viewportHeight, config) => {
        const settings = getFastScroll(config);
        return Math.max(120, Math.round(viewportHeight * settings.step));
    };

    gestures.scrollCore = {
        DEFAULT_FAST_SCROLL,
        getFastScroll,
        getRightZoneWidth,
        getWheelDeltaPixels,
        getFastScrollStepPixels,
        hasVerticalWheelIntent
    };
})();
