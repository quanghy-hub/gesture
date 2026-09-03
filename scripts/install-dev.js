const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8'));
const extensionId = manifest.browser_specific_settings?.gecko?.id;

if (!extensionId) {
    console.error('Không tìm thấy gecko.id trong manifest.json');
    process.exit(1);
}

console.log('Building content scripts & Firefox .xpi...');
execSync('npm run build && npm run build:firefox', { stdio: 'inherit', cwd: ROOT_DIR });

const xpiFile = path.join(ROOT_DIR, 'web-ext-artifacts', `gesture-${manifest.version}.xpi`);
if (!fs.existsSync(xpiFile)) {
    console.error(`Không tìm thấy file .xpi: ${xpiFile}`);
    process.exit(1);
}

const profilesDir = path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles');
if (fs.existsSync(profilesDir)) {
    const profiles = fs.readdirSync(profilesDir).filter((dir) => dir.includes('dev-edition'));
    if (profiles.length === 0) {
        console.log('Không tìm thấy profile Firefox Developer Edition.');
    }
    for (const profile of profiles) {
        const extDir = path.join(profilesDir, profile, 'extensions');
        if (!fs.existsSync(extDir)) {
            fs.mkdirSync(extDir, { recursive: true });
        }
        const targetXpi = path.join(extDir, `${extensionId}.xpi`);
        fs.copyFileSync(xpiFile, targetXpi);
        console.log(`\x1b[32m✔ Đã tự động cài đặt vào Firefox Developer Edition (${profile}):\n  -> ${targetXpi}\x1b[0m`);
    }
} else {
    console.log(`Không tìm thấy thư mục Profiles tại ${profilesDir}`);
}
