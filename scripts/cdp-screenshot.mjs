// CDP screenshot of the Beaver Buddy overlay renderer.
// Usage: node scripts/cdp-screenshot.mjs <port> <outfile> [delayMs] [--target=<substring>] [--measure]
//   outfile  '-' skips the screenshot (pure measurement run with --measure).
//   --target case-insensitive substring match on the page target's title or url
//           (default: first page target, i.e. the previous behavior).
//   --measure evaluates scroll/viewport metrics (with worst-case status/token
//           lines filled) and prints one `METRICS {...}` line before any shot.
const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const positional = args.filter((a) => !a.startsWith('--'));
const [port, outfile, delayMs = '8000'] = positional;
const targetFlag = flags.find((f) => f.startsWith('--target='));
const targetMatch = targetFlag ? targetFlag.slice('--target='.length).toLowerCase() : null;
const measure = flags.includes('--measure');

const list = await fetch(`http://localhost:${port}/json`).then((r) => r.json());
const page = list.find(
  (t) =>
    t.type === 'page' &&
    (!targetMatch || (t.title || '').toLowerCase().includes(targetMatch) || (t.url || '').toLowerCase().includes(targetMatch)),
);
if (!page) {
  console.error(`no page target found${targetMatch ? ` matching "${targetMatch}"` : ''}`);
  process.exit(1);
}

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
};

await new Promise((resolve) => {
  ws.onopen = resolve;
});

await send('Page.enable');
await new Promise((r) => setTimeout(r, Number(delayMs)));

if (measure) {
  // Worst case first: fill both status spans, both token lines and the status
  // line, then read heights synchronously (the read forces layout). The DOM is
  // restored inside the same evaluate so a screenshot taken afterwards is
  // unaffected.
  const result = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const fill = [['claudeStatus','enabled — logs not found'],
                    ['codexStatus','enabled — logs not found'],
                    ['claudeTokens','today: 12,345 · lifetime: 1,234,567'],
                    ['codexTokens','today: 12,345 · lifetime: 1,234,567'],
                    ['status','connected']];
      const saved = fill.map(([id, t]) => { const el = document.getElementById(id);
        if (!el) return null; const old = el.textContent; el.textContent = t; return [el, old]; });
      const m = {
        bodyScrollH: document.body.scrollHeight,
        docScrollH: document.documentElement.scrollHeight,
        innerH: window.innerHeight, innerW: window.innerWidth,
        docScrollW: document.documentElement.scrollWidth,
      };
      m.hasVScroll = m.docScrollH > m.innerH;
      m.hasHScroll = m.docScrollW > m.innerW;
      saved.forEach((s) => { if (s) s[0].textContent = s[1]; });
      return m;
    })()`,
  });
  console.log(`METRICS ${JSON.stringify(result.result.value)}`);
}

if (outfile !== '-') {
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(outfile, Buffer.from(shot.data, 'base64'));
  console.log(`saved ${outfile}`);
}
ws.close();
process.exit(0);
