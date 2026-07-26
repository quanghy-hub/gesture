const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert').strict;

console.log('\x1b[36m==================================================\x1b[0m');
console.log('\x1b[36m    CHẠY BỘ KIỂM THỬ TỰ ĐỘNG - GESTURE SUITE      \x1b[0m');
console.log('\x1b[36m==================================================\x1b[0m');

// Mock classes for DOM elements in Node.js VM context
class MockNode {}
class MockElement extends MockNode {}
class MockHTMLInputElement extends MockElement {}
class MockHTMLTextAreaElement extends MockElement {}

// 1. Khởi tạo môi trường giả lập (Sandbox)
const mockStorageState = {};
const sandbox = {
    globalThis: {},
    console: {
        log: () => {},
        warn: () => {},
        error: console.error
    },
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    URL: globalThis.URL,
    AbortController: globalThis.AbortController,
    Event: class { constructor(type) { this.type = type; } },
    Node: MockNode,
    Element: MockElement,
    HTMLInputElement: MockHTMLInputElement,
    HTMLTextAreaElement: MockHTMLTextAreaElement,
    // Mock chrome API cần thiết
    chrome: {
        runtime: {
            getURL: (p) => p,
            lastError: null
        },
        storage: {
            local: {
                get: (keys, callback) => {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    const res = {};
                    keyList.forEach(k => {
                        if (mockStorageState[k] !== undefined) res[k] = mockStorageState[k];
                    });
                    if (typeof callback === 'function') callback(res);
                    return Promise.resolve(res);
                },
                set: (payload, callback) => {
                    Object.assign(mockStorageState, payload);
                    if (typeof callback === 'function') callback();
                    return Promise.resolve();
                }
            }
        },
        tabs: {
            create: async (opts) => ({ id: 101, ...opts }),
            remove: async (id) => true,
            captureVisibleTab: async (winId, opts) => 'data:image/png;base64,mockCapture'
        },
        downloads: {
            download: async (opts) => 999
        }
    },
    fetch: async (url, opts) => {
        if (url.includes('/sync/')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ revision: 5, profiles: { macbook: { settings: { config: { version: 1 } } }, mobile: { settings: { config: { version: 1 } } } } })
            };
        }
        if (url.includes('mymemory')) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ responseData: { translatedText: 'Xin chào' } })
            };
        }
        return {
            ok: true,
            status: 200,
            json: async () => [[['Xin chào', 'Hello', null, null, 1]], null, 'en'],
            blob: async () => ({ type: 'image/png', arrayBuffer: async () => new ArrayBuffer(8) })
        };
    },
    importScripts: () => {},
    navigator: {
        userAgent: 'Node.js test environment'
    }
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.document = {
    permissionsPolicy: null,
    featurePolicy: null,
    createElement: () => ({ style: {}, remove: () => {} }),
    body: { appendChild: () => {} },
    activeElement: null
};

// Helper đọc và chạy file JS trong sandbox
const loadScript = (filePath) => {
    const fullPath = path.resolve(__dirname, '..', filePath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInNewContext(code, sandbox, { filename: filePath });
};

// Nạp các script cần thiết
try {
    loadScript('shared/namespace.js');
    loadScript('shared/messaging.js');
    loadScript('shared/config-utils.js');
    loadScript('shared/config-schema.js');
    loadScript('shared/config-normalize.js');
    loadScript('shared/config.js');
    loadScript('shared/storage.js');
    loadScript('shared/cloudflare-sync-state.js');
    loadScript('shared/cloudflare-sync-api.js');
    loadScript('shared/cloudflare-sync-auto.js');
    loadScript('shared/cloudflare-sync.js');
    loadScript('shared/selection-query.js');
    loadScript('shared/selection-snapshot.js');
    loadScript('shared/selection-modifier.js');
    loadScript('shared/selection-core.js');
    loadScript('background/api-services/translate-utils.js');
    loadScript('background/api-services/translate-google.js');
    loadScript('background/api-services/translate-providers.js');
    loadScript('background/api-services/translate-api.js');
    loadScript('background/api-services/ocr-api.js');
    loadScript('background/api-service-registry.js');
    loadScript('background/message-handlers.js');
    loadScript('shared/extension-ui-guard.js');
    loadScript('shared/dom-utils.js');
    loadScript('shared/touch-core.js');
    loadScript('content/quick-search/constants.js');
    loadScript('content/youtube-subtitles/constants.js');
    loadScript('content/youtube-subtitles/caption-source.js');
    console.log('\x1b[32m✔ Nạp các module thành công.\x1b[0m');
} catch (error) {
    console.error('\x1b[31m✘ Thất bại khi nạp module:\x1b[0m', error);
    process.exit(1);
}

const {
    normalizeHost,
    normalizeConfig,
    getGestureSettings,
    getForumConfig,
    updateForumHostConfig,
    isVideoFloatingBackgroundSeekExcluded,
    setVideoFloatingBackgroundSeekExcluded,
    isGestureHostExcluded,
    setGestureHostExcluded
} = sandbox.globalThis.GestureExtension.shared.config;
const { storage, cloudflareSync, selectionCore, domUtils, touchCore } = sandbox.globalThis.GestureExtension.shared;
const { messageHandlers } = sandbox.globalThis.GestureExtension.background;
const { splitTranslateText } = sandbox.globalThis.GestureExtension.background.apiServiceRegistry;
const { captionSource } = sandbox.globalThis.GestureExtension.youtubeSubtitles;
const { quickSearch } = sandbox.globalThis.GestureExtension;

// Chuyển đổi dữ liệu từ ngữ cảnh VM sang ngữ cảnh Main để tránh lỗi lệch prototype Array
const toMainContext = (val) => {
    if (val === undefined) return undefined;
    return JSON.parse(JSON.stringify(val));
};

let successCount = 0;
let failCount = 0;

function runTest(name, fn) {
    try {
        const res = fn();
        if (res && typeof res.then === 'function') {
            return res.then(() => {
                console.log(`\x1b[32m✔ [PASSED]\x1b[0m ${name}`);
                successCount++;
            }).catch((error) => {
                console.error(`\x1b[31m✘ [FAILED]\x1b[0m ${name}`);
                console.error(error);
                failCount++;
            });
        }
        console.log(`\x1b[32m✔ [PASSED]\x1b[0m ${name}`);
        successCount++;
    } catch (error) {
        console.error(`\x1b[31m✘ [FAILED]\x1b[0m ${name}`);
        console.error(error);
        failCount++;
    }
}

async function runAllTests() {

// ============================================================================
// 1. normalizeHost() Tests
// ============================================================================
runTest('normalizeHost: chuẩn hóa domain thông thường', () => {
    assert.equal(normalizeHost('google.com'), 'google.com');
    assert.equal(normalizeHost('GOOGLE.COM  '), 'google.com');
});

runTest('normalizeHost: loại bỏ www. của domain 3 cấp trở lên', () => {
    assert.equal(normalizeHost('www.google.com'), 'google.com');
    assert.equal(normalizeHost('www.sub.google.com'), 'sub.google.com');
});

runTest('normalizeHost: giữ nguyên www. nếu domain chỉ có 2 cấp', () => {
    assert.equal(normalizeHost('www.com'), 'www.com');
});

runTest('normalizeHost: tước bỏ protocol và các path/query rác', () => {
    assert.equal(normalizeHost('https://github.com/quanghy-hub/gesture'), 'github.com');
    assert.equal(normalizeHost('http://localhost:8080/popup.html?v=1'), '');
});

runTest('normalizeHost: loại bỏ ký tự đại diện wildcard (*.) ở đầu', () => {
    assert.equal(normalizeHost('*.google.com'), 'google.com');
    assert.equal(normalizeHost('www.*.google.com'), '');
});

runTest('normalizeHost: trả về chuỗi rỗng cho host không hợp lệ', () => {
    assert.equal(normalizeHost('invalid_host'), '');
    assert.equal(normalizeHost('...'), '');
    assert.equal(normalizeHost(''), '');
    assert.equal(normalizeHost(null), '');
});


// ============================================================================
// 2. normalizeConfig() Tests
// ============================================================================
runTest('normalizeConfig: khôi phục giá trị mặc định cho cấu hình rỗng', () => {
    const config = toMainContext(normalizeConfig({}));
    assert.equal(config.version, 1);
    assert.equal(config.clipboard.enabled, true);
    assert.equal(config.clipboard.maxHistory, 5);
});

runTest('normalizeConfig: giới hạn (clamp) các số cấu hình ngoài tầm', () => {
    const config = toMainContext(normalizeConfig({
        clipboard: { maxHistory: 99 },
        quickSearch: { columns: 1 }
    }));
    assert.equal(config.clipboard.maxHistory, 20);
    assert.equal(config.quickSearch.columns, 3);
});

runTest('videoFloating: chặn riêng background seek theo host và subdomain', () => {
    const config = normalizeConfig({
        videoFloating: {
            backgroundSeekExcludedHosts: ['https://www.tiktok.com/foryou']
        }
    });
    assert.equal(isVideoFloatingBackgroundSeekExcluded(config, 'm.tiktok.com'), true);
    assert.equal(isVideoFloatingBackgroundSeekExcluded(config, 'youtube.com'), false);

    const next = setVideoFloatingBackgroundSeekExcluded(config, 'https://example.com/watch', true);
    assert.equal(isVideoFloatingBackgroundSeekExcluded(next, 'www.example.com'), true);
});

runTest('gestures: chặn riêng cử chỉ theo host và subdomain', () => {
    const config = normalizeConfig({
        gestures: {
            excludedHosts: ['https://www.tiktok.com/foryou']
        }
    });
    assert.equal(isGestureHostExcluded(config, 'm.tiktok.com'), true);
    assert.equal(isGestureHostExcluded(config, 'youtube.com'), false);

    const next = setGestureHostExcluded(config, 'https://example.com/watch', true);
    assert.equal(isGestureHostExcluded(next, 'www.example.com'), true);
});

runTest('normalizeConfig: tối ưu hóa cờ _isNormalized hoạt động đúng', () => {
    const raw = { _isNormalized: true, customKey: 'hello' };
    const config = normalizeConfig(raw);
    assert.equal(config, raw);
});

runTest('getGestureSettings: chịu được config cũ chưa có closeTab', () => {
    const settings = getGestureSettings({
        _isNormalized: true,
        gestures: {
            desktop: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                rclick: { enabled: true, mode: 'fg' },
                pager: { enabled: true, hops: 3 }
            },
            mobile: {
                enabled: true,
                lpress: { enabled: true, mode: 'bg', ms: 500 },
                edge: { enabled: false, width: 40, speed: 3, side: 'both' }
            }
        }
    });
    assert.equal(settings.closeTab.enabled, false);
    assert.equal(settings.closeTab.ms, 150);
});


// ============================================================================
// 3. splitTranslateText() Tests
// ============================================================================
runTest('splitTranslateText: trả về mảng rỗng nếu chuỗi rỗng', () => {
    assert.deepEqual(toMainContext(splitTranslateText('')), []);
    assert.deepEqual(toMainContext(splitTranslateText(null)), []);
});

runTest('splitTranslateText: giữ nguyên chuỗi ngắn dưới giới hạn', () => {
    const text = 'Học đi đôi với hành.';
    assert.deepEqual(toMainContext(splitTranslateText(text, 50)), [text]);
});

runTest('splitTranslateText: tách phân đoạn thông minh qua dòng trống', () => {
    const p1 = 'Đoạn văn thứ nhất.';
    const p2 = 'Đoạn văn thứ hai.';
    const text = `${p1}\n\n${p2}`;
    const chunks = toMainContext(splitTranslateText(text, 20));
    assert.deepEqual(chunks, [p1, p2]);
});

runTest('splitTranslateText: phân tách cứng nếu từ quá dài', () => {
    const longWord = 'MộtTừSiêuSiêuDàiVượtQuáCảGiớiHạnKýTựChoPhép';
    const chunks = toMainContext(splitTranslateText(longWord, 10));
    assert.equal(chunks.length, 5);
    assert.equal(chunks.join(''), longWord);
});


// ============================================================================
// 4. YouTube subtitles captionSource Tests
// ============================================================================
runTest('captionSource: không tự chọn track phụ đề khi YouTube chưa bật CC', () => {
    const disabledTrack = {
        kind: 'captions',
        mode: 'disabled',
        language: 'en',
        activeCues: [{ text: 'Hello world' }],
        cues: []
    };
    const video = { currentTime: 1, textTracks: [disabledTrack] };

    assert.equal(captionSource.getActiveCaptionTrack(video, null), null);
    assert.equal(captionSource.extractCaptionText(video, null), '');
    assert.equal(disabledTrack.mode, 'disabled');
});

runTest('captionSource: giữ track đã bật để dịch sau khi ẩn native caption', () => {
    const showingTrack = {
        kind: 'subtitles',
        mode: 'showing',
        language: 'en',
        activeCues: [{ text: 'Hello   world' }],
        cues: []
    };
    const video = { currentTime: 1, textTracks: [showingTrack] };

    const activeTrack = captionSource.getActiveCaptionTrack(video, null);
    assert.equal(activeTrack, showingTrack);

    captionSource.hideNativeCaptionTrack(activeTrack);
    assert.equal(showingTrack.mode, 'hidden');
    assert.equal(captionSource.getActiveCaptionTrack(video, showingTrack), showingTrack);
    assert.equal(captionSource.extractCaptionText(video, showingTrack), 'Hello world');
});

runTest('youtubeSubtitles: hỗ trợ caption fallback khi mobile YouTube không expose nút CC desktop', () => {
    const controllerSource = fs.readFileSync(path.resolve(__dirname, '..', 'content/youtube-subtitles/controller.js'), 'utf8');
    const captionSourceSource = fs.readFileSync(path.resolve(__dirname, '..', 'content/youtube-subtitles/caption-source.js'), 'utf8');

    assert.match(controllerSource, /getActiveCaptionTrack\(video,\s*state\.captionTrack\)/);
    assert.match(controllerSource, /hasDomCaptionText\(\)/);
    assert.match(captionSourceSource, /extractCaptionTextFromDom/);
    assert.match(captionSourceSource, /\.caption-visual-line,\s*\.ytp-caption-segment/);
});

runTest('videoScreenshot trigger: dùng cùng drag affordance với nút dịch phụ đề', () => {
    const constantsSource = fs.readFileSync(path.resolve(__dirname, '..', 'content/video-screenshot/constants.js'), 'utf8');
    const controllerSource = fs.readFileSync(path.resolve(__dirname, '..', 'content/video-screenshot/controller.js'), 'utf8');

    assert.match(constantsSource, /triggerSize:\s*46/);
    assert.match(controllerSource, /triggerRef\.element\.style\.touchAction\s*=\s*'none'/);
    assert.match(controllerSource, /threshold:\s*4/);
    assert.match(controllerSource, /onMove:\s*\(\{\s*event,\s*deltaX,\s*deltaY,\s*origin\s*\}\)\s*=>\s*\{\s*floating\.stopFloatingEvent\(event\);/);
    assert.match(controllerSource, /triggerRef\.element\.addEventListener\('pointerdown',\s*\(event\)\s*=>\s*\{\s*floating\.stopFloatingEvent\(event\);/);
});


// ============================================================================
// 5. Storage API Module Tests
// ============================================================================
await runTest('storage: getConfig trả về default config chuẩn hóa', async () => {
    const config = await storage.getConfig();
    assert.equal(config.version, 1);
    assert.equal(config.clipboard.enabled, true);
});

await runTest('storage: saveConfig ghi cấu hình vào storage', async () => {
    const updated = await storage.saveConfig({ version: 1, clipboard: { enabled: false, maxHistory: 10 } });
    assert.equal(updated.clipboard.enabled, false);
    assert.equal(updated.clipboard.maxHistory, 10);
    const read = await storage.getConfig();
    assert.equal(read.clipboard.maxHistory, 10);
});

await runTest('storage: saveClipboardHistory thêm mục mới và cắt ngắn theo maxHistory', async () => {
    await storage.saveClipboardHistory('Item 1');
    await storage.saveClipboardHistory('Item 2');
    await storage.saveClipboardHistory('Item 3');
    const cfg = await storage.getConfig();
    assert.equal(cfg.clipboard.history[0], 'Item 3');
    assert.equal(cfg.clipboard.history[1], 'Item 2');
});

await runTest('storage: togglePinItem ghim và bỏ ghim mục', async () => {
    await storage.togglePinItem('Pinned Note');
    let cfg = await storage.getConfig();
    assert.ok(cfg.clipboard.pinned.includes('Pinned Note'));

    await storage.togglePinItem('Pinned Note');
    cfg = await storage.getConfig();
    assert.ok(!cfg.clipboard.pinned.includes('Pinned Note'));
});

await runTest('storage: clearClipboardHistory xóa lịch sử clipboard', async () => {
    await storage.clearClipboardHistory();
    const cfg = await storage.getConfig();
    assert.deepEqual(toMainContext(cfg.clipboard.history), []);
});


// ============================================================================
// 6. Background Message Handlers Tests
// ============================================================================
await runTest('messageHandlers: handleOpenTab yêu cầu URL hợp lệ', async () => {
    const res = await messageHandlers.handleOpenTab({}, { tab: { id: 1 } });
    assert.equal(res.ok, false);
    assert.equal(res.error, 'Missing url');
});

await runTest('messageHandlers: handleOpenTab tạo tab thành công', async () => {
    const res = await messageHandlers.handleOpenTab({ url: 'https://google.com', mode: 'fg' }, { tab: { id: 1, index: 0 } });
    assert.equal(res.ok, true);
    assert.equal(res.tabId, 101);
});

await runTest('messageHandlers: handleCloseCurrentTab đóng tab người gửi', async () => {
    const res = await messageHandlers.handleCloseCurrentTab({ tab: { id: 5 } });
    assert.equal(res.ok, true);
});

await runTest('messageHandlers: handleCloseCurrentTab báo lỗi nếu không có tab id', async () => {
    const res = await messageHandlers.handleCloseCurrentTab({});
    assert.equal(res.ok, false);
    assert.equal(res.error, 'No sender tab');
});

await runTest('messageHandlers: handleCaptureVisibleTab chụp ảnh window thành công', async () => {
    const res = await messageHandlers.handleCaptureVisibleTab({ tab: { windowId: 10 } });
    assert.equal(res.ok, true);
    assert.ok(res.url.startsWith('data:image/png'));
});

await runTest('messageHandlers: handleTranslateText xử lý dịch văn bản', async () => {
    const res = await messageHandlers.handleTranslateText({ text: 'Hello' });
    assert.equal(res.ok, true);
    assert.equal(res.result.text, 'Hello');
});


// ============================================================================
// 7. Cloudflare Sync & Settings Tests
// ============================================================================
await runTest('cloudflareSync: loadSettings nạp cấu hình mặc định', async () => {
    const settings = await cloudflareSync.loadSettings();
    assert.equal(settings.workerUrl, 'https://extension.quavav15-6.workers.dev');
    assert.equal(settings.profile, 'macbook');
    assert.equal(settings.mode, 'manual');
});

await runTest('cloudflareSync: saveSettings cập nhật thông số profile', async () => {
    const updated = await cloudflareSync.saveSettings({ profile: 'mobile', mode: 'auto' });
    assert.equal(updated.profile, 'mobile');
    assert.equal(updated.mode, 'auto');
});

await runTest('cloudflareSync: bootstrapProfile tải cấu hình từ cloud', async () => {
    const res = await cloudflareSync.bootstrapProfile({ profile: 'macbook', workerUrl: 'https://test.workers.dev', apiCode: 'secret' });
    assert.equal(res.action, 'pulled');
    assert.equal(res.state.revision, 5);
});


// ============================================================================
// 8. Selection Core Tests
// ============================================================================
runTest('selectionCore: isEditableTarget nhận diện chính xác các thẻ editable', () => {
    const mockInput = Object.create(sandbox.HTMLInputElement.prototype);
    mockInput.tagName = 'INPUT';
    mockInput.type = 'text';
    assert.equal(selectionCore.isEditableTarget(mockInput), true);

    const mockButton = Object.create(sandbox.HTMLInputElement.prototype);
    mockButton.tagName = 'INPUT';
    mockButton.type = 'submit';
    assert.equal(selectionCore.isEditableTarget(mockButton), false);
});

runTest('selectionCore: replaceSelectionSnapshot thay đổi giá trị input chuẩn xác', () => {
    let dispatchedInput = false;
    const mockInput = Object.create(sandbox.HTMLInputElement.prototype);
    mockInput.isConnected = true;
    mockInput.value = 'Hello World';
    mockInput.selectionStart = 6;
    mockInput.selectionEnd = 11;
    mockInput.getBoundingClientRect = () => ({ left: 10, top: 10, width: 100, height: 30, bottom: 40 });
    mockInput.focus = () => {};
    mockInput.setSelectionRange = () => {};
    mockInput.dispatchEvent = (evt) => { if (evt.type === 'input') dispatchedInput = true; };

    sandbox.document = sandbox.document || {};
    sandbox.document.activeElement = mockInput;

    const snapshot = selectionCore.getEditableSelectionSnapshot(mockInput);
    assert.ok(snapshot !== null, 'Snapshot should be generated');

    const success = selectionCore.replaceSelectionSnapshot(snapshot, 'Vietnam');
    assert.equal(success, true);
    assert.equal(mockInput.value, 'Hello Vietnam');
    assert.equal(dispatchedInput, true);
});


// ============================================================================
// 9. Security Validation & postMessage Whitelist Tests
// ============================================================================
runTest('security: iframe-mode kiểm tra origin/source và command whitelist', () => {
    const iframeSource = fs.readFileSync(path.resolve(__dirname, '..', 'content/video-floating/iframe-mode.js'), 'utf8');
    assert.match(iframeSource, /ALLOWED_IFRAME_COMMANDS/);
    assert.match(iframeSource, /event\.source\s*!==\s*window\.parent/);
    assert.match(iframeSource, /ALLOWED_IFRAME_COMMANDS\.has\(command\)/);
});

runTest('security: top-frame xác thực source window trước khi gán iframe state', () => {
    const topFrameSource = fs.readFileSync(path.resolve(__dirname, '..', 'content/video-floating/top-frame.js'), 'utf8');
    assert.match(topFrameSource, /ctx\.floatedIframe\?\.contentWindow\s*===\s*event\.source/);
    assert.match(topFrameSource, /typeof\s*event\.data\.state\s*===\s*'object'/);
});

runTest('security: page-api kiểm tra event source và bridge identity', () => {
    const pageApiSource = fs.readFileSync(path.resolve(__dirname, '..', 'content/video-floating/page-api.js'), 'utf8');
    assert.match(pageApiSource, /e\.source\s*!==\s*window/);
    assert.match(pageApiSource, /e\.data\.source\s*!==\s*FVP_IFRAME_BRIDGE/);
});


// ============================================================================
// 10. Build Bundles Integrity Tests
// ============================================================================
runTest('buildBundle: file dist/content-bundle.js phải tồn tại và > 400KB', () => {
    const bundlePath = path.resolve(__dirname, '..', 'dist/content-bundle.js');
    assert.equal(fs.existsSync(bundlePath), true, 'dist/content-bundle.js does not exist');
    const stat = fs.statSync(bundlePath);
    assert.ok(stat.size > 400000, `Bundle size ${stat.size} bytes is too small`);
});

runTest('buildBundle: file dist/page-api-bundle.js phải tồn tại và > 5KB', () => {
    const bundlePath = path.resolve(__dirname, '..', 'dist/page-api-bundle.js');
    assert.equal(fs.existsSync(bundlePath), true, 'dist/page-api-bundle.js does not exist');
    const stat = fs.statSync(bundlePath);
    assert.ok(stat.size > 5000, `Bundle size ${stat.size} bytes is too small`);
});


// ============================================================================
// 11. DOM Utils & Touch Core Tests
// ============================================================================
runTest('domUtils: escapeHtml mã hóa chính xác các ký tự đặc biệt XSS', () => {
    assert.equal(domUtils.escapeHtml('<script>alert("XSS") & "test"</script>'), '&lt;script&gt;alert(&quot;XSS&quot;) &amp; &quot;test&quot;&lt;/script&gt;');
});

runTest('domUtils: previewText cắt ngắn văn bản vượt quá độ dài tối đa', () => {
    const longText = 'Đây là một đoạn văn bản rất dài vượt quá giới hạn cho phép để hiển thị trong preview.';
    assert.equal(domUtils.previewText(longText, 20), 'Đây là một đoạn v...');
    assert.equal(domUtils.previewText('Ngắn', 20), 'Ngắn');
});

runTest('touchCore: getPrimaryPoint trích xuất tọa độ chính xác', () => {
    const touchEvent = { touches: [{ clientX: 150, clientY: 300 }] };
    assert.deepEqual(toMainContext(touchCore.getPrimaryPoint(touchEvent)), { x: 150, y: 300 });

    const pointerEvent = { clientX: 45, clientY: 90 };
    assert.deepEqual(toMainContext(touchCore.getPrimaryPoint(pointerEvent)), { x: 45, y: 90 });
});

runTest('touchCore: getDistance tính khoảng cách Euclid giữa 2 điểm', () => {
    const distance = touchCore.getDistance({ x: 0, y: 0 }, { x: 3, y: 4 });
    assert.equal(distance, 5);
});

runTest('touchCore: isTouchLikeEvent phân biệt touch và mouse events', () => {
    assert.equal(touchCore.isTouchLikeEvent({ touches: [] }), true);
    assert.equal(touchCore.isTouchLikeEvent({ clientX: 10 }), false);
});


// ============================================================================
// 12. Quick Search & Forum Config Tests
// ============================================================================
runTest('quickSearch: encodeQuery chuẩn hóa khoảng trắng và encode URI', () => {
    assert.equal(quickSearch.encodeQuery('  cử   chỉ   chrome  '), 'c%E1%BB%AD%20ch%E1%BB%89%20chrome');
});

runTest('quickSearch: buildProviderUrl thay thế {{q}} và {{img}} chính xác', () => {
    const url = quickSearch.buildProviderUrl('https://www.google.com/search?q={{q}}&img={{img}}', {
        text: 'hello world',
        imageUrl: 'https://example.com/test.png'
    });
    assert.equal(url, 'https://www.google.com/search?q=hello%20world&img=https%3A%2F%2Fexample.com%2Ftest.png');
});

runTest('forumConfig: getForumConfig kế thừa defaults và host overrides', () => {
    const baseConfig = normalizeConfig({});
    const defaultConfig = getForumConfig(baseConfig, 'unknown-forum.com');
    assert.equal(defaultConfig.enabled, false);
    assert.equal(defaultConfig.wide, true);
    assert.equal(defaultConfig.minWidth, 1000);

    const updated = updateForumHostConfig(baseConfig, 'voz.vn', { enabled: true, minWidth: 1200 });
    const vozConfig = getForumConfig(updated, 'voz.vn');
    assert.equal(vozConfig.enabled, true);
    assert.equal(vozConfig.minWidth, 1200);
});

// ============================================================================
// Kết luận
// ============================================================================
console.log('\x1b[36m==================================================\x1b[0m');
console.log(`Kết quả: \x1b[32m${successCount} thành công\x1b[0m, \x1b[31m${failCount} thất bại\x1b[0m`);
console.log('\x1b[36m==================================================\x1b[0m');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}

}

runAllTests().catch((err) => {
    console.error('Unhandled test execution error:', err);
    process.exit(1);
});
