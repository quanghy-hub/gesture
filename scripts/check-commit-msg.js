/**
 * Kiểm tra commit message theo chuẩn Conventional Commits.
 * Chạy bởi .husky/commit-msg — zero dependency, chỉ dùng Node built-ins.
 *
 * Hợp lệ: feat(scope): ... | fix(sw): ... | chore: ... | revert: ... | Merge ...
 */
const fs = require('fs');

const COMMIT_MSG_FILE = process.argv[2];
if (!COMMIT_MSG_FILE) {
    process.exit(0);
}

const fullMessage = fs.readFileSync(COMMIT_MSG_FILE, 'utf8');
const firstLine = (fullMessage.split('\n')[0] || '').trim();
if (!firstLine) {
    process.exit(0);
}

const CONVENTIONAL_PATTERN = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9][a-z0-9-]*\))?!?:\s+.+/i;
const ALLOWED_PATTERNS = [/^merge\s/i, /^revert\s/i, /^version\s/i, /^release\s/i, /^bump\s/i];

if (CONVENTIONAL_PATTERN.test(firstLine) || ALLOWED_PATTERNS.some((re) => re.test(firstLine))) {
    process.exit(0);
}

console.error('✘ [commit-msg] Commit message không theo chuẩn Conventional Commits.');
console.error(`  Nhận được: "${firstLine}"`);
console.error('  Ví dụ hợp lệ:');
console.error('    feat(video-floating): add loop button');
console.error('    fix(sw): resolve import error');
console.error('    chore: update deps');
process.exit(1);
