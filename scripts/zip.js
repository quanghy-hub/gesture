const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_ZIP_DIR = path.join(ROOT_DIR, 'dist-zip');
const ZIP_FILE = path.join(DIST_ZIP_DIR, 'gesture.zip');

console.log('Building content scripts...');
execSync('node scripts/build.js', { stdio: 'inherit', cwd: ROOT_DIR });

if (!fs.existsSync(DIST_ZIP_DIR)) {
    fs.mkdirSync(DIST_ZIP_DIR, { recursive: true });
}

if (fs.existsSync(ZIP_FILE)) {
    fs.unlinkSync(ZIP_FILE);
}

const includes = ['manifest.json', 'background', 'content', 'dist', 'icons', 'shared', 'ui'];
const isWin = process.platform === 'win32';

try {
    if (isWin) {
        const items = includes.map((i) => `'${i}'`).join(',');
        execSync(`powershell -Command "Compress-Archive -Path ${items} -DestinationPath '${ZIP_FILE}' -Force"`, {
            stdio: 'inherit',
            cwd: ROOT_DIR
        });
    } else {
        execSync(`zip -r "${ZIP_FILE}" ${includes.join(' ')}`, { stdio: 'inherit', cwd: ROOT_DIR });
    }
    console.log(`\x1b[32m✔ Created extension zip package at ${ZIP_FILE}\x1b[0m`);
} catch (error) {
    console.error('\x1b[31m✘ Packaging zip failed:\x1b[0m', error.message);
    process.exit(1);
}
