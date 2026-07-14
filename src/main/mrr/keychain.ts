// macOS Keychain access via the `security` CLI — the sanctioned exception
// to the single state-directory rule (CLAUDE.md: secrets live in Keychain,
// never in app-support JSON). execFile with an argv array only, never a
// shell string, so a secret containing shell metacharacters can never be
// interpreted as anything but one literal argument. `-w` on
// find-generic-password prints ONLY the secret to stdout — it is captured
// and returned, never printed. Every failure path is redacted before
// logging: a failed `security` invocation embeds its full command line
// (including any secret passed as an argv element) in the error message.
//
// The `security` CLI has no in-memory API — passing a secret via `-w` is
// the only non-interactive way to write one, which briefly exposes it to
// `ps` for the life of the child process. That is a limitation of the CLI
// itself, not of this wrapper.

import { execFile } from 'node:child_process';
import { logRedacted } from './redact';

// `security`'s exit code when find/delete targets a missing item.
const ITEM_NOT_FOUND_CODE = 44;

// Service names arrive from a CLI flag: reject anything `security` could
// parse as an option (leading '-') and anything outside a boring
// filename-safe charset, bounded to 64 chars.
const SERVICE_NAME_RE = /^[A-Za-z0-9._][A-Za-z0-9._-]{0,63}$/;

export function isValidKeychainService(value: string): boolean {
  return SERVICE_NAME_RE.test(value);
}

function exitCode(error: unknown): number | undefined {
  const code = (error as { code?: unknown } | undefined)?.code;
  return typeof code === 'number' ? code : undefined;
}

// Hand-rolled promise wrapper (not util.promisify) so the mocked callback
// shape in tests matches Node's real execFile signature exactly: (error,
// stdout, stderr) as three positional args — util.promisify only produces
// the {stdout, stderr} object shape via a hidden [promisify.custom] symbol
// that child_process defines on the *real* execFile, which a plain test
// mock wouldn't carry.
function run(file: string, args: readonly string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(file, args as string[], (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

export async function setKeychainSecret(service: string, account: string, secret: string): Promise<void> {
  try {
    // -U upserts (updates in place) instead of erroring on a duplicate item.
    await run('security', ['add-generic-password', '-U', '-s', service, '-a', account, '-w', secret]);
  } catch (error) {
    logRedacted('keychain write failed', error, secret);
    throw new Error('keychain write failed');
  }
}

export async function getKeychainSecret(service: string, account: string): Promise<string | null> {
  try {
    const { stdout } = await run('security', ['find-generic-password', '-s', service, '-a', account, '-w']);
    return stdout.replace(/\n$/, '');
  } catch (error) {
    if (exitCode(error) === ITEM_NOT_FOUND_CODE) return null;
    // No secret is ever an argv element on the read path, but redact
    // defensively anyway — never trust an external process's stderr.
    logRedacted('keychain read failed', error);
    return null;
  }
}

export async function deleteKeychainSecret(service: string, account: string): Promise<void> {
  try {
    await run('security', ['delete-generic-password', '-s', service, '-a', account]);
  } catch (error) {
    if (exitCode(error) === ITEM_NOT_FOUND_CODE) return; // already absent — disconnect is idempotent
    logRedacted('keychain delete failed', error);
    throw new Error('keychain delete failed');
  }
}
