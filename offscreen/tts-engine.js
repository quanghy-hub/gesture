/**
 * Tier 2 — Engine đọc phụ đề OFFLINE trong offscreen page.
 *
 * - Model: Xenova/mms-tts-vie (VITS ONNX quantized, Meta MMS tiếng Việt)
 * - Runtime: @xenova/transformers 2.17.2 (vendored tại vendor/transformers.min.js),
 *   backend onnxruntime-web WASM (CSP đã mở 'wasm-unsafe-eval')
 * - Weights tải từ HuggingFace CDN lần đầu và tự cache trong browser Cache API
 *   ('transformers-cache'); nút "Xoá" trong popup xoá cache này.
 */
(() => {
    const MODEL_ID = 'Xenova/mms-tts-vie';

    let synthPromise = null;
    let lib = null;
    let taskChain = Promise.resolve();

    const broadcast = (payload) => {
        chrome.runtime.sendMessage({ type: 'gesture-ext/tts-offline-state', payload }).catch(() => {});
    };

    const store = globalThis.GestureExtension?.shared?.offlineStore;
    if (!store) throw new Error('offlineStore not loaded');
    const { idbGet } = store;

    /**
     * Nạp thư viện dạng CLASSIC SCRIPT (đã biến đổi sẵn bởi
     * scripts/gen-transformers-global.js: câu export{...} cuối bundle được thay
     * bằng gán window.transformers). Cách này né toàn bộ vấn đề dynamic import
     * trong extension page (fetch/MIME/CSP) — giống mô hình bergamot glue.
     */
    async function loadLibrary() {
        if (lib) {
            return lib;
        }
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Nạp transformers.js timeout')), 30000);
            const script = document.createElement('script');
            script.src = 'vendor/transformers.global.js';
            script.onload = () => {
                clearTimeout(timeout);
                resolve();
            };
            script.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Không tải được transformers.global.js'));
            };
            document.head.appendChild(script);
        });
        const transformers = window.transformers;
        if (!transformers?.pipeline) {
            throw new Error('transformers.js không expose pipeline');
        }
        return transformers;
    }

    async function ensureSynth() {
        if (synthPromise) {
            return synthPromise;
        }
        synthPromise = (async () => {
            const transformers = await loadLibrary();
            transformers.env.allowLocalModels = false;
            try {
                // Extension page không có cross-origin isolation → bắt buộc 1 thread;
                // ghim đúng thư mục wasm của phiên bản đã pin để ORT không đoán sai.
                transformers.env.backends.onnx.wasm.numThreads = 1;
                transformers.env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/';
                // Nạp ORT runtime từ IndexedDB (đã tải khi warmup): bỏ hẳn request
                // streaming tới CDN → hết cảnh báo content-length, chạy được cả
                // khi mất mạng sau khi đã cài.
                try {
                    const ortBytes = await idbGet('tts:ortwasm');
                    if (ortBytes) {
                        transformers.env.backends.onnx.wasm.wasmBinary = ortBytes;
                    }
                } catch {
                    // Không có → fallback tải từ CDN như cấu hình trên.
                }
                try {
                    transformers.env.backends.onnx.wasm.logLevel = 'error';
                } catch {
                    // Bỏ qua nếu shape env khác.
                }
            } catch {
                // Bỏ qua nếu backend chưa init
            }
            const synthesizer = await transformers.pipeline('text-to-audio', MODEL_ID, {
                dtype: 'q8',
                progress_callback: (progress) => {
                    if (progress && progress.status === 'progress' && progress.total) {
                        broadcast({
                            status: 'downloading',
                            progress: Math.round((progress.loaded / progress.total) * 100),
                            label: 'Đang tải giọng offline…'
                        });
                    }
                }
            });
            await broadcast({ status: 'ready', installed: true });
            return synthesizer;
        })().catch((error) => {
            synthPromise = null;
            broadcast({ status: 'error', error: String(error?.message || error) });
            throw error;
        });
        return synthPromise;
    }

    // ---- WAV encoding (PCM16 mono) ----
    function writeAscii(view, offset, text) {
        for (let index = 0; index < text.length; index += 1) {
            view.setUint8(offset + index, text.charCodeAt(index));
        }
    }

    function encodeWav(samples, sampleRate) {
        const numSamples = samples.length;
        const buffer = new ArrayBuffer(44 + numSamples * 2);
        const view = new DataView(buffer);
        writeAscii(view, 0, 'RIFF');
        view.setUint32(4, 36 + numSamples * 2, true);
        writeAscii(view, 8, 'WAVE');
        writeAscii(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, 1, true); // mono
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeAscii(view, 36, 'data');
        view.setUint32(40, numSamples * 2, true);
        let offset = 44;
        for (let index = 0; index < numSamples; index += 1) {
            const sample = Math.max(-1, Math.min(1, samples[index]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
            offset += 2;
        }
        return buffer;
    }

    function arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let index = 0; index < bytes.length; index += 0x8000) {
            binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
        }
        return btoa(binary);
    }

    /** Tổng hợp → WAV (base64). KHÔNG phát ở đây — content script phát trên
     * trang có user activation nên không bao giờ bị autoplay policy chặn. */
    async function synthesizeToWavBase64(text) {
        const synthesizer = await ensureSynth();
        const output = await synthesizer(String(text || ''));
        const samples = output.audio instanceof Float32Array ? output.audio : new Float32Array(output.audio);
        const wavBuffer = encodeWav(samples, output.sampling_rate);
        return { wavBase64: arrayBufferToBase64(wavBuffer), durationSeconds: samples.length / output.sampling_rate };
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (!message || String(message.type || '').indexOf('offline-tts/') !== 0) {
            return undefined;
        }
        const action = String(message.type).slice('offline-tts/'.length);
        taskChain = taskChain.then(async () => {
            try {
                if (action === 'warmup') {
                    await ensureSynth();
                    sendResponse({ ok: true });
                } else if (action === 'synthesize') {
                    // Tổng hợp có thể mất vài giây — caller đặt timeout riêng.
                    const result = await synthesizeToWavBase64(message.payload?.text);
                    sendResponse({ ok: true, ...result });
                } else if (action === 'stop') {
                    // v2: tổng hợp chạy trong chính request này nên không cần
                    // hủy giữa chừng ở đây; content tự ngắt phát local.
                    sendResponse({ ok: true });
                } else if (action === 'remove') {
                    synthPromise = null;
                    if (window.caches) {
                        const keys = await caches.keys();
                        for (const key of keys) {
                            if (/transformers/i.test(key)) {
                                await caches.delete(key);
                            }
                        }
                    }
                    sendResponse({ ok: true });
                } else {
                    sendResponse({ ok: false, error: 'Hành động không hỗ trợ' });
                }
            } catch (error) {
                sendResponse({ ok: false, error: String(error?.message || error) });
            }
        });
        return true;
    });
})();
