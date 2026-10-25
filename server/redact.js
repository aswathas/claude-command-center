/**
 * Secret redaction. The dashboard reads a settings file that holds live API
 * tokens, so every value whose key looks like a credential is masked before it
 * leaves the process. Masked values keep a length fingerprint so the UI can
 * show "set, 51 chars" without revealing the secret.
 */

const SECRET_KEY = /(token|secret|password|passwd|api[_-]?key|auth|credential|private[_-]?key|session[_-]?key|cookie|bearer)/i;
const SECRET_VALUE_HINT = /^(sk-[A-Za-z0-9_-]{8,}|gh[pousr]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,})/;

export const REDACTED = '••••••••••••';

export function isSecretKey(key) {
  return SECRET_KEY.test(String(key));
}

export function looksSecret(value) {
  return typeof value === 'string' && SECRET_VALUE_HINT.test(value);
}

export function fingerprint(value) {
  if (value === undefined || value === null || value === '') return null;
  return `${String(value).length} chars`;
}

/**
 * Recursively redact a value. Returns a parallel structure where secrets are
 * replaced by { __redacted: true, length } markers.
 */
export function redact(value, keyHint = '') {
  if (isSecretKey(keyHint)) {
    if (value === undefined || value === null || value === '') return value;
    return { __redacted: true, length: fingerprint(value) };
  }
  if (Array.isArray(value)) return value.map((v) => redact(v, keyHint));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redact(v, k);
    return out;
  }
  if (looksSecret(value)) return { __redacted: true, length: fingerprint(value) };
  return value;
}

/** Collect the paths of every redacted leaf so the UI can offer a reveal-and-edit flow. */
export function secretPaths(value, prefix = '') {
  const out = [];
  if (value && typeof value === 'object' && !Array.isArray(value) && value.__redacted) {
    out.push(prefix);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => out.push(...secretPaths(v, `${prefix}[${i}]`)));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) out.push(...secretPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

/** Redact the `env` block of an MCP server definition, keeping the key names. */
export function redactEnv(env) {
  if (!env || typeof env !== 'object') return env;
  const out = {};
  for (const [k, v] of Object.entries(env)) {
    out[k] = isSecretKey(k) ? { __redacted: true, length: fingerprint(v) } : v;
  }
  return out;
}
