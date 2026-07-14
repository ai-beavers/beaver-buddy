import { describe, expect, it, vi } from 'vitest';
import { logRedacted, redactSecret } from './redact';

describe('redactSecret', () => {
  it('replaces every occurrence of the secret with a fixed marker', () => {
    expect(redactSecret('Command failed: -w sk_test_FAKE123 (retry with sk_test_FAKE123)', 'sk_test_FAKE123')).toBe(
      'Command failed: -w [redacted] (retry with [redacted])',
    );
  });

  it('leaves the message untouched when the secret is empty', () => {
    expect(redactSecret('some message', '')).toBe('some message');
  });

  it('leaves a message with no occurrence untouched', () => {
    expect(redactSecret('unrelated error', 'sk_test_FAKE123')).toBe('unrelated error');
  });
});

describe('logRedacted', () => {
  it('never lets a fake secret reach console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const secret = 'sk_test_fake_DO_NOT_USE';
    logRedacted('keychain write failed', new Error(`Command failed: security add-generic-password -w ${secret}`), secret);
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain(secret);
    expect(output).toContain('[redacted]');
    spy.mockRestore();
  });

  it('redacts across multiple provided secrets', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logRedacted('poll failed', new Error('key-a and key-b both leaked'), 'key-a', 'key-b');
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain('key-a');
    expect(output).not.toContain('key-b');
    spy.mockRestore();
  });

  it('stringifies a non-Error thrown value', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logRedacted('poll failed', 'plain string error');
    expect(spy.mock.calls[0]?.[0]).toContain('plain string error');
    spy.mockRestore();
  });
});
