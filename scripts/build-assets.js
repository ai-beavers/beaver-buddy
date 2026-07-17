const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const assets = [
  { src: path.join(root, 'src', 'renderer', 'index.html'), dst: path.join(root, 'dist', 'renderer', 'index.html') },
  { src: path.join(root, 'src', 'main', 'mrr', 'settings.html'), dst: path.join(root, 'dist', 'main', 'mrr', 'settings.html') },
];

const spritesSrc = path.join(root, 'assets', 'sprites');
const spritesDst = path.join(root, 'dist', 'renderer', 'assets', 'sprites');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function copyDir(src, dst) {
  ensureDir(dst);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const dstPath = path.join(dst, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, dstPath);
    } else {
      copyFile(srcPath, dstPath);
    }
  }
}

// Idempotent: remove existing sprite destination folder before copying.
fs.rmSync(spritesDst, { recursive: true, force: true });

// Copy static HTML assets.
for (const { src, dst } of assets) {
  copyFile(src, dst);
}

// Copy sprites recursively.
copyDir(spritesSrc, spritesDst);

console.log('Assets built successfully.');
