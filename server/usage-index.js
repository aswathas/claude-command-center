/**
 * Token telemetry.
 *
 * Claude Code writes one JSONL transcript per session under
 * ~/.claude/projects/<slug>/<session>.jsonl. Every assistant message carries a
 * `usage` block. The same API message can appear more than once in a file
 * (streamed retries, block re-writes), so usage is deduplicated on
 * (sessionId, message.id) before it is counted.
 *
 * 1 GB of transcripts is too much to re-parse on every request, so each file is
 * aggregated once and cached by (mtime, size). A changed file is re-aggregated;
 * an unchanged one is skipped.
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PATHS, CACHE_DIR, ensureDir } from './claude-home.js';

const CACHE_FILE = path.join(CACHE_DIR, 'usage-index.json');
const CACHE_VERSION = 5;

const state = {
  files: new Map(), // absolute path -> { mtimeMs, size, agg }
  scanning: false,
  progress: { done: 0, total: 0, current: null },
  lastScanAt: null,
  lastScanMs: 0,
  error: null,
};

function emptyAgg() {
  return {
    days: {},
    models: {},
    projects: {},
    sessions: {},
    totals: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, msgs: 0, sidechainMsgs: 0 },
  };
}

function blankBucket() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, msgs: 0 };
}

function addTo(bucket, key, field, value) {
  if (!bucket[key]) bucket[key] = blankBucket();
  bucket[key][field] += value;
  return bucket[key];
}

async function walkJsonl(root) {
  const out = [];
  let stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(full);
    }
  }
  return out;
}

/** Aggregate one transcript file into per-day / per-model / per-project buckets. */
async function aggregateFile(file) {
  const agg = emptyAgg();
  const msgModels = {};
  const seen = new Set();
  let lastCostState = null;
  let sessionDay = null;
  let sessionCwd = null;
  let stream;
  try {
    stream = fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 20 });
  } catch {
    return agg;
  }
  let buffer = '';

  const handleLine = (line) => {
    if (!line.trim()) return;
    let d;
    try {
      d = JSON.parse(line);
    } catch {
      return;
    }

    // Claude Code's own session accounting. The final record in a file is the
    // session total, so it is the authoritative source for cost and for the
    // per-model split.
    if (d.type === 'cost-state') {
      lastCostState = d;
      if (d.cwd) sessionCwd = d.cwd;
      return;
    }

    if (d.type !== 'assistant') {
      if (d.cwd && !sessionCwd) sessionCwd = d.cwd;
      return;
    }
    const msg = d.message || {};
    const usage = msg.usage;
    if (!usage) return;
    const key = `${d.sessionId || 'n/a'}:${msg.id || d.uuid || Math.random()}`;
    if (seen.has(key)) return;
    seen.add(key);

    const input = usage.input_tokens || 0;
    const output = usage.output_tokens || 0;
    const cacheRead = usage.cache_read_input_tokens || 0;
    const cacheWrite = usage.cache_creation_input_tokens || 0;
    const cost = typeof msg.costUSD === 'number' ? msg.costUSD : 0;
    const ts = d.timestamp || null;
    const day = ts ? ts.slice(0, 10) : 'unknown';
    if (day !== 'unknown') sessionDay = day;
    if (d.cwd && !sessionCwd) sessionCwd = d.cwd;

    const dayBucket =
      agg.days[day] || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, msgs: 0, sessions: {} };
    dayBucket.input += input;
    dayBucket.output += output;
    dayBucket.cacheRead += cacheRead;
    dayBucket.cacheWrite += cacheWrite;
    dayBucket.cost += cost;
    dayBucket.msgs += 1;
    if (d.sessionId) dayBucket.sessions[d.sessionId] = true;
    agg.days[day] = dayBucket;

    const model = msg.model || 'unknown';
    const m = msgModels[model] || (msgModels[model] = blankBucket());
    m.input += input;
    m.output += output;
    m.cacheRead += cacheRead;
    m.cacheWrite += cacheWrite;
    m.cost += cost;
    m.msgs += 1;

    const project = projectLabel(d.cwd);
    const p = agg.projects[project] || (agg.projects[project] = blankBucket());
    p.input += input;
    p.output += output;
    p.cacheRead += cacheRead;
    p.cacheWrite += cacheWrite;
    p.cost += cost;
    p.msgs += 1;

    if (d.sessionId) agg.sessions[d.sessionId] = true;

    agg.totals.input += input;
    agg.totals.output += output;
    agg.totals.cacheRead += cacheRead;
    agg.totals.cacheWrite += cacheWrite;
    agg.totals.cost += cost;
    agg.totals.msgs += 1;
    if (d.isSidechain) agg.totals.sidechainMsgs += 1;
  };

  await new Promise((resolve) => {
    stream.on('data', (chunk) => {
      buffer += chunk;
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        handleLine(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
      }
    });
    stream.on('end', () => {
      if (buffer.trim()) handleLine(buffer);
      resolve();
    });
    stream.on('error', () => resolve());
  });

  // Prefer Claude Code's session accounting for cost and the model split; fall
  // back to the per-message sums when a session has no cost record.
  if (lastCostState) {
    const modelUsage = lastCostState.modelUsage || {};
    const names = Object.keys(modelUsage);
    if (names.length) {
      agg.models = {};
      for (const name of names) {
        const u = modelUsage[name] || {};
        agg.models[name] = {
          input: u.inputTokens || 0,
          output: u.outputTokens || 0,
          cacheRead: u.cacheReadInputTokens || 0,
          cacheWrite: u.cacheCreationInputTokens || 0,
          cost: typeof u.costUSD === 'number' ? u.costUSD : 0,
          msgs: msgModels[name]?.msgs || 0,
        };
      }
    } else {
      agg.models = msgModels;
    }

    const sessionCost = typeof lastCostState.totalCostUSD === 'number' ? lastCostState.totalCostUSD : 0;
    agg.totals.cost += sessionCost;
    // Attribute the session cost to a real day: the last message we saw, then
    // the session start time, and never a synthetic "unknown" bucket.
    const costDay =
      sessionDay ||
      (lastCostState.startTime
        ? new Date(Number(lastCostState.startTime)).toISOString().slice(0, 10)
        : null);
    if (costDay && costDay !== 'unknown') {
      const dayBucket =
        agg.days[costDay] ||
        (agg.days[costDay] = {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          msgs: 0,
          sessions: {},
        });
      dayBucket.cost += sessionCost;
    }
    const project = projectLabel(sessionCwd);
    const p = agg.projects[project] || (agg.projects[project] = blankBucket());
    p.cost += sessionCost;
  } else {
    agg.models = msgModels;
  }

  return agg;
}

export function projectLabel(cwd) {
  if (!cwd) return 'unknown';
  const parts = String(cwd).split(/[\\/]/).filter(Boolean);
  if (!parts.length) return 'unknown';
  const tail = parts.slice(-2).join('/');
  return tail || parts[parts.length - 1];
}

async function loadCache() {
  try {
    const raw = await fsp.readFile(CACHE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.version !== CACHE_VERSION) return;
    for (const [file, entry] of Object.entries(parsed.files || {})) {
      state.files.set(file, entry);
    }
    state.lastScanAt = parsed.lastScanAt || null;
  } catch {
    /* no cache yet */
  }
}

async function saveCache() {
  try {
    ensureDir(CACHE_DIR);
    const files = {};
    for (const [file, entry] of state.files) files[file] = entry;
    await fsp.writeFile(
      CACHE_FILE,
      JSON.stringify({ version: CACHE_VERSION, lastScanAt: state.lastScanAt, files }, null, 0),
      'utf8'
    );
  } catch {
    /* cache write is best-effort */
  }
}

/** Scan transcripts, re-aggregating only files that changed. */
export async function scan({ force = false } = {}) {
  if (state.scanning) return status();
  state.scanning = true;
  state.error = null;
  const started = Date.now();
  try {
    await loadCache();
    const files = await walkJsonl(PATHS.projects);
    state.progress = { done: 0, total: files.length, current: null };
    const seen = new Set();
    for (const file of files) {
      seen.add(file);
      let stat;
      try {
        stat = await fsp.stat(file);
      } catch {
        continue;
      }
      const cached = state.files.get(file);
      if (!force && cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        state.progress.done += 1;
        continue;
      }
      state.progress.current = file;
      const agg = await aggregateFile(file);
      state.files.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, agg });
      state.progress.done += 1;
    }
    for (const file of [...state.files.keys()]) {
      if (!seen.has(file)) state.files.delete(file);
    }
    state.lastScanAt = new Date().toISOString();
    state.lastScanMs = Date.now() - started;
    await saveCache();
  } catch (err) {
    state.error = err.message;
  } finally {
    state.scanning = false;
    state.progress.current = null;
  }
  return status();
}

export function status() {
  return {
    scanning: state.scanning,
    progress: state.progress,
    lastScanAt: state.lastScanAt,
    lastScanMs: state.lastScanMs,
    filesIndexed: state.files.size,
    error: state.error,
  };
}

function dayKey(dateStr) {
  return dateStr.slice(0, 10);
}

/** Merge cached per-file aggregates into one time series. */
export function aggregate() {
  const days = {};
  const models = {};
  const projects = {};
  const sessions = new Set();
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, msgs: 0, sidechainMsgs: 0 };

  for (const { agg } of state.files.values()) {
    for (const [day, d] of Object.entries(agg.days || {})) {
      const target = days[day] || { date: day, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, msgs: 0, sessions: 0 };
      target.input += d.input;
      target.output += d.output;
      target.cacheRead += d.cacheRead;
      target.cacheWrite += d.cacheWrite;
      target.cost += d.cost || 0;
      target.msgs += d.msgs || 0;
      target.sessions += Object.keys(d.sessions || {}).length;
      days[day] = target;
    }
    for (const [model, m] of Object.entries(agg.models || {})) {
      const t = models[model] || { model, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, msgs: 0 };
      t.input += m.input;
      t.output += m.output;
      t.cacheRead += m.cacheRead;
      t.cacheWrite += m.cacheWrite;
      t.cost += m.cost || 0;
      t.msgs += m.msgs || 0;
      models[model] = t;
    }
    for (const [project, p] of Object.entries(agg.projects || {})) {
      const t = projects[project] || { project, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, msgs: 0 };
      t.input += p.input;
      t.output += p.output;
      t.cacheRead += p.cacheRead;
      t.cacheWrite += p.cacheWrite;
      t.cost += p.cost || 0;
      t.msgs += p.msgs || 0;
      projects[project] = t;
    }
    for (const s of Object.keys(agg.sessions || {})) sessions.add(s);
    totals.input += agg.totals.input;
    totals.output += agg.totals.output;
    totals.cacheRead += agg.totals.cacheRead;
    totals.cacheWrite += agg.totals.cacheWrite;
    totals.cost += agg.totals.cost;
    totals.msgs += agg.totals.msgs;
    totals.sidechainMsgs += agg.totals.sidechainMsgs;
  }

  const series = Object.values(days).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const d of series) d.total = d.input + d.output + d.cacheRead + d.cacheWrite;

  totals.total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  totals.sessions = sessions.size;

  const modelList = Object.values(models)
    .map((m) => ({ ...m, total: m.input + m.output + m.cacheRead + m.cacheWrite }))
    .sort((a, b) => b.total - a.total);
  const projectList = Object.values(projects)
    .map((p) => ({ ...p, total: p.input + p.output + p.cacheRead + p.cacheWrite }))
    .sort((a, b) => b.total - a.total);

  return { days: series, models: modelList, projects: projectList, totals };
}

export function range(agg, from, to) {
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  const days = agg.days.filter((d) => d.date >= fromKey && d.date <= toKey);
  const sum = (list, field) => list.reduce((acc, item) => acc + (item[field] || 0), 0);
  const totals = {
    input: sum(days, 'input'),
    output: sum(days, 'output'),
    cacheRead: sum(days, 'cacheRead'),
    cacheWrite: sum(days, 'cacheWrite'),
    cost: sum(days, 'cost'),
    msgs: sum(days, 'msgs'),
    sessions: sum(days, 'sessions'),
  };
  totals.total = totals.input + totals.output + totals.cacheRead + totals.cacheWrite;
  return { days, totals };
}
