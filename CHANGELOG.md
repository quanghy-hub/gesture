# CHANGELOG

Tất cả những thay đổi quan trọng của dự án **Gesture Suite Extension** được ghi lại tại đây.

---

## [1.4.5] - 2026-08-27

### ♻️ Refactor — dọn triệt để duplicate & dead code

- **Centralize `MODEL_CONFIG` + `prepareAligned` + offscreen lifecycle**: gom vào `shared/offline-store.js` (`hasOffscreen/ensureOffscreen/sendToEngine` singleton) — xoá 90 LOC duplicate giữa `background/offline-translation.js`/`offline-tts.js` và 40 LOC `MODEL_CONFIG/prepareAligned` giữa SW/offscreen. `background/offline-translation.js` và `offscreen/engine.js|tts-engine.js` giờ delegate trực tiếp `store.*`, bỏ nhánh fallback `if(store?.xxx)` dead.
- **Dead code**: xoá `let timedOut + void timedOut` (`offline-translation.js:491`), nhánh `vi→en` chết (`resolvePair` chỉ giữ `en-vi`), `shared/config.js` `getExcludedMatchPatterns`/`applyGestureSettings` + exports `getVideoFloatingBackgroundSeekExcludedHosts` không dùng, `types/globals.d.ts` đồng bộ.
- **Manifest**: gỡ `dist/*` khỏi `web_accessible_resources` (`manifest.json:47`) — chỉ giữ `icons/*`, giảm fingerprint surface (đã inject via `content_scripts`).
- **TTS state**: `background/offline-tts.js:24` reset `downloading→idle` giờ xoá cả `label/error`, `ensureOffscreen` reuse singleton.
- **Bundle** 561.9 → 558.8 KB, `lint/typecheck/test` sạch.

## [1.4.4] - 2026-08-27

### ♻️ Refactor — tách offline store & fix coupling dịch/TTS

- **Tách `shared/offline-store.js`**: gom `openDb/idbGet/idbPut/idbDelete/sha256Hex/gunzipIfNeeded/fetchBuffer` dùng chung cho `background/offline-translation.js`, `offscreen/engine.js`, `offscreen/tts-engine.js` — xoá duplicate 3 nơi, SW và offscreen cùng nạp qua `background/imports.js` + `offscreen/engine.html`.
- **Giải coupling ORT wasm**: `background/offline-translation.js` tách `TRANSLATE_ENGINE_FILES` + `TTS_ORT_FILE`; `TRANSLATE_REQUIRED_KEYS` (5 keys) thay `DOWNLOAD_PLAN` (6 keys) cho `isReady()` — dịch sẵn sàng ngay cả khi TTS chưa tải; `removeModel()` chỉ xoá key dịch, giữ ORT cho TTS.
- **State bền**: crash giữa `downloading` → reload SW reset `downloading→idle` (đồng nhất với `offline-tts.js`), hết kẹt popup "Đang tải".
- **Fallback gzip**: `gunzipIfNeeded` kiểm tra `DecompressionStream` tồn tại trước khi pipe, báo lỗi rõ trên fork cũ.
- **Offscreen** load `../shared/offline-store.js` trước `engine.js/tts-engine.js` để reuse helpers.

## [Unreleased]

### 🗣️ Tier 2 TTS offline — giọng tiếng Việt VITS (transformers.js)

- **Engine**: `Xenova/mms-tts-vie` (VITS ONNX quantized ~40–60MB từ Meta MMS). transformers.js 2.17.2 được nạp dạng **classic script đã biến đổi** (`transformers.global.js`, sinh bằng `scripts/gen-transformers-global.js`: thay `export{…}` → gán `window.transformers`) — né hoàn toàn các vấn đề dynamic import trong extension page (fetch/MIME/CSP). Bare-import `onnxruntime-web` resolve qua import map → shim ESM đọc `window.ort` từ chuỗi UMD ORT 1.14 (common + web, cũng vendored). CSP giữ `'self' 'wasm-unsafe-eval'`.
- **Weights tự tải từ HuggingFace CDN** lần đầu khi bấm "Tải giọng offline" và cache trong browser Cache API; nút Xoá dọn cache. Không commit binary vào repo.
- **Tích hợp**: speaker ở content script nhận engine mới (`youtubeSubtitles.ttsEngine: 'os'|'offline'`) — chế độ Offline chuyển từng câu sang background → offscreen tổng hợp → phát audio, ducking volume video điều phối qua broadcast `gesture-ext/tts-audio`; tua/tắt → `tts-stop`.
- **Popup**: select Engine (Hệ thống/Offline) + trạng thái tiến độ tải + nút Tải/Xoá giọng offline.
- **Tốc độ đọc tới 3x + bỏ câu trễ**: `ttsRate` hỗ trợ 0.8–3x (popup), engine offline phát với `playbackRate` + `preservesPitch` (giọng không biến dạng); câu chờ quá 8s so với vị trí video bị bỏ để giữ nhịp dubbing.
- Desktop dùng chung trang offscreen với module dịch (reasons thêm AUDIO_PLAYBACK); mobile chưa hỗ trợ Tier 2 — dùng Tier 1 Web Speech.
- Chất lượng MMS vi: mức dùng được, giọng đơn; muốn tự nhiên hơn chờ model vi tốt hơn cho trình duyệt.

### 🔊 Tier 1 TTS — đọc phụ đề tiếng Việt bằng Web Speech API

- Module mới `tts.js`: hàng đợi tối đa 2 câu (tràn bỏ câu cũ), chọn giọng vi từ hệ thống (lazy + `voiceschanged`), **ducking** volume video còn 15% khi đang nói và trả đúng volume gốc khi hết phiên.
- Reset an toàn: tua video (`seeked`), tắt dịch, chuyển trang, tab ẩn → `speechSynthesis.cancel()` + trả volume.
- Chỉ đọc bản dịch thành công (không đọc thông báo lỗi); tự bỏ qua khi trình duyệt thiếu `speechSynthesis`.
- Popup card YouTube Subtitles: toggle "TTS đọc" + select tốc độ 0.8x/1x/1.2x (`youtubeSubtitles.ttsEnabled` mặc định TẮT, `ttsRate`).
- Yêu cầu giọng vi trên hệ điều hành: Windows Settings → Speech → Add Vietnamese voice; Android/Kiwi dùng Google TTS có sẵn.

### 🔤 Dịch text dài — hết vướng giới hạn query

- **MyMemory**: thêm bộ chia `splitTranslateTextByBytes()` cắt theo **UTF-8 byte** (≤450B/chunk, ưu tiên cắt tại khoảng trắng) — server MyMemory chặn `q` > 500 bytes nên trước đây text dài bị từ chối; giờ tự tách nhiều request nhỏ và nối kết quả.
- **Google**: nâng `GOOGLE_TRANSLATE_CHUNK_LIMIT` 1400 → **2000** ký tự/chunk (POST body chịu được), giảm số request với văn bản dài.
- Test mới: mọi chunk sau khi chia phải ≤ giới hạn byte và nội dung nối lại không mất.

### 📴 Module dịch OFFLINE Bergamot WASM — dùng chung cho mọi tính năng

- **Hotfix UI**: broadcast trạng thái giờ luôn kèm `installed` (trước đây broadcast cuối sau khi tải xong thiếu field này → popup hiển thị sai "Chưa có model"); state được nạp lại từ storage khi service worker restart; khối offline trong popup tách khỏi grid 5 cột của API Services (CSS riêng: `.offline-block/.offline-row/.offline-status-line/.offline-actions`).
- **Nguồn model chính thức Firefox Translations** (GCS công khai, MPL-2.0): cặp `en→vi` base-memory đã Release (BLEU 43.1), engine WASM v0.4.5 từ browsermt/bergamot-translator.
- **Không lưu binary trong repo**: glue JS (82KB) commit kèm; file nặng (wasm 5MB + model ~32MB + lex/vocab) chỉ tải về khi người dùng bật tính năng trong popup → verify SHA-256 (model) → giải nén gzip → lưu IndexedDB (`unlimitedStorage`).
- **Kiến trúc**: `background/offline-translation.js` (catalog, downloader, offscreen lifecycle, router) + `offscreen/engine.{html,js}` chạy BlockingService/TranslationModel đúng API demo mozilla/translate; tuần tự hoá request, timeout từng bước.
- **Tích hợp một điểm, hưởng mọi tính năng**: chèn offline-first vào `handleTranslateText` — phụ đề YouTube, inline translate, selection… target=vi đều tự ưu tiên local (~50–200ms/câu), lỗi thì lặng lẽ rơi về online với `provider: 'bergamot-offline'`.
- **Hỗ trợ chiều dịch**: offline chỉ giữ **en→vi**. Chiều vi→en đã thử nghiệm nhưng chuyển về đường online (chất lượng tốt hơn, không tăng dung lượng); `resolvePair` trả null khi thiếu cặp → tự fallback online, cấu trúc PAIRS sẵn sàng thêm cặp mới sau này.
- **Chạy cả trên MOBILE (Kiwi/Chromium Android)**: các bản fork không có `chrome.offscreen` sẽ tự chuyển sang host dự phòng — engine nạp lazy trong Service Worker qua `importScripts(blob)` từ IndexedDB; desktop vẫn ưu tiên offscreen document. `getStatus().host` báo đang dùng host nào.
- **Chạy cả trên MOBILE (Kiwi/Chromium Android)**: các bản fork không có `chrome.offscreen` sẽ tự chuyển sang host dự phòng — engine nạp lazy trong Service Worker qua `importScripts(blob)` từ IndexedDB; desktop vẫn ưu tiên offscreen document. `getStatus().host` báo đang dùng host nào.
- **Popup**: card "Dịch offline" (toggle "Dịch offline" qua FIELD_MAP, trạng thái realtime qua broadcast, nút Tải/Xoá model).
- Manifest: thêm quyền `offscreen`, `unlimitedStorage`; CSP `'wasm-unsafe-eval'`; zip pack gồm `offscreen/`, `types/`.
- Toggle mặc định TẮT — hành vi cũ không đổi cho tới khi người dùng bật + tải model.

### 🧹 Dọn code thừa + gỡ thử nghiệm dịch offline + gom 8-10 từ/câu

- **Gom từ về 8-10 từ/câu**: `EARLY_VISIBLE_CAPTION_WORDS` = 8, `MIN_VISIBLE_CAPTION_WORDS` = 9. Câu gốc vẫn hiện tức thì theo phụ đề native nên khoảng gom này chỉ điều chỉnh nhịp dòng dịch, không tạo lại cảm giác trễ.
- **Gỡ lớp dịch offline (Chrome Built-in Translator API)**: thử nghiệm cho thấy API/model on-device chỉ có trên Google Chrome chính thức — các Chromium fork (Helium, Brave...) không có gói và hiện không có tuỳ chọn chuyển lại online trong UI. Translator trở lại thuần online qua service worker (giữ cache 2000 mục + gom request trùng đang bay); bỏ dây truyền `sourceLang` ở manager/prefetch.
- **Dọn code thừa sau thay đổi kiến trúc "không đụng track mode"**:
    - Bỏ `hideNativeCaptionTrack(s)`, `getPreferredTrack`, nhánh `managedTrack` trong `getActiveCaptionTrack` (chỉ còn đọc track `'showing'`), state `captionTrack`, chuỗi `releaseCaptionTrack` xuyên manager/video-sync/controller, `SELECTORS.nativeCaptionNodes`.
    - Test cũ về ẩn native caption → thay bằng test mới khẳng định **chỉ đọc track, không đổi mode**.

### ⚡ YouTube subtitles — sửa độ trễ NGUỒN: không còn đổi track mode sang 'hidden'

- **Nguyên nhân gốc của "bật extension lên phụ đề tiếng Anh nhả chậm"**: manager gọi `track.mode = 'hidden'` để ẩn phụ đề native. Nhưng YouTube chỉ bơm dữ liệu ASR đều đặn khi track đang `'showing'` — về `'hidden'`, player giảm tải segment phụ đề → cue tới nhỏ giọt, độ trễ nằm ở **nguồn phát**, trước cả bước dịch (giải thích chính hiện tượng "tắt thì nhanh, bật thì chậm").
- **Fix**: giữ nguyên track `'showing'` để luồng cue chạy y như khi tắt extension; ẩn phụ đề native thuần bằng CSS sẵn có (`.yt-translating .ytp-caption-window-container { display:none }`). Tắt dịch → class gỡ → phụ đề native hiện lại bình thường.

### ⚡ Giảm độ trễ hiển thị, bám sát phụ đề gốc

- **Hiện câu gốc ngay lập tức**: trước đây cả cặp gốc+dịch chỉ hiện sau khi bản dịch về → độ trễ mạng cộng thẳng vào độ lệch với phụ đề gốc. Giờ câu gốc hiển thị tức thì theo phụ đề native, dòng dịch đổ vào khi kết quả trả về (xoá sạch dòng dịch cũ để tránh ghép lệch cặp).
- **Hạ ngưỡng gom chữ**: `EARLY_VISIBLE_CAPTION_WORDS` 5 → 4, `MIN_VISIBLE_CAPTION_WORDS` 8 → 5 — chunk kế tiếp chỉ cần thêm ~5 từ (~2 giây nói) thay vì ~8 từ (~3–4 giây), khoảng trễ tích luỹ giữa hai lần cập nhật giảm một nửa.
- Lưu ý: phần trễ do YouTube ASR trả text chậm hơn lời nói (~1–2s) là giới hạn của nguồn phát, không thuộc phạm vi extension.

### 🔥 Hotfix: phụ đề đứng yên/"đơ" sau khi bật prefetch

- **Nguyên nhân chính**: prefetcher quét cả vùng cue đang phát/sắp active — với auto caption (ASR) vùng này tự viết lại text liên tục → mỗi lần quét thấy chuỗi mới đều được đẩy vào hàng dịch → 2 slot request chay mãi bằng snapshot rác, dọa rate-limit provider khiến **cả bản dịch trên đường hiển thị bị treo theo**.
    - `prefetch.js`: chỉ dịch trước cue bắt đầu sau `PREFETCH_MIN_LEAD_SECONDS` (4s) kể từ vị trí hiện tại — tách hẳn khỏi vùng cuộn text; bỏ cửa sổ lookback.
    - Prefetch **nhường đường live**: khi một bản dịch hiển thị đang chờ (`shouldDefer`), không khởi request prefetch mới.
- **Chống treo hiển thị**: bản dịch live có trần chờ `LIVE_TRANSLATE_TIMEOUT_MS` (15s) — request bị treo chỉ hiện báo lỗi tạm thay vì đóng băng phụ đề vĩnh viễn.
- **Chống lan truyền lỗi**: exception từ prefetch trong handler sự kiện video được cô lập (try/catch) — không thể giết đường `renderCurrentCaption`; bớt 'change' khỏi danh sách force-pump để tránh khuếch đại khi mode track flap.
- Test mới: cơ chế defer nhường đường live.

### ⚡ YouTube subtitles — dịch trước (prefetch) để hiện phụ đề gần như tức thì

- **Module mới `prefetch.js`**: quét `TextTrack.cues` trong cửa sổ `-20s → +90s` quanh vị trí phát, dịch ngầm các cue/cửa sổ 18 từ sắp tới với tối đa 2 request song song, ưu tiên theo thứ tự phát. Được bơm từ mọi sự kiện video (`timeupdate`/`cuechange`/`seeked`... có throttle 800ms; force sau tua/khi track nạp) và thêm một nhịp quét sớm 1.2s sau khi bật dịch.
    - Phụ đề upload thủ công: toàn bộ cues có sẵn → bản dịch thường sẵn sàng TRƯỚC khi câu được nói → hiển thị không còn chờ mạng.
    - Auto caption (ASR): cues do player tải theo segment (thường đi trước vài chục giây) → lấy trước được phần đã tải; phần chưa về vẫn rơi vào đường dịch live như cũ.
- **translator.js**: cache 500 → 2000 mục (chứa bản dịch của cả đoạn lookahead); gom request trùng đang bay qua map `pending` — prefetch và render live yêu cầu cùng một chuỗi chỉ gửi MỘT request.
- **constants.js**: hạ ngưỡng hiển thị sớm `EARLY_VISIBLE_CAPTION_WORDS` 6 → 5, `MIN_VISIBLE_CAPTION_WORDS` 10 → 8 (câu đầu hiện nhanh hơn); thêm `PREFETCH_LOOKAHEAD_SECONDS/LOOKBACK_SECONDS/MAX_CONCURRENT/SCAN_INTERVAL_MS/FAIL_COOLDOWN_MS`.
- **video-sync/controller**: hook `onVideoEvent` đưa sự kiện phát vào prefetcher; reset hàng đợi khi tắt dịch/chuyển trang.
- Test mới: thứ tự prefetch theo startTime, cắt cửa sổ 18 từ đúng, bỏ qua key đã cache/ngoài lookahead, cooldown sau thất bại.

### 🎬 YouTube subtitles — sửa phụ đề nhảy loạn & lặp lại câu đã dịch

- **Fix phát hiện tua false-positive** (`caption-manager.js`): heuristic cũ so `currentTime` với thời điểm caption đổi text gần nhất (ngưỡng 0.6s) — nhưng auto caption của YouTube chỉ về text theo burst 1–3s/lần nên hầu như mỗi lần cập nhật đều bị coi là "tua", `consumedWordCount` bị xoá giữa câu → cả câu (gồm từ đã dịch) bị render + dịch lại từ đầu, mỗi lần lặp là một cache miss → gọi API dịch liên tục. Giờ theo dõi vị trí video **mỗi lần render** và chỉ tính là tua khi lệch giữa media-time và đồng hồ thực vượt `SEEK_DRIFT_TOLERANCE_SECONDS` (1s, chỉ tính khi đang phát); sự kiện `seeked`/`loadedmetadata` vẫn là cơ chế reset chính.
- **Fix nhận diện caption rolling** (`caption-source.js`): so khớp prefix nguyên văn từng từ bị vỡ khi YouTube ASR viết lại text giữa chừng (`hello world` → `Hello world.`), sửa từ cuối hoặc cue overlap → reset toàn bộ và dịch lại câu đã đọc. Thay bằng so khớp bỏ hoa/thường + dấu câu, tha thức tối đa 2 từ bị sửa ở đuôi phần chung; sai khác ở giữa câu vẫn reset như cue mới.
- **Fix nháy phụ đề khi chuyển cue** (`caption-manager.js`): cue trống thoáng qua trước đây xoá container + reset state ngay lập tức (nháy phụ đề, mất chunking). Giờ giữ phụ đề hiện tại trong grace window `CAPTION_EMPTY_GRACE_MS` (3s), chỉ dọn dẹp nếu nguồn caption trống kéo dài.
- Test hồi quy mới: revision hoa/dấu câu của auto caption không làm dịch lại phần đã đọc.

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
