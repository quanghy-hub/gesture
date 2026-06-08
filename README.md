# Gesture Suite Extension

Chromium Extension Manifest V3 được tách module từ các userscript:

- `forum.js` → forum layout feature
- `gestures.js` → desktop gestures feature
- `gsmobile.js` → mobile gestures feature

## Kiến trúc

- `background/` service worker xử lý tab actions
- `shared/` storage, config schema, runtime helpers, tab bridge
- `content/` các module feature chạy trên page
- `ui/popup/` quick toggles
- `icons/` icon của extension cho toolbar/extensions page

## Cài trên Chromium desktop / Helium macOS

1. Mở `chrome://extensions`
2. Bật **Developer mode**
3. Chọn **Load unpacked**
4. Trỏ đến thư mục repo này, nơi có `manifest.json`
5. Sau khi đổi branch hoặc sửa file, bấm **Reload** extension trong Helium/Chromium

## Cài trên Kiwi Browser

1. Chép thư mục `extension` lên thiết bị Android
2. Mở Kiwi → Extensions
3. Bật developer mode nếu cần
4. Load unpacked / cài từ thư mục phù hợp với bản Kiwi của bạn

## Cloudflare Sync

Popup có panel **Cloudflare Sync** dùng chung Worker `extension` và app namespace `gesture`:

- Worker URL mặc định: `https://extension.quavav15-6.workers.dev`
- API code là secret `SYNC_API_KEY` của Worker.
- `MacBook` và `Mobile` là 2 profile config riêng trong `/sync/gesture/state`.
- `Đẩy lên` chỉ lưu config của profile đang chọn.
- `Kéo về` chỉ tải config của profile đang chọn.
- Auto sync chạy mặc định khi profile đang chọn đã có Worker URL/API code.

## Ghi chú hiệu năng

- Chuyển từ userscript sang extension không tự động tăng tốc nhiều nếu logic DOM vẫn giữ nguyên.
- Lợi ích chính của bản extension này là kiến trúc sạch hơn, tránh trùng lặp, tách module rõ ràng và dễ tối ưu tiếp.
- Điểm nóng hiệu năng lớn nhất vẫn là `MutationObserver`, DOM query và layout/reflow, đặc biệt ở forum layout.
- Forum layout hiện có thêm cơ chế cache theo host để content script biết sớm khi nào cần ẩn layout cũ và chỉ hiện layout mới mượt hơn.

## Ghi chú tương thích

- Gestures không còn chặn riêng `mail.google.com`; mọi site HTTP/HTTPS đều có thể chạy, trừ khi bị xung đột bởi chính trang đó.
- Runtime vẫn tách desktop/mobile ở mức event listener nội bộ, nhưng không còn khóa cứng theo nhận diện thiết bị để tránh trường hợp máy cảm ứng hoặc môi trường lai làm gestures bị tắt toàn bộ.
- Settings giờ được gom trực tiếp trong **popup** thành một bảng duy nhất, không cần mở rộng sang trang hay khung nổi riêng.
- Scroll gestures được gom trong popup: fast scroll desktop dùng `Command + ↑/↓` trên macOS, `Ctrl + ↑/↓` trên Windows/Linux, hoặc cuộn chuột ở vùng mép phải; mobile chỉ còn edge swipe một ngón.
- Nhánh `macos` ưu tiên Helium/Chromium trên macOS: trackpad được lọc kỹ hơn để tránh kích hoạt nhầm khi swipe ngang, pinch/zoom hoặc scroll nhẹ.
- Tua video bằng trackpad macOS: vuốt 2 ngón sang phải để tua tới, vuốt sang trái để tua lùi.
- macOS không gửi số ngón trackpad cho Chromium extension, và gesture hệ thống như Mission Control/App Exposé được hệ điều hành chặn trước trang web. Muốn dùng 4 ngón cho extension cần tắt hoặc đổi shortcut 4 ngón trong System Settings trước.
- Pager giờ hoạt động theo số lần cuộn được gom trong cửa sổ thời gian: **1 cuộn = 1 trang, 2 cuộn = 2 trang, 3 cuộn = 3 trang, và từ ngưỡng tối đa trở lên sẽ đi thẳng tới đầu/cuối**.
- Bản này phù hợp để load unpacked trên Chromium desktop và Kiwi; nếu cần phát hành lâu dài, bước tiếp theo nên thêm build pipeline, lint và test checklist.

## Giải trình về Quyền hạn `<all_urls>` (Host Permissions Rationale)

Extension này yêu cầu quyền `<all_urls>` trong `manifest.json` vì các tính năng cốt lõi sau đây hoạt động trên phạm vi toàn cục và cần tương tác trực tiếp với DOM của mọi trang web:

1. **Gestures (Cử chỉ toàn cục)**: Hỗ trợ người dùng thực hiện các cử chỉ vuốt trackpad/chuột, nhấn giữ, nhấp đúp hoặc vuốt mép màn hình để thực hiện hành động nhanh (như chuyển tab, đóng tab, cuộn trang) trên mọi trang web.
2. **Inline Translate (Dịch thuật tại chỗ)**: Cho phép bôi đen văn bản và dịch trực tiếp ngay tại vị trí con trỏ trên bất kỳ website nào bằng tổ hợp phím tắt hoặc cử chỉ chuột.
3. **Floating Video & Screenshot (Video nổi & Chụp ảnh màn hình)**: Tự động phát hiện các thẻ `<video>` trên mọi trang web để cung cấp thanh công cụ chụp ảnh màn hình, quay video clip ngắn và kích hoạt chế độ Picture-in-Picture (Video nổi).
4. **OCR (Nhận diện chữ trên ảnh)**: Cho phép trích xuất văn bản từ hình ảnh hoặc khung hình video trực tiếp trên bất kỳ trang web nào để phục vụ dịch thuật hoặc sao chép.

Việc cấp quyền này đảm bảo trải nghiệm người dùng liền mạch và nhất quán trên toàn bộ môi trường duyệt web mà không bị gián đoạn hay giới hạn bởi tên miền. Chúng tôi cam kết không thu thập, lưu trữ hoặc truyền tải bất kỳ dữ liệu cá nhân hay lịch sử duyệt web nào của người dùng.
