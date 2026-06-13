const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert').strict;

console.log('\x1b[36m==================================================\x1b[0m');
console.log('\x1b[36m    CHẠY BỘ KIỂM THỬ TỰ ĐỘNG - GESTURE SUITE      \x1b[0m');
console.log('\x1b[36m==================================================\x1b[0m');

// 1. Khởi tạo môi trường giả lập (Sandbox)
const sandbox = {
    globalThis: {},
    console: {
        log: () => {},
        warn: () => {},
        error: console.error
    },
    // Mock chrome API cần thiết
    chrome: {
        runtime: {
            getURL: (p) => p
        },
        storage: {
            local: {
                get: () => {},
                set: () => {}
            }
        }
    },
    importScripts: () => {},
    navigator: {
        userAgent: 'Node.js test environment'
    }
};
sandbox.globalThis = sandbox;

// Helper đọc và chạy file JS trong sandbox
const loadScript = (filePath) => {
    const fullPath = path.resolve(__dirname, '..', filePath);
    const code = fs.readFileSync(fullPath, 'utf8');
    vm.runInNewContext(code, sandbox, { filename: filePath });
};

// Nạp các script cần thiết
try {
    loadScript('shared/namespace.js');
    loadScript('shared/config-utils.js');
    loadScript('shared/config-schema.js');
    loadScript('shared/config-normalize.js');
    loadScript('shared/config.js');
    loadScript('background/api-services/translate-api.js');
    loadScript('background/api-services/ocr-api.js');
    loadScript('background/api-service-registry.js');
    sandbox.globalThis.GestureExtension.shared.domUtils = {
        queryAllDeep: () => []
    };
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
    isVideoFloatingBackgroundSeekExcluded,
    setVideoFloatingBackgroundSeekExcluded,
    isGestureHostExcluded,
    setGestureHostExcluded
} = sandbox.globalThis.GestureExtension.shared.config;
const { splitTranslateText } = sandbox.globalThis.GestureExtension.background.apiServiceRegistry;
const { captionSource } = sandbox.globalThis.GestureExtension.youtubeSubtitles;

// Chuyển đổi dữ liệu từ ngữ cảnh VM sang ngữ cảnh Main để tránh lỗi lệch prototype Array
const toMainContext = (val) => {
    if (val === undefined) return undefined;
    return JSON.parse(JSON.stringify(val));
};

let successCount = 0;
let failCount = 0;

function runTest(name, fn) {
    try {
        fn();
        console.log(`\x1b[32m✔ [PASSED]\x1b[0m ${name}`);
        successCount++;
    } catch (error) {
        console.error(`\x1b[31m✘ [FAILED]\x1b[0m ${name}`);
        console.error(error);
        failCount++;
    }
}

// ============================================================================
// 2. Chạy các unit tests
// ============================================================================

// --- normalizeHost() ---
runTest('normalizeHost: chuẩn hóa domain thông thường', () => {
    assert.equal(normalizeHost('google.com'), 'google.com');
    assert.equal(normalizeHost('GOOGLE.COM  '), 'google.com');
});

runTest('normalizeHost: loại bỏ www. của domain 3 cấp trở lên', () => {
    assert.equal(normalizeHost('www.google.com'), 'google.com');
    assert.equal(normalizeHost('www.sub.google.com'), 'sub.google.com');
});

runTest('normalizeHost: giữ nguyên www. nếu domain chỉ có 2 cấp (không hợp lệ nhưng kiểm tra biên)', () => {
    assert.equal(normalizeHost('www.com'), 'www.com');
});

runTest('normalizeHost: tước bỏ protocol và các path/query rác (localhost không có dot nên trả về rỗng)', () => {
    assert.equal(normalizeHost('https://github.com/quanghy-hub/gesture'), 'github.com');
    assert.equal(normalizeHost('http://localhost:8080/popup.html?v=1'), '');
});

runTest('normalizeHost: loại bỏ ký tự đại diện wildcard (*.) ở đầu', () => {
    assert.equal(normalizeHost('*.google.com'), 'google.com');
    // www.*.google.com không bắt đầu bằng *. trực tiếp nên sẽ bị coi là host chứa kí tự không hợp lệ và trả về rỗng
    assert.equal(normalizeHost('www.*.google.com'), '');
});

runTest('normalizeHost: trả về chuỗi rỗng cho host không hợp lệ', () => {
    assert.equal(normalizeHost('invalid_host'), '');
    assert.equal(normalizeHost('...'), '');
    assert.equal(normalizeHost(''), '');
    assert.equal(normalizeHost(null), '');
});


// --- normalizeConfig() ---
runTest('normalizeConfig: khôi phục giá trị mặc định cho cấu hình rỗng', () => {
    const config = toMainContext(normalizeConfig({}));
    assert.equal(config.version, 1);
    assert.equal(config.clipboard.enabled, true);
    assert.equal(config.clipboard.maxHistory, 5); // default
});

runTest('normalizeConfig: giới hạn (clamp) các số cấu hình ngoài tầm', () => {
    const config = toMainContext(normalizeConfig({
        clipboard: { maxHistory: 99 }, // limit is 20
        quickSearch: { columns: 1 }     // limit is [3, 8], default/fallback is 5
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
    assert.equal(config, raw); // Trả về trực tiếp chính tham chiếu đó (bỏ qua deepClone)
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


// --- splitTranslateText() ---
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
    
    // Giới hạn 20 ký tự (mỗi đoạn dài < 20, nhưng cả 2 > 20)
    const chunks = toMainContext(splitTranslateText(text, 20));
    assert.deepEqual(chunks, [p1, p2]);
});

runTest('splitTranslateText: phân tách cứng nếu có từ quá dài vượt giới hạn phân đoạn', () => {
    const longWord = 'MộtTừSiêuSiêuDàiVượtQuáCảGiớiHạnKýTựChoPhép';
    const chunks = toMainContext(splitTranslateText(longWord, 10));
    assert.equal(chunks.length, 5); // Tách làm 5 mảnh
    assert.equal(chunks.join(''), longWord);
});


// --- YouTube subtitles captionSource ---
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


// ============================================================================
// 3. Kết luận
// ============================================================================
console.log('\x1b[36m==================================================\x1b[0m');
console.log(`Kết quả: \x1b[32m${successCount} thành công\x1b[0m, \x1b[31m${failCount} thất bại\x1b[0m`);
console.log('\x1b[36m==================================================\x1b[0m');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
