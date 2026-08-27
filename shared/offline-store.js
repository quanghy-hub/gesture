// @ts-check
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
    const ext = globalThis.GestureExtension;
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

    ext.shared.offlineStore = {
        IDB_NAME,
        IDB_STORE,
        openDb,
        idbGet,
        idbPut,
        idbDelete,
        sha256Hex,
        gunzipIfNeeded,
        fetchBuffer
    };
})();
