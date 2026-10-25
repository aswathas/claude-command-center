import { useCallback, useEffect, useState } from 'react';
import { api, setAccessCode } from './lib/api';
import { Icon } from './components/Icons';
import { ToastProvider } from './components/Toast';
import { Console } from './pages/Console';
import { Tasks } from './pages/Tasks';
import { Skills } from './pages/Skills';
import { Plugins } from './pages/Plugins';
import { Mcp } from './pages/Mcp';
import { Settings } from './pages/Settings';
import { Memory } from './pages/Memory';

const TABS = [
  { key: 'console', label: 'Console' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'skills', label: 'Skills' },
  { key: 'plugins', label: 'Plugins' },
  { key: 'mcp', label: 'MCP' },
  { key: 'settings', label: 'Settings' },
  { key: 'memory', label: 'Memory' },
];

function CodeGate({ onUnlock }: { onUnlock: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const ok = await onUnlock(code);
    setBusy(false);
    if (!ok) setError('That code does not match. Ask the machine for the code in the terminal.');
  };

  return (
    <div className="gate">
      <form className="gate__card" onSubmit={submit}>
        <h1 className="gate__title">Access code</h1>
        <p className="gate__text">
          This dashboard is open to the network. The code is printed in the terminal that started it.
        </p>
        <div className="field">
          <label className="field__label" htmlFor="code">
            Code
          </label>
          <input
            id="code"
            className="input input--mono"
            value={code}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="ABC-123"
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        {error && (
          <p style={{ color: 'var(--rust)', marginTop: 'var(--space-3)', fontSize: 'var(--step--1)' }}>{error}</p>
        )}
        <button className="btn btn--primary" style={{ marginTop: 'var(--space-4)', width: '100%' }} disabled={busy}>
          {busy ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  );
}

function Shell() {
  const [page, setPage] = useState(() => window.location.hash.replace('#/', '') || 'console');
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => (localStorage.getItem('ccc-theme') as 'dark' | 'light') || 'dark'
  );
  const [gated, setGated] = useState(false);
  const [counts, setCounts] = useState({ skills: 0, plugins: 0, mcp: 0, tasks: 0, files: 0, scanned: '' });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ccc-theme', theme);
  }, [theme]);

  useEffect(() => {
    const onHash = () => setPage(window.location.hash.replace('#/', '') || 'console');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const refreshCounts = useCallback(async () => {
    try {
      const [skills, plugins, mcp, tasks, status] = await Promise.all([
        api.skills(),
        api.plugins(),
        api.mcp(),
        api.tasks(),
        api.usageStatus(),
      ]);
      setCounts({
        skills: skills.skills.length,
        plugins: plugins.plugins.filter((p) => p.installPath).length,
        mcp: mcp.globalServers.length,
        tasks: tasks.tasks.filter((t) => t.alive).length,
        files: status.filesIndexed,
        scanned: status.lastScanAt || '',
      });
    } catch (err) {
      if ((err as any)?.codeRequired) setGated(true);
    }
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [page, refreshCounts]);

  const unlock = async (code: string) => {
    setAccessCode(code);
    try {
      await api.usageStatus();
      setGated(false);
      await refreshCounts();
      return true;
    } catch {
      setAccessCode('');
      return false;
    }
  };

  const navigate = (next: string) => {
    window.location.hash = `#/${next}`;
    setPage(next);
  };

  const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  if (gated) return <CodeGate onUnlock={unlock} />;

  const tabCount = (key: string) =>
    key === 'skills' ? counts.skills : key === 'plugins' ? counts.plugins : key === 'mcp' ? counts.mcp : null;

  return (
    <div className="app">
      <header className="machinebar">
        <span className="machinebar__mark">
          <span className="machinebar__glyph">CCC</span>
          <span className="machinebar__name">Command Center</span>
        </span>

        <span className="machinebar__actions">
          <button
            className="btn btn--ghost"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Switch between the bench and the night bench"
            title="Switch theme"
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
          </button>
        </span>

        <span className="machinebar__status">
          <span>{now}</span>
          <span>
            <b>LOCAL</b>
          </span>
          <span>
            <b>{counts.files.toLocaleString('en-US')}</b> transcripts
          </span>
          <span>
            <b>{counts.tasks}</b> running
          </span>
          <span>
            scanned <em>{counts.scanned ? new Date(counts.scanned).toLocaleString('en-GB') : '—'}</em>
          </span>
        </span>
      </header>

      <nav className="tabs" aria-label="Sections">
        {TABS.map((tab) => {
          const count = tabCount(tab.key);
          return (
            <button
              key={tab.key}
              className="tab"
              aria-current={page === tab.key ? 'page' : undefined}
              onClick={() => navigate(tab.key)}
            >
              {tab.label}
              {count !== null && <span className="tab__count">{count}</span>}
            </button>
          );
        })}
      </nav>

      <main className="content">
        {page === 'console' && <Console onNavigate={navigate} />}
        {page === 'tasks' && <Tasks />}
        {page === 'skills' && <Skills />}
        {page === 'plugins' && <Plugins />}
        {page === 'mcp' && <Mcp />}
        {page === 'settings' && <Settings />}
        {page === 'memory' && <Memory />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <Shell />
    </ToastProvider>
  );
}
