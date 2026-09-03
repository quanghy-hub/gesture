/**
 * Danh sách import của service worker — SINGLE SOURCE OF TRUTH.
 *
 * File này là nơi duy nhất khai báo thứ tự các module mà service worker
 * cần nạp. Cả `background/service-worker.js` (runtime) lẫn `scripts/build.js`
 * (build-time validation) đều đọc từ đây, tránh tình trạng hai danh sách
 * lệch nhau gây lỗi runtime (ReferenceError) như đã từng xảy ra.
 *
 * Lưu ý: giữ thứ tự theo đúng dependency — namespace trước, rồi đến
 * messaging/config/storage, cuối cùng là background handlers.
 */
(() => {
    const ext = globalThis.GestureExtension;
    ext.background = ext.background || {};
    ext.background.SW_IMPORT_PATHS = Object.freeze([
        '/shared/messaging.js',
        '/shared/api-services.js',
        '/shared/config-utils.js',
        '/shared/config-schema.js',
        '/shared/config-normalize.js',
        '/shared/config.js',
        '/shared/storage.js',
        '/shared/cloudflare-sync-state.js',
        '/shared/cloudflare-sync-api.js',
        '/shared/cloudflare-sync-auto.js',
        '/shared/cloudflare-sync.js',
        '/background/api-services/translate-utils.js',
        '/background/api-services/translate-google.js',
        '/background/api-services/translate-providers.js',
        '/background/api-services/translate-api.js',
        '/background/api-services/ocr-api.js',
        '/background/api-service-registry.js',
        '/shared/offline-store.js',
        '/background/offline-translation.js',
        '/background/offline-tts.js',
        '/background/message-handlers.js'
    ]);
})();
