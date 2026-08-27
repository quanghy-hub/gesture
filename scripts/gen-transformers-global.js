/**
 * Sinh offscreen/vendor/transformers.global.js từ transformers.min.js:
 * - Thay câu `export{…}` cuối bundle bằng gán window.transformers
 *   → nạp được bằng <script> thường trong extension (không cần dynamic import).
 * - Im cảnh báo vô hại của hub.js về Content-Length (HF CDN trả response
 *   không kèm header này → thư viện warn nhưng vẫn tải bình thường).
 *
 * Chạy lại mỗi khi nâng cấp @xenova/transformers.
 */
const fs = require('fs');

const sourcePath = 'offscreen/vendor/transformers.min.js';
const outputPath = 'offscreen/vendor/transformers.global.js';
let source = fs.readFileSync(sourcePath, 'utf8');

const exportIndex = source.lastIndexOf('export{');
if (exportIndex < 0) {
    console.error('NO EXPORT FOUND');
    process.exit(1);
}
const closeIndex = source.indexOf('}', exportIndex);
const specs = source
    .slice(exportIndex + 7, closeIndex)
    .split(',')
    .map((spec) => spec.trim())
    .filter(Boolean);

const entries = [];
for (const spec of specs) {
    const match = spec.match(/^(.+?)(?:\s+as\s+(['"]?)([\s\S]+?)\2)?$/);
    if (!match) {
        console.error('BAD SPEC:', spec);
        process.exit(1);
    }
    const local = match[1];
    const exported = match[3] || match[1];
    entries.push(`${JSON.stringify(exported)}: ${local}`);
}

const head = source.slice(0, exportIndex);
let tail = source.slice(closeIndex + 1);
tail = tail.replace(/^\s*;/, '').replace(/\/\/# sourceMappingURL=[^\n]*\n?/g, '');

let output = head + 'window.transformers=Object.assign(window.transformers||{},{\n' + entries.join(',\n') + '\n});\n' + tail;

// Im cảnh báo Content-Length của hub.js (vô hại — buffer tự mở rộng)
output = output.replace(
    'console.warn("Unable to determine content-length from response headers. Will expand buffer when needed.")',
    'void 0'
);

fs.writeFileSync(outputPath, output);
console.log('written:', fs.statSync(outputPath).size);
console.log('entries:', entries.length);
console.log('warning patched:', !output.includes('Unable to determine content-length'));

try {
    new Function(output);
    console.log('SYNTAX OK');
} catch (error) {
    console.error('SYNTAX FAIL:', error.message);
    process.exit(1);
}
