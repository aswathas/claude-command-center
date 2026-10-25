import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { McpResponse, McpServer } from '../lib/api';
import { Toggle } from '../components/Toggle';
import { useToast } from '../components/Toast';

export function Mcp() {
  const toast = useToast();
  const [data, setData] = useState<McpResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ name: string; raw: string; isNew?: boolean } | null>(null);

  const load = async () => {
    try {
      setData(await api.mcp());
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async (server: McpServer, enabled: boolean) => {
    setBusy(server.name);
    try {
      const res = await api.toggleMcp(server.name, enabled);
      toast.push(res.message, 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const saveDefinition = async () => {
    if (!editing) return;
    try {
      const parsed = JSON.parse(editing.raw);
      await api.saveMcp(editing.name, parsed);
      toast.push(`Saved MCP server ${editing.name}`, 'ok');
      setEditing(null);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const remove = async (name: string) => {
    try {
      await api.deleteMcp(name);
      toast.push(`Removed MCP server ${name}`, 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const describe = (server: McpServer) => {
    if (server.url) return server.url;
    if (server.command) return [server.command, ...server.args].join(' ');
    return '—';
  };

  return (
    <>
      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Global MCP servers</span>
          <span className="panel__meta">from ~/.claude.json</span>
          <div className="panel__actions">
            <button
              className="btn btn--primary"
              onClick={() =>
                setEditing({
                  name: '',
                  isNew: true,
                  raw: JSON.stringify({ command: 'npx', args: ['-y', 'some-mcp-server'] }, null, 2),
                })
              }
            >
              Add server
            </button>
          </div>
        </div>
        
        {loading ? (
          <div className="loading">Reading MCP configuration…</div>
        ) : (
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th style={{ width: 54 }}>On</th>
                <th>Server</th>
                <th>Transport</th>
                <th>Command or URL</th>
                <th>Env</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>
            <tbody>
              {(data?.globalServers ?? []).map((server) => (
                <tr key={server.name}>
                  <td>
                    <Toggle
                      checked
                      disabled={busy === server.name}
                      onChange={(next) => toggle(server, next)}
                      label={`Disable ${server.name}`}
                    />
                  </td>
                  <td className="mono">{server.name}</td>
                  <td>
                    <span className="chip">{server.type}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 'var(--step--1)' }}>
                      {describe(server)}
                    </span>
                  </td>
                  <td className="table__num">{server.envKeys.length || '—'}</td>
                  <td>
                    <span className="table__actions">
                      <button
                        className="btn btn--ghost"
                        onClick={() =>
                          setEditing({
                            name: server.name,
                            raw: JSON.stringify(server.raw ?? {}, null, 2),
                          })
                        }
                      >
                        Edit
                      </button>
                      <button className="btn btn--ghost btn--danger" onClick={() => remove(server.name)}>
                        Remove
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {(data?.globalServers ?? []).length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="chart__empty">No global MCP servers configured.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        )}
      </div>

      {data && data.disabledServers.length > 0 && (
        <div className="panel span-12">
          <div className="panel__head">
            <span className="panel__title">Parked servers</span>
            <span className="panel__meta">disabled from the dashboard</span>
          </div>
          
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th style={{ width: 54 }}>On</th>
                <th>Server</th>
                <th>Transport</th>
                <th>Command or URL</th>
              </tr>
            </thead>
            <tbody>
              {data.disabledServers.map((server) => (
                <tr key={server.name}>
                  <td>
                    <Toggle
                      checked={false}
                      disabled={busy === server.name}
                      onChange={(next) => toggle(server, next)}
                      label={`Enable ${server.name}`}
                    />
                  </td>
                  <td className="mono">{server.name}</td>
                  <td>
                    <span className="chip">{server.type}</span>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 'var(--step--1)' }}>
                      {describe(server)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Per-project servers</span>
          <span className="panel__meta">{data?.projects.length ?? 0} projects</span>
        </div>
        
        {data && data.projects.length > 0 ? (
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Servers</th>
                <th>Disabled</th>
                <th>Last cost</th>
                <th>Last session tokens</th>
              </tr>
            </thead>
            <tbody>
              {data.projects.map((project) => (
                <tr key={project.cwd}>
                  <td>
                    <div className="table__desc mono" style={{ maxWidth: 420 }} title={project.cwd}>
                      {project.cwd}
                    </div>
                  </td>
                  <td>
                    {project.servers.length === 0 ? (
                      <span style={{ color: 'var(--ink-3)' }}>—</span>
                    ) : (
                      project.servers.map((server) => (
                        <span key={server.name} className="chip" style={{ marginRight: 4 }}>
                          {server.name}
                        </span>
                      ))
                    )}
                  </td>
                  <td className="table__num">{project.disabledMcpServers.length || '—'}</td>
                  <td className="table__num">
                    {project.lastCost !== null ? `$${project.lastCost.toFixed(4)}` : '—'}
                  </td>
                  <td className="table__num">
                    {project.lastTotalInputTokens !== null
                      ? (project.lastTotalInputTokens + (project.lastTotalOutputTokens ?? 0)).toLocaleString('en-US')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : (
          <div className="chart__empty">No project-level MCP configuration found.</div>
        )}
      </div>

      {editing && (
        <div className="panel span-12">
          <div className="panel__head">
            <span className="panel__title">
              {editing.isNew ? 'New MCP server' : `Edit ${editing.name}`}
            </span>
            <span className="panel__meta">definition written to ~/.claude.json</span>
            <div className="panel__actions">
              <button className="btn btn--ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="btn btn--primary" onClick={saveDefinition}>
                Save server
              </button>
            </div>
          </div>
          
          <div className="editor">
            {editing.isNew && (
              <div className="field">
                <label className="field__label" htmlFor="mcp-name">
                  Server name
                </label>
                <input
                  id="mcp-name"
                  className="input input--mono"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="my-server"
                />
              </div>
            )}
            <textarea
              className="textarea"
              spellCheck={false}
              value={editing.raw}
              onChange={(e) => setEditing({ ...editing, raw: e.target.value })}
            />
            <p style={{ color: 'var(--ink-3)', fontSize: 'var(--step--1)' }}>
              Secret values in <span className="mono">env</span> are masked in this view but stored exactly as
              written.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
