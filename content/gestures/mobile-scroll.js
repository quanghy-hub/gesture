(() => {
    const ext = globalThis.GestureExtension;
    ext.gestures = ext.gestures || {};

    const clampScrollTop = (value, element) => Math.max(0, Math.min(value, element.scrollHeight - element.clientHeight));

    const getEdgeStrength = (x, widthConfig, sideConfig) => {
        const width = Math.max(widthConfig, 1);

        if (sideConfig === 'left') {
            return Math.max(0, 1 - x / width);
        }
        if (sideConfig === 'right') {
            return Math.max(0, 1 - (innerWidth - x) / width);
        }

        if (x <= width) {
            return Math.max(0, 1 - x / width);
        }
        if (x >= innerWidth - width) {
            return Math.max(0, 1 - (innerWidth - x) / width);
        }
        return 0;
    };

    const createScrollManager = (state) => {
        const requestEdgeRender = () => {
            if (state.edge.renderRAF) return;

            const step = (time) => {
                const element = document.scrollingElement || document.documentElement;
                const target = clampScrollTop(state.edge.targetScrollTop, element);
                const current = element.scrollTop;
                const delta = target - current;

                if (Math.abs(delta) < 0.5) {
                    if (current !== target) {
                        element.scrollTop = target;
                    }
                    state.edge.renderRAF = null;
                    state.edge.renderTime = 0;
                    return;
                }

                const deltaTime = state.edge.renderTime ? Math.min(Math.max(time - state.edge.renderTime, 8), 32) : 16;
                state.edge.renderTime = time;
                const follow = state.edge.active ? 0.95 : 0.35;
                const maxStep = Math.max(12, deltaTime * 2.8);
                const next =
                    current + Math.sign(delta) * Math.min(Math.abs(delta) * follow, Math.abs(delta), maxStep + Math.abs(delta) * 0.25);
                element.scrollTop = next;
                state.edge.renderRAF = requestAnimationFrame(step);
            };

            state.edge.renderRAF = requestAnimationFrame(step);
        };

        const stopEdgeRender = () => {
            cancelAnimationFrame(state.edge.renderRAF);
            state.edge.renderRAF = null;
            state.edge.renderTime = 0;
        };

        const stopMomentum = () => {
            cancelAnimationFrame(state.momentumRAF);
            state.momentumRAF = null;
            state.momentumTime = 0;
        };

        const startMomentum = (velocity) => {
            stopMomentum();
            stopEdgeRender();
            const element = document.scrollingElement || document.documentElement;
            const decayPerFrame = 0.94;
            const minVelocity = 8;

            const step = (time) => {
                const deltaTime = state.momentumTime ? Math.min(Math.max(time - state.momentumTime, 8), 34) : 16;
                state.momentumTime = time;
                const decay = Math.pow(decayPerFrame, deltaTime / 16);
                velocity *= decay;
                if (Math.abs(velocity) < minVelocity) {
                    state.momentumRAF = null;
                    state.momentumTime = 0;
                    return;
                }
                const previous = element.scrollTop;
                element.scrollTop = clampScrollTop(previous + (velocity * deltaTime) / 1000, element);
                if (element.scrollTop === previous) {
                    state.momentumRAF = null;
                    state.momentumTime = 0;
                    return;
                }
                state.momentumRAF = requestAnimationFrame(step);
            };

            state.momentumRAF = requestAnimationFrame(step);
        };

        return {
            requestEdgeRender,
            stopEdgeRender,
            startMomentum,
            stopMomentum
        };
    };

    ext.gestures.mobileScroll = {
        clampScrollTop,
        getEdgeStrength,
        createScrollManager
    };
})();
