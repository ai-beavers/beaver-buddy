import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { atomicWriteFile } from './atomic-file';

let stateDir: string;

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bb-atomic-file-'));
});

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('atomicWriteFile', () => {
  it('writes the file and leaves no tmp residue', async () => {
    await atomicWriteFile(stateDir, 'state.json', '{"hello":"world"}');

    const filePath = path.join(stateDir, 'state.json');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('{"hello":"world"}');
    expect(fs.readdirSync(stateDir)).toEqual(['state.json']);
  });

  it('creates nested state directories on demand', async () => {
    const nested = path.join(stateDir, 'a', 'b');
    await atomicWriteFile(nested, 'state.json', '{"ok":true}');
    expect(fs.readFileSync(path.join(nested, 'state.json'), 'utf8')).toBe('{"ok":true}');
  });

  it('overwrites an existing file atomically', async () => {
    const filePath = path.join(stateDir, 'state.json');
    fs.writeFileSync(filePath, 'old');
    await atomicWriteFile(stateDir, 'state.json', 'new');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('new');
  });

  it('writes binary Buffer contents without encoding loss', async () => {
    const filePath = path.join(stateDir, 'blob.enc');
    const buffer = Buffer.from([0x00, 0xff, 0x42, 0x13]);
    await atomicWriteFile(stateDir, 'blob.enc', buffer);
    expect(fs.readFileSync(filePath)).toEqual(buffer);
  });

  it('retries transient EPERM errors during rename and eventually succeeds', async () => {
    const realRename = fs.promises.rename;
    const renameSpy = vi
      .spyOn(fs.promises, 'rename')
      .mockRejectedValueOnce(Object.assign(new Error('EPERM'), { code: 'EPERM' }))
      .mockImplementation((oldPath, newPath) => realRename(oldPath as string, newPath as string));

    await atomicWriteFile(stateDir, 'state.json', '{"retried":true}');

    expect(renameSpy).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8')).toBe('{"retried":true}');
    renameSpy.mockRestore();
  });

  it('retries transient EBUSY errors during rename and eventually succeeds', async () => {
    const realRename = fs.promises.rename;
    const renameSpy = vi
      .spyOn(fs.promises, 'rename')
      .mockRejectedValueOnce(Object.assign(new Error('EBUSY'), { code: 'EBUSY' }))
      .mockImplementation((oldPath, newPath) => realRename(oldPath as string, newPath as string));

    await atomicWriteFile(stateDir, 'state.json', '{"busy":true}');

    expect(renameSpy).toHaveBeenCalledTimes(2);
    expect(fs.readFileSync(path.join(stateDir, 'state.json'), 'utf8')).toBe('{"busy":true}');
    renameSpy.mockRestore();
  });

  it('does not retry EACCES errors', async () => {
    const renameSpy = vi
      .spyOn(fs.promises, 'rename')
      .mockRejectedValue(Object.assign(new Error('EACCES'), { code: 'EACCES' }));

    await expect(atomicWriteFile(stateDir, 'state.json', '{"denied":true}')).rejects.toThrow('EACCES');
    expect(renameSpy).toHaveBeenCalledTimes(1);
    renameSpy.mockRestore();
  });

  it('gives up after exhausting retries', async () => {
    const renameSpy = vi
      .spyOn(fs.promises, 'rename')
      .mockRejectedValue(Object.assign(new Error('EPERM'), { code: 'EPERM' }));

    await expect(atomicWriteFile(stateDir, 'state.json', '{"stuck":true}')).rejects.toThrow('EPERM');
    // Initial attempt + 3 retries = 4 calls.
    expect(renameSpy).toHaveBeenCalledTimes(4);
    renameSpy.mockRestore();
  });

  it('cleans up the temp file even when writing fails', async () => {
    const writeFileSpy = vi.spyOn(fs.promises, 'writeFile').mockRejectedValue(new Error('disk full'));

    await expect(atomicWriteFile(stateDir, 'state.json', '{"lost":true}')).rejects.toThrow('disk full');
    expect(fs.readdirSync(stateDir)).toEqual([]);
    writeFileSpy.mockRestore();
  });
});
