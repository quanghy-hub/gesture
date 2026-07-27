# Chrome Web Store Metadata & Publishing Guide

> **Extension Name**: Gesture
> **Version**: 1.1.0
> **Category**: Productivity / Accessibility
> **Manifest Version**: 3
> **Last Updated**: 2026-07-21

---

## 1. Store Listing Copy

### Short Description (Max 132 chars)

Forum layout plus desktop and mobile gestures for Chromium and Kiwi Browser.

### Detailed Description (User-facing)

Gesture enhances your web browsing experience across desktop and mobile Chromium browsers with intuitive gestures, Picture-in-Picture video tools, instant inline translation, and customizable forum reading layouts.

#### 🌟 Key Features

- 🖱️ **Desktop & Mobile Gestures**: Perform quick actions with mouse clicks, trackpad swipes, or touch edge swipes — navigate pages, open links in background/foreground tabs, or close tabs effortlessly.
- 🖼️ **Picture-in-Picture & Floating Video**: Watch videos in a floating window with 2-finger trackpad seeking, custom aspect ratio fitting, rotation, and video quality controls.
- 📸 **Video Screenshots & Frame Capture**: Take instant high-resolution screenshots or capture video clips directly from any HTML5 video player.
- 🔤 **Instant Inline Translation**: Highlight text anywhere on the web to translate it in-place using customizable hotkeys, gestures, or selection popups. Supports editable fields (inputs, textareas, contenteditable).
- 🔍 **Multi-Engine Quick Search**: Select text or long-press images to quickly search across Google, Perplexity, ChatGPT, Gemini, Claude, YouTube, and more.
- 📋 **Floating Clipboard Manager**: Keep a searchable history of copied snippets, pin important items, and paste directly into forms.
- 💬 **Bilingual YouTube Subtitles**: Display real-time dual-language subtitles on YouTube videos with draggable positioning and custom styling.
- 📖 **Smart Forum Layout**: Automatically optimizes post layouts and expands reading width on forum sites (vBulletin, XenForo, phpBB, Discourse).
- 🔓 **Unblock Copy**: Restore text selection and right-click functionality on websites that disable copying.
- ☁️ **Cloudflare Configuration Sync**: Synchronize your settings smoothly across desktop and mobile profiles.

---

## 2. Single Purpose Statement

"Gesture provides global web navigation gestures, video controls, inline translation, and reading layout enhancements to streamline daily browser interactions."

---

## 3. Permissions Justification

Every permission declared in `manifest.json` is strictly required for the extension's core user-facing functionality:

### API Permissions

| Permission       | Justification                                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`        | Required to save user preferences, custom gesture settings, pinned clipboard items, and local host exclusion rules across browser sessions.                               |
| `tabs`           | Required to create new background/foreground tabs from gesture links, close active tabs via gesture actions, and capture active tab screenshots for video frame analysis. |
| `downloads`      | Required to save captured video screenshots and recorded video clips directly to the user's Downloads folder upon request.                                                |
| `scripting`      | Required to dynamically inject content script bundles and MAIN-world video quality APIs into web pages while respecting the user's domain exclusion list.                 |
| `clipboardWrite` | Required to copy translated text snippets, forum excerpts, and OCR results to the system clipboard when the user clicks copy action buttons.                              |

### Host Permissions

| Host Permission | Justification                                                                                                                                                                                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<all_urls>`    | Required because Gesture features (mouse/touch gestures, floating video PiP, inline translation, screenshot capture, and copy unblocking) operate globally across all web pages visited by the user. Restricting to specific domains would break the extension's primary purpose of unified browser-wide navigation. |

---

## 4. Privacy & Data Disclosures

- **Data Collection**: No personal data, browsing history, or user identifiers are collected, tracked, or transmitted to third-party tracking servers.
- **Remote Code**: The extension contains **zero remote code**. All script logic is bundled locally inside the extension package (`dist/content-bundle.js`, `dist/page-api-bundle.js`).
- **Data Usage**: Configuration data synchronized via Cloudflare Workers is encrypted via user-provided API tokens and stored exclusively in the user's private KV namespace.
- **Network Requests**: External API calls are strictly user-initiated (e.g. translation requests sent to Google Translate or MyMemory APIs, or OCR requests sent to OCR.space when explicitly requested).

---

## 5. Pre-Submission Review Checklist

- [x] Manifest Version is 3
- [x] Icons exist in all required sizes (`16x16`, `32x32`, `48x48`, `128x128`) inside `icons/`
- [x] All permissions and host permissions have plain-English justifications
- [x] No `eval()` or dynamic code loading used in extension pages
- [x] Content scripts bundled locally into `dist/` directory
- [x] Automated test suite passing (41/41 tests)
- [x] No sensitive keys or secrets hardcoded in release artifacts

---

## 6. Version History

### Version 1.1.0 (2026-07-21)

- Bundled 44 content script files into unified isolated and main-world bundles (`dist/content-bundle.js`, `dist/page-api-bundle.js`).
- Enhanced `postMessage` security validation with origin checks, frame source validation, and strict command whitelisting.
- Persisted rate-limit cooldown state to `chrome.storage.session`.
- Expanded automated test suite from 20 to 41 tests.
