import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteSecret, getSecret, setSecret } from './secrets';
import { deleteKeychainSecret, getKeychainSecret, setKeychainSecret } from './keychain';

vi.mock('electron', () => ({
  safeStorage: {
    // Use base64 as a deterministic stand-in for real DPAPI encryption so
    // roundtrips work while the on-disk bytes do not contain the plaintext.
    encryptString: vi.fn((plain: string) => Buffer.from(Buffer.from(plain, 'utf8').toString('base64'))),
    decryptString: vi.fn((buffer: Buffer) => Buffer.from(String(buffer), 'base64').toString('utf8')),
  },
}));

vi.mock('./keychain', () => ({
  setKeychainSecret: vi.fn().mockResolvedValue(undefined),
  getKeychainSecret: vi.fn().mockResolvedValue(null),
  deleteKeychainSecret: vi.fn().mockResolvedValue(undefined),
}));

const setKeychainSecretMock = vi.mocked(setKeychainSecret);
const getKeychainSecretMock = vi.mocked(getKeychainSecret);
const deleteKeychainSecretMock = vi.mocked(deleteKeychainSecret);

let storeDir: string;
let originalPlatform: PropertyDescriptor | undefined;

beforeEach(() => {
  storeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-secrets-'));
  setKeychainSecretMock.mockClear();
  getKeychainSecretMock.mockClear();
  deleteKeychainSecretMock.mockClear();
});

afterEach(() => {
  fs.rmSync(storeDir, { recursive: true, force: true });
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
    originalPlatform = undefined;
  }
});

function setPlatform(value: NodeJS.Platform): void {
  originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value });
}

describe('Windows secret store', () => {
  beforeEach(() => {
    setPlatform('win32');
  });

  it('setSecret writes an encrypted file under <storeDir>/secrets/<service>/<account>.enc', async () => {
    await setSecret(storeDir, 'svc', 'stripe-key', 'sk_test_fake');
    const filePath = path.join(storeDir, 'secrets', 'svc', 'stripe-key.enc');
    expect(fs.existsSync(filePath)).toBe(true);
    const raw = fs.readFileSync(filePath);
    expect(raw.toString()).toBe(Buffer.from('sk_test_fake', 'utf8').toString('base64'));
  });

  it('getSecret decrypts the stored file', async () => {
    await setSecret(storeDir, 'svc', 'stripe-key', 'sk_test_fake');
    await expect(getSecret(storeDir, 'svc', 'stripe-key')).resolves.toBe('sk_test_fake');
  });

  it('getSecret returns null when the file does not exist', async () => {
    await expect(getSecret(storeDir, 'svc', 'missing')).resolves.toBeNull();
  });

  it('deleteSecret removes the file', async () => {
    await setSecret(storeDir, 'svc', 'stripe-key', 'sk_test_fake');
    await deleteSecret(storeDir, 'svc', 'stripe-key');
    expect(fs.existsSync(path.join(storeDir, 'secrets', 'svc', 'stripe-key.enc'))).toBe(false);
  });

  it('deleteSecret is idempotent when the file is already absent', async () => {
    await expect(deleteSecret(storeDir, 'svc', 'missing')).resolves.toBeUndefined();
  });

  it('never writes plaintext key material to disk', async () => {
    await setSecret(storeDir, 'svc', 'stripe-key', 'sk_test_secret');
    const raw = fs.readFileSync(path.join(storeDir, 'secrets', 'svc', 'stripe-key.enc'), 'utf8');
    expect(raw).not.toContain('sk_test_secret');
  });

  it('setSecret rejects when safeStorage fails', async () => {
    const { safeStorage } = await import('electron');
    vi.mocked(safeStorage.encryptString).mockImplementationOnce(() => {
      throw new Error('dpapi failure');
    });
    await expect(setSecret(storeDir, 'svc', 'stripe-key', 'x')).rejects.toThrow('secret write failed');
  });

  it('getSecret returns null and logs on a decrypt failure', async () => {
    await setSecret(storeDir, 'svc', 'stripe-key', 'sk_test_fake');
    const { safeStorage } = await import('electron');
    vi.mocked(safeStorage.decryptString).mockImplementationOnce(() => {
      throw new Error('dpapi decrypt failure');
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(getSecret(storeDir, 'svc', 'stripe-key')).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('macOS secret store', () => {
  beforeEach(() => {
    setPlatform('darwin');
  });

  it('delegates setSecret to the Keychain helper', async () => {
    await setSecret(storeDir, 'svc', 'stripe-key', 'sk_test_fake');
    expect(setKeychainSecretMock).toHaveBeenCalledWith('svc', 'stripe-key', 'sk_test_fake');
  });

  it('delegates getSecret to the Keychain helper', async () => {
    getKeychainSecretMock.mockResolvedValueOnce('sk_test_fake');
    await expect(getSecret(storeDir, 'svc', 'stripe-key')).resolves.toBe('sk_test_fake');
    expect(getKeychainSecretMock).toHaveBeenCalledWith('svc', 'stripe-key');
  });

  it('delegates deleteSecret to the Keychain helper', async () => {
    await deleteSecret(storeDir, 'svc', 'stripe-key');
    expect(deleteKeychainSecretMock).toHaveBeenCalledWith('svc', 'stripe-key');
  });
});
