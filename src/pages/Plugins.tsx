import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Plugin } from '../lib/api';
import { relativeTime } from '../lib/format';
import { Toggle } from '../components/Toggle';
import { useToast } from '../components/Toast';

export function Plugins() {
  const toast = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.plugins();
      setPlugins(res.plugins);
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

  const { installed, available } = useMemo(
    () => ({
      installed: plugins.filter((p) => p.installPath),
      available: plugins.filter((p) => !p.installPath),
    }),
    [plugins]
  );

  const toggle = async (plugin: Plugin, enabled: boolean) => {
    setBusy(plugin.key);
    try {
      await api.togglePlugin(plugin.key, enabled);
      toast.push(`${plugin.name} ${enabled ? 'enabled' : 'disabled'}`, 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Installed plugins</span>
          <span className="panel__meta">enabledPlugins in settings.json</span>
        </div>
        
        {loading ? (
          <div className="loading">Reading plugin registry…</div>
        ) : installed.length === 0 ? (
          <div className="empty">
            <div className="empty__title">No plugins installed</div>
            <div>Add a marketplace with the Claude Code CLI, then refresh this page.</div>
          </div>
        ) : (
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th style={{ width: 54 }}>On</th>
                <th>Plugin</th>
                <th>What it does</th>
                <th>Skills</th>
                <th>Version</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {installed.map((plugin) => (
                <tr key={plugin.key}>
                  <td>
                    <Toggle
                      checked={plugin.enabled}
                      disabled={busy === plugin.key}
                      onChange={(next) => toggle(plugin, next)}
                      label={`${plugin.enabled ? 'Disable' : 'Enable'} ${plugin.name}`}
                    />
                  </td>
                  <td>
                    <span className="table__name">
                      <span className="mono">
                        {plugin.name.includes('@') ? plugin.name.split('@')[0] : plugin.name}
                      </span>
                      {plugin.marketplace && (
                        <span className="chip">@{plugin.marketplace}</span>
                      )}
                    </span>
                  </td>
                  <td>
                    <div className="table__desc" title={plugin.description}>
                      {plugin.description || '—'}
                    </div>
                  </td>
                  <td className="table__num">{plugin.skills.length || '—'}</td>
                  <td className="table__num">{plugin.version || '—'}</td>
                  <td className="table__num">{relativeTime(plugin.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Available in your marketplaces</span>
          <span className="panel__meta">not installed</span>
        </div>
        
        {available.length === 0 ? (
          <div className="chart__empty">No uninstalled plugins in the local marketplace catalogue.</div>
        ) : (
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th>Plugin</th>
                <th>Marketplace</th>
                <th>What it does</th>
              </tr>
            </thead>
            <tbody>
              {available.map((plugin) => (
                <tr key={plugin.key}>
                  <td className="mono">{plugin.name}</td>
                  <td className="mono">{plugin.marketplace}</td>
                  <td>
                    <div className="table__desc">{plugin.description || '—'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
