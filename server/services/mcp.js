/**
 * MCP servers: the global set in ~/.claude.json plus every per-project set.
 * Claude Code has no first-class "disable one global server" flag, so a
 * disabled server is moved out of ~/.claude.json into a parked file the
 * dashboard owns and can restore.
 */
import path from 'node:path';
import { PATHS, STATE_DIR, readJson, writeJson, writeWithBackup, httpError, ensureDir } from '../claude-home.js';
import { redactEnv } from '../redact.js';

const PARKED_FILE = path.join(STATE_DIR, 'disabled-mcp.json');

function shapeServer(name, def) {
  const base = { name, type: 'stdio', command: null, args: [], url: null, envKeys: [], env: {}, headers: {}, raw: def };
  if (!def || typeof def !== 'object') return base;
  if (def.url || def.type === 'sse' || def.type === 'http') {
    base.type = def.type || 'http';
    base.url = def.url || null;
    base.headers = def.headers || {};
  } else {
    base.type = 'stdio';
    base.command = def.command || null;
    base.args = Array.isArray(def.args) ? def.args : [];
  }
  if (def.env && typeof def.env === 'object') {
    base.envKeys = Object.keys(def.env);
    base.env = redactEnv(def.env);
  }
  return base;
}

async function readParked() {
  return (await readJson(PARKED_FILE, {})) || {};
}

export async function listMcp() {
  const root = (await readJson(PATHS.claudeJson, {})) || {};
  const parked = await readParked();

  const globalServers = Object.entries(root.mcpServers || {}).map(([name, def]) => ({
    ...shapeServer(name, def),
    scope: 'global',
    disabled: false,
  }));
  const disabledServers = Object.entries(parked).map(([name, def]) => ({
    ...shapeServer(name, def),
    scope: 'global',
    disabled: true,
  }));

  const projects = Object.entries(root.projects || {}).map(([cwd, cfg]) => {
    const servers = Object.entries(cfg.mcpServers || {}).map(([name, def]) => ({
      ...shapeServer(name, def),
      scope: 'project',
      cwd,
      disabled: (cfg.disabledMcpServers || []).includes(name),
    }));
    return {
      cwd,
      servers,
      disabledMcpServers: cfg.disabledMcpServers || [],
      disabledMcpjsonServers: cfg.disabledMcpjsonServers || [],
      enabledMcpjsonServers: cfg.enabledMcpjsonServers || [],
      hasTrustDialogAccepted: cfg.hasTrustDialogAccepted ?? null,
      lastCost: cfg.lastCost ?? null,
      lastTotalInputTokens: cfg.lastTotalInputTokens ?? null,
      lastTotalOutputTokens: cfg.lastTotalOutputTokens ?? null,
      lastTotalCacheReadInputTokens: cfg.lastTotalCacheReadInputTokens ?? null,
      lastTotalCacheCreationInputTokens: cfg.lastTotalCacheCreationInputTokens ?? null,
      lastModelUsage: cfg.lastModelUsage || null,
    };
  });

  return { globalServers, disabledServers, projects, parkedFile: PARKED_FILE };
}

export async function setGlobalServerEnabled(name, enabled) {
  const root = (await readJson(PATHS.claudeJson, {})) || {};
  const parked = await readParked();
  if (!root.mcpServers) root.mcpServers = {};

  if (enabled) {
    // A parked copy always wins: restore it and drop the parked record so the
    // two lists can never disagree.
    if (parked[name]) {
      root.mcpServers[name] = parked[name];
      delete parked[name];
    } else if (!root.mcpServers[name]) {
      throw httpError(404, `No MCP server named ${name}`);
    }
  } else {
    if (root.mcpServers[name]) {
      parked[name] = root.mcpServers[name];
      delete root.mcpServers[name];
    } else if (!parked[name]) {
      throw httpError(404, `No MCP server named ${name}`);
    }
  }

  ensureDir(STATE_DIR);
  await writeWithBackup(PARKED_FILE, JSON.stringify(parked, null, 2) + '\n', { backup: false });
  await writeJson(PATHS.claudeJson, root);
  return { ok: true, state: enabled ? 'on' : 'off', message: `${name} ${enabled ? 'enabled' : 'disabled'}` };
}

export async function saveGlobalServer(name, definition) {
  const root = (await readJson(PATHS.claudeJson, {})) || {};
  if (!root.mcpServers) root.mcpServers = {};
  if (!definition || typeof definition !== 'object') throw httpError(400, 'A server definition is required');
  if (!definition.command && !definition.url) throw httpError(400, 'A server needs a command or a url');
  root.mcpServers[name] = definition;
  const backup = await writeJson(PATHS.claudeJson, root);
  return { ok: true, name, backup };
}

export async function deleteGlobalServer(name) {
  const root = (await readJson(PATHS.claudeJson, {})) || {};
  const parked = await readParked();
  if (root.mcpServers?.[name]) {
    delete root.mcpServers[name];
  } else if (parked[name]) {
    delete parked[name];
  } else {
    throw httpError(404, `No MCP server named ${name}`);
  }
  ensureDir(STATE_DIR);
  await writeWithBackup(PARKED_FILE, JSON.stringify(parked, null, 2) + '\n', { backup: false });
  const backup = await writeJson(PATHS.claudeJson, root);
  return { ok: true, name, backup };
}
