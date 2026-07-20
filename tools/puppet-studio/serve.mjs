// Local dev server for the puppet studio (ADR 003: dev-time tooling only).
// Serves the studio page, compiled studio code, pixi.js, rig JSONs and part
// images, and accepts POST /save to write baked sheets + frames under
// assets-src/baked/. No dependencies — plain node:http.
//
// Path safety: every request path is resolved under its fixed base directory;
// anything escaping (../, absolute) is rejected.

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const studioRoot = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = path.resolve(studioRoot, '..', '..');
const bakedRoot = path.join(repoRoot, 'assets-src', 'baked');
const partsRoot = path.join(repoRoot, 'assets-src', 'parts');

const PORT = 8377;
const MAX_BODY_BYTES = 64 * 1024 * 1024;

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.map': 'application/json; charset=utf-8',
};

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}

// Resolves requestPath under baseDir; null when it escapes.
function safeResolve(baseDir, requestPath) {
  const resolved = path.resolve(baseDir, `.${requestPath}`);
  return resolved.startsWith(baseDir + path.sep) || resolved === baseDir ? resolved : null;
}

function serveFile(res, filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    send(res, 404, 'not found');
    return;
  }
  const type = CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  fs.createReadStream(filePath).pipe(res);
}

function dataUrlToBuffer(dataUrl) {
  const prefix = 'data:image/png;base64,';
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) {
    throw new Error('expected a PNG data URL');
  }
  return Buffer.from(dataUrl.slice(prefix.length), 'base64');
}

function safeName(name) {
  if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new Error(`unsafe name: ${String(name)}`);
  }
  return name;
}

function handleSave(req, res) {
  const chunks = [];
  let size = 0;
  req.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      req.destroy(new Error('body too large'));
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', () => {
    try {
      const payload = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const name = safeName(payload.name);
      const outDir = path.join(bakedRoot, name);
      fs.mkdirSync(outDir, { recursive: true });

      const written = [];
      const sheetPath = path.join(outDir, 'sheet.png');
      fs.writeFileSync(sheetPath, dataUrlToBuffer(payload.sheet));
      written.push(sheetPath);

      const metaPath = path.join(outDir, 'sheet.json');
      fs.writeFileSync(metaPath, JSON.stringify(payload.meta, null, 2));
      written.push(metaPath);

      const frames = payload.frames ?? {};
      for (const [anim, dataUrls] of Object.entries(frames)) {
        const animDir = path.join(outDir, 'frames', safeName(anim));
        fs.mkdirSync(animDir, { recursive: true });
        dataUrls.forEach((dataUrl, index) => {
          const framePath = path.join(animDir, `frame_${String(index + 1).padStart(2, '0')}.png`);
          fs.writeFileSync(framePath, dataUrlToBuffer(dataUrl));
          written.push(framePath);
        });
      }

      console.log(`[save] wrote ${written.length} files under ${outDir}`);
      send(res, 200, JSON.stringify({ written: written.map((p) => path.relative(repoRoot, p)) }), 'application/json; charset=utf-8');
    } catch (error) {
      send(res, 400, String(error instanceof Error ? error.message : error));
    }
  });
  req.on('error', (error) => send(res, 500, String(error)));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'POST' && pathname === '/save') {
    handleSave(req, res);
    return;
  }
  if (req.method !== 'GET') {
    send(res, 405, 'method not allowed');
    return;
  }

  if (pathname === '/') {
    serveFile(res, path.join(studioRoot, 'index.html'));
    return;
  }
  if (pathname === '/api/rigs') {
    const rigsDir = path.join(studioRoot, 'rigs');
    const names = fs.existsSync(rigsDir)
      ? fs.readdirSync(rigsDir).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')).sort()
      : [];
    send(res, 200, JSON.stringify(names), 'application/json; charset=utf-8');
    return;
  }
  if (pathname.startsWith('/dist/')) {
    serveFile(res, safeResolve(path.join(studioRoot, 'dist'), pathname.slice('/dist'.length)));
    return;
  }
  if (pathname.startsWith('/rigs/')) {
    serveFile(res, safeResolve(path.join(studioRoot, 'rigs'), pathname.slice('/rigs'.length)));
    return;
  }
  if (pathname.startsWith('/parts/')) {
    serveFile(res, safeResolve(partsRoot, pathname.slice('/parts'.length)));
    return;
  }
  if (pathname === '/node_modules/pixi.js/dist/pixi.mjs') {
    serveFile(res, path.join(repoRoot, 'node_modules', 'pixi.js', 'dist', 'pixi.mjs'));
    return;
  }
  send(res, 404, 'not found');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`puppet studio: http://localhost:${PORT}/`);
  console.log('(dev-time tool only — not part of the shipped app, see docs/adr/003-pixijs-authoring.md)');
});
