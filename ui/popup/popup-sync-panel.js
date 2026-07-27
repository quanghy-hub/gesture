(() => {
    const ext = globalThis.GestureExtension;
    const { normalizeConfig, deepClone, DEFAULT_CONFIG } = ext.shared.config;
    const storage = ext.shared.storage;
    const cloudflareSync = ext.shared.cloudflareSync;
    const { safeGetElementById } = ext.ui.popupUtils;

    // Sync panel elements
    const backupWorkerUrl = safeGetElementById('backup-worker-url');
    const backupApiCode = safeGetElementById('backup-api-code');
    const profileMacbook = safeGetElementById('profile-macbook');
    const profileMobile = safeGetElementById('profile-mobile');
    const backupVerify = safeGetElementById('backup-verify');
    const backupPush = safeGetElementById('backup-push');
    const backupPull = safeGetElementById('backup-pull');
    const backupStatus = safeGetElementById('backup-status');

    const setBackupStatus = (message, type = '') => {
        if (!backupStatus) return;
        backupStatus.textContent = message;
        backupStatus.className = `section-note backup-status${type ? ` ${type}` : ''}`;
        storage
            .setLocal({
                [cloudflareSync.KEYS.status]: message,
                [cloudflareSync.KEYS.statusType]: type
            })
            .catch((error) => {
                console.error('[GestureExtension][popup] Failed to persist sync status', error);
            });
    };

    const loadBackupStatus = async () => {
        const result = await storage.getLocal([cloudflareSync.KEYS.status, cloudflareSync.KEYS.statusType]);
        if (result[cloudflareSync.KEYS.status]) {
            backupStatus.textContent = result[cloudflareSync.KEYS.status];
            backupStatus.className = `section-note backup-status${result[cloudflareSync.KEYS.statusType] ? ` ${result[cloudflareSync.KEYS.statusType]}` : ''}`;
        }
    };

    const formatSyncStamp = (date = new Date()) =>
        date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });

    const syncStatusSuffix = (revision) => `revision ${Number.isSafeInteger(revision) ? revision : 0} · ${formatSyncStamp()}`;

    const getSyncSettingsFromControls = () => ({
        workerUrl: backupWorkerUrl.value.trim(),
        apiCode: backupApiCode.value.trim(),
        profile: profileMobile.checked ? 'mobile' : 'macbook'
    });

    const renderSyncSettings = (settings) => {
        backupWorkerUrl.value = settings.workerUrl || cloudflareSync.DEFAULT_WORKER_URL;
        backupApiCode.value = settings.apiCode || '';
        if (settings.profile === 'mobile') {
            profileMobile.checked = true;
        } else {
            profileMacbook.checked = true;
        }
    };

    const saveSyncSettingsFromControls = async (patch = {}) => {
        const next = await cloudflareSync.saveSettings({
            ...getSyncSettingsFromControls(),
            ...patch
        });
        renderSyncSettings(next);
        return next;
    };

    /**
     * Wire all sync panel event listeners.
     * @param {object} deps
     * @param {() => object|null} deps.getConfig — returns current config
     * @param {(config: object) => void} deps.setConfig — updates config state
     * @param {() => void} deps.render — re-renders the entire popup
     * @param {() => Promise|null} deps.getPendingSave — returns pending save promise if any
     * @returns {{ renderSyncSettings, loadBackupStatus }}
     */
    const initSyncPanel = ({ getConfig, setConfig, render, getPendingSave }) => {
        const switchProfile = async (nextProfileId) => {
            const config = getConfig();
            if (!config || !nextProfileId) return;
            try {
                const syncSettings = await cloudflareSync.loadSettings();
                const currentProfile = syncSettings.profile;
                if (currentProfile === nextProfileId) return;
                await cloudflareSync.saveSettings({ profile: nextProfileId });

                const result = await storage.getLocal(['gestureSyncProfiles']);
                const profiles = result.gestureSyncProfiles || {};

                profiles[currentProfile] = {
                    settings: {
                        schema: 1,
                        config: deepClone(config)
                    }
                };

                const targetProfile = profiles[nextProfileId];
                let nextConfig;
                if (targetProfile?.settings?.config) {
                    nextConfig = normalizeConfig(targetProfile.settings.config);
                } else {
                    nextConfig = normalizeConfig(DEFAULT_CONFIG);
                }

                await storage.setLocal({
                    gestureSyncProfile: nextProfileId,
                    gestureSyncProfiles: profiles
                });

                setConfig(await storage.saveConfig(nextConfig));

                const nextSyncSettings = await cloudflareSync.loadSettings();
                renderSyncSettings(nextSyncSettings);
                render();

                setBackupStatus(`Switched to active profile: ${nextProfileId === 'mobile' ? 'Mobile' : 'MacBook'}`);
            } catch (error) {
                console.error('[GestureExtension][popup] Failed to switch profile', error);
                setBackupStatus(`Failed to switch profile: ${error.message}`, 'err');
            }
        };

        // Worker URL input
        backupWorkerUrl?.addEventListener('input', () => {
            saveSyncSettingsFromControls().catch((error) => {
                setBackupStatus(`Error saving Worker URL: ${error.message}`, 'err');
            });
        });

        // API code input
        backupApiCode?.addEventListener('input', () => {
            saveSyncSettingsFromControls().catch((error) => {
                setBackupStatus(`Error saving API code: ${error.message}`, 'err');
            });
        });

        // Profile radio buttons
        profileMacbook?.addEventListener('change', () => {
            if (profileMacbook.checked) {
                switchProfile('macbook');
            }
        });

        profileMobile?.addEventListener('change', () => {
            if (profileMobile.checked) {
                switchProfile('mobile');
            }
        });

        // Verify button
        backupVerify?.addEventListener('click', async () => {
            backupVerify.disabled = true;
            setBackupStatus('Verifying Worker connection...');
            try {
                await saveSyncSettingsFromControls();
                const result = await cloudflareSync.bootstrapProfile(getSyncSettingsFromControls());
                if (result.config) {
                    setConfig(result.config);
                    render();
                }
                setBackupStatus(
                    `${result.action === 'pulled' ? 'Pulled cloud profile' : 'Connected to Worker'} · ${syncStatusSuffix(result.state.revision)}`,
                    'ok'
                );
            } catch (error) {
                setBackupStatus(`Connection failed: ${error.message}`, 'err');
            } finally {
                backupVerify.disabled = false;
            }
        });

        // Push button
        backupPush?.addEventListener('click', async () => {
            backupPush.disabled = true;
            setBackupStatus('Pushing to cloud...');
            try {
                await saveSyncSettingsFromControls();
                const pending = getPendingSave();
                if (pending) {
                    await pending;
                }
                const remote = await cloudflareSync.pushConfig(normalizeConfig(getConfig()), getSyncSettingsFromControls());
                setBackupStatus(`Push succeeded · ${syncStatusSuffix(remote.revision)}`, 'ok');
            } catch (error) {
                setBackupStatus(`Push failed: ${error.message}`, 'err');
            } finally {
                backupPush.disabled = false;
            }
        });

        // Pull button
        backupPull?.addEventListener('click', async () => {
            backupPull.disabled = true;
            setBackupStatus('Pulling from cloud...');
            try {
                await saveSyncSettingsFromControls();
                const result = await cloudflareSync.pullConfig(getSyncSettingsFromControls());
                setConfig(result.config);
                render();
                setBackupStatus(`Pull succeeded · ${syncStatusSuffix(result.state.revision)}`, 'ok');
            } catch (error) {
                setBackupStatus(`Pull failed: ${error.message}`, 'err');
            } finally {
                backupPull.disabled = false;
            }
        });

        return { renderSyncSettings, loadBackupStatus };
    };

    ext.ui = ext.ui || {};
    ext.ui.popupSyncPanel = { initSyncPanel };
})();
