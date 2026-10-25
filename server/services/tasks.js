/**
 * Task control: what Claude Code is doing right now, and the ability to
 * start and stop work from the dashboard (including from a phone).
 *
 * Two kinds of "running":
 *   1. Tasks this dashboard started — a headless `claude -p` run it owns,
 *      with a pid, a log file, and a stop button that actually stops it.
 *   2. Claude Code's own job records under ~/.claude/jobs — these carry no
 *      pid, so they are reported as state, not as something we can kill.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { PATHS, STATE_DIR, readJson, ensureDir, httpError, toNativePath } from '../claude-home.js';

const TASK_DIR = path.join(STATE_DIR, 'tasks');

function ensureTaskDir() {
  ensureDir(TASK_DIR);
  return TASK_DIR;
}

function newId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/* ------------------------------------------------------------- job records */

export async function listJobs() {
  let entries = [];
  try {
    entries = await fsp.readdir(PATHS.jobs, { withFileTypes: true });
  } catch {
    return [];
  }
  const jobs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(PATHS.jobs, entry.name, 'state.json');
    const state = await readJson(file);
    if (!state) continue;
    jobs.push({
      id: entry.name,
      name: state.name || state.intent || entry.name,
      intent: state.intent || null,
      detail: state.detail || null,
      state: state.state || 'unknown',
      tempo: state.tempo || 'unknown',
      tokens: state.tokens ?? null,
      cwd: state.cwd || null,
      sessionId: state.sessionId || null,
      createdAt: state.createdAt || null,
      updatedAt: state.updatedAt || null,
      output: state.output?.result ? String(state.output.result).slice(0, 400) : null,
    });
  }
  return jobs.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

/* --------------------------------------------------------------- processes */

function psWindows() {
  const script =
    'Get-CimInstance Win32_Process | Where-Object { $_.Name -match "claude|node|bash|python" } | ' +
    'ForEach-Object { [PSCustomObject]@{ pid=$_.ProcessId; ppid=$_.ParentProcessId; name=$_.Name; ' +
    'started=$_.CreationDate.ToString("o"); cmd=$_.CommandLine } } | ConvertTo-Json -Compress';
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        try {
          const parsed = JSON.parse(stdout.trim());
          return resolve(Array.isArray(parsed) ? parsed : [parsed]);
        } catch {
          return resolve([]);
        }
      }
    );
  });
}

/** `ps` on macOS and Linux: etimes is seconds since the process started. */
function psUnix() {
  return new Promise((resolve) => {
    execFile(
      'ps',
      ['-eo', 'pid=,ppid=,etimes=,comm=,args='],
      { maxBuffer: 8 * 1024 * 1024 },
      (err, stdout) => {
        if (err || !stdout) return resolve([]);
        const now = Date.now();
        const rows = [];
        for (const line of stdout.split('\n')) {
          const m = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/);
          if (!m) continue;
          const [, pid, ppid, etimes, name, cmd] = m;
          if (!/claude|node|bash|python/i.test(name)) continue;
          rows.push({
            pid: Number(pid),
            ppid: Number(ppid),
            name,
            started: new Date(now - Number(etimes) * 1000).toISOString(),
            cmd: cmd.slice(0, 220),
          });
        }
        resolve(rows);
      }
    );
  });
}

function psCommand() {
  return process.platform === 'win32' ? psWindows() : psUnix();
}

export async function listProcesses() {
  const raw = await psCommand();
  return raw
    .filter((p) => p && p.pid)
    .map((p) => ({
      pid: p.pid,
      ppid: p.ppid,
      name: p.name,
      started: p.started,
      cmd: String(p.cmd || '').slice(0, 220),
      claude: /claude/i.test(String(p.cmd || '')) || /claude/i.test(String(p.name || '')),
    }));
}

/* ------------------------------------------------------------ managed tasks */

function taskMetaPath(id) {
  return path.join(TASK_DIR, `${id}.json`);
}
function taskLogPath(id) {
  return path.join(TASK_DIR, `${id}.log`);
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function listManagedTasks() {
  ensureTaskDir();
  let files = [];
  try {
    files = await fsp.readdir(TASK_DIR);
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const meta = await readJson(path.join(TASK_DIR, file));
    if (!meta) continue;
    const alive = meta.pid ? isAlive(meta.pid) : false;
    let bytes = 0;
    try {
      bytes = (await fsp.stat(taskLogPath(meta.id))).size;
    } catch {
      bytes = 0;
    }
    out.push({
      id: meta.id,
      name: meta.name || meta.prompt?.slice(0, 60) || meta.id,
      prompt: meta.prompt || '',
      cwd: meta.cwd,
      pid: meta.pid,
      alive,
      startedAt: meta.startedAt,
      endedAt: meta.endedAt || null,
      exitCode: meta.exitCode ?? null,
      logBytes: bytes,
      logPath: taskLogPath(meta.id),
    });
  }
  return out.sort((a, b) => String(b.startedAt || '').localeCompare(String(a.startedAt || '')));
}

/** Projects the operator has already used, offered as run targets. */
export async function listRunTargets() {
  const root = (await readJson(PATHS.claudeJson, {})) || {};
  const dirs = new Set();
  for (const cwd of Object.keys(root.projects || {})) {
    try {
      if (fs.existsSync(toNativePath(cwd))) dirs.add(cwd);
    } catch {
      /* ignore */
    }
  }
  dirs.add(os.homedir());
  return [...dirs].sort();
}

export async function startTask({ cwd, prompt, name }) {
  const text = String(prompt || '').trim();
  if (!text) throw httpError(400, 'A prompt is required');
  if (text.length > 4000) throw httpError(400, 'That prompt is longer than 4000 characters');

  const target = toNativePath(cwd || os.homedir());
  const allowed = await listRunTargets();
  const permitted = allowed.some((dir) => toNativePath(dir) === target);
  if (!permitted) throw httpError(403, 'Pick a project directory this machine already knows about');

  ensureTaskDir();
  const id = newId();
  const startedAt = new Date().toISOString();
  const logPath = taskLogPath(id);

  let child;
  try {
    child = spawn(
      'claude',
      ['-p', text, '--permission-mode', 'bypassPermissions', '--output-format', 'text'],
      { cwd: target, windowsHide: true, detached: false, shell: false, env: process.env }
    );
  } catch (err) {
    throw httpError(500, `Could not start the task: ${err.message}`);
  }

  const meta = {
    id,
    name: name || text.split('\n')[0].slice(0, 60),
    prompt: text,
    cwd: target,
    pid: child.pid,
    startedAt,
    logPath,
  };
  await fsp.writeFile(taskMetaPath(id), JSON.stringify(meta, null, 2));

  child.stdout?.pipe(fs.createWriteStream(logPath, { flags: 'a' }));
  child.stderr?.pipe(fs.createWriteStream(logPath, { flags: 'a' }));
  child.on('exit', async (code) => {
    // A stop writes "stopped" first; do not overwrite that with the exit code.
    const existing = (await readJson(taskMetaPath(id))) || meta;
    if (existing.exitCode === 'stopped') return;
    const current = { ...existing, endedAt: new Date().toISOString(), exitCode: code };
    await fsp.writeFile(taskMetaPath(id), JSON.stringify(current, null, 2)).catch(() => {});
  });

  return meta;
}

export async function stopTask(id) {
  const meta = await readJson(taskMetaPath(id));
  if (!meta) throw httpError(404, 'No such task');
  if (meta.pid && isAlive(meta.pid)) {
    if (process.platform === 'win32') {
      await new Promise((resolve) => {
        execFile('taskkill', ['/PID', String(meta.pid), '/T', '/F'], { windowsHide: true }, () => resolve());
      });
    } else {
      // shortcut: SIGTERM only reaches the direct child, not its process group.
      // Claude Code runs its own children, so a stopped task may leave them.
      try {
        process.kill(meta.pid, 'SIGTERM');
      } catch {
        /* already gone */
      }
    }
  }
  const updated = { ...meta, endedAt: new Date().toISOString(), exitCode: 'stopped', pid: null };
  await fsp.writeFile(taskMetaPath(id), JSON.stringify(updated, null, 2));
  return { ok: true, id };
}

export async function taskLog(id, limit = 20000) {
  const meta = await readJson(taskMetaPath(id));
  if (!meta) throw httpError(404, 'No such task');
  let content = '';
  try {
    const raw = await fsp.readFile(taskLogPath(id), 'utf8');
    content = raw.length > limit ? raw.slice(-limit) : raw;
  } catch {
    content = '';
  }
  return { id, log: content, meta };
}
