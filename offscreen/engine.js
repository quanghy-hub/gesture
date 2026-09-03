/**
 * Offscreen document: chạy các model dịch offline Bergamot (WASM).
 *
 * Luồng:
 *   1. Background tải engine (.wasm/.js) + models (.bin.gz đã giải nén) vào IndexedDB
 *   2. Trang này đọc file từ IndexedDB, khởi tạo Module emscripten với
 *      `wasmBinary` (không cần eval — CSP chỉ cần 'wasm-unsafe-eval')
 *   3. Nhận message `offline-engine/translate` {text, pair} từ service worker
 *
 * Cách dùng API sao chép 1:1 từ demo chính thức mozilla/translate/js/worker.js
 * (BlockingService + TranslationModel(config, model, shortlist, vocabs, null)).
 */
/* global Module */
(() => {
    const store = globalThis.GestureExtension?.shared?.offlineStore;
    if (!store) throw new Error('offlineStore not loaded');

    let translationService = null;
    const translationModels = new Map(); // pairKey -> TranslationModel
    const loadPromises = new Map();
    let runtimeReady = null;
    // Tuần tự hoá mọi tác vụ nặng để các request dồn tới không đè nhau
    let taskChain = Promise.resolve();

    const MODEL_CONFIG = store.MODEL_CONFIG;
    const { idbGet } = store;

    function prepareAlignedMemory(buffer, alignment) {
        return store.prepareAligned(buffer, Module, alignment);
    }

    function initRuntime() {
        if (runtimeReady) {
            return runtimeReady;
        }
        runtimeReady = (async () => {
            const wasmBytes = await idbGet('engine.wasm');
            if (!wasmBytes) {
                throw new Error('Thiếu engine.wasm trong IndexedDB');
            }
            self.Module = {
                wasmBinary: wasmBytes,
                print() {},
                printErr() {}
            };
            // Nạp glue emscripten sau khi Module đã được định nghĩa; glue sẽ
            // instantiate wasmBinary và gọi onRuntimeInitialized khi sẵn sàng.
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('WASM init timeout')), 30000);
                self.Module.onRuntimeInitialized = () => {
                    clearTimeout(timeout);
                    resolve();
                };
                const script = document.createElement('script');
                script.src = 'bergamot-translator-worker.js';
                script.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error('Nạp bergamot glue thất bại'));
                };
                document.head.appendChild(script);
            });
            return new Module.BlockingService({ cacheSize: 64 });
        })().catch((error) => {
            runtimeReady = null;
            throw error;
        });
        return runtimeReady;
    }

    async function loadModel(pairKey) {
        if (translationModels.has(pairKey)) {
            return translationModels.get(pairKey);
        }
        const existing = loadPromises.get(pairKey);
        if (existing) {
            return existing;
        }
        const loadPromise = (async () => {
            translationService = await initRuntime();
            const [modelBytes, lexBuf, vocabBuf] = await Promise.all([
                idbGet(`${pairKey}:model`),
                idbGet(`${pairKey}:lex`),
                idbGet(`${pairKey}:vocab`)
            ]);
            if (!modelBytes || !lexBuf || !vocabBuf) {
                throw new Error(`Thiếu model ${pairKey} trong IndexedDB`);
            }
            const alignedModel = prepareAlignedMemory(modelBytes, 256);
            const alignedShortlist = prepareAlignedMemory(lexBuf, 64);
            const alignedVocabs = new Module.AlignedMemoryList();
            alignedVocabs.push_back(prepareAlignedMemory(vocabBuf, 64));
            const model = new Module.TranslationModel(MODEL_CONFIG, alignedModel, alignedShortlist, alignedVocabs, null);
            translationModels.set(pairKey, model);
            return model;
        })().catch((error) => {
            loadPromises.delete(pairKey);
            throw error;
        });
        loadPromises.set(pairKey, loadPromise);
        return loadPromise;
    }

    function translateOnce(pairKey, text) {
        const model = translationModels.get(pairKey);
        const input = new Module.VectorString();
        const options = new Module.VectorResponseOptions();
        input.push_back(String(text || ''));
        try {
            const results = translationService.translate(model, input, options);
            const out = results.size() > 0 ? String(results.get(0).getTranslatedText() || '') : '';
            results.delete();
            return out.trim();
        } finally {
            input.delete();
            options.delete();
        }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || String(message.type || '').indexOf('offline-engine/') !== 0) {
            return undefined;
        }
        const action = String(message.type).slice('offline-engine/'.length);
        taskChain = taskChain.then(async () => {
            try {
                if (action === 'load') {
                    await loadModel(String(message.pair || 'en-vi'));
                    sendResponse({ ok: true });
                    return;
                }
                if (action === 'translate') {
                    const pairKey = String(message.pair || 'en-vi');
                    await loadModel(pairKey);
                    const text = translateOnce(pairKey, message.payload?.text);
                    sendResponse({ ok: true, text });
                    return;
                }
                sendResponse({ ok: false, error: 'Hành động không hỗ trợ' });
            } catch (error) {
                sendResponse({ ok: false, error: String(error?.message || error) });
            }
        });
        return true; // phản hồi bất đồng bộ
    });
})();
