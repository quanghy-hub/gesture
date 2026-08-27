/**
 * Tier 2 — Đọc phụ đề OFFLINE bằng VITS vi (transformers.js, chạy trong
 * offscreen page dùng chung với module dịch Bergamot).
 *
 * - Weights (model_quantized ~40–60MB) do transformers.js tự tải từ HuggingFace
 *   CDN lần đầu và cache trong browser Cache API; nút "Xoá" xoá cache đó.
 * - speakLine() được gọi từ content speaker khi engine = 'offline'.
 */
(() => {
    const ext = globalThis.GestureExtension;
    ext.background = ext.background || {};

    const STATE_KEY = 'gestureOfflineTtsState';

    let state = { status: 'idle', progress: 0, label: '', error: '' };
    let readyCache = null;

    chrome.storage.local
        .get(STATE_KEY)
        .then((saved) => {
            if (saved && saved[STATE_KEY]) {
                state = { ...state, ...saved[STATE_KEY] };
                if (state.status === 'downloading') {
                    state = { ...state, status: 'idle', progress: 0 };
                }
            }
        })
        .catch(() => {});

    // Offscreen broadcast tiến độ/tiến trình phát → mirror + chuyển tiếp popup
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === 'gesture-ext/tts-offline-state') {
            const payload = message.payload || {};
            if (payload.status) {
                state = { ...state, ...payload };
                if (state.status === 'ready') {
                    readyCache = true;
                }
                if (state.status === 'error') {
                    readyCache = null;
                }
                chrome.storage.local.set({ [STATE_KEY]: state }).catch(() => {});
            }
            chrome.runtime
                .sendMessage({ type: 'gesture-ext/tts-state', payload: { ...state, playing: !!payload.playing } })
                .catch(() => {});
        }
        return undefined;
    });

    const setState = async (patch) => {
        state = { ...state, ...patch };
        await chrome.storage.local.set({ [STATE_KEY]: state }).catch(() => {});
    };

    async function hasOffscreen() {
        if (chrome.runtime.getContexts) {
            const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
            return contexts.length > 0;
        }
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        return clients.some((client) => client.url.includes('offscreen/engine.html'));
    }

    let creatingOffscreen = null;
    async function ensureOffscreen() {
        if (await hasOffscreen()) {
            return;
        }
        creatingOffscreen =
            creatingOffscreen ||
            chrome.offscreen
                .createDocument({
                    url: 'offscreen/engine.html',
                    reasons: ['WORKERS', 'AUDIO_PLAYBACK'],
                    justification: 'Đọc phụ đề tiếng Việt offline (VITS TTS)'
                })
                .catch((error) => {
                    if (!String(error?.message || '').includes('already exists')) {
                        throw error;
                    }
                })
                .finally(() => {
                    creatingOffscreen = null;
                });
        await creatingOffscreen;
    }

    function sendToEngine(type, payload, timeoutMs = 30000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('TTS engine timeout')), timeoutMs);
            chrome.runtime.sendMessage({ type, payload }, (response) => {
                clearTimeout(timeout);
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    reject(new Error(lastError.message));
                    return;
                }
                if (!response || response.ok === false) {
                    reject(new Error(response?.error || 'TTS engine lỗi'));
                    return;
                }
                resolve(response);
            });
        });
    }

    async function isEnabled() {
        try {
            const config = await ext.shared.storage.getConfig();
            const tts = config?.youtubeSubtitles;
            return !!(tts && tts.ttsEnabled && tts.ttsEngine === 'offline');
        } catch {
            return false;
        }
    }

    async function isReady() {
        if (readyCache !== null) {
            return readyCache;
        }
        // Cache API của extension origin chứa weights sau lần warmup đầu.
        if (!self.caches) {
            return false;
        }
        try {
            const keys = await caches.keys();
            readyCache = keys.some((key) => /transformers/i.test(key));
        } catch {
            readyCache = false;
        }
        return readyCache;
    }

    async function getStatus() {
        const installed = await isReady();
        return { ...state, installed };
    }

    async function warmup() {
        try {
            await setState({ status: 'downloading', progress: 0, label: 'Chuẩn bị…', error: '' });
            await ensureOffscreen();
            await sendToEngine('offline-tts/warmup', {}, 180000);
            readyCache = null;
            await setState({ status: 'ready', progress: 100, label: 'Đã sẵn sàng', error: '' });
            return { ok: true };
        } catch (error) {
            await setState({ status: 'error', error: String(error?.message || error) });
            return { ok: false, error: String(error?.message || error) };
        }
    }

    async function startWarmup() {
        if (warmupChain) {
            return { ok: false, error: 'Đang tải' };
        }
        warmupChain = warmup().finally(() => {
            warmupChain = null;
        });
        return { ok: true, started: true };
    }
    let warmupChain = null;

    async function removeVoice() {
        try {
            await ensureOffscreen();
            await sendToEngine('offline-tts/remove', {}, 15000);
        } catch {
            // Offscreen có thể chưa tồn tại — vẫn dọn state.
        }
        readyCache = null;
        await setState({ status: 'idle', progress: 0, label: '', error: '' });
        return { ok: true };
    }

    /**
     * Tổng hợp offline và trả WAV base64 NGAY TRONG response — content sẽ
     * phát trên trang của nó (có user activation nên không bị autoplay chặn).
     * Lỗi cụ thể được trả qua field error để content/popup hiển thị đúng nguyên nhân.
     */
    let lastSpeakStartedAt = 0;

    /** Đang trong window dubbing (VITS chiếm thread offscreen)? */
    function isRecentlyDubbing() {
        return Date.now() - lastSpeakStartedAt < (ext.youtubeSubtitles?.TTS_DUB_ACTIVE_WINDOW_MS ?? 6000);
    }

    async function speakLine(text) {
        if (!(await isEnabled())) {
            return { ok: false, error: 'TTS đang tắt' };
        }
        if (!(await isReady())) {
            return { ok: false, error: 'Giọng offline chưa sẵn sàng — bấm Tải model' };
        }
        lastSpeakStartedAt = Date.now();
        try {
            await ensureOffscreen();
            // Lần đầu sau khi mở trình duyệt có thể mất vài giây nạp model
            const result = await sendToEngine('offline-tts/synthesize', { text }, 180000);
            return { ok: true, wavBase64: result.wavBase64 };
        } catch (error) {
            const message = String(error?.message || error);
            await setState({ label: `Lỗi TTS: ${message}` }).catch(() => {});
            return { ok: false, error: message };
        }
    }

    async function stopSpeaking() {
        try {
            await ensureOffscreen();
            await sendToEngine('offline-tts/stop', {}, 5000);
        } catch {
            // Bỏ qua.
        }
        return { ok: true };
    }

    ext.background.offlineTts = {
        isEnabled,
        isRecentlyDubbing,
        getStatus,
        startWarmup,
        removeVoice,
        speakLine,
        stopSpeaking
    };
})();
