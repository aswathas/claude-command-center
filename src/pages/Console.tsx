import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { TasksResponse, UsageResponse } from '../lib/api';
import { addDays, compact, cost, duration, full, isoDay, relativeTime } from '../lib/format';
import { Heatmap, HeatLegend } from '../components/Heatmap';
import { DailyBars } from '../components/DailyBars';
import { BarList, DataTable } from '../components/Charts';
import { Toggle } from '../components/Toggle';
import { useToast } from '../components/Toast';

const RANGES = [
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: '90', label: '90 days', days: 90 },
  { key: '365', label: 'Year', days: 365 },
];

export function Console({ onNavigate }: { onNavigate: (page: string) => void }) {
  const toast = useToast();
  const [range, setRange] = useState('30');
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [taskState, setTaskState] = useState<TasksResponse | null>(null);
  const [skills, setSkills] = useState<{ on: number; off: number }>({ on: 0, off: 0 });
  const [plugins, setPlugins] = useState({ installed: 0, enabled: 0 });
  const [mcp, setMcp] = useState({ total: 0, projects: 0 });
  const [loading, setLoading] = useState(true);
  const [showTable, setShowTable] = useState(false);

  const days = RANGES.find((r) => r.key === range)?.days ?? 30;

  const load = useCallback(async () => {
    try {
      const to = isoDay(new Date());
      const from = isoDay(addDays(new Date(), -(days - 1)));
      const [usageRes, tasksRes, skillsRes, pluginsRes, mcpRes] = await Promise.all([
        api.usage(from, to),
        api.tasks(),
        api.skills(),
        api.plugins(),
        api.mcp(),
      ]);
      setUsage(usageRes);
      setTaskState(tasksRes);
      setSkills({
        on: skillsRes.skills.filter((s) => s.enabled).length,
        off: skillsRes.skills.filter((s) => !s.enabled).length,
      });
      const installed = pluginsRes.plugins.filter((p) => p.installPath);
      setPlugins({
        installed: installed.length,
        enabled: installed.filter((p) => p.enabled).length,
      });
      setMcp({ total: mcpRes.globalServers.length, projects: mcpRes.projects.length });
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [days, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const rescan = async () => {
    toast.push('Re-indexing transcripts in the background');
    try {
      await api.rescan(true);
      await load();
      toast.push('Transcript index rebuilt', 'ok');
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const stopTask = async (id: string) => {
    try {
      await api.stopTask(id);
      toast.push('Task stopped', 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const running = (taskState?.tasks ?? []).filter((t) => t.alive);
  const finished = (taskState?.tasks ?? []).filter((t) => !t.alive).slice(0, 5);

  const modelRows = useMemo(
    () =>
      (usage?.models ?? [])
        .filter((m) => m.total > 0)
        .slice(0, 8)
        .map((m) => ({ label: m.model, value: m.total })),
    [usage]
  );

  const projectRows = useMemo(
    () =>
      (usage?.projects ?? [])
        .slice(0, 8)
        .map((p) => ({ label: p.project, value: p.total })),
    [usage]
  );

  return (
    <>
      <section className="panel panel--marked span-12" style={{ paddingBottom: 'var(--space-4)' }}>
        <div className="panel__head">
          <span className="panel__title">Window</span>
          <span className="panel__meta">scopes the telemetry panels below</span>
          <span className="panel__actions">
            <div className="segmented" role="group" aria-label="Date range">
              {RANGES.map((r) => (
                <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}>
                  {r.label}
                </button>
              ))}
            </div>
          </span>
        </div>
        <div className="readouts">
          <div className="readout">
            <span className="readout__label">Tokens</span>
            <span className="readout__value readout__value--live">{compact(usage?.totals.total ?? 0)}</span>
            <span className="readout__foot">
              {usage ? `${usage.from} to ${usage.to}` : '—'}
            </span>
          </div>
          <div className="readout">
            <span className="readout__label">Recorded cost</span>
            <span className="readout__value">{cost(usage?.totals.cost ?? 0)}</span>
            <span className="readout__foot">from session accounting</span>
          </div>
          <div className="readout">
            <span className="readout__label">Input</span>
            <span className="readout__value">{compact(usage?.totals.input ?? 0)}</span>
            <span className="readout__foot">fresh prompt tokens</span>
          </div>
          <div className="readout">
            <span className="readout__label">Output</span>
            <span className="readout__value">{compact(usage?.totals.output ?? 0)}</span>
            <span className="readout__foot">generated tokens</span>
          </div>
          <div className="readout">
            <span className="readout__label">Cache</span>
            <span className="readout__value">{compact((usage?.totals.cacheRead ?? 0) + (usage?.totals.cacheWrite ?? 0))}</span>
            <span className="readout__foot">read and written</span>
          </div>
          <div className="readout">
            <span className="readout__label">Sessions</span>
            <span className="readout__value">{full(usage?.totals.sessions ?? 0)}</span>
            <span className="readout__foot">{full(usage?.totals.msgs ?? 0)} messages</span>
          </div>
        </div>
      </section>

      <section className="panel span-4">
        <div className="panel__head">
          <span className="panel__title">Running</span>
          <span className="panel__meta">{running.length} live</span>
          <span className="panel__actions">
            <button className="btn btn--ghost" onClick={() => onNavigate('tasks')}>
              All tasks
            </button>
          </span>
        </div>
        {running.length === 0 ? (
          <p className="chart__empty">Nothing is running. Start one from the Tasks tab.</p>
        ) : (
          <div className="tasklist">
            {running.map((task) => (
              <div className="taskrow" key={task.id}>
                <span>
                  <span className="taskrow__name">{task.name}</span>
                  <span className="taskrow__meta">
                    <span className="chip chip--on">
                      <span className="chip__dot" />
                      live
                    </span>
                    <span>pid {task.pid}</span>
                    <span>{relativeTime(task.startedAt)}</span>
                    <span title={task.cwd}>{task.cwd}</span>
                  </span>
                </span>
                <button className="btn btn--stop" onClick={() => stopTask(task.id)}>
                  Stop
                </button>
              </div>
            ))}
          </div>
        )}
        {finished.length > 0 && (
          <div className="tasklist" style={{ marginTop: 'var(--space-3)' }}>
            {finished.map((task) => (
              <div className="taskrow" key={task.id}>
                <span>
                  <span className="taskrow__name" style={{ fontWeight: 500, color: 'var(--ink-2)' }}>
                    {task.name}
                  </span>
                  <span className="taskrow__meta">
                    <span className="chip chip--off">
                      <span className="chip__dot" />
                      {task.exitCode === 'stopped' ? 'stopped' : `exit ${task.exitCode ?? '—'}`}
                    </span>
                    <span>{relativeTime(task.endedAt || task.startedAt)}</span>
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel span-4">
        <div className="panel__head">
          <span className="panel__title">Control</span>
          <span className="panel__meta">what is installed</span>
        </div>
        <div className="readouts" style={{ borderBottom: 'none' }}>
          <div className="readout">
            <span className="readout__label">Skills on</span>
            <span className="readout__value">{skills.on}</span>
            <span className="readout__foot">{skills.off} parked</span>
          </div>
          <div className="readout">
            <span className="readout__label">Plugins on</span>
            <span className="readout__value">{plugins.enabled}</span>
            <span className="readout__foot">{plugins.installed} installed</span>
          </div>
          <div className="readout">
            <span className="readout__label">MCP servers</span>
            <span className="readout__value">{mcp.total}</span>
            <span className="readout__foot">{mcp.projects} project scopes</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-4)' }}>
          <button className="btn" onClick={() => onNavigate('skills')}>
            Skills
          </button>
          <button className="btn" onClick={() => onNavigate('plugins')}>
            Plugins
          </button>
          <button className="btn" onClick={() => onNavigate('mcp')}>
            MCP
          </button>
          <button className="btn" onClick={() => onNavigate('settings')}>
            Settings
          </button>
          <button className="btn" onClick={() => onNavigate('memory')}>
            Memory
          </button>
        </div>
      </section>

      <section className="panel span-4">
        <div className="panel__head">
          <span className="panel__title">Claude Code jobs</span>
          <span className="panel__meta">{taskState?.jobs.length ?? 0} records</span>
        </div>
        {(taskState?.jobs ?? []).slice(0, 6).map((job) => (
          <div className="taskrow" key={job.id}>
            <span>
              <span className="taskrow__name" style={{ fontWeight: 500 }}>
                {job.name}
              </span>
              <span className="taskrow__meta">
                <span
                  className={`chip ${
                    job.state === 'done' ? 'chip--on' : job.state === 'blocked' ? 'chip--warn' : 'chip--off'
                  }`}
                >
                  <span className="chip__dot" />
                  {job.state}
                </span>
                <span>{relativeTime(job.updatedAt)}</span>
              </span>
            </span>
          </div>
        ))}
        {!taskState?.jobs.length && <p className="chart__empty">No job records on this machine.</p>}
      </section>

      <section className="panel panel--marked span-8">
        <div className="panel__head">
          <span className="panel__title">Token burn</span>
          <span className="panel__meta">every day on record</span>
          <span className="panel__actions">
            <HeatLegend />
            <button className="btn btn--ghost" onClick={() => setShowTable((v) => !v)}>
              {showTable ? 'Show calendar' : 'Show table'}
            </button>
          </span>
        </div>
        {loading && !usage ? (
          <div className="loading">Reading transcripts…</div>
        ) : showTable ? (
          <DataTable
            headers={['Date', 'Tokens', 'Input', 'Output', 'Cache', 'Messages', 'Sessions']}
            rows={[...(usage?.allDays ?? [])]
              .reverse()
              .slice(0, 120)
              .map((d) => [
                d.date,
                full(d.total),
                full(d.input),
                full(d.output),
                full(d.cacheRead + d.cacheWrite),
                full(d.msgs),
                full(d.sessions),
              ])}
          />
        ) : (
          <Heatmap days={usage?.allDays ?? []} weeks={52} />
        )}
      </section>

      <section className="panel span-4">
        <div className="panel__head">
          <span className="panel__title">Models</span>
          <span className="panel__meta">session accounting</span>
        </div>
        {modelRows.length ? (
          <BarList rows={modelRows} colorFor={() => 'var(--brass)'} />
        ) : (
          <p className="chart__empty">No model usage recorded yet.</p>
        )}
      </section>

      <section className="panel span-6">
        <div className="panel__head">
          <span className="panel__title">Projects</span>
          <span className="panel__meta">by working directory</span>
        </div>
        {projectRows.length ? (
          <BarList rows={projectRows} colorFor={() => 'var(--brass)'} />
        ) : (
          <p className="chart__empty">No project usage recorded yet.</p>
        )}
      </section>

      <section className="panel span-6">
        <div className="panel__head">
          <span className="panel__title">Tokens per day</span>
          <span className="panel__meta">within the window</span>
        </div>
        <DailyBars days={usage?.days ?? []} />
      </section>

      <section className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Installation</span>
          <span className="panel__actions">
            <button className="btn" onClick={rescan}>
              Rebuild transcript index
            </button>
          </span>
        </div>
        <div className="readouts">
          <div className="readout">
            <span className="readout__label">Lifetime tokens</span>
            <span className="readout__value">{compact(usage?.lifetime.total ?? 0)}</span>
            <span className="readout__foot">{full(usage?.lifetime.msgs ?? 0)} messages</span>
          </div>
          <div className="readout">
            <span className="readout__label">Lifetime cost</span>
            <span className="readout__value">{cost(usage?.lifetime.cost ?? 0)}</span>
            <span className="readout__foot">recorded</span>
          </div>
          <div className="readout">
            <span className="readout__label">Sidechain turns</span>
            <span className="readout__value">{full(usage?.lifetime.sidechainMsgs ?? 0)}</span>
            <span className="readout__foot">sub-agent messages</span>
          </div>
          <div className="readout">
            <span className="readout__label">Transcripts</span>
            <span className="readout__value">{full(usage?.index.filesIndexed ?? 0)}</span>
            <span className="readout__foot">files indexed</span>
          </div>
          <div className="readout">
            <span className="readout__label">Last index</span>
            <span className="readout__value">{duration(usage?.index.lastScanMs ?? 0)}</span>
            <span className="readout__foot">{relativeTime(usage?.index.lastScanAt ?? null)}</span>
          </div>
        </div>
      </section>
    </>
  );
}
