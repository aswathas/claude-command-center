import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ManagedTask, TasksResponse } from '../lib/api';
import { relativeTime } from '../lib/format';
import { useToast } from '../components/Toast';

export function Tasks() {
  const toast = useToast();
  const [data, setData] = useState<TasksResponse | null>(null);
  const [cwd, setCwd] = useState('');
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState('');
  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.tasks();
      setData(res);
      if (!cwd && res.targets.length) setCwd(res.targets[0]);
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const running = (data?.tasks ?? []).filter((t) => t.alive);
  const finished = (data?.tasks ?? []).filter((t) => !t.alive);

  // Follow the log of the selected task while it is alive.
  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.taskLog(selected);
        if (!cancelled) setLog(res.log);
      } catch {
        /* keep the last log */
      }
    };
    tick();
    const timer = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [selected, data?.tasks]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  const start = async () => {
    if (!prompt.trim()) {
      toast.push('Write what the task should do first', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await api.runTask(cwd, prompt.trim());
      toast.push(`Task started (pid ${res.pid})`, 'ok');
      setPrompt('');
      setSelected(res.id);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const stop = async (id: string) => {
    try {
      await api.stopTask(id);
      toast.push('Task stopped', 'ok');
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const claudeProcesses = (data?.processes ?? []).filter((p) => p.claude);

  return (
    <>
      <section className="panel panel--marked span-6">
        <div className="panel__head">
          <span className="panel__title">Start a task</span>
          <span className="panel__meta">headless claude in a project you already use</span>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="target">
            Directory
          </label>
          <select id="target" className="select" value={cwd} onChange={(e) => setCwd(e.target.value)}>
            {(data?.targets ?? []).map((target) => (
              <option key={target} value={target}>
                {target}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginTop: 'var(--space-3)' }}>
          <label className="field__label" htmlFor="prompt">
            What should it do
          </label>
          <textarea
            id="prompt"
            className="textarea"
            rows={5}
            value={prompt}
            placeholder="Summarise the failing test and fix the assertion"
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <button className="btn btn--primary" onClick={start} disabled={busy || !prompt.trim()}>
            {busy ? 'Starting…' : 'Run task'}
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => {
              setPrompt('');
              setSelected(null);
              setLog('');
            }}
          >
            Clear
          </button>
        </div>
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--step--1)', marginTop: 'var(--space-3)' }}>
          The task runs with bypassed permissions, exactly like a local terminal run. It writes to
          <span className="mono"> ~/.claude/.command-center/tasks</span> and nothing else.
        </p>
      </section>

      <section className="panel span-6">
        <div className="panel__head">
          <span className="panel__title">Running</span>
          <span className="panel__meta">{running.length} live</span>
        </div>
        {running.length === 0 ? (
          <p className="chart__empty">Nothing is running right now.</p>
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
                    <span>started {relativeTime(task.startedAt)}</span>
                  </span>
                </span>
                <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button className="btn btn--ghost" onClick={() => setSelected(task.id)}>
                    Log
                  </button>
                  <button className="btn btn--stop" onClick={() => stop(task.id)}>
                    Stop
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        {finished.length > 0 && (
          <>
            <div className="panel__head" style={{ marginTop: 'var(--space-4)' }}>
              <span className="panel__title">Finished</span>
              <span className="panel__meta">{finished.length} kept</span>
            </div>
            <div className="tasklist">
              {finished.map((task: ManagedTask) => (
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
                  <button className="btn btn--ghost" onClick={() => setSelected(task.id)}>
                    Log
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="panel span-6">
        <div className="panel__head">
          <span className="panel__title">Output</span>
          <span className="panel__meta">{selected || 'nothing selected'}</span>
        </div>
        {selected ? (
          <pre className="logbox" ref={logRef}>
            {log || 'No output yet.'}
          </pre>
        ) : (
          <p className="chart__empty">Pick a task to read what it printed.</p>
        )}
      </section>

      <section className="panel span-6">
        <div className="panel__head">
          <span className="panel__title">Claude processes</span>
          <span className="panel__meta">detected on this machine</span>
        </div>
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>PID</th>
                <th>Started</th>
                <th>Command</th>
              </tr>
            </thead>
            <tbody>
              {claudeProcesses.map((proc) => (
                <tr key={proc.pid}>
                  <td className="table__num">{proc.pid}</td>
                  <td className="table__num">{relativeTime(proc.started)}</td>
                  <td>
                    <span className="mono" style={{ fontSize: 'var(--step--1)', color: 'var(--ink-2)' }}>
                      {proc.cmd}
                    </span>
                  </td>
                </tr>
              ))}
              {claudeProcesses.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <p className="chart__empty">No Claude processes running.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p style={{ color: 'var(--ink-3)', fontSize: 'var(--step--1)', marginTop: 'var(--space-3)' }}>
          This list is read-only. Stopping a task works on the tasks this dashboard started; other Claude
          processes are listed so you know what else is on the machine.
        </p>
      </section>
    </>
  );
}
