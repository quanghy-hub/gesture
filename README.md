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

## Cài trên Chromium desktop

1. Mở `chrome://extensions`
2. Bật **Developer mode**
3. Chọn **Load unpacked**
4. Trỏ đến thư mục `extension`

## Cài trên Kiwi Browser

1. Chép thư mục `extension` lên thiết bị Android
2. Mở Kiwi → Extensions
3. Bật developer mode nếu cần
4. Load unpacked / cài từ thư mục phù hợp với bản Kiwi của bạn

## Ghi chú hiệu năng

- Chuyển từ userscript sang extension không tự động tăng tốc nhiều nếu logic DOM vẫn giữ nguyên.
- Lợi ích chính của bản extension này là kiến trúc sạch hơn, tránh trùng lặp, tách module rõ ràng và dễ tối ưu tiếp.
- Điểm nóng hiệu năng lớn nhất vẫn là `MutationObserver`, DOM query và layout/reflow, đặc biệt ở forum layout.
- Forum layout hiện có thêm cơ chế cache theo host để content script biết sớm khi nào cần ẩn layout cũ và chỉ hiện layout mới mượt hơn.

## Ghi chú tương thích

- Gestures không còn chặn riêng `mail.google.com`; mọi site HTTP/HTTPS đều có thể chạy, trừ khi bị xung đột bởi chính trang đó.
- Runtime vẫn tách desktop/mobile ở mức event listener nội bộ, nhưng không còn khóa cứng theo nhận diện thiết bị để tránh trường hợp máy cảm ứng hoặc môi trường lai làm gestures bị tắt toàn bộ.
- Settings giờ được gom trực tiếp trong **popup** thành một bảng duy nhất, không cần mở rộng sang trang hay khung nổi riêng.
- Scroll gestures được gom trong popup: fast scroll desktop dùng `Ctrl + ↑/↓` hoặc cuộn chuột ở vùng mép phải; mobile chỉ còn edge swipe một ngón.
- Pager giờ hoạt động theo số lần cuộn được gom trong cửa sổ thời gian: **1 cuộn = 1 trang, 2 cuộn = 2 trang, 3 cuộn = 3 trang, và từ ngưỡng tối đa trở lên sẽ đi thẳng tới đầu/cuối**.
- Bản này phù hợp để load unpacked trên Chromium desktop và Kiwi; nếu cần phát hành lâu dài, bước tiếp theo nên thêm build pipeline, lint và test checklist.
