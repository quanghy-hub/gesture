// @ts-nocheck
/**
 * Helpers dùng chung cho các module offline (dịch Bergamot + TTS VITS).
 *
 * - Tách IDB + giải nén + checksum ra một nơi để tránh copy 4 lần
 *   (background/offline-translation.js, background/offline-tts.js,
 *    offscreen/engine.js, offscreen/tts-engine.js).
 * - SW và offscreen đều có thể dùng: SW nạp qua background/imports.js,
 *   offscreen nạp qua <script src="../shared/offline-store.js"> trong engine.html.
 */
(() => {
    const root = globalThis;
    root.GestureExtension = root.GestureExtension || {};
    const ext = root.GestureExtension;
    ext.shared = ext.shared || {};

    const IDB_NAME = 'gesture-offline-translate-v1';
    const IDB_STORE = 'files';

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, 1);
            req.onupgradeneeded = () => {
                if (!req.result.objectStoreNames.contains(IDB_STORE)) {
                    req.result.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function idbGet(key) {
        return openDb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => reject(req.error);
                })
        );
    }

    function idbPut(key, buffer) {
        return openDb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readwrite');
                    tx.objectStore(IDB_STORE).put(buffer, key);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                })
        );
    }

    function idbDelete(key) {
        return openDb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readwrite');
                    tx.objectStore(IDB_STORE).delete(key);
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                })
        );
    }

    async function sha256Hex(buffer) {
        const digest = await crypto.subtle.digest('SHA-256', buffer);
        return Array.from(new Uint8Array(digest))
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
    }

    async function gunzipIfNeeded(buffer, isGz) {
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
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status} — ${url}`);
        }
        return response.arrayBuffer();
    }

    // ---- Bergamot decoder config (dùng chung SW fallback + offscreen) -----------
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

    function prepareAligned(buffer, ModuleRef, alignment) {
        const mod = ModuleRef || globalThis.Module || self.Module;
        const byteArray = new Int8Array(buffer);
        const aligned = new mod.AlignedMemory(byteArray.byteLength, alignment);
        aligned.getByteArrayView().set(byteArray);
        return aligned;
    }

    // ---- Offscreen document lifecycle (dùng chung 2 background modules) -------
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

    ext.shared.offlineStore = {
        IDB_NAME,
        IDB_STORE,
        MODEL_CONFIG,
        openDb,
        idbGet,
        idbPut,
        idbDelete,
        sha256Hex,
        gunzipIfNeeded,
        fetchBuffer,
        prepareAligned,
        hasOffscreen,
        ensureOffscreen,
        sendToEngine
    };
})();
