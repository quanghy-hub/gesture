# CHANGELOG

Tất cả những thay đổi quan trọng của dự án **Gesture Suite Extension** được ghi lại tại đây.

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
