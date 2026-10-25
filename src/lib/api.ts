export type DayRow = {
  date: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  msgs: number;
  sessions: number;
  total: number;
};

export type Totals = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  msgs: number;
  sessions: number;
  total: number;
};

export type ModelRow = {
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  msgs: number;
  total: number;
};

export type ProjectRow = {
  project: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
  msgs: number;
  total: number;
};

export type IndexStatus = {
  scanning: boolean;
  progress: { done: number; total: number; current: string | null };
  lastScanAt: string | null;
  lastScanMs: number;
  filesIndexed: number;
  error: string | null;
};

export type UsageResponse = {
  from: string;
  to: string;
  spanDays: number;
  days: DayRow[];
  totals: Totals;
  previous: Totals;
  models: ModelRow[];
  projects: ProjectRow[];
  allDays: DayRow[];
  lifetime: Totals & { sidechainMsgs: number };
  index: IndexStatus;
};

export type Skill = {
  name: string;
  dirName: string;
  description: string;
  version: string | null;
  author: string | null;
  license: string | null;
  enabled: boolean;
  state: 'on' | 'off';
  hasSkillFile: boolean;
  linkTarget: string | null;
  fileCount: number;
  bytes: number;
  path: string;
};

export type Plugin = {
  key: string;
  name: string;
  marketplace: string | null;
  version: string | null;
  scope: string | null;
  installedAt: string | null;
  updatedAt: string | null;
  installPath: string | null;
  enabled: boolean;
  inEnabledMap: boolean;
  description: string;
  skills: string[];
  available?: boolean;
};

export type McpServer = {
  name: string;
  type: string;
  command: string | null;
  args: string[];
  url: string | null;
  envKeys: string[];
  env: Record<string, unknown>;
  headers: Record<string, unknown>;
  scope: 'global' | 'project';
  cwd?: string;
  disabled: boolean;
  raw?: unknown;
};

export type ProjectMcp = {
  cwd: string;
  servers: McpServer[];
  disabledMcpServers: string[];
  disabledMcpjsonServers: string[];
  enabledMcpjsonServers: string[];
  hasTrustDialogAccepted: boolean | null;
  lastCost: number | null;
  lastTotalInputTokens: number | null;
  lastTotalOutputTokens: number | null;
  lastTotalCacheReadInputTokens: number | null;
  lastTotalCacheCreationInputTokens: number | null;
  lastModelUsage: Record<string, number> | null;
};

export type McpResponse = {
  globalServers: McpServer[];
  disabledServers: McpServer[];
  projects: ProjectMcp[];
  parkedFile: string;
};

export type SettingsResponse = {
  settings: Record<string, any>;
  settingsLocal: Record<string, any>;
  secretPaths: string[];
  claudeMd: string;
  projects: {
    cwd: string;
    hasTrustDialogAccepted: boolean | null;
    lastCost: number | null;
    lastDuration: number | null;
    lastStartTime: string | null;
    lastSessionId: string | null;
    lastTotalInputTokens: number | null;
    lastTotalOutputTokens: number | null;
    lastTotalCacheReadInputTokens: number | null;
    lastTotalCacheCreationInputTokens: number | null;
    lastModelUsage: Record<string, number> | null;
    mcpServerCount: number;
  }[];
  oauth: { emailAddress: string | null; seatTier: string | null; billingType: string | null; hasExtraUsageEnabled: boolean | null } | null;
  numStartups: number | null;
  skillUsage: Record<string, number>;
  pluginUsage: Record<string, number>;
  paths: Record<string, string>;
};

export type MemoryFile = { name: string; path: string; bytes: number; modified: string };
export type MemoryResponse = {
  user: { dir: string; files: MemoryFile[] };
  projects: { project: string; dir: string; files: MemoryFile[] }[];
};

export type ManagedTask = {
  id: string;
  name: string;
  prompt: string;
  cwd: string;
  pid: number | null;
  alive: boolean;
  startedAt: string;
  endedAt: string | null;
  exitCode: number | string | null;
  logBytes: number;
  logPath: string;
};

export type JobRecord = {
  id: string;
  name: string;
  intent: string | null;
  detail: string | null;
  state: string;
  tempo: string;
  tokens: number | null;
  cwd: string | null;
  sessionId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  output: string | null;
};

export type ProcessRow = {
  pid: number;
  ppid: number;
  name: string;
  started: string;
  cmd: string;
  claude: boolean;
};

export type TasksResponse = {
  tasks: ManagedTask[];
  jobs: JobRecord[];
  processes: ProcessRow[];
  targets: string[];
};

export type AccessInfo = {
  code: string;
  lanEnabled: boolean;
  createdAt: string;
  lanIp: string;
  port: number;
};

let accessCode = '';

export function setAccessCode(code: string) {
  accessCode = code || '';
}

export function getAccessCode() {
  return accessCode;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessCode ? { 'x-ccc-code': accessCode } : {}),
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (res.status === 401 && body?.codeRequired) {
    const err = new Error('Access code required') as Error & { codeRequired?: boolean };
    err.codeRequired = true;
    throw err;
  }
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

const get = <T,>(path: string) => request<T>(path);
const send = <T,>(path: string, method: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  usage: (from: string, to: string) => get<UsageResponse>(`/api/usage?from=${from}&to=${to}`),
  usageStatus: () => get<IndexStatus>('/api/usage/status'),
  rescan: (force = false) => send<IndexStatus>('/api/usage/scan', 'POST', { force }),

  skills: () => get<{ skills: Skill[] }>('/api/skills'),
  toggleSkill: (name: string, enabled: boolean) =>
    send<{ ok: boolean; message: string }>(`/api/skills/${encodeURIComponent(name)}/toggle`, 'POST', { enabled }),

  plugins: () => get<{ plugins: Plugin[] }>('/api/plugins'),
  togglePlugin: (key: string, enabled: boolean) =>
    send<{ ok: boolean; key: string }>('/api/plugins/toggle', 'POST', { key, enabled }),

  mcp: () => get<McpResponse>('/api/mcp'),
  toggleMcp: (name: string, enabled: boolean) =>
    send<{ ok: boolean; message: string }>(`/api/mcp/global/${encodeURIComponent(name)}/toggle`, 'POST', { enabled }),
  saveMcp: (name: string, definition: unknown) =>
    send<{ ok: boolean }>(`/api/mcp/global/${encodeURIComponent(name)}`, 'PUT', { definition }),
  deleteMcp: (name: string) =>
    send<{ ok: boolean }>(`/api/mcp/global/${encodeURIComponent(name)}`, 'DELETE'),

  settings: () => get<SettingsResponse>('/api/settings'),
  patchSettings: (patch: Record<string, unknown>) => send<{ ok: boolean }>('/api/settings', 'PATCH', { patch }),
  replaceSettings: (raw: string) => send<{ ok: boolean }>('/api/settings', 'PUT', { raw }),
  replaceSettingsLocal: (raw: string) => send<{ ok: boolean }>('/api/settings/local', 'PUT', { raw }),
  setEnv: (key: string, value: string | null) => send<{ ok: boolean }>('/api/settings/env', 'POST', { key, value }),
  revealEnv: (key: string) => get<{ key: string; value: string }>(`/api/settings/env/${encodeURIComponent(key)}`),
  saveClaudeMd: (content: string) => send<{ ok: boolean }>('/api/settings/claude-md', 'PUT', { content }),

  memory: () => get<MemoryResponse>('/api/memory'),
  readMemory: (path: string) => get<{ path: string; content: string }>(`/api/memory/file?path=${encodeURIComponent(path)}`),
  writeMemory: (path: string, content: string) =>
    send<{ ok: boolean; bytes: number }>('/api/memory/file', 'PUT', { path, content }),
  deleteMemory: (path: string) => send<{ ok: boolean }>(`/api/memory/file?path=${encodeURIComponent(path)}`, 'DELETE'),

  tasks: () => get<TasksResponse>('/api/tasks'),
  runTask: (cwd: string, prompt: string, name?: string) =>
    send<{ id: string; pid: number }>('/api/tasks/run', 'POST', { cwd, prompt, name }),
  stopTask: (id: string) => send<{ ok: boolean }>('/api/tasks/stop', 'POST', { id }),
  taskLog: (id: string) => get<{ id: string; log: string; meta: ManagedTask }>(`/api/tasks/log?id=${encodeURIComponent(id)}`),

  access: () => get<AccessInfo>('/api/access'),
  setLan: (enabled: boolean) => send<AccessInfo>('/api/access/lan', 'POST', { enabled }),
  rotateCode: () => send<AccessInfo>('/api/access/rotate', 'POST'),
};
