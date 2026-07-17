// Strict validation for the settings:save / settings:disconnect renderer ->
// main IPC (the app's first renderer-originated channel): a closed field
// set, length caps, and charset sanity. Runs in main regardless of what the
// renderer UI already disables — the renderer is never trusted.

export const MAX_FIELD_LEN = 200;
const PRINTABLE_ASCII = /^[\x20-\x7E]*$/;

export interface ValidationError {
  readonly error: string;
}

export interface ValidatedSave {
  readonly stripeKey: string | null;
  readonly revenuecatKey: string | null;
  readonly revenuecatProjectId: string | null;
  readonly mode: 'tokens' | 'mrr' | null;
}

export interface ValidatedDisconnect {
  readonly target: 'stripe' | 'revenuecat' | 'claude' | 'codex';
}

export function isValidationError(value: unknown): value is ValidationError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

// Empty string is treated the same as "field not provided" — an untouched
// input never overwrites an already-connected key.
function readField(obj: Record<string, unknown>, name: string): string | null | ValidationError {
  const value = obj[name];
  if (value === undefined) return null;
  if (typeof value !== 'string') return { error: `${name} must be a string` };
  if (value.length > MAX_FIELD_LEN) return { error: `${name} exceeds ${MAX_FIELD_LEN} characters` };
  if (!PRINTABLE_ASCII.test(value)) return { error: `${name} contains invalid characters` };
  return value.length > 0 ? value : null;
}

const SAVE_FIELDS: readonly string[] = ['stripeKey', 'revenuecatKey', 'revenuecatProjectId', 'mode'];

export function validateSaveInput(input: unknown): ValidatedSave | ValidationError {
  if (typeof input !== 'object' || input === null) return { error: 'payload must be an object' };
  const obj = input as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!SAVE_FIELDS.includes(key)) return { error: `unexpected field: ${key}` };
  }

  const stripeKey = readField(obj, 'stripeKey');
  if (isValidationError(stripeKey)) return stripeKey;
  const revenuecatKey = readField(obj, 'revenuecatKey');
  if (isValidationError(revenuecatKey)) return revenuecatKey;
  const revenuecatProjectId = readField(obj, 'revenuecatProjectId');
  if (isValidationError(revenuecatProjectId)) return revenuecatProjectId;

  if (Boolean(revenuecatKey) !== Boolean(revenuecatProjectId)) {
    return { error: 'revenuecat requires both an API key and a project id' };
  }

  const modeRaw = obj.mode;
  let mode: 'tokens' | 'mrr' | null = null;
  if (modeRaw !== undefined) {
    if (modeRaw !== 'tokens' && modeRaw !== 'mrr') return { error: 'mode must be "tokens" or "mrr"' };
    mode = modeRaw;
  }

  return { stripeKey, revenuecatKey, revenuecatProjectId, mode };
}

export function validateDisconnectInput(input: unknown): ValidatedDisconnect | ValidationError {
  if (typeof input !== 'object' || input === null) return { error: 'payload must be an object' };
  const target = (input as Record<string, unknown>).target;
  if (target !== 'stripe' && target !== 'revenuecat' && target !== 'claude' && target !== 'codex') {
    return { error: 'target must be "stripe", "revenuecat", "claude", or "codex"' };
  }
  return { target };
}

export interface ValidatedConnectUsage {
  readonly target: 'claude' | 'codex';
}

export function validateConnectUsageInput(input: unknown): ValidatedConnectUsage | ValidationError {
  if (typeof input !== 'object' || input === null) return { error: 'payload must be an object' };
  const obj = input as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (key !== 'target') return { error: `unexpected field: ${key}` };
  }
  const target = obj.target;
  if (target !== 'claude' && target !== 'codex') return { error: 'target must be "claude" or "codex"' };
  return { target };
}
