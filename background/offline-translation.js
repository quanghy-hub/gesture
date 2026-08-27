/**
 * Dịch offline bằng Bergamot WASM.
 *
 * - Engine WASM + models KHÔNG nằm trong repo: tải về lần đầu khi người dùng
 *   bật tính năng, lưu IndexedDB (permission unlimitedStorage).
 * - Nguồn model chính thức của Firefox Translations (GCS công khai), engine từ
 *   release browsermt/bergamot-translator v0.4.5.
 * - Hỗ trợ cặp: en→vi (base-memory). Cặp khác rơi về online.
 * - Tách ORT wasm của TTS ra khỏi REQUIRED_KEYS để dịch không bị chặn bởi TTS.
 */
(() => {
    const ext = globalThis.GestureExtension;
    ext.background = ext.background || {};

    const STATE_KEY = 'gestureOfflineTranslationState';

    const ENGINE_BASE = 'https://github.com/browsermt/bergamot-translator/releases/download/v0.4.5';
    const MODEL_BASE = 'https://storage.googleapis.com/moz-fx-translations-data--303e-prod-translations-data';

    const TRANSLATE_ENGINE_FILES = [
        { key: 'engine.glue', url: `${ENGINE_BASE}/bergamot-translator-worker.js`, label: 'Glue JS', gz: false, isText: true },
        { key: 'engine.wasm', url: `${ENGINE_BASE}/bergamot-translator-worker.wasm`, label: 'Engine WASM (~5MB)', gz: false }
    ];

    // ORT wasm cho TTS được cache chung DB nhưng KHÔNG chặn isReady của dịch.
    // Để dịch offline sẵn sàng ngay cả khi TTS chưa tải.
    const TTS_ORT_FILE = {
        key: 'tts:ortwasm',
        url: 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/ort-wasm.wasm',
        label: 'ORT runtime (~9MB)',
        gz: false
    };

    // Các cặp ngôn ngữ: đường dẫn export trong registry của Mozilla
    // LƯU Ý: chỉ giữ en→vi. Chiều vi→en đã thử nhưng bỏ — để đường online
    // xử lý (resolvePair sẽ trả null khi không có entry trong PAIRS).
    const PAIRS = {
        'en-vi': {
            sourceLanguage: 'en',
            targetLanguage: 'vi',
            exportDir: '/models/en-vi/test_prompsit_Ep8JhBQ3QRizDT91JVy8KQ/exported',
            filePrefix: 'envi',
            modelSha256: '04fa6044593a404c2aa02b3096f203880852df6f8f41e5eb966ed9f2b4366737'
        }
    };

    function buildDownloadPlan() {
        const items = [...TRANSLATE_ENGINE_FILES, TTS_ORT_FILE];
        Object.entries(PAIRS).forEach(([pairKey, pair]) => {
            items.push(
                {
                    key: `${pairKey}:model`,
                    url: `${MODEL_BASE}${pair.exportDir}/model.${pair.filePrefix}.intgemm.alphas.bin.gz`,
                    label: `Model ${pair.sourceLanguage}→${pair.targetLanguage}`,
                    gz: true,
                    sha256: pair.modelSha256
                },
                {
                    key: `${pairKey}:lex`,
                    url: `${MODEL_BASE}${pair.exportDir}/lex.50.50.${pair.filePrefix}.s2t.bin.gz`,
                    label: `Lexicon ${pair.sourceLanguage}→${pair.targetLanguage}`,
                    gz: true
                },
                {
                    key: `${pairKey}:vocab`,
                    url: `${MODEL_BASE}${pair.exportDir}/vocab.${pair.filePrefix}.spm.gz`,
                    label: `Vocab ${pair.sourceLanguage}→${pair.targetLanguage}`,
                    gz: true
                }
            );
        });
        return items;
    }

    const DOWNLOAD_PLAN = buildDownloadPlan();
    // isReady chỉ cần engine dịch + model, không đợi ORT của TTS
    const TRANSLATE_REQUIRED_KEYS = [
        ...TRANSLATE_ENGINE_FILES.map((item) => item.key),
        ...Object.keys(PAIRS).flatMap((pairKey) => [`${pairKey}:model`, `${pairKey}:lex`, `${pairKey}:vocab`])
    ];
    const TOTAL_STEPS = DOWNLOAD_PLAN.length;

    // Cấu hình decoder copy nguyên văn từ demo Mozilla (khoảng cách có ý nghĩa)
    const MODEL_CONFIG = `beam-size: 1
normalize: 1.0
word-penalty: 0
max-length-break: 128
mini-batch-words: 1024
workspace: 128
max-length-factor: 2.0
skip-cost: true
cpu-threads: 0
quiet: true
quiet-translation: true
gemm-precision: int8shiftAll
`;

    let state = { status: 'idle', step: 0, totalSteps: TOTAL_STEPS, label: '', error: '' };
    let readyCache = null;
    let downloadChain = null;

    // SW có thể bị kill/restart bất kỳ lúc nào: nạp lại trạng thái đã lưu để
    // popup không hiện sai (vd "idle" trong khi model đã sẵn sàng).
    // Nếu crash giữa downloading → reset về idle để popup không kẹt.
    chrome.storage.local
        .get(STATE_KEY)
        .then((saved) => {
            if (saved && saved[STATE_KEY]) {
                state = { ...state, ...saved[STATE_KEY] };
                if (state.status === 'downloading') {
                    state = { ...state, status: 'idle', label: '', error: '' };
                }
            }
        })
        .catch(() => {});

    async function computeInstalled() {
        try {
            return await isReady();
        } catch {
            return false;
        }
    }

    async function broadcastState() {
        // Broadcast PHẢI kèm `installed` — nếu không, bản cập nhật cuối cùng
        // (sau khi tải xong) sẽ ghi đè UI thành "Chưa có model".
        const installed = await computeInstalled();
        const status = state.status === 'idle' && installed ? 'ready' : state.status;
        chrome.runtime.sendMessage({ type: 'gesture-ext/offline-state', payload: { ...state, status, installed } }).catch(() => {});
    }

    const persistState = async () => {
        await chrome.storage.local.set({ [STATE_KEY]: state });
        broadcastState();
    };

    const setState = async (patch) => {
        state = { ...state, ...patch };
        await persistState();
    };

    // ---- IndexedDB helpers (dùng shared/offline-store.js nếu có) ---------------
    const store = ext.shared.offlineStore;

    function openDb() {
        if (store?.openDb) return store.openDb();
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('gesture-offline-translate-v1', 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains('files')) {
                    req.result.createObjectStore('files');
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbPut(key, buffer) {
        if (store?.idbPut) return store.idbPut(key, buffer);
        return openDb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction('files', 'readwrite');
                    tx.objectStore('files').put(buffer, key);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                })
        );
    }

    function idbGet(key) {
        if (store?.idbGet) return store.idbGet(key);
        return openDb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const req = db.transaction('files', 'readonly').objectStore('files').get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => reject(req.error);
                })
        );
    }

    function idbDelete(key) {
        if (store?.idbDelete) return store.idbDelete(key);
        return openDb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction('files', 'readwrite');
                    tx.objectStore('files').delete(key);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                })
        );
    }

    // ---- Tiện ích -------------------------------------------------------------
    async function sha256Hex(buffer) {
        if (store?.sha256Hex) return store.sha256Hex(buffer);
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    async function gunzipIfNeeded(buffer, isGz) {
        if (store?.gunzipIfNeeded) return store.gunzipIfNeeded(buffer, isGz);
        if (!isGz) {
            return buffer;
        }
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('Trình duyệt không hỗ trợ DecompressionStream (cần Chromium ≥ 80)');
        }
        const stream = new Response(buffer).body.pipeThrough(new DecompressionStream('gzip'));
        return new Response(stream).arrayBuffer();
    }

    async function fetchBuffer(url) {
        if (store?.fetchBuffer) return store.fetchBuffer(url);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} — ${url}`);
        }
        return response.arrayBuffer();
    }

    // ---- Offscreen document (desktop) -----------------------------------------
    let creatingOffscreen = null;

    async function hasOffscreen() {
        if (chrome.runtime.getContexts) {
            const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
            return contexts.length > 0;
        }
        const clients = await self.clients.matchAll({ includeUncontrolled: true });
        return clients.some((client) => client.url.includes('offscreen/engine.html'));
    }

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
                    justification: 'Chạy mô hình dịch offline Bergamot WASM và đọc phụ đề offline (TTS)'
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

    function sendToEngine(type, payload, timeoutMs = 20000) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Offline engine timeout')), timeoutMs);
            chrome.runtime.sendMessage({ type, payload }, (response) => {
                clearTimeout(timeout);
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    reject(new Error(lastError.message));
                    return;
                }
                if (!response || response.ok === false) {
                    reject(new Error(response?.error || 'Offline engine lỗi'));
                    return;
                }
                resolve(response);
            });
        });
    }

    // ---- Host dự phòng cho MOBILE (Kiwi/Chromium Android): không có
    // chrome.offscreen → chạy thẳng engine trong Service Worker thread.
    /* global importScripts */
    let swLoadPromises = new Map();
    let swService = null;
    const swModels = new Map();

    function swPrepareAligned(buffer, alignment) {
        const byteArray = new Int8Array(buffer);
        const aligned = new self.Module.AlignedMemory(byteArray.byteLength, alignment);
        aligned.getByteArrayView().set(byteArray);
        return aligned;
    }

    async function ensureSwRuntime() {
        if (swService) {
            return;
        }
        const [glueBuf, wasmBytes] = await Promise.all([idbGet('engine.glue'), idbGet('engine.wasm')]);
        if (!glueBuf || !wasmBytes) {
            throw new Error('Thiếu engine offline trong IndexedDB');
        }
        const glueText = typeof glueBuf === 'string' ? glueBuf : new TextDecoder().decode(glueBuf);
        const glueUrl = URL.createObjectURL(new Blob([glueText], { type: 'text/javascript' }));
        self.Module = { wasmBinary: wasmBytes, print() {}, printErr() {} };
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('SW WASM init timeout')), 30000);
            self.Module.onRuntimeInitialized = () => {
                clearTimeout(timeout);
                resolve();
            };
            importScripts(glueUrl);
        });
        URL.revokeObjectURL(glueUrl);
        swService = new self.Module.BlockingService({ cacheSize: 64 });
    }

    async function ensureSwModel(pairKey) {
        if (swModels.has(pairKey)) {
            return swModels.get(pairKey);
        }
        const existing = swLoadPromises.get(pairKey);
        if (existing) {
            return existing;
        }
        const loadPromise = (async () => {
            await ensureSwRuntime();
            const [modelBytes, lexBuf, vocabBuf] = await Promise.all([
                idbGet(`${pairKey}:model`),
                idbGet(`${pairKey}:lex`),
                idbGet(`${pairKey}:vocab`)
            ]);
            if (!modelBytes || !lexBuf || !vocabBuf) {
                throw new Error(`Thiếu model ${pairKey}`);
            }
            const alignedModel = swPrepareAligned(modelBytes, 256);
            const alignedShortlist = swPrepareAligned(lexBuf, 64);
            const alignedVocabs = new self.Module.AlignedMemoryList();
            alignedVocabs.push_back(swPrepareAligned(vocabBuf, 64));
            const model = new self.Module.TranslationModel(MODEL_CONFIG, alignedModel, alignedShortlist, alignedVocabs, null);
            swModels.set(pairKey, model);
            return model;
        })().catch((error) => {
            swLoadPromises.delete(pairKey);
            throw error;
        });
        swLoadPromises.set(pairKey, loadPromise);
        return loadPromise;
    }

    function translateInSw(pairKey, text) {
        const model = swModels.get(pairKey);
        const input = new self.Module.VectorString();
        const options = new self.Module.VectorResponseOptions();
        input.push_back(String(text || ''));
        try {
            const results = swService.translate(model, input, options);
            const out = results.size() > 0 ? String(results.get(0).getTranslatedText() || '') : '';
            results.delete();
            return out.trim();
        } finally {
            input.delete();
            options.delete();
        }
    }

    // ---- API công khai ------------------------------------------------------------
    function normalizeLang(lang) {
        return String(lang || '')
            .trim()
            .split(/[-_]/)[0]
            .toLowerCase();
    }

    /**
     * Chọn cặp model theo (nguồn, đích):
     *   đích vi → en-vi; nguồn vi + đích en → vi-en; còn lại null (dùng online).
     */
    function resolvePair(sourceLanguage, targetLanguage) {
        const trg = normalizeLang(targetLanguage);
        const src = normalizeLang(sourceLanguage);
        if (trg === 'vi' && PAIRS['en-vi']) {
            return 'en-vi';
        }
        if (trg === 'en' && src === 'vi' && PAIRS['vi-en']) {
            return 'vi-en';
        }
        return null;
    }

    async function isEnabled() {
        try {
            const config = await ext.shared.storage.getConfig();
            return !!(config && config.offlineTranslation && config.offlineTranslation.enabled);
        } catch {
            return false;
        }
    }

    async function isReady() {
        if (readyCache !== null) {
            return readyCache;
        }
        const files = await Promise.all(TRANSLATE_REQUIRED_KEYS.map((key) => idbGet(key)));
        readyCache = files.every((file) => !!file);
        return readyCache;
    }

    function isPairSupported(sourceLanguage, targetLanguage) {
        return resolvePair(sourceLanguage, targetLanguage) !== null;
    }

    async function getStatus() {
        const installed = await computeInstalled();
        const host = typeof chrome.offscreen?.createDocument === 'function' ? 'offscreen' : 'service-worker';
        return { ...state, status: state.status === 'idle' && installed ? 'ready' : state.status, installed, host };
    }

    async function startDownload() {
        if (downloadChain) {
            return { ok: false, error: 'Đang tải' };
        }
        downloadChain = (async () => {
            try {
                await setState({ status: 'downloading', step: 0, totalSteps: TOTAL_STEPS, label: '', error: '' });
                for (let index = 0; index < DOWNLOAD_PLAN.length; index += 1) {
                    const item = DOWNLOAD_PLAN[index];
                    // Đã có trong IndexedDB từ lần tải trước → bỏ qua
                    if (await idbGet(item.key)) {
                        continue;
                    }
                    await setState({ step: index, label: `Đang tải ${item.label}…` });
                    const compressed = await fetchBuffer(item.url);
                    const raw = await gunzipIfNeeded(compressed, item.gz);
                    if (item.sha256 && (await sha256Hex(raw)) !== item.sha256) {
                        throw new Error(`Checksum sai cho ${item.label}`);
                    }
                    await idbPut(item.key, item.isText ? new TextDecoder().decode(raw) : raw);
                }
                readyCache = null;
                await setState({ status: 'ready', step: TOTAL_STEPS, label: 'Đã sẵn sàng', error: '' });
                return { ok: true };
            } catch (error) {
                await setState({ status: 'error', error: String(error?.message || error) });
                return { ok: false, error: String(error?.message || error) };
            } finally {
                downloadChain = null;
            }
        })();
        return downloadChain;
    }

    async function removeModel() {
        // Chỉ xoá file dịch, giữ ORT wasm cho TTS nếu user chỉ muốn xoá dịch
        await Promise.all(TRANSLATE_REQUIRED_KEYS.map((key) => idbDelete(key)));
        readyCache = null;
        swModels.clear();
        await setState({ status: 'idle', step: 0, label: '', error: '' });
        return { ok: true };
    }

    /**
     * Router dịch: trả text nếu dịch offline thành công, ngược lại null để
     * caller rơi về đường online. Không bao giờ throw ra ngoài.
     */
    async function tryTranslate({ text, sourceLanguage, targetLanguage }) {
        try {
            const pairKey = resolvePair(sourceLanguage, targetLanguage);
            if (!text || !pairKey || !(await isReady())) {
                return null;
            }
            const ttsApi = ext.background.offlineTts;
            // Đang dubbing bằng VITS (chiếm thread offscreen) → nhường ngay,
            // dùng online để dòng dịch không bị trễ tích luỹ.
            if (ttsApi?.isRecentlyDubbing?.()) {
                return null;
            }
            if (typeof chrome.offscreen?.createDocument === 'function') {
                await ensureOffscreen();
                const translatePromise = (async () => {
                    const load = await sendToEngine('offline-engine/load', { pair: pairKey }, 30000);
                    if (!load?.ok) {
                        return null;
                    }
                    const response = await sendToEngine('offline-engine/translate', { text, pair: pairKey }, 10000);
                    return String(response?.text || '').trim() || null;
                })();
                // Ngân sách nhanh: quá hạn → trả null cho caller rơi về online;
                // kết quả offline tới muộn vẫn chạy hết nhưng bị bỏ qua.
                const budget = ext.youtubeSubtitles?.OFFLINE_TRANSLATE_FAST_BUDGET_MS ?? 1200;
                const guarded = translatePromise.catch(() => null);
                let timedOut = false;
                const winner = await Promise.race([
                    guarded.then((value) => {
                        timedOut = false;
                        return value;
                    }),
                    new Promise((resolve) =>
                        setTimeout(() => {
                            timedOut = true;
                            resolve(undefined);
                        }, budget)
                    )
                ]);
                void timedOut;
                return winner ?? null;
            }
            // Mobile / fork không có offscreen: chạy trong Service Worker
            const model = await ensureSwModel(pairKey);
            if (!model || !swService) {
                return null;
            }
            return translateInSw(pairKey, text) || null;
        } catch {
            return null;
        }
    }

    ext.background.offlineTranslation = {
        isEnabled,
        isReady,
        isPairSupported,
        getStatus,
        startDownload,
        removeModel,
        tryTranslate
    };
})();
