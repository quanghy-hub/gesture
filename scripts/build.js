const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

const ISOLATED_FILES = [
    'shared/namespace.js',
    'shared/messaging.js',
    'shared/api-services.js',
    'shared/config-utils.js',
    'shared/config-schema.js',
    'shared/config-normalize.js',
    'shared/config.js',
    'shared/storage.js',
    'shared/runtime.js',
    'shared/tab-actions-client.js',
    'shared/extension-ui-guard.js',
    'shared/viewport-core.js',
    'shared/floating-core.js',
    'shared/touch-core.js',
    'shared/toast-core.js',
    'shared/selection-core.js',
    'shared/dom-utils.js',
    'shared/ocr-core.js',
    'content/unblock-copy/index.js',
    'content/forum/styles.js',
    'content/forum/layout.js',
    'content/forum/cache.js',
    'content/forum/early-style.js',
    'content/forum/controller.js',
    'content/forum/index.js',
    'content/gestures/gesture-utils.js',
    'content/gestures/desktop.js',
    'content/gestures/mobile.js',
    'content/gestures/index.js',
    'content/clipboard/constants.js',
    'content/clipboard/panel-data.js',
    'content/clipboard/actions.js',
    'content/clipboard/ui.js',
    'content/clipboard/controller.js',
    'content/clipboard/index.js',
    'content/google-search/index.js',
    'content/quick-search/constants.js',
    'content/quick-search/ui.js',
    'content/quick-search/text-session.js',
    'content/quick-search/image-session.js',
    'content/quick-search/actions.js',
    'content/quick-search/event-manager.js',
    'content/quick-search/controller.js',
    'content/quick-search/index.js',
    'shared/translate-core.js',
    'content/inline-translate/constants.js',
    'content/inline-translate/text-block-detector.js',
    'content/inline-translate/editable-selection-panel.js',
    'content/inline-translate/dom.js',
    'content/inline-translate/actions.js',
    'content/inline-translate/controller.js',
    'content/inline-translate/index.js',
    'content/video-screenshot/constants.js',
    'content/video-screenshot/ui.js',
    'content/video-screenshot/controller.js',
    'content/video-screenshot/index.js',
    'content/video-floating/constants.js',
    'content/video-floating/helpers.js',
    'content/video-floating/iframe-mode.js',
    'content/video-floating/video-presentation-helper.js',
    'content/video-floating/floating-session.js',
    'content/video-floating/seek-controller.js',
    'content/video-floating/ui-controls.js',
    'content/video-floating/top-frame.js',
    'content/video-floating/index.js',
    'content/youtube-subtitles/constants.js',
    'content/youtube-subtitles/dom.js',
    'content/youtube-subtitles/caption-source.js',
    'content/youtube-subtitles/translator.js',
    'content/youtube-subtitles/controller.js',
    'content/youtube-subtitles/index.js',
    'content/bootstrap.js'
];

const MAIN_FILES = [
    'content/video-floating/page-api.js'
];

function buildBundle(fileList, outputFileName) {
    const startTime = Date.now();
    const contents = [];

    contents.push(`/**\n * Gesture Extension Bundle: ${outputFileName}\n * Generated: ${new Date().toISOString()}\n */\n`);

    for (const relativePath of fileList) {
        const absolutePath = path.join(ROOT_DIR, relativePath);
        if (!fs.existsSync(absolutePath)) {
            throw new Error(`Source file missing: ${relativePath}`);
        }
        const fileCode = fs.readFileSync(absolutePath, 'utf8');
        contents.push(`/* --- Source: ${relativePath} --- */`);
        contents.push(fileCode.trim());
        contents.push('\n');
    }

    if (!fs.existsSync(DIST_DIR)) {
        fs.mkdirSync(DIST_DIR, { recursive: true });
    }

    const outputPath = path.join(DIST_DIR, outputFileName);
    const bundleContent = contents.join('\n');
    fs.writeFileSync(outputPath, bundleContent, 'utf8');

    const duration = Date.now() - startTime;
    const sizeKb = (Buffer.byteLength(bundleContent, 'utf8') / 1024).toFixed(1);
    console.log(`\x1b[32m✔ Built ${outputFileName}\x1b[0m (${sizeKb} KB) in ${duration}ms`);
}

function build() {
    console.log('\x1b[36mBuilding Gesture Extension content bundles...\x1b[0m');
    try {
        buildBundle(ISOLATED_FILES, 'content-bundle.js');
        buildBundle(MAIN_FILES, 'page-api-bundle.js');
        console.log('\x1b[32m✔ All bundles built successfully.\x1b[0m');
    } catch (error) {
        console.error('\x1b[31m✘ Build failed:\x1b[0m', error.message);
        process.exit(1);
    }
}

if (process.argv.includes('--watch')) {
    build();
    console.log('\x1b[35mWatching for changes in shared/ and content/...\x1b[0m');
    const watchDirs = ['shared', 'content'].map(d => path.join(ROOT_DIR, d));
    let debounceTimer = null;
    watchDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.watch(dir, { recursive: true }, (eventType, filename) => {
                if (!filename || !filename.endsWith('.js')) return;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    console.log(`\x1b[33mFile changed: ${filename}. Rebuilding...\x1b[0m`);
                    build();
                }, 100);
            });
        }
    });
} else {
    build();
}
