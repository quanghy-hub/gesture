# Agent Memory Template — Gesture Unified Extension

## 1. Mục tiêu dự án
- Dự án đích: [gesture](gesture)
- Nguồn migration: [translate](translate)
- Mục tiêu: hợp nhất **toàn bộ content features chính** của [translate/src/content](translate/src/content) vào [gesture/content](gesture/content), sau đó chuẩn hóa config, popup settings, permissions, background và core dùng chung.

## 2. Trạng thái hiện tại
### Đã port vào [gesture/content](gesture/content)
- [gesture/content/clipboard](gesture/content/clipboard)
- [gesture/content/google-search](gesture/content/google-search)
- [gesture/content/quick-search](gesture/content/quick-search)
- [gesture/content/inline-translate](gesture/content/inline-translate)
- [gesture/content/video-screenshot](gesture/content/video-screenshot)
- [gesture/content/trusted-types](gesture/content/trusted-types)
- [gesture/content/youtube-subtitles](gesture/content/youtube-subtitles)

### Đã mở rộng hạ tầng
- [gesture/content/bootstrap.js](gesture/content/bootstrap.js) đã nạp các feature mới.
- [gesture/manifest.json](gesture/manifest.json) đã load các content scripts mới.
- [gesture/shared/config.js](gesture/shared/config.js) đã có thêm các namespace config mới.
- [gesture/background/service-worker.js](gesture/background/service-worker.js) đã có handler dịch tối thiểu [`gesture-ext/translate-text`](gesture/background/service-worker.js).

## 3. Định hướng kiến trúc hiện tại
### Quyết định mới nhất
- Ưu tiên **chuẩn hóa kiến trúc trước**.
- Chưa dọn popup settings chung ngay.
- Chưa refactor lớn một lần trên toàn bộ codebase.
- Trước tiên phải thiết kế và gom **floating-ui core dùng chung** cho các feature nổi.

### Các feature nổi mục tiêu cho core chung
- [gesture/content/clipboard/index.js](gesture/content/clipboard/index.js)
- [gesture/content/google-search/index.js](gesture/content/google-search/index.js)
- [gesture/content/quick-search/index.js](gesture/content/quick-search/index.js)

### Mức độ nhập core hiện tại
#### Đã nhập mạnh vào core
- [gesture/content/google-search/index.js](gesture/content/google-search/index.js)
  - đã dùng trigger/panel root chung
  - đã dùng drag behavior chung
  - đã dùng outside click guard chung
  - đã dùng clamp/positioning chung

- [gesture/content/clipboard/index.js](gesture/content/clipboard/index.js)
  - đã chuyển floating layer sang core
  - trigger/panel root/drag/outside click đã dùng core
  - business logic clipboard vẫn giữ riêng

#### Đang nhập dần vào core
- [gesture/content/quick-search/index.js](gesture/content/quick-search/index.js)
  - đã chuyển `ensureUiRoot()` sang [`createShadowRootHost()`](gesture/shared/floating/core.js)
  - đã chuyển toast sang [`createToast()`](gesture/shared/floating/core.js)
  - đã dọn một phần `createBubble()` ở tầng mount/lifecycle nhỏ
  - business logic selection/image actions vẫn giữ nguyên

### Các lớp logic đang trùng nhau
1. Trigger lifecycle
- tạo nút/icon nổi
- show/hide
- toggle panel
- drag state
- active state

2. Positioning / clamp
- clamp theo viewport
- neo theo input/anchor/selection
- reposition khi scroll / resize
- xử lý fallback khi chạm mép

3. Floating root / panel host
- tạo container nổi
- quản lý root overlay hoặc shadow host
- mount panel/bubble

4. Interaction guard
- `preventDefault`
- `stopPropagation`
- `stopImmediatePropagation`
- outside click
- click-vs-drag
- focus retention

## 4. Những gì đã làm
### Manifest / bootstrap
- Đã thêm load cho:
  - [gesture/content/google-search/index.js](gesture/content/google-search/index.js)
  - [gesture/content/quick-search/index.js](gesture/content/quick-search/index.js)
  - [gesture/content/inline-translate/index.js](gesture/content/inline-translate/index.js)
  - [gesture/content/video-screenshot/index.js](gesture/content/video-screenshot/index.js)
  - [gesture/content/trusted-types/index.js](gesture/content/trusted-types/index.js)
  - [gesture/content/youtube-subtitles/index.js](gesture/content/youtube-subtitles/index.js)
- Đã nối feature registry trong [gesture/content/bootstrap.js](gesture/content/bootstrap.js).

### Config schema
Đã thêm vào [gesture/shared/config.js](gesture/shared/config.js):
- `googleSearch`
- `quickSearch`
- `inlineTranslate`
- `trustedTypes`
- `youtubeSubtitles`

### Background
Đã có trong [gesture/background/service-worker.js](gesture/background/service-worker.js):
- mở tab
- đóng tab
- dịch text qua Google Translate

### Popup settings
Đã có tối thiểu trong [gesture/ui/popup/popup.html](gesture/ui/popup/popup.html) và [gesture/ui/popup/popup.js](gesture/ui/popup/popup.js):
- Clipboard
- Google Search
- Quick Search

## 5. Những gì CHƯA làm xong
### A. Chuẩn hóa kiến trúc trước
Cần tạo core mới trong [gesture/shared](gesture/shared) hoặc [gesture/content](gesture/content), ưu tiên ở [gesture/shared](gesture/shared):
- [gesture/shared/floating/](gesture/shared/floating)
  - `trigger.js`
  - `positioning.js`
  - `panel-root.js`
  - `interaction-guard.js`
  - `drag.js`
  - `helpers.js`

#### Bước refactor theo thứ tự
1. Refactor [gesture/content/google-search/index.js](gesture/content/google-search/index.js) dùng core trước
2. Refactor [gesture/content/clipboard/index.js](gesture/content/clipboard/index.js)
3. Refactor [gesture/content/quick-search/index.js](gesture/content/quick-search/index.js)

Lý do thứ tự này:
- Google Search có trigger/panel đơn giản nhất
- Clipboard có trigger/panel phức tạp hơn do bám input + insert text
- Quick Search có bubble root + selection/image context phức tạp nhất

### B. Popup / settings chung
Chỉ làm sau khi core kiến trúc ổn hơn.

Cần nối thêm vào popup chung:
- `inlineTranslate.enabled`
- `inlineTranslate.hotkey`
- `inlineTranslate.swipeEnabled`
- `inlineTranslate.swipeDir`
- `inlineTranslate.swipePx`
- `inlineTranslate.fontScale`
- `inlineTranslate.mutedColor`
- `trustedTypes.enabled`
- `trustedTypes.allowDomains`
- `youtubeSubtitles.enabled`
- `youtubeSubtitles.targetLang`
- `youtubeSubtitles.fontSize`
- `youtubeSubtitles.translatedFontSize`
- `youtubeSubtitles.originalColor`
- `youtubeSubtitles.translatedColor`
- `youtubeSubtitles.displayMode`
- `youtubeSubtitles.showOriginal`

### C. Permissions / manifest cleanup
Cần rà soát [gesture/manifest.json](gesture/manifest.json):
- có thể cần `downloads` cho [gesture/content/video-screenshot/index.js](gesture/content/video-screenshot/index.js)
- có thể cần `web_accessible_resources` nếu về sau tách lại injected page scripts
- cần rà soát host permissions cho các API/host đặc thù

### D. Kiểm thử tích hợp
Cần test lại:
- xung đột event giữa các content features
- xung đột CSS overlay/floating UI
- lifecycle khi nhiều feature cùng chạy trên một trang
- riêng [gesture/content/youtube-subtitles/index.js](gesture/content/youtube-subtitles/index.js) cần test kỹ trên YouTube thực tế

## 6. Những chỗ có rủi ro cao
### [gesture/content/youtube-subtitles/index.js](gesture/content/youtube-subtitles/index.js)
- là nhánh lớn và nhạy nhất
- phụ thuộc nhiều vào DOM YouTube
- cần test `yt-navigate-finish`, `textTracks`, `caption DOM fallback`, kéo thả container
- hiện đã bỏ settings panel tại trang, dự định đưa về popup chung

### [gesture/content/video-screenshot/index.js](gesture/content/video-screenshot/index.js)
- cần xác minh `chrome.downloads.download()` có permission phù hợp trong [gesture/manifest.json](gesture/manifest.json)

### [gesture/content/quick-search/index.js](gesture/content/quick-search/index.js)
- đang dùng icon/bubble runtime tự inject trong shadow root
- là ứng viên rõ nhất để chuyển sang `floating root` dùng chung

## 7. Kế hoạch chi tiết giai đoạn cuối
### Giai đoạn 1 — Architecture first
#### Step 1.1
Tạo folder core:
- [gesture/shared/floating](gesture/shared/floating)

#### Step 1.2
Thiết kế API dùng chung tối thiểu:
- `createFloatingTrigger()`
- `createFloatingPanelRoot()`
- `clampToViewport()`
- `bindDragBehavior()`
- `guardFloatingEvent()`

#### Step 1.3
Refactor thử nghiệm:
- bắt đầu từ [gesture/content/google-search/index.js](gesture/content/google-search/index.js)
- mục tiêu: giảm code trigger/drag/panel positioning lặp lại

#### Step 1.4
Refactor tiếp:
- [gesture/content/clipboard/index.js](gesture/content/clipboard/index.js)
- [gesture/content/quick-search/index.js](gesture/content/quick-search/index.js)

### Giai đoạn 2 — Popup settings chung
Sau khi Step 1.4 ổn định:
- mở rộng [gesture/ui/popup/popup.html](gesture/ui/popup/popup.html)
- mở rộng [gesture/ui/popup/popup.js](gesture/ui/popup/popup.js)
- đưa các setting của inline translate / trusted types / youtube subtitles vào popup chung

### Giai đoạn 3 — Manifest / permissions
- rà [gesture/manifest.json](gesture/manifest.json)
- thêm `downloads` nếu cần
- cân nhắc `web_accessible_resources`
- rà host permissions tối thiểu cần thiết

### Giai đoạn 4 — Integration testing
1. test clipboard trên input/contenteditable
2. test quick search selection + image bubble
3. test google search floating panel
4. test inline translate hotkey/swipe
5. test video screenshot download
6. test trusted types allowlist
7. test youtube subtitles trên YouTube watch page

## 8. Cách dùng template này cho agent khác
Khi mở task mới, agent phải đọc file này và trả lời 6 câu trước khi code:
1. Mục tiêu hiện tại là port feature hay chuẩn hóa kiến trúc?
2. Những feature nào đã port xong?
3. Feature nào là rủi ro cao nhất?
4. Core dùng chung đã được tạo chưa?
5. Popup settings đang ở giai đoạn nào?
6. Bước tiếp theo thuộc Giai đoạn 1, 2, 3 hay 4?

## 9. Prompt mẫu cho agent lần sau
"Đọc [gesture/docs/agent-memory-template.md](gesture/docs/agent-memory-template.md), xác định bước hiện tại trong Giai đoạn 1/2/3/4, chỉ sửa đúng những file cần cho bước đó, rồi cập nhật lại memory nếu trạng thái thay đổi."

## 10. Định nghĩa hoàn thành dự án gộp
Dự án chỉ được coi là hoàn thành khi:
- mọi content features chính từ [translate/src/content](translate/src/content) đã có bản tương đương ổn định trong [gesture/content](gesture/content)
- popup chung trong [gesture/ui/popup](gesture/ui/popup) quản lý được các setting chính
- [gesture/manifest.json](gesture/manifest.json) đã đủ permissions và content scripts cần thiết
- background trong [gesture/background/service-worker.js](gesture/background/service-worker.js) đáp ứng các feature đã port
- đã dọn bước đầu kiến trúc dùng chung cho floating UI
- đã test tích hợp các nhánh rủi ro cao, đặc biệt là [gesture/content/youtube-subtitles/index.js](gesture/content/youtube-subtitles/index.js)
