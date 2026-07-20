import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const html = readFileSync(fileURLToPath(new URL('./index.html', import.meta.url)), 'utf8');

describe('renderer CSP (P1 hardening invariant)', () => {
  it('ships a Content-Security-Policy meta tag', () => {
    expect(html).toMatch(/<meta[^>]*http-equiv="Content-Security-Policy"/);
  });

  it('denies everything by default and only allows self scripts', () => {
    const csp = /<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]*)"/.exec(
      html,
    )?.[1];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'unsafe-inline'");
  });
});
