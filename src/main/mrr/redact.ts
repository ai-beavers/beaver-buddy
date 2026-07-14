// Shared redaction for every MRR error path (keychain CLI stderr/stdout,
// network error messages) — key material must never reach a log line.
// child_process errors from a failed `security` invocation embed the full
// command line (including any secret passed as an argv element) in
// `error.message`, so redaction has to strip known secret values from the
// message text itself, not just avoid interpolating them directly.

export function redactSecret(message: string, secret: string): string {
  if (!secret) return message;
  return message.split(secret).join('[redacted]');
}

// Logs `${prefix}: ${message}` with every provided secret value stripped
// from the message first. Never logs raw stdout/stderr — callers pass only
// the derived message string.
export function logRedacted(prefix: string, error: unknown, ...secrets: readonly string[]): void {
  const raw = error instanceof Error ? error.message : String(error);
  const redacted = secrets.reduce((msg, secret) => redactSecret(msg, secret), raw);
  console.error(`${prefix}: ${redacted}`);
}
