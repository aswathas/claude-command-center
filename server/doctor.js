/**
 * doctor — detect the Claude Code install this dashboard will read, and
 * report what is actually on disk before anyone starts the server.
 *
 * Run it with:  npm run doctor
 *
 * It reads counts and file names only. It never opens credentials.json and
 * never prints the contents of a config file.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import process from 'node:process';

const home = process.env.CLAUDE_HOME
  ? path.resolve(process.env.CLAUDE_HOME)
  : path.join(os.homedir(), '.claude');
const claudeJson = process.env.CLAUDE_JSON
  ? path.resolve(process.env.CLAUDE_JSON)
  : path.join(path.dirname(home), '.claude.json');

const BOLD = '\u001b[1m';
const DIM = '\u001b[2m';
const GREEN = '\u001b[32m';
const YELLOW = '\u001b[33m';
const RED = '\u001b[31m';
const RESET = '\u001b[0m';

const ok = (s) => `${GREEN}${s}${RESET}`;
const warn = (s) => `${YELLOW}${s}${RESET}`;
const bad = (s) => `${RED}${s}${RESET}`;

function countDirs(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() || d.isSymbolicLink()).length;
  } catch {
    return 0;
  }
}

function countFiles(dir, ext) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && (!ext || f.name.endsWith(ext))).length;
  } catch {
    return 0;
  }
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

/** Claude Code writes one JSONL transcript per session under projects/<slug>/. */
function transcriptStats() {
  const projects = path.join(home, 'projects');
  let files = 0;
  let bytes = 0;
  let dirs = 0;
  try {
    for (const entry of fs.readdirSync(projects, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      dirs += 1;
      const dir = path.join(projects, entry.name);
      for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!f.isFile()) continue;
        if (!f.name.endsWith('.jsonl')) continue;
        files += 1;
        try {
          bytes += fs.statSync(path.join(dir, f.name)).size;
        } catch {
          /* a file can vanish mid-scan; skip its size */
        }
      }
    }
  } catch {
    /* no projects directory yet */
  }
  return { files, bytes, dirs };
}

function mcpCounts() {
  let global = 0;
  let projects = 0;
  try {
    const raw = fs.readFileSync(claudeJson, 'utf8');
    const parsed = JSON.parse(raw);
    global = Object.keys(parsed.mcpServers || {}).length;
    for (const value of Object.values(parsed.projects || {})) {
      if (value && typeof value === 'object' && value.mcpServers) {
        projects += Object.keys(value.mcpServers).length;
      }
    }
  } catch {
    /* unreadable or absent .claude.json */
  }
  return { global, projects };
}

/** Memory: the user memory folder plus the per-project auto-memory folders. */
function memoryCounts() {
  const userFiles = countMemoryFiles(path.join(home, 'memory'));
  let projectFolders = 0;
  let projectFiles = 0;
  try {
    for (const entry of fs.readdirSync(path.join(home, 'projects'), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const memDir = path.join(home, 'projects', entry.name, 'memory');
      const n = countMemoryFiles(memDir);
      if (n > 0) {
        projectFolders += 1;
        projectFiles += n;
      }
    }
  } catch {
    /* no projects directory yet */
  }
  return { userFiles, projectFolders, projectFiles };
}

function countMemoryFiles(dir) {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((f) => f.isFile() && /\.(md|txt)$/i.test(f.name)).length;
  } catch {
    return 0;
  }
}

/** Installed plugins come from the registry; enabled ones from settings.json. */
function pluginCounts() {
  const registry = path.join(home, 'plugins', 'installed_plugins.json');
  let installed = 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(registry, 'utf8'));
    installed = Object.keys(parsed.plugins || {}).length;
  } catch {
    /* no plugin registry yet */
  }

  let enabled = 0;
  try {
    const settings = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'));
    enabled = Object.keys(settings.enabledPlugins || {}).length;
  } catch {
    /* no settings.json yet */
  }

  const marketplaces = countDirs(path.join(home, 'plugins', 'marketplaces'));
  return { enabled, installed, marketplaces };
}

const t = transcriptStats();
const mcp = mcpCounts();
const plugins = pluginCounts();
const mem = memoryCounts();
const skills = countDirs(path.join(home, 'skills'));
const skillsOff = countDirs(path.join(home, 'skills-off'));

console.log('');
console.log(`${BOLD}Claude Command Center — doctor${RESET}`);
console.log(`${DIM}${'─'.repeat(58)}${RESET}`);
console.log(`  node        ${process.version}`);
console.log(`  platform    ${process.platform} ${process.arch}`);
console.log('');
console.log(`${BOLD}Claude home${RESET}`);
console.log(`  CLAUDE_HOME ${home} ${exists(home) ? ok('found') : bad('not found')}`);
console.log(`  CLAUDE_JSON ${claudeJson} ${exists(claudeJson) ? ok('found') : warn('not found')}`);
console.log('');
console.log(`${BOLD}What is on disk${RESET}`);
console.log(`  skills        ${skills} enabled ${DIM}·${RESET} ${skillsOff} parked`);
console.log(`  plugins       ${plugins.installed} installed ${DIM}·${RESET} ${plugins.enabled} enabled ${DIM}·${RESET} ${plugins.marketplaces} marketplaces`);
console.log(`  mcp servers   ${mcp.global} global ${DIM}·${RESET} ${mcp.projects} across project scopes`);
console.log(`  memory        ${mem.userFiles} user memory files ${DIM}·${RESET} ${mem.projectFiles} files in ${mem.projectFolders} project memory folders`);
console.log(`  transcripts   ${t.files} jsonl files ${DIM}·${RESET} ${(t.bytes / 1024 / 1024).toFixed(0)} MB across ${t.dirs} project folders`);
console.log('');

let warnings = 0;

if (!exists(home)) {
  warnings += 1;
  console.log(`${bad('!')} ${home} does not exist.`);
  console.log('    Install Claude Code first, or point CLAUDE_HOME at the right folder:');
  console.log(`      ${process.platform === 'win32' ? 'set CLAUDE_HOME=C:\\path\\to\\.claude' : 'export CLAUDE_HOME=/path/to/.claude'}`);
  console.log('');
}

if (skills === 0 && skillsOff === 0) {
  warnings += 1;
  console.log(`${warn('!')} No skill folders found in ${path.join(home, 'skills')}.`);
  console.log('    The dashboard will still run — it will just have nothing to toggle.');
  console.log('');
}

if (t.files === 0) {
  console.log(`${warn('!')} No transcripts found under ${path.join(home, 'projects')}.`);
  console.log('    Token telemetry stays empty until Claude Code records a session.');
  console.log('');
}

if (warnings === 0) {
  console.log(`${ok('✓')} ${BOLD}Ready.${RESET} Start the dashboard with:`);
  console.log('');
  console.log('      npm run build && npm start');
  console.log('');
  console.log(`    Then open ${BOLD}http://127.0.0.1:8787${RESET}`);
  console.log('');
}

if (process.env.CLAUDE_HOME || process.env.CLAUDE_JSON) {
  console.log(`${DIM}Using CLAUDE_HOME / CLAUDE_JSON overrides — the dashboard will only`);
  console.log('read the install you named, never the default one.' + RESET);
  console.log('');
}
