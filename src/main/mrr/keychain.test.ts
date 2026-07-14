// execFile is mocked throughout — this suite never touches the real
// Keychain or spawns a real `security` process.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteKeychainSecret, getKeychainSecret, isValidKeychainService, setKeychainSecret } from './keychain';

const execFileMock = vi.fn();
vi.mock('node:child_process', () => ({ execFile: (...args: unknown[]) => execFileMock(...args) }));

type Callback = (error: unknown, stdout: string, stderr: string) => void;

function succeed(stdout: string): void {
  execFileMock.mockImplementation((_file: string, _args: string[], cb: Callback) => cb(null, stdout, ''));
}

function fail(error: unknown): void {
  execFileMock.mockImplementation((_file: string, _args: string[], cb: Callback) => cb(error, '', ''));
}

function notFoundError(command: string): Error & { code: number } {
  return Object.assign(new Error(`Command failed: ${command}`), { code: 44 });
}

beforeEach(() => {
  execFileMock.mockReset();
});

describe('isValidKeychainService', () => {
  it('accepts the default and QA-style names, rejects option-lookalikes and garbage', () => {
    expect(isValidKeychainService('beaver-buddy')).toBe(true);
    expect(isValidKeychainService('beaver-buddy-qa-a1b2c3')).toBe(true);
    expect(isValidKeychainService('-D')).toBe(false); // would parse as a `security` option
    expect(isValidKeychainService('--keychain-service')).toBe(false);
    expect(isValidKeychainService('has space')).toBe(false);
    expect(isValidKeychainService('')).toBe(false);
    expect(isValidKeychainService('x'.repeat(65))).toBe(false);
    expect(isValidKeychainService('x'.repeat(64))).toBe(true);
  });
});

describe('setKeychainSecret', () => {
  it('invokes `security` with an argv array (never a shell string), including -U upsert', async () => {
    succeed('');
    await setKeychainSecret('svc', 'acct', 'sk_test_fake_DO_NOT_USE');
    expect(execFileMock).toHaveBeenCalledWith(
      'security',
      ['add-generic-password', '-U', '-s', 'svc', '-a', 'acct', '-w', 'sk_test_fake_DO_NOT_USE'],
      expect.any(Function),
    );
  });

  it('passes a shell-metacharacter secret as a single literal argv element', async () => {
    succeed('');
    const dangerous = '$(rm -rf ~); sk_evil';
    await setKeychainSecret('svc', 'acct', dangerous);
    const args = execFileMock.mock.calls[0]?.[1] as string[];
    expect(args[args.length - 1]).toBe(dangerous);
  });

  it('redacts the secret from any logged error and rejects with a generic message', async () => {
    const secret = 'sk_test_fake_DO_NOT_USE';
    fail(new Error(`Command failed: security add-generic-password -U -s svc -a acct -w ${secret}`));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(setKeychainSecret('svc', 'acct', secret)).rejects.toThrow('keychain write failed');
    const output = spy.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(output).not.toContain(secret);
    spy.mockRestore();
  });
});

describe('getKeychainSecret', () => {
  it('returns the captured stdout secret, trimmed of its trailing newline', async () => {
    succeed('sk_test_fake_DO_NOT_USE\n');
    await expect(getKeychainSecret('svc', 'acct')).resolves.toBe('sk_test_fake_DO_NOT_USE');
  });

  it('invokes `security find-generic-password -w` with the exact argv', async () => {
    succeed('secret\n');
    await getKeychainSecret('svc', 'acct');
    expect(execFileMock).toHaveBeenCalledWith(
      'security',
      ['find-generic-password', '-s', 'svc', '-a', 'acct', '-w'],
      expect.any(Function),
    );
  });

  it('returns null when the item is not found (exit code 44), no error logged', async () => {
    fail(notFoundError('security find-generic-password -s svc -a acct -w'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getKeychainSecret('svc', 'acct')).resolves.toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('returns null and redacts on any other failure', async () => {
    fail(new Error('security: some other keychain error'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getKeychainSecret('svc', 'acct')).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('deleteKeychainSecret', () => {
  it('resolves without error when the item is already absent (idempotent disconnect)', async () => {
    fail(notFoundError('security delete-generic-password -s svc -a acct'));
    await expect(deleteKeychainSecret('svc', 'acct')).resolves.toBeUndefined();
  });

  it('rejects and redacts on any other failure', async () => {
    fail(new Error('security: permission denied'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(deleteKeychainSecret('svc', 'acct')).rejects.toThrow('keychain delete failed');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
