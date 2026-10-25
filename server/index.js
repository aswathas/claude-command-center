/**
 * Claude Command Center — local API.
 * Binds to 127.0.0.1 only. Every mutating route writes through a helper that
 * backs up the file it changes.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PATHS, APP_ROOT, readJson, writeJson } from './claude-home.js';
import * as usage from './usage-index.js';
import { listSkills, setSkillEnabled } from './services/skills.js';
import { listPlugins, setPluginEnabled } from './services/plugins.js';
import { listMcp, setGlobalServerEnabled, saveGlobalServer, deleteGlobalServer } from './services/mcp.js';
import { getSettings, patchSettings, setEnvVar, replaceSettings, replaceSettingsLocal, writeClaudeMd } from './services/settings.js';
import { listMemory, readMemoryFile, writeMemoryFile, deleteMemoryFile } from './services/memory.js';
import * as tasks from './services/tasks.js';
import { getAccess, setLanEnabled, rotateCode, checkCode, isLoopback } from './services/access.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(APP_ROOT, 'dist');
const PORT = Number(process.env.CCC_PORT || 8787);

const app = express();
app.use(express.json({ limit: '8mb' }));

/* Access control. A caller on this machine always passes. A caller from the
   network is refused outright unless phone access is switched on, and then
   has to present the access code. */
app.use('/api', async (req, res, next) => {
  try {
    if (req.path === '/health') return next();
    const remote = req.socket.remoteAddress;
    if (isLoopback(remote)) return next();

    const access = await getAccess();
    if (!access.lanEnabled) {
      return res.status(403).json({ error: 'Network access is switched off on this machine' });
    }
    const presented = req.header('x-ccc-code') || req.query.code;
    if (await checkCode(presented)) return next();
    return res.status(401).json({ error: 'Access code required', codeRequired: true });
  } catch (err) {
    return next(err);
  }
});

/* The static build carries no secrets, but a dashboard that is not reachable
   from the network should not even have a socket open on it. The listener
   follows the phone-access switch: loopback until it is turned on. */
app.use((req, res, next) => {
  const remote = req.socket.remoteAddress;
  if (isLoopback(remote)) return next();
  getAccess()
    .then((access) => {
      if (access.lanEnabled) return next();
      res.status(403).json({ error: 'Network access is switched off on this machine' });
    })
    .catch(next);
});

const wrap = (fn) => (req, res) => {
  Promise.resolve(fn(req, res)).catch((err) => {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'Unexpected failure' });
  });
};

/* ---------------------------------------------------------------- listener */

/* The socket follows the phone-access switch. Loopback until the operator
   opens the network, so nothing is reachable from the LAN by accident. */
let server = null;

async function bindHost() {
  const access = await getAccess();
  const host = access.lanEnabled ? '0.0.0.0' : '127.0.0.1';
  if (server) {
    const old = server;
    server = null;
    await new Promise((resolve) => old.close(resolve));
  }
  server = app.listen(PORT, host);
  return access;
}

/* ------------------------------------------------------------------ usage */

app.get('/api/usage/status', wrap(async (_req, res) => res.json(usage.status())));

app.post('/api/usage/scan', wrap(async (req, res) => {
  const result = await usage.scan({ force: Boolean(req.body?.force) });
  res.json(result);
}));

app.get('/api/usage', wrap(async (req, res) => {
  const agg = usage.aggregate();
  const now = new Date();
  const to = req.query.to || now.toISOString().slice(0, 10);
  const from = req.query.from || new Date(now.getTime() - 29 * 86400000).toISOString().slice(0, 10);
  const window = usage.range(agg, from, to);

  const spanDays = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const prevTo = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(prevTo).getTime() - (spanDays - 1) * 86400000).toISOString().slice(0, 10);
  const previous = usage.range(agg, prevFrom, prevTo);

  res.json({
    from,
    to,
    spanDays,
    days: window.days,
    totals: window.totals,
    previous: previous.totals,
    models: agg.models,
    projects: agg.projects,
    allDays: agg.days,
    lifetime: agg.totals,
    index: usage.status(),
  });
}));

/* ----------------------------------------------------------------- skills */

app.get('/api/skills', wrap(async (_req, res) => res.json({ skills: await listSkills() })));

app.post('/api/skills/:name/toggle', wrap(async (req, res) => {
  const enabled = req.body?.enabled === true;
  res.json(await setSkillEnabled(req.params.name, enabled));
}));

/* ---------------------------------------------------------------- plugins */

app.get('/api/plugins', wrap(async (_req, res) => res.json({ plugins: await listPlugins() })));

app.post('/api/plugins/toggle', wrap(async (req, res) => {
  const { key, enabled } = req.body || {};
  if (!key) return res.status(400).json({ error: 'A plugin key is required' });
  res.json(await setPluginEnabled(key, enabled === true));
}));

/* -------------------------------------------------------------------- mcp */

app.get('/api/mcp', wrap(async (_req, res) => res.json(await listMcp())));

app.post('/api/mcp/global/:name/toggle', wrap(async (req, res) => {
  res.json(await setGlobalServerEnabled(req.params.name, req.body?.enabled === true));
}));

app.put('/api/mcp/global/:name', wrap(async (req, res) => {
  res.json(await saveGlobalServer(req.params.name, req.body?.definition));
}));

app.delete('/api/mcp/global/:name', wrap(async (req, res) => {
  res.json(await deleteGlobalServer(req.params.name));
}));

/* --------------------------------------------------------------- settings */

app.get('/api/settings', wrap(async (_req, res) => res.json(await getSettings())));

app.patch('/api/settings', wrap(async (req, res) => {
  res.json(await patchSettings(req.body?.patch));
}));

app.put('/api/settings', wrap(async (req, res) => {
  res.json(await replaceSettings(req.body?.raw));
}));

app.put('/api/settings/local', wrap(async (req, res) => {
  res.json(await replaceSettingsLocal(req.body?.raw));
}));

app.post('/api/settings/env', wrap(async (req, res) => {
  const { key, value } = req.body || {};
  if (!key) return res.status(400).json({ error: 'An env key is required' });
  res.json(await setEnvVar(key, value));
}));

/* Secrets stay masked in list views. Reading one back is an explicit,
   per-key request from the operator's own machine. */
app.get('/api/settings/env/:key', wrap(async (req, res) => {
  const settings = (await readJson(PATHS.settings, {})) || {};
  const value = settings.env?.[req.params.key];
  if (value === undefined) return res.status(404).json({ error: 'No such env key' });
  res.json({ key: req.params.key, value });
}));

app.put('/api/settings/claude-md', wrap(async (req, res) => {
  res.json(await writeClaudeMd(req.body?.content));
}));

/* ----------------------------------------------------------------- memory */

app.get('/api/memory', wrap(async (_req, res) => res.json(await listMemory())));

app.get('/api/memory/file', wrap(async (req, res) => {
  res.json(await readMemoryFile(String(req.query.path || '')));
}));

app.put('/api/memory/file', wrap(async (req, res) => {
  res.json(await writeMemoryFile(req.body?.path, req.body?.content));
}));

app.delete('/api/memory/file', wrap(async (req, res) => {
  res.json(await deleteMemoryFile(String(req.query.path || '')));
}));

/* ------------------------------------------------------------------ tasks */

app.get('/api/tasks', wrap(async (_req, res) => {
  const [managed, jobs, processes, targets] = await Promise.all([
    tasks.listManagedTasks(),
    tasks.listJobs(),
    tasks.listProcesses(),
    tasks.listRunTargets(),
  ]);
  res.json({ tasks: managed, jobs, processes, targets });
}));

app.post('/api/tasks/run', wrap(async (req, res) => {
  res.json(await tasks.startTask(req.body || {}));
}));

app.post('/api/tasks/stop', wrap(async (req, res) => {
  const id = req.body?.id;
  if (!id) return res.status(400).json({ error: 'A task id is required' });
  res.json(await tasks.stopTask(id));
}));

app.get('/api/tasks/log', wrap(async (req, res) => {
  res.json(await tasks.taskLog(String(req.query.id || '')));
}));

/* ----------------------------------------------------------------- access */

app.get('/api/access', wrap(async (_req, res) => res.json(await getAccess())));

app.post('/api/access/lan', wrap(async (req, res) => {
  await setLanEnabled(req.body?.enabled === true);
  await bindHost();
  res.json(await getAccess());
}));

app.post('/api/access/rotate', wrap(async (_req, res) => res.json(await rotateCode())));

/* ------------------------------------------------------------------ misc */

app.get('/api/overview-meta', wrap(async (_req, res) => {
  const root = (await readJson(PATHS.claudeJson, {})) || {};
  res.json({
    numStartups: root.numStartups ?? null,
    oauth: root.oauthAccount?.emailAddress ?? null,
    seatTier: root.oauthAccount?.seatTier ?? null,
    home: PATHS.home,
  });
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/* ----------------------------------------------------------- static build */

if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
}

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown endpoint' }));

/* Malformed JSON and anything else that escapes a route handler still has to
   answer with the same shape the interface expects. */
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error:
      err.type === 'entity.parse.failed'
        ? 'That request was not valid JSON.'
        : err.message || 'Unexpected failure',
  });
});

bindHost()
  .then((access) => {
    console.log(`Claude Command Center API on http://127.0.0.1:${PORT}`);
    console.log(`Claude home: ${PATHS.home}`);
    console.log(
      `Access code: ${access.code}${access.lanEnabled ? `  (network access on: http://${access.lanIp}:${access.port})` : '  (network access off)'}`,
    );
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

usage.scan().catch((err) => console.error('initial scan failed', err));
