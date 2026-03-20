(() => {
    const ext = globalThis.GestureExtension;
    const { getForumConfig, updateForumHostConfig, getGestureSettings, applyGestureSettings } = ext.shared.config;
    const storage = ext.shared.storage;

    const hostLabel = document.getElementById('current-host');
    const statusLabel = document.getElementById('status');
    const saveButton = document.getElementById('save-settings');
    const closeButton = document.getElementById('close-popup');
    const forumEnabled = document.getElementById('forum-enabled');
    const forumWide = document.getElementById('forum-wide');
    const forumMinWidth = document.getElementById('forum-min-width');
    const forumGap = document.getElementById('forum-gap');
    const forumFade = document.getElementById('forum-fade');
    const forumDelay = document.getElementById('forum-delay');
    const gesturesEnabled = document.getElementById('gestures-enabled');
    const gLpEnabled = document.getElementById('g-lp-enabled');
    const gLpMode = document.getElementById('g-lp-mode');
    const gLpMs = document.getElementById('g-lp-ms');
    const gRcEnabled = document.getElementById('g-rc-enabled');
    const gRcMode = document.getElementById('g-rc-mode');
    const gDblRightEnabled = document.getElementById('g-dbl-right-enabled');
    const gDblRight = document.getElementById('g-dbl-right');
    const gDblTapEnabled = document.getElementById('g-dbl-tap-enabled');
    const gDblTapMs = document.getElementById('g-dbl-tap-ms');
    const gEdgeEnabled = document.getElementById('g-edge-enabled');
    const gEdgeSide = document.getElementById('g-edge-side');
    const gEdgeWidth = document.getElementById('g-edge-width');
    const gEdgeSpeed = document.getElementById('g-edge-speed');
    const gPagerEnabled = document.getElementById('g-pager-enabled');
    const gPagerHops = document.getElementById('g-pager-hops');
    const hostOnlyRows = Array.from(document.querySelectorAll('.host-only'));
    const hostBoundControls = [forumEnabled, forumWide, forumMinWidth, forumGap, forumFade, forumDelay];

    let activeHost = null;
    let config = null;

    const setStatus = (message, isError = false) => {
        statusLabel.textContent = message;
        statusLabel.style.color = isError ? '#fca5a5' : '#9ca3af';
    };

    const getActiveTab = () => new Promise((resolve) => {
        chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => resolve(tabs?.[0] || null));
    });

    const getHostFromUrl = (url) => {
        try {
            return new URL(url).host;
        } catch {
            return null;
        }
    };

    const setHostControlsState = (enabled) => {
        hostBoundControls.forEach((control) => {
            control.disabled = !enabled;
        });
        hostOnlyRows.forEach((row) => {
            row.style.opacity = enabled ? '1' : '.55';
        });
    };

    const render = () => {
        if (!config) return;

        const gestures = getGestureSettings(config);
        gesturesEnabled.checked = !!gestures.enabled;
        gLpEnabled.checked = !!gestures.longPress.enabled;
        gLpMode.value = gestures.longPress.mode;
        gLpMs.value = gestures.longPress.ms;
        gRcEnabled.checked = !!gestures.rightClick.enabled;
        gRcMode.value = gestures.rightClick.mode;
        gDblRightEnabled.checked = !!gestures.doubleRight.enabled;
        gDblRight.value = gestures.doubleRight.ms;
        gDblTapEnabled.checked = !!gestures.doubleTap.enabled;
        gDblTapMs.value = gestures.doubleTap.ms;
        gEdgeEnabled.checked = !!gestures.edgeSwipe.enabled;
        gEdgeSide.value = gestures.edgeSwipe.side;
        gEdgeWidth.value = gestures.edgeSwipe.width;
        gEdgeSpeed.value = gestures.edgeSwipe.speed;
        gPagerEnabled.checked = !!gestures.pager.enabled;
        gPagerHops.value = gestures.pager.hops;

        if (!activeHost) {
            hostLabel.textContent = 'Không có host hiện tại';
            setHostControlsState(false);
            return;
        }

        const forumConfig = getForumConfig(config, activeHost);
        hostLabel.textContent = activeHost;
        setHostControlsState(true);
        forumEnabled.checked = !!forumConfig.enabled;
        forumWide.checked = !!forumConfig.wide;
        forumMinWidth.value = forumConfig.minWidth;
        forumGap.value = forumConfig.gap;
        forumFade.value = forumConfig.fadeTime;
        forumDelay.value = forumConfig.initDelay;
    };

    const save = async () => {
        if (!config) return;

        const next = applyGestureSettings(ext.shared.config.deepClone(config), {
            enabled: gesturesEnabled.checked,
            longPress: {
                enabled: gLpEnabled.checked,
                mode: gLpMode.value,
                ms: Number(gLpMs.value)
            },
            rightClick: {
                enabled: gRcEnabled.checked,
                mode: gRcMode.value
            },
            doubleRight: {
                enabled: gDblRightEnabled.checked,
                ms: Number(gDblRight.value)
            },
            doubleTap: {
                enabled: gDblTapEnabled.checked,
                ms: Number(gDblTapMs.value)
            },
            edgeSwipe: {
                enabled: gEdgeEnabled.checked,
                side: gEdgeSide.value,
                width: Number(gEdgeWidth.value),
                speed: Number(gEdgeSpeed.value)
            },
            pager: {
                enabled: gPagerEnabled.checked,
                hops: Number(gPagerHops.value)
            }
        });

        let normalized = next;
        if (activeHost) {
            normalized = updateForumHostConfig(next, activeHost, {
                enabled: forumEnabled.checked,
                wide: forumWide.checked,
                minWidth: Number(forumMinWidth.value),
                gap: Number(forumGap.value),
                fadeTime: Number(forumFade.value),
                initDelay: Number(forumDelay.value)
            });
        }

        config = await storage.saveConfig(normalized);
        render();
        setStatus('Đã lưu cấu hình.');
    };

    Promise.all([storage.getConfig(), getActiveTab()]).then(([loadedConfig, activeTab]) => {
        config = loadedConfig;
        activeHost = getHostFromUrl(activeTab?.url || '');
        render();
        setStatus('Sẵn sàng.');
    }).catch((error) => {
        console.error('[GestureExtension][popup] init failed', error);
        setStatus(error?.message || 'Lỗi context/runtime.', true);
    });

    saveButton.addEventListener('click', () => {
        save().catch((error) => {
            console.error('[GestureExtension][popup] save failed', error);
            setStatus(error?.message || 'Không lưu được cấu hình.', true);
        });
    });

    closeButton.addEventListener('click', () => {
        window.close();
    });
})();
