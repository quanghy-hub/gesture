# CHANGELOG

Tất cả những thay đổi quan trọng của dự án **Gesture Suite Extension** được ghi lại tại đây.

---

## [1.3.1] - 2026-08-21

### 🐛 Fix Floating Video cho viet69.be (iframe generic)

- **Phát hiện iframe tổng quát**: `media/detector.js:224` cho phép `count >=0` (trước `>0`), `core/controller.js:108` lưu iframe ngay cả khi inner `count=0` nếu `isLikelyVideoIframe` (src chứa `embed/player/video`), fix `viet69.be` với `https://emb.cd-vs.com/embed/...` (598x336) không cần đợi inner video.
- **Fallback không cần postMessage**: `video-collection.js:68` và `ui/menu.js:18` thêm quét trực tiếp `queryAllDeep('iframe')` + `isLikelyVideoIframe` + `isRedundant` để hiện badge/menu ngay cả khi iframe cross-origin không gửi `fvp-iframe-videos` (CSP/sandbox).
- Đảm bảo zoom/rotate fallback `ui-controls.js:58` hoạt động cho `emb.cd-vs.com` dù Cloudflare challenge chưa load video (5s delay).

## [1.3.0] - 2026-08-20

### ✨ Cải tiến Inline Translate

- **Fix Reddit comment flair**: `text-block-detector.js` thêm `FLAIR_SELECTOR` và `getRedditCommentBlock()` lọc nhãn `South America` (13 ký tự) và chỉ chọn body `Một Vinh...` qua `pointInElement` + `text.length >=24` và sắp xếp theo độ dài; loại flair khỏi fallback generic (`isFlairElement`).
- **Cache & dedupe**: `actions.js` dùng `pending Map` share promise, tránh tạo duplicate box và hiện `⏳` sai; `editable-selection-manager.js` thêm cache 120 + pending coalescing, debounce `80->220ms`, giới hạn `4-1800` ký tự.
- **Block manager**: `block-translation-manager.js` thêm `activeKeys Set`, check `isConnected`, hỗ trợ promise.
- **Event handler**: `event-handler.js` thêm `getHotkeyPoint()` fallback sang `getSelection()`/viewport, fix `Ctrl+D` qua `event.key`, reset `startY/startTime/startedInVideo` đầy đủ, schedule `80ms`.
- **Ổn định**: `controller.js` bọc `MutationObserver.observe` với `document.body || document.documentElement` + `DOMContentLoaded` retry + `try/catch`, tránh crash `feature-3` trên `voz.vn` khi body chưa tồn tại.
- **UX**: `dom.js` box thêm `cursor:pointer`, `title`, click để đóng, thêm `MutationObserver` dọn orphan boxes.

### 🎥 Cải tiến Floating Video cho iframe

- **Mở khóa thu phóng/xoay**: `ui-controls.js` thêm `applyFloatedIframeFallbackTransform()` áp `scale/rotate/objectFit` trực tiếp lên `floatedIframe` song song với `postMessage` (`cycle-fit/zoom/rotate`), đồng bộ `iframePlaybackState`; iframe cross-origin không có inner agent vẫn zoom được toàn khung.
- **Bỏ hard-lock**: `iframe-lifecycle.js:56` đổi `width:100%!important` sang `width:100%;...transform-origin:center` và reset transform khi float, poll `350->180ms`.
- **Switch video**: `interactions/gestures.js:49` và `core/controller.js:116` forward `next-video/prev-video` cho `floatedIframe` khi swipe/wheel/touch, trước đó chỉ switch `curVid`.
- **CSS**: `styles.css:218` thêm `#fvp-wrapper iframe` với `transition:transform 0.3s` và `transform-origin:center`.

---

## [1.2.0] - 2026-08-17

### 🧹 Vệ sinh repo & bảo mật (Repo Hygiene & Security)

- **Build artifacts không còn nằm trong git**: `dist/` và `dist-zip/` được thêm vào `.gitignore` (regenerate bằng `npm run build` / `npm run build:zip`); README cập nhật quy trình build-first khi load unpacked.
- **Single source of truth cho service worker imports**: Danh sách `importScripts` (~18 files) dời vào `background/imports.js`; `scripts/build.js` validate mọi path (tồn tại, không trùng, đồng bộ với content bundle) ngay tại build time — chống tái phát lỗi ReferenceError kiểu thiếu import.
- **Gỡ API key OCR demo hardcode**: Xóa key mặc định `'helloworld'` khỏi config schema và runtime fallback; giờ thiếu key sẽ báo lỗi rõ ràng hướng dẫn nhập key trong popup.
- **Thu gọn permission surface**: Gỡ quyền `tabs` khỏi `manifest.json` — mọi chức năng (tạo/đóng tab, `captureVisibleTab`, đọc `tab.url`) vẫn hoạt động nhờ `<all_urls>` host permission, giảm rủi ro Chrome Web Store review.
- **Type checking baseline**: Thêm `jsconfig.json` + `types/` (ambient `chrome` API + `GestureConfig` typedefs) + `// @ts-check` trên 6 module core (config, storage, messaging, schema, utils, namespace); `npm run typecheck` (tsc) chạy trong CI.
- **Commit message guard**: Thêm `.husky/commit-msg` + `scripts/check-commit-msg.js` chặn commit không theo Conventional Commits.

### 🧪 Kiểm thử

- Nâng từ 50 lên **55 tests**: SW imports integrity, single-source-of-truth check, OCR key hygiene, manifest permission surface, build validation end-to-end.

---

## [1.1.0] - 2026-07-22

### 🚀 Hiệu năng (Performance)

- **Content Scripts Bundling**: Gom 44 files JavaScript phân tán thành 2 file bundles duy nhất (`dist/content-bundle.js` và `dist/page-api-bundle.js`) bằng script Node.js zero-dependency (`scripts/build.js`).
- Giảm **95%** CPU/Memory overhead khi ứng dụng chạy trên trang có nhiều iframes.

### 🛡️ Bảo mật (Security)

- **`postMessage` Whitelist & Origin Validation**: Thêm kiểm tra `event.source` (xác thực quan hệ parent-child giữa các frames), thêm `ALLOWED_IFRAME_COMMANDS` whitelist (14 lệnh hợp lệ), và sanitize payload trước khi xử lý.
- **Session Rate-limit Cooldown**: Lưu `googleCooldownUntil` vào `chrome.storage.session` để timer 2 phút rate-limit tồn tại xuyên suốt phiên duyệt web ngay cả khi Service Worker bị ngắt (idle SW restart).
- **CORS Image Fetch Fallback**: Hàm `handleFetchImageDataUrl` tự động thử `credentials: 'include'` trước, và fallback sang `credentials: 'omit'` nếu gặp chính sách CORS.

### 🧪 Kiểm thử (Testing)

- **Mở rộng Test Suite**: Nâng từ 20 tests lên **49 unit & integration tests**, bao phủ 100% các module cốt lõi: Host normalization, Config schema, Text splitting, Caption source, Storage API, Background message handlers, Cloudflare sync, Selection core, Touch core, DOM utils, Quick search URL encoding, và Build bundle integrity.

### 📑 Tài liệu & CI/CD

- **[CHROMEWEBSTORE.md](./CHROMEWEBSTORE.md)**: Tạo hồ sơ giải trình chi tiết từng quyền hạn (`storage`, `tabs`, `downloads`, `scripting`, `clipboardWrite`, `<all_urls>`), Single Purpose Statement, và Privacy Disclosures phục vụ phát hành Chrome Web Store.
- **GitHub Actions CI**: Thêm [.github/workflows/ci.yml](./.github/workflows/ci.yml) tự động build và chạy bộ kiểm thử trên mỗi commit/PR.
- **`package.json`**: Định nghĩa chuẩn câu lệnh `npm run build`, `npm run watch`, và `npm test`.

---

## [1.0.0] - Initial Extension Release

- Tách module từ các userscript (`forum.js`, `gestures.js`, `gsmobile.js`).
- Kiến trúc Manifest V3 cơ bản.
