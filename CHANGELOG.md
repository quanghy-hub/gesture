# CHANGELOG

Tất cả những thay đổi quan trọng của dự án **Gesture Suite Extension** được ghi lại tại đây.

---

## [1.4.3] - 2026-08-24

### 🧹 Repo cleanup — dead code sweep

- **File rác**: xóa 13 file `.tmp-*` (ảnh/debug script ~1.6MB) khỏi root; untrack `test-results/.last-run.json` (đã có trong .gitignore nhưng bị commit từ trước).
- **Dead code sau khi gỡ clipboard** (verify từng item bằng grep trước khi cắt):
    - `dom-utils.js`: bỏ `escapeHtml`, `previewText` (chỉ còn test dùng), `isVisible`, `encodeAttribute`, `decodeAttribute`.
    - `selection-query.js` / `selection-modifier.js`: bỏ `getActiveSelectionText`, `getSelectionTextFromTarget`, `insertTextAtCaret` + 2 helper insert (từng chỉ phục vụ clipboard).
    - `floating-ui.js`: bỏ method `setActive`, ngừng export `createFloatingElementApi` (chỉ dùng nội bộ). CSS `.is-active` giữ lại vì google-search/youtube-subtitles toggle trực tiếp.
    - `toast-core.js`: `ensureToastStyle` chuyển thành hàm nội bộ.
    - `touch-core.js`: bỏ `createLongPress`; `viewport-core.js`: bỏ `getCenteredRect`; `floating-utils.js`: bỏ wrapper `clamp` chết; `runtime.js`: bỏ `isMacOS`.
- **Message path chết**: bỏ `tabActions.openNewTab` + handler `'gesture-ext/open-new-tab'` (client không bao giờ gọi) → thu gom message surface của service worker.
- **Iframe bridge**: bỏ 4 lệnh whitelist không bao giờ được gửi (`play-pause`, `cycle-fit`, `cycle-zoom`, `rotate`) → thu hẹp bề mặt postMessage, giảm attack surface. State snapshot (`fitIdx/zoomIdx/rotationAngle`) vẫn giữ vì UI state vẫn đọc.
- Bundle giảm 540.9KB → 533.9KB; eslint/typecheck/test sạch hoàn toàn.

### 🗑️ Remove Clipboard feature

- Xóa toàn bộ module `content/clipboard/` (trigger 📋, panel history/pin/paste) cùng wiring: `bootstrap.js`, `scripts/build.js`, `manifest.json` CSS, `extension-ui-guard.js`, popup (section + field map + events + elements + render), `storage.js` (4 API clipboard), config schema/normalize, type declarations và test liên quan.
- Dọn call site còn sót: `quick-search/actions.js#copyText` và `ocr-core.js` không còn ghi vào lịch sử clipboard của extension. Quyền `clipboardWrite` được **giữ lại** vì OCR/Quick Search vẫn dùng `navigator.clipboard`.
- Lợi ích phụ: loại bỏ race condition read-modify-write toàn config khi copy từ nhiều tab đồng thời.

### 🖼️ Forum layout — perf & ổn định

- **Fix layout thrash** (`layout.js`): tách vòng đọc/ghi khi dựng masonry — trải items vào 2 cột trước, đo chiều cao hàng loạt một lần, tính phân bổ thuần số học rồi mới dời item lệch cột. Thread dài không còn N lần forced reflow.
- **Chống vòng lặp ResizeObserver**: `fitWrapperToViewport` chỉ ghi `--fs-overflow-fix` khi giá trị đổi thật sự.
- **Bỏ ghi localStorage lặp lại**: `syncCache` so khớp serialized key trước khi ghi (resize/observer spam không còn ghi trùng).

### 📸 Video Screenshot — sạch khung hình & phản hồi người dùng

- **Ảnh chụp vùng không còn dính UI của extension** (`capture-region.js`): ẩn nút trigger nổi trước `captureVisibleTab`, khôi phục trong `finally`.
- **Video ghi hình sạch hơn** (`screen-recorder.js`): gộp badge "Đang ghi hình" vào control bar (đã tự đặt ngoài vùng ghi); viền vùng ghi dùng `outline-offset: 2px` đẩy hoàn toàn ra ngoài — pixel trong region không bị viền/badge ăn vào. Trigger nổi bị ẩn suốt phiên ghi.
- **Toast phản hồi thay vì silent failure**: thành công/lỗi khi chụp frame (báo riêng lỗi video cross-origin bị canvas-taint), lỗi chụp vùng, lỗi bắt đầu ghi hình, bản ghi trống.
- **Perf**: MutationObserver chỉ chạy khi tính năng bật; tắt qua popup sẽ ngắt observer ngay lập tức.
- Phím tắt bỏ qua target `[role="textbox"]`.

---

## [1.4.2] - 2026-08-22

### 🐛 Fix Floating iframe căn giữa & không phóng to

- **Trước**: `iframe-mode.js` inject toàn cục `position:absolute` + `translate` làm lệch nút play gốc và phóng to video dọc (100% ép khung) → lẹm hình (`[Image 1]`).
- **Sau**: style chỉ áp khi `html.fvp-iframe-floating`, video dùng `width:auto;height:auto;max-width/height:100%;object-fit:contain` trong flex center, giữ khung gốc. Outer `ui-controls.js` giữ `width/height:100%` lấp wrapper, zoom/rotate do outer `transform`. Thêm auto-click `jsReadyPlay` sau reload do move iframe.

## [1.4.1] - 2026-08-21

### 📝 Quick Search

- **Fix nút Save ảnh cross-origin**: `<a download>` bị Chromium bỏ qua với URL ngoài — đổi sang chuỗi 3 tầng: SW fetch dataURL → `chrome.downloads.download`, fallback blob object URL, cuối cùng mở tab. Đuôi file suy diễn từ MIME thật thay vì hardcode `.jpg` (`actions.js`, helper mới `resolveImageExtension`).
- **Tắt feature có hiệu lực ngay**: gate `enabled` trong `evaluateSelection`/`evaluateImageCandidate` + `onConfigChange` dọn bubble/long-press khi tắt (`controller.js`, `session-manager.js`).
- **Box Dịch tự chủ**: tự inject styles qua `inlineTranslate.dom.ensureStyles()`, click-to-close, đánh dấu `__gestureSourceNode` cho orphan observer — không còn phụ thuộc Inline Translate có bật hay không.
- Perf: `pointermove` return sớm khi image search tắt; bỏ dead param `startHoverHideTimer`; thống nhất default `selectionDelay = 300`; UI chuyển sang `adoptedStyleSheets` chống CSP `style-src` của trang.
- Thêm test `resolveImageExtension`.

### 🎬 YouTube Subtitles — fix phụ đề đứng yên khi tua/kéo nhanh

- **Serialize + coalescing render**: chỉ một `renderCurrentCaption` chạy tại một thời điểm; request mới trong lúc bận được gom và xử lý đúng một lần sau — bản dịch không thể ghi DOM lệch thứ tự nữa (nguyên nhân chính của triệu chứng đứng yên ở text cũ) (`caption-manager.js`).
- **Reset state khi tua**: event `seeked`/`loadedmetadata` giờ kích hoạt reset `lastSource/consumedWordCount` + vô hiệu hóa bản dịch đang bay trước khi render lại (`video-sync.js`, `controller.js`).
- **Heuristic time-gap**: nhảy `currentTime` > 0.6s so với lần render trước coi như tua — caption rolling không còn bị slice sai offset (`caption-manager.js`).
- **Debounce MutationObserver 100ms**: giảm storm render khi player tự mutation liên tục (`video-sync.js`).
- Thêm test hồi quy cho thứ tự reset → render của videoSync.

---

## [1.4.0] - 2026-08-21

### 🎬 Floating Video

- **Frame ngoài sở hữu presentation**: fit/zoom/rotate của floated iframe do frame ngoài quyết định một nguồn duy nhất; bỏ forward `cycle-fit/cycle-zoom/rotate` sang iframe agent để hai bên không giành quyền ghi transform (`ui-controls.js`, `core/controller.js`).
- **Lọc state poll từ iframe**: `fvp-iframe-state` strip các trường presentation trước khi merge vào `iframePlaybackState`, tránh bị inner agent ghi đè mỗi lần poll (`core/controller.js`).
- **Khôi phục fallback menu**: tách `floatFirstAvailableMedia.fallbackToMenuItems` để controller override ủy quyền lại menu khi không có direct video, thay vì bỏ im (`ui/menu.js`).
- **CSS iframe nổi**: tách rule riêng cho `#fvp-wrapper iframe`, bật lại `pointer-events` để player cross-origin nhận tương tác native (nút play, menu chất lượng).

### ✨ Gestures

- **Cấu hình riêng theo nền tảng**: Popup thêm bộ chọn **Settings for** (Desktop/Mobile); long-press, close-tab và các cờ bật/tắt giờ lưu độc lập cho từng platform thay vì bị merge chung (`ui/popup/popup-save.js`, `popup-render.js`).
- **Giảm cửa sổ suppress 800ms → 300ms**: sau khi mở/đóng tab bằng gesture, chỉ chặn click tổng hợp phát sinh ngay sau pointerup/touchend, không còn nuốt click thật khi người dùng thao tác tiếp (`content/gestures/gesture-utils.js`).
- **Ghi chú pager ↔ Forum layout**: popup hiển thị hint "Pager (← / →) chỉ chạy trên site đã bật Forum layout"; README cập nhật mô tả đúng cơ chế gom nhịp phím 180ms.
- **Gộp state manager trùng lặp**: `desktop-long-press.js`, `mobile-long-press.js`, `mobile-tap.js` gộp thành `content/gestures/state-managers.js` dùng chung cho cả hai controller.
- **Tách hàm thuần `buildHoppedHref`** khỏi `goPage()` để kiểm thử được thuật toán suy diễn URL phân trang (param query + segment path).

### 🧪 Kiểm thử

- Thêm test cho `buildHoppedHref` (multi-hop query/path), `getEdgeStrength` (left/right/both) và `clampScrollTop` — nâng tổng số test.

### 📑 Tài liệu

- README bỏ mô tả fast scroll desktop (`Ctrl/⌘ + ↑/↓`) đã bị xóa từ bản trước; ghi rõ điều kiện bật của pager.

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
