/**
 * Settings: settings.json, settings.local.json, the user CLAUDE.md, and the
 * parts of ~/.claude.json that describe per-project activity.
 */
import { PATHS, readJson, readText, writeJson, writeWithBackup } from '../claude-home.js';
import { redact, secretPaths } from '../redact.js';

export async function getSettings() {
  const settings = (await readJson(PATHS.settings, {})) || {};
  const settingsLocal = (await readJson(PATHS.settingsLocal, {})) || {};
  const root = (await readJson(PATHS.claudeJson, {})) || {};
  const claudeMd = await readText(PATHS.claudeMd);

  const projects = Object.entries(root.projects || {}).map(([cwd, cfg]) => ({
    cwd,
    hasTrustDialogAccepted: cfg.hasTrustDialogAccepted ?? null,
    lastCost: cfg.lastCost ?? null,
    lastDuration: cfg.lastDuration ?? null,
    lastStartTime: cfg.lastStartTime ?? null,
    lastSessionId: cfg.lastSessionId ?? null,
    lastTotalInputTokens: cfg.lastTotalInputTokens ?? null,
    lastTotalOutputTokens: cfg.lastTotalOutputTokens ?? null,
    lastTotalCacheReadInputTokens: cfg.lastTotalCacheReadInputTokens ?? null,
    lastTotalCacheCreationInputTokens: cfg.lastTotalCacheCreationInputTokens ?? null,
    lastModelUsage: cfg.lastModelUsage || null,
    mcpServerCount: Object.keys(cfg.mcpServers || {}).length,
  }));

  return {
    settings: redact(settings),
    settingsLocal: redact(settingsLocal),
    secretPaths: secretPaths(settings),
    claudeMd: claudeMd ?? '',
    projects,
    oauth: root.oauthAccount
      ? {
          emailAddress: root.oauthAccount.emailAddress || null,
          seatTier: root.oauthAccount.seatTier || null,
          billingType: root.oauthAccount.billingType || null,
          hasExtraUsageEnabled: root.oauthAccount.hasExtraUsageEnabled ?? null,
        }
      : null,
    numStartups: root.numStartups ?? null,
    skillUsage: root.skillUsage || {},
    pluginUsage: root.pluginUsage || {},
    paths: {
      home: PATHS.home,
      settings: PATHS.settings,
      settingsLocal: PATHS.settingsLocal,
      claudeJson: PATHS.claudeJson,
      claudeMd: PATHS.claudeMd,
      skills: PATHS.skills,
      skillsOff: PATHS.skillsOff,
      projects: PATHS.projects,
      memory: PATHS.memory,
    },
  };
}

/** Patch a single top-level field of settings.json. Secrets are written as-is. */
export async function patchSettings(patch) {
  const current = (await readJson(PATHS.settings, {})) || {};
  const next = { ...current };
  for (const [key, value] of Object.entries(patch || {})) {
    next[key] = value;
  }
  const backup = await writeJson(PATHS.settings, next);
  return { ok: true, backup, settings: redact(next) };
}

/** Set or remove one env var inside settings.json's `env` block. */
export async function setEnvVar(key, value) {
  const current = (await readJson(PATHS.settings, {})) || {};
  if (!current.env || typeof current.env !== 'object') current.env = {};
  if (value === null || value === undefined) delete current.env[key];
  else current.env[key] = String(value);
  const backup = await writeJson(PATHS.settings, current);
  return { ok: true, backup, env: redact(current.env) };
}

/**
 * Merge redacted placeholders back into the real values before writing.
 * The browser never receives a secret, so a raw save must not turn the
 * masked placeholder into the stored value.
 */
function restoreSecrets(target, source) {
  if (target && typeof target === 'object' && !Array.isArray(target) && target.__redacted === true) {
    return source;
  }
  if (Array.isArray(target)) {
    return target.map((item, i) => restoreSecrets(item, Array.isArray(source) ? source[i] : undefined));
  }
  if (target && typeof target === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(target)) {
      out[key] = restoreSecrets(value, source && typeof source === 'object' ? source[key] : undefined);
    }
    return out;
  }
  return target;
}

/** Replace the whole settings.json after validating it parses. */
export async function replaceSettings(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = new Error(`settings.json is not valid JSON: ${err.message}`);
    e.status = 400;
    throw e;
  }
  const current = (await readJson(PATHS.settings, {})) || {};
  const merged = restoreSecrets(parsed, current);
  const backup = await writeJson(PATHS.settings, merged);
  return { ok: true, backup, settings: redact(merged) };
}

export async function writeClaudeMd(content) {
  const backup = await writeWithBackup(PATHS.claudeMd, String(content ?? ''));
  return { ok: true, backup };
}

export async function replaceSettingsLocal(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = new Error(`settings.local.json is not valid JSON: ${err.message}`);
    e.status = 400;
    throw e;
  }
  const backup = await writeJson(PATHS.settingsLocal, parsed);
  return { ok: true, backup, settingsLocal: redact(parsed) };
}
