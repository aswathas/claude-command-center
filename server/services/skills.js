/**
 * Skills live as directories in ~/.claude/skills (installed) and
 * ~/.claude/skills-off (parked). Some are real directories, some are symlinks
 * into a plugin's marketplace copy. Enabling/disabling is a move between the
 * two directories, which is exactly how the skills CLI parks a skill.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PATHS, ensureDir, httpError } from '../claude-home.js';

async function readFrontmatter(file) {
  let head;
  try {
    const raw = await fsp.readFile(file, 'utf8');
    head = raw.slice(0, 8000);
  } catch {
    return {};
  }
  if (!head.startsWith('---')) return {};
  const end = head.indexOf('\n---', 3);
  if (end < 0) return {};
  // Split on both line endings and drop any trailing \r. `.` in a regex
  // never matches \r, so a CRLF file would otherwise fail the last key of
  // every frontmatter block.
  const lines = head
    .slice(3, end)
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ''));
  const out = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();

    // Folded (>) and literal (|) scalars continue on the following indented lines.
    if (value === '>' || value === '|' || value === '>-' || value === '|-') {
      const parts = [];
      let j = i + 1;
      while (j < lines.length && /^\s+\S/.test(lines[j])) {
        parts.push(lines[j].trim());
        j += 1;
      }
      value = parts.join(' ');
      i = j - 1;
    }

    value = value.replace(/^['"]|['"]$/g, '');
    out[key] = value;
  }
  return out;
}

async function describeEntry(dir, name, state) {
  const skillFile = path.join(dir, name, 'SKILL.md');
  let stat = null;
  try {
    stat = await fsp.stat(skillFile);
  } catch {
    /* skill without SKILL.md */
  }
  let linkTarget = null;
  try {
    const lst = await fsp.lstat(path.join(dir, name));
    if (lst.isSymbolicLink()) linkTarget = await fsp.readlink(path.join(dir, name));
  } catch {
    /* ignore */
  }
  const fm = stat ? await readFrontmatter(skillFile) : {};
  let bytes = 0;
  let fileCount = 0;
  const walk = async (dirPath, depth) => {
    if (depth > 6) return;
    let entries = [];
    try {
      entries = await fsp.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.isFile()) {
        fileCount += 1;
        const s = await fsp.stat(full).catch(() => null);
        if (s) bytes += s.size;
      }
    }
  };
  await walk(path.join(dir, name), 0);
  return {
    name: fm.name || name,
    dirName: name,
    description: fm.description || '',
    version: fm.version || null,
    author: fm.author || null,
    license: fm.license || null,
    tags: fm.tags || null,
    enabled: state === 'on',
    state,
    hasSkillFile: Boolean(stat),
    linkTarget,
    fileCount,
    bytes,
    path: path.join(dir, name),
  };
}

export async function listSkills() {
  const on = new Map();
  const off = new Map();

  for (const [state, dir, map] of [
    ['on', PATHS.skills, on],
    ['off', PATHS.skillsOff, off],
  ]) {
    let entries = [];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      entries = [];
    }
    for (const entry of entries) {
      if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;
      map.set(entry.name, await describeEntry(dir, entry.name, state));
    }
  }

  const merged = new Map();
  for (const [name, skill] of on) merged.set(name, skill);
  for (const [name, skill] of off) {
    if (!merged.has(name)) merged.set(name, skill);
    else merged.set(name, { ...merged.get(name), state: 'off', enabled: false, parkedAt: skill.path });
  }

  return [...merged.values()].sort((a, b) => a.dirName.localeCompare(b.dirName));
}

export async function setSkillEnabled(name, enabled) {
  const safe = path.basename(String(name));
  const onPath = path.join(PATHS.skills, safe);
  const offPath = path.join(PATHS.skillsOff, safe);
  let existsOn = false;
  let existsOff = false;
  try {
    await fsp.lstat(onPath);
    existsOn = true;
  } catch {}
  try {
    await fsp.lstat(offPath);
    existsOff = true;
  } catch {}

  if (enabled) {
    if (existsOn) return { ok: true, state: 'on', message: `${safe} is already on` };
    if (!existsOff) throw httpError(404, `No parked skill named ${safe}`);
    ensureDir(PATHS.skills);
    await fsp.rename(offPath, onPath);
    return { ok: true, state: 'on', message: `${safe} enabled` };
  }

  if (existsOff) return { ok: true, state: 'off', message: `${safe} is already off` };
  if (!existsOn) throw httpError(404, `No installed skill named ${safe}`);
  ensureDir(PATHS.skillsOff);
  await fsp.rename(onPath, offPath);
  return { ok: true, state: 'off', message: `${safe} disabled` };
}
