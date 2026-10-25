import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { MemoryResponse } from '../lib/api';
import { bytes, relativeTime } from '../lib/format';
import { useToast } from '../components/Toast';

export function Memory() {
  const toast = useToast();
  const [data, setData] = useState<MemoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<{ path: string; name: string; content: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = async () => {
    try {
      setData(await api.memory());
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

  const open = async (path: string, name: string) => {
    try {
      const res = await api.readMemory(path);
      setActive({ path: res.path, name, content: res.content });
      setDirty(false);
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const save = async () => {
    if (!active) return;
    try {
      await api.writeMemory(active.path, active.content);
      toast.push(`Saved ${active.name}`, 'ok');
      setDirty(false);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const create = async () => {
    const name = `memory-${new Date().toISOString().slice(0, 10)}.md`;
    const path = `${data?.user.dir}/${name}`;
    try {
      await api.writeMemory(path, `# ${name}\n\n`);
      toast.push(`Created ${name}`, 'ok');
      await load();
      setActive({ path, name, content: `# ${name}\n\n` });
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  const remove = async (path: string, name: string) => {
    try {
      await api.deleteMemory(path);
      toast.push(`Deleted ${name}`, 'ok');
      if (active?.path === path) setActive(null);
      await load();
    } catch (err) {
      toast.push((err as Error).message, 'error');
    }
  };

  if (loading) return <div className="loading">Reading memory folders…</div>;

  const userFiles = data?.user.files ?? [];
  const projectFiles = data?.projects ?? [];

  return (
    <>
      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">Memory</span>
          <span className="panel__meta">
            {userFiles.length} user files · {projectFiles.reduce((n, p) => n + p.files.length, 0)} project files
          </span>
          <div className="panel__actions">
            <button className="btn btn--primary" onClick={create}>
              New memory file
            </button>
          </div>
        </div>
        
        {userFiles.length === 0 && projectFiles.length === 0 ? (
          <div className="empty">
            <div className="empty__title">No memory files yet</div>
            <div>Create one here, or let Claude Code write a memory after a session.</div>
          </div>
        ) : (
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th>File</th>
                <th>Where</th>
                <th>Size</th>
                <th>Changed</th>
                <th style={{ width: 90 }} />
              </tr>
            </thead>
            <tbody>
              {userFiles.map((file) => (
                <tr key={file.path}>
                  <td>
                    <button className="btn btn--ghost" onClick={() => open(file.path, file.name)}>
                      {file.name}
                    </button>
                  </td>
                  <td className="mono" style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                    user
                  </td>
                  <td className="table__num">{bytes(file.bytes)}</td>
                  <td className="table__num">{relativeTime(file.modified)}</td>
                  <td>
                    <span className="table__actions">
                      <button className="btn btn--ghost btn--danger" onClick={() => remove(file.path, file.name)}>
                        Delete
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
              {projectFiles.map((project) =>
                project.files.map((file) => (
                  <tr key={file.path}>
                    <td>
                      <button className="btn btn--ghost" onClick={() => open(file.path, file.name)}>
                        {file.name}
                      </button>
                    </td>
                    <td className="mono" style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                      {project.project}
                    </td>
                    <td className="table__num">{bytes(file.bytes)}</td>
                    <td className="table__num">{relativeTime(file.modified)}</td>
                    <td>
                      <span className="table__actions">
                        <button
                          className="btn btn--ghost btn--danger"
                          onClick={() => remove(file.path, file.name)}
                        >
                          Delete
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table></div>
        )}
      </div>

      {active && (
        <div className="panel span-12">
          <div className="panel__head">
            <span className="panel__title">{active.name}</span>
            <span className="panel__meta">{active.path}</span>
            <div className="panel__actions">
              {dirty && <span className="chip chip--warn">unsaved</span>}
              <button className="btn btn--primary" onClick={save} disabled={!dirty}>
                Save
              </button>
              <button
                className="btn btn--ghost"
                onClick={() => {
                  setActive(null);
                  setDirty(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
          
          <textarea
            className="textarea"
            value={active.content}
            onChange={(e) => {
              setActive({ ...active, content: e.target.value });
              setDirty(true);
            }}
          />
        </div>
      )}
    </>
  );
}
