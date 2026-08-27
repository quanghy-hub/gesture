// In depth của stack div tại mỗi <section>/</section> để tìm điểm lệch
const fs = require('fs');
const html = fs.readFileSync('ui/popup/popup.html', 'utf8');
const voidTags = new Set(['input', 'br', 'img', 'meta', 'link', 'hr', 'source', 'path', 'col', 'area', 'base', 'embed', 'track', 'wbr']);
const stack = [];
let depth = 0;
const re = /<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^"'>])*)>/g;
let match;
function lineAt(index) {
    let n = 1;
    for (let i = 0; i < index; i++) if (html[i] === '\n') n++;
    return n;
}
while ((match = re.exec(html))) {
    const tag = match[1].toLowerCase();
    const isClose = match[0][1] === '/';
    const selfClose = /\/>$/.test(match[0]);
    if (voidTags.has(tag) || selfClose) continue;
    const at = lineAt(match.index);
    if (tag === 'section') {
        console.log(`depth=${depth} @ dòng ${at}: ${isClose ? '</section>' : '<section>'}`);
    }
    if (!isClose) {
        stack.push({ tag, line: at });
        depth++;
    } else {
        stack.pop();
        depth--;
    }
}
console.log('final depth:', depth);
