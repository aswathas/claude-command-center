/**
 * Every path the dashboard touches, in one place, plus guarded read/write helpers.
 * Nothing here writes outside CLAUDE_HOME without an explicit path check.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// CLAUDE_HOME points the dashboard at a different Claude Code installation.
// Unset, it is the one in the user's home directory.
export const CLAUDE_HOME = process.env.CLAUDE_HOME
  ? path.resolve(process.env.CLAUDE_HOME)
  : path.join(os.homedir(), '.claude');
export const CLAUDE_JSON = process.env.CLAUDE_JSON
  ? path.resolve(process.env.CLAUDE_JSON)
  : path.join(path.dirname(CLAUDE_HOME), '.claude.json');
export const APP_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
// The transcript index belongs to the Claude home it indexes, not to the app
// folder. Two dashboards pointed at different installs would otherwise
// overwrite each other's cache.
export const CACHE_DIR = path.join(CLAUDE_HOME, '.command-center', 'cache');
export const STATE_DIR = path.join(CLAUDE_HOME, '.command-center');

export const PATHS = {
  home: CLAUDE_HOME,
  settings: path.join(CLAUDE_HOME, 'settings.json'),
  settingsLocal: path.join(CLAUDE_HOME, 'settings.local.json'),
  claudeMd: path.join(CLAUDE_HOME, 'CLAUDE.md'),
  claudeJson: CLAUDE_JSON,
  skills: path.join(CLAUDE_HOME, 'skills'),
  skillsOff: path.join(CLAUDE_HOME, 'skills-off'),
  plugins: path.join(CLAUDE_HOME, 'plugins'),
  installedPlugins: path.join(CLAUDE_HOME, 'plugins', 'installed_plugins.json'),
  marketplaces: path.join(CLAUDE_HOME, 'plugins', 'marketplaces'),
  pluginCache: path.join(CLAUDE_HOME, 'plugins', 'cache'),
  projects: path.join(CLAUDE_HOME, 'projects'),
  jobs: path.join(CLAUDE_HOME, 'jobs'),
  memory: path.join(CLAUDE_HOME, 'memory'),
  history: path.join(CLAUDE_HOME, 'history.jsonl'),
  agents: path.join(CLAUDE_HOME, 'agents'),
  todos: path.join(CLAUDE_HOME, 'todos'),
  stateDir: STATE_DIR,
};

/** Files the dashboard must never read or serve. */
const FORBIDDEN = ['credentials.json', '.credentials.json'];

export function assertReadable(file) {
  const base = path.basename(file).toLowerCase();
  if (FORBIDDEN.includes(base)) {
    throw httpError(403, `Refusing to read ${base}`);
  }
  return file;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Accept a path in either shape: "C:\Users\..." from the app, or "/c/Users/..."
 * from a POSIX-style shell. Returns a native absolute path.
 */
export function toNativePath(input) {
  if (typeof input !== 'string' || !input.trim()) return '';
  let value = input.trim();
  const posixDrive = value.match(/^\/([A-Za-z])(\/.*)$/);
  if (posixDrive) {
    value = `${posixDrive[1].toUpperCase()}:${posixDrive[2].replace(/\//g, '\\')}`;
  }
  return path.resolve(value);
}

/** Read + parse JSON, returning a fallback instead of throwing on missing/corrupt files. */
export async function readJson(file, fallback = null) {
  try {
    assertReadable(file);
    const raw = await fsp.readFile(file, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    if (err.status) throw err;
    return fallback;
  }
}

export async function readText(file) {
  try {
    assertReadable(file);
    return await fsp.readFile(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Write a file inside CLAUDE_HOME (or the app cache) with a timestamped backup
 * of the previous contents. Returns the backup path.
 */
export async function writeWithBackup(file, contents, { backup = true } = {}) {
  const resolved = path.resolve(file);
  const roots = [path.resolve(CLAUDE_HOME), path.resolve(CACHE_DIR), path.resolve(APP_ROOT)];
  const exactFiles = [path.resolve(CLAUDE_JSON)];
  const inside = roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!inside && !exactFiles.includes(resolved)) {
    throw httpError(403, `Refusing to write outside the Claude home: ${resolved}`);
  }
  await fsp.mkdir(path.dirname(resolved), { recursive: true });
  let backupPath = null;
  if (backup && fs.existsSync(resolved)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    backupPath = `${resolved}.bak.${stamp}`;
    await fsp.copyFile(resolved, backupPath);
  }
  await fsp.writeFile(resolved, contents, 'utf8');
  return backupPath;
}

export async function writeJson(file, value, opts) {
  return writeWithBackup(file, JSON.stringify(value, null, 2) + '\n', opts);
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export { path, fs, fsp };
