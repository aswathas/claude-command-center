import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Skill } from '../lib/api';
import { bytes } from '../lib/format';
import { Toggle } from '../components/Toggle';
import { Icon } from '../components/Icons';
import { useToast } from '../components/Toast';

type Filter = 'all' | 'on' | 'off';

export function Skills() {
  const toast = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.skills();
      setSkills(res.skills);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((skill) => {
      if (filter !== 'all' && (filter === 'on' ? !skill.enabled : skill.enabled)) return false;
      if (!q) return true;
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.dirName.toLowerCase().includes(q) ||
        (skill.description || '').toLowerCase().includes(q)
      );
    });
  }, [skills, query, filter]);

  const counts = useMemo(
    () => ({
      all: skills.length,
      on: skills.filter((s) => s.enabled).length,
      off: skills.filter((s) => !s.enabled).length,
    }),
    [skills]
  );

  const toggle = async (skill: Skill, enabled: boolean) => {
    setBusy(skill.dirName);
    try {
      const res = await api.toggleSkill(skill.dirName, enabled);
      toast.push(res.message, 'ok');
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
          <span className="panel__title">Installed skills</span>
          <span className="panel__meta">
            {counts.on} on · {counts.off} parked in skills-off
          </span>
          <div className="panel__actions">
            <div className="search">
              <Icon name="search" />
              <input
                className="input"
                placeholder="Filter skills"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Filter skills"
              />
            </div>
            <div className="segmented" role="group" aria-label="Skill state">
              {(['all', 'on', 'off'] as Filter[]).map((f) => (
                <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === 'all' ? `All ${counts.all}` : f === 'on' ? `On ${counts.on}` : `Off ${counts.off}`}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {loading ? (
          <div className="loading">Reading skill folders…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty__title">Nothing matches that filter</div>
            <div>Clear the search or switch the state filter.</div>
          </div>
        ) : (
          <div className="tablewrap"><table className="table">
            <thead>
              <tr>
                <th style={{ width: 54 }}>On</th>
                <th>Skill</th>
                <th>What it does</th>
                <th>Source</th>
                <th style={{ width: 90 }} className="table__num">
                  Size
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((skill) => (
                <tr key={skill.dirName}>
                  <td>
                    <Toggle
                      checked={skill.enabled}
                      disabled={busy === skill.dirName}
                      onChange={(next) => toggle(skill, next)}
                      label={`${skill.enabled ? 'Disable' : 'Enable'} ${skill.name}`}
                    />
                  </td>
                  <td>
                    <span className="table__name">
                      <span className="mono">{skill.name}</span>
                      {!skill.hasSkillFile && <span className="chip chip--warn">no SKILL.md</span>}
                    </span>
                  </td>
                  <td>
                    <div className="table__desc" title={skill.description}>
                      {skill.description || '—'}
                    </div>
                  </td>
                  <td>
                    <span className="mono" style={{ fontSize: 'var(--step--1)', color: 'var(--ink-3)' }}>
                      {skill.linkTarget ? 'plugin' : 'local'}
                    </span>
                  </td>
                  <td className="table__num">{bytes(skill.bytes)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      <div className="panel span-12">
        <div className="panel__head">
          <span className="panel__title">How the switch works</span>
        </div>
        
        <p style={{ color: 'var(--ink-2)', maxWidth: '70ch' }}>
          Turning a skill off moves its folder from <span className="mono">~/.claude/skills</span> into{' '}
          <span className="mono">~/.claude/skills-off</span>; turning it back on moves it home. Nothing is
          deleted, so a disabled skill keeps its exact contents and its update channel.
        </p>
      </div>
    </>
  );
}
