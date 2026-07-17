// Platform-specific secret storage for MRR API keys.
// macOS: Keychain via keychain.ts (security CLI).
// Windows: DPAPI via Electron safeStorage, persisted as individual encrypted
// files under <stateDir>/secrets/<service>/<account>.enc.
// No plaintext key material is ever written to growth-settings.json.

import fs from 'node:fs/promises';
import path from 'node:path';
import { safeStorage } from 'electron';
import { atomicWriteFile } from '../atomic-file';
import { deleteKeychainSecret, getKeychainSecret, setKeychainSecret } from './keychain';
import { logRedacted } from './redact';

const SECRETS_SUBDIR = 'secrets';

function secretFilePath(storeDir: string, service: string, account: string): string {
  return path.join(storeDir, SECRETS_SUBDIR, service, `${account}.enc`);
}

export async function setSecret(storeDir: string, service: string, account: string, secret: string): Promise<void> {
  if (process.platform === 'darwin') {
    return setKeychainSecret(service, account, secret);
  }

  if (process.platform === 'win32') {
    try {
      const encrypted = safeStorage.encryptString(secret);
      const filePath = secretFilePath(storeDir, service, account);
      await atomicWriteFile(path.dirname(filePath), path.basename(filePath), encrypted);
      return;
    } catch (error) {
      logRedacted('secret write failed', error, secret);
      throw new Error('secret write failed');
    }
  }

  throw new Error(`secret storage not implemented for platform ${process.platform}`);
}

export async function getSecret(storeDir: string, service: string, account: string): Promise<string | null> {
  if (process.platform === 'darwin') {
    return getKeychainSecret(service, account);
  }

  if (process.platform === 'win32') {
    const filePath = secretFilePath(storeDir, service, account);
    try {
      const encrypted = await fs.readFile(filePath);
      return safeStorage.decryptString(encrypted);
    } catch (error) {
      const code = (error as { code?: string } | undefined)?.code;
      if (code === 'ENOENT') return null;
      logRedacted('secret read failed: corrupt or inaccessible', error);
      return null;
    }
  }

  logRedacted('secret read failed', new Error(`unsupported platform ${process.platform}`));
  return null;
}

export async function deleteSecret(storeDir: string, service: string, account: string): Promise<void> {
  if (process.platform === 'darwin') {
    return deleteKeychainSecret(service, account);
  }

  if (process.platform === 'win32') {
    const filePath = secretFilePath(storeDir, service, account);
    try {
      await fs.rm(filePath, { force: true });
    } catch (error) {
      logRedacted('secret delete failed', error);
      throw new Error('secret delete failed');
    }
    return;
  }

  throw new Error(`secret storage not implemented for platform ${process.platform}`);
}
