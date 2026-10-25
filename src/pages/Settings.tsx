import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../lib/api';
import type { AccessInfo, SettingsResponse } from '../lib/api';
import { cost, full, relativeTime } from '../lib/format';
import { Toggle } from '../components/Toggle';
import { useToast } from '../components/Toast';

type Masked = { __redacted: true; length: string };

const isMasked = (v: unknown): v is Masked =>
  Boolean(v && typeof v === 'object' && (v as any).__redacted);

export function Settings() {
  const toast = useToast();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [raw, setRaw] = useState('');
  const [claudeMd, setClaudeMd] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [editingEnv, setEditingEnv] = useState<{ key: string; value: string } | null>(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [access, setAccess] = useState<AccessInfo | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const loadAccess = async () => {
    try {
      const info = await api.access();
      setAccess(info);
      if (info.lanEnabled) {
        const url = `http://${info.lanIp}:${info.port}`;
        setQr(await QRCode.toDataURL(url, { margin: 1, width: 320 }));
      } else {
        setQr(null);
      }
    } catch {
      /* access panel stays quiet */
    }
  };

  const toggleLan = async (enabled: boolean) => {
    try {
      const info = await api.setLan(enabled);
      setAccess(info);
      toast.push(enabled ? `Open on ${info.lanIp}:${info.port}` : 'Closed to the network', 'ok');
      await loadAccess();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const rotate = async () => {
    try {
      const info = await api.rotateCode();
      setAccess(info);
      toast.push('New access code issued', 'ok');
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const load = async () => {
    try {
      const res = await api.settings();
      setData(res);
      setRaw(JSON.stringify(res.settings, null, 2));
      setClaudeMd(res.claudeMd);
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRaw = async () => {
    try {
      await api.replaceSettings(raw);
      toast.push('settings.json saved — a backup was kept alongside it', 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const saveEnv = async (key: string, value: string | null) => {
    try {
      await api.setEnv(key, value);
      toast.push(value === null ? `Removed ${key}` : `Updated ${key}`, 'ok');
      setEditingEnv(null);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const reveal = async (key: string) => {
    try {
      const res = await api.revealEnv(key);
      setRevealed((prev) => ({ ...prev, [key]: res.value }));
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const saveClaudeMd = async () => {
    try {
      await api.saveClaudeMd(claudeMd);
      toast.push('CLAUDE.md saved', 'ok');
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const setModel = async (model: string) => {
    try {
      await api.patchSettings({ model });
      toast.push('Model updated', 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const setPermissionMode = async (mode: string) => {
    try {
      const permissions = { ...(data?.settings.permissions || {}), defaultMode: mode };
      await api.patchSettings({ permissions });
      toast.push('Permission mode updated', 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  if (loading) return <div className="loading">Reading settings…</div>;
  if (!data) return <div className="chart__empty">Settings could not be read.</div>;

  const env = (data.settings.env || {}) as Record<string, unknown>;
  const envKeys = Object.keys(env);

  return (
    <>
      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Model and permissions</span>
          <span className="panel__meta">takes effect on the next Claude Code start</span>
        </div>
        
        <div className="grid--halves">
          <div className="field">
            <label className="field__label" htmlFor="model">
              Active model
            </label>
            <input
              id="model"
              className="input input--mono"
              defaultValue={String(data.settings.model ?? '')}
              onBlur={(e) => e.target.value !== data.settings.model && setModel(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="perm">
              Default permission mode
            </label>
            <select
              id="perm"
              className="select"
              value={data.settings.permissions?.defaultMode ?? 'default'}
              onChange={(e) => setPermissionMode(e.target.value)}
            >
              {['default', 'acceptEdits', 'bypassPermissions', 'plan'].map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </div>
        </div>
        {Array.isArray(data.settings.modelPicker?.options) && (
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th>Picker entry</th>
                <th>Model</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {(data.settings.modelPicker.options as any[]).map((option) => (
                <tr key={option.model}>
                  <td>{option.label}</td>
                  <td className="mono">{option.model}</td>
                  <td>{option.description}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Phone access</span>
          <span className="panel__meta">reach the console from another device on this network</span>
          <span className="panel__actions">
            <Toggle
              checked={access?.lanEnabled ?? false}
              onChange={(next) => toggleLan(next)}
              label="Allow access from the network"
            />
          </span>
        </div>
        {access?.lanEnabled ? (
          <div className="grid--halves">
            <div>
              <div className="readouts">
                <div className="readout">
                  <span className="readout__label">Address</span>
                  <span className="readout__value" style={{ fontSize: 'var(--step-1)' }}>
                    http://{access.lanIp}:{access.port}
                  </span>
                  <span className="readout__foot">on this network</span>
                </div>
                <div className="readout">
                  <span className="readout__label">Access code</span>
                  <span className="readout__value readout__value--live">{access.code}</span>
                  <span className="readout__foot">also printed in the terminal</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                <button className="btn" onClick={rotate}>
                  Rotate the code
                </button>
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(`http://${access.lanIp}:${access.port}`);
                    toast.push('Address copied', 'ok');
                  }}
                >
                  Copy address
                </button>
              </div>
              <p style={{ color: 'var(--ink-3)', fontSize: 'var(--step--1)', marginTop: 'var(--space-3)' }}>
                With the network open, every API call needs the code. Turning this off closes the
                dashboard to the outside world immediately.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {qr ? (
                <img
                  src={qr}
                  alt={`QR code for the dashboard at http://${access.lanIp}:${access.port}`}
                  style={{ width: 168, height: 168, imageRendering: 'pixelated', background: '#fff', padding: 8 }}
                />
              ) : (
                <p className="chart__empty">Scan to open on a phone.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="chart__empty">
            The console is on loopback only. Switch this on to open it to your network — you will need the
            access code on every device that connects.
          </p>
        )}
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Environment</span>
          <span className="panel__meta">
            {envKeys.length} keys · secret values are masked until you ask for them
          </span>
        </div>
        
        <div className="tablewrap"><table className="table">
          <thead>
            <tr>
              <th>Key</th>
              <th>Value</th>
              <th style={{ width: 210 }} />
            </tr>
          </thead>
          <tbody>
            {envKeys.map((key) => {
              const value = env[key];
              const masked = isMasked(value);
              const shown = revealed[key];
              const editing = editingEnv?.key === key;
              return (
                <tr key={key}>
                  <td className="mono">{key}</td>
                  <td>
                    {editing ? (
                      <input
                        className="input input--mono"
                        value={editingEnv!.value}
                        autoFocus
                        onChange={(e) => setEditingEnv({ key, value: e.target.value })}
                      />
                    ) : masked && shown === undefined ? (
                      <span className="mono" style={{ color: 'var(--ink-3)' }}>
                        {String((value as Masked).length)} · hidden
                      </span>
                    ) : masked ? (
                      <span className="mono">{shown}</span>
                    ) : (
                      <span className="mono">{String(value)}</span>
                    )}
                  </td>
                  <td>
                    <span className="table__actions">
                      {masked && shown === undefined && (
                        <button className="btn btn--ghost" onClick={() => reveal(key)}>
                          Show
                        </button>
                      )}
                      {editing ? (
                        <>
                          <button
                            className="btn btn--primary"
                            onClick={() => saveEnv(key, editingEnv!.value)}
                          >
                            Save
                          </button>
                          <button className="btn btn--ghost" onClick={() => setEditingEnv(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn--ghost"
                          onClick={() => setEditingEnv({ key, value: '' })}
                        >
                          Edit
                        </button>
                      )}
                      <button className="btn btn--ghost btn--danger" onClick={() => saveEnv(key, null)}>
                        Remove
                      </button>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>

        <div className="editor">
          <div className="editor__bar">
            <div className="field" style={{ flex: 1 }}>
              <label className="field__label" htmlFor="new-key">
                New key
              </label>
              <input
                id="new-key"
                className="input input--mono"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="MY_FLAG"
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label className="field__label" htmlFor="new-value">
                Value
              </label>
              <input
                id="new-value"
                className="input input--mono"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
              />
            </div>
            <button
              className="btn btn--primary"
              style={{ alignSelf: 'flex-end' }}
              disabled={!newKey.trim()}
              onClick={async () => {
                await saveEnv(newKey.trim(), newValue);
                setNewKey('');
                setNewValue('');
              }}
            >
              Add key
            </button>
          </div>
        </div>
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Status line</span>
        </div>
        
        <pre
          className="mono"
          style={{
            margin: 0,
            padding: 'var(--space-3)',
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-md)',
            overflowX: 'auto',
            fontSize: 'var(--step--1)',
            color: 'var(--ink-2)',
          }}
        >
          {data.settings.statusLine?.command ?? 'not configured'}
        </pre>
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Raw settings.json</span>
          <span className="panel__meta">a timestamped backup is written on every save</span>
          <div className="panel__actions">
            <button className="btn btn--primary" onClick={saveRaw}>
              Save settings
            </button>
          </div>
        </div>
        
        <textarea
          className="textarea"
          spellCheck={false}
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
        />
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--step--1)' }}>
          Secrets appear here as <span className="mono">{'{ __redacted: true }'}</span> placeholders. Saving
          keeps the real values in place — placeholders are merged back into the stored secrets, never
          written over them.
        </p>
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">User instructions</span>
          <span className="panel__meta">~/.claude/CLAUDE.md</span>
          <div className="panel__actions">
            <button className="btn btn--primary" onClick={saveClaudeMd}>
              Save instructions
            </button>
          </div>
        </div>
        
        <textarea
          className="textarea"
          spellCheck={false}
          value={claudeMd}
          onChange={(e) => setClaudeMd(e.target.value)}
        />
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Project activity</span>
          <span className="panel__meta">{data.projects.length} known projects</span>
        </div>
        
        <div className="tablewrap"><table className="table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Last run</th>
              <th>Last cost</th>
              <th>Input</th>
              <th>Output</th>
              <th>MCP</th>
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
                <td className="table__num">{relativeTime(project.lastStartTime)}</td>
                <td className="table__num">{cost(project.lastCost)}</td>
                <td className="table__num">{full(project.lastTotalInputTokens)}</td>
                <td className="table__num">{full(project.lastTotalOutputTokens)}</td>
                <td className="table__num">{project.mcpServerCount || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Where things live</span>
        </div>
        
        <div className="tablewrap"><table className="table">
          <tbody>
            {Object.entries(data.paths).map(([name, value]) => (
              <tr key={name}>
                <td style={{ width: 180 }}>{name}</td>
                <td className="mono" style={{ fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
