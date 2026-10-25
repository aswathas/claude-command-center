/**
 * Memory files: the user memory folder and the per-project auto-memory folders
 * Claude Code writes next to each project transcript.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PATHS, ensureDir, httpError, toNativePath } from '../claude-home.js';

async function listDir(dir) {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!/\.(md|txt)$/i.test(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const stat = await fsp.stat(full);
      files.push({ name: entry.name, path: full, bytes: stat.size, modified: stat.mtime.toISOString() });
    }
    return files.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function listMemory() {
  const userFiles = await listDir(PATHS.memory);

  const projectDirs = [];
  try {
    const projects = await fsp.readdir(PATHS.projects, { withFileTypes: true });
    for (const project of projects) {
      if (!project.isDirectory()) continue;
      const memDir = path.join(PATHS.projects, project.name, 'memory');
      const files = await listDir(memDir);
      if (files.length) projectDirs.push({ project: project.name, dir: memDir, files });
    }
  } catch {
    /* no projects dir */
  }

  return { user: { dir: PATHS.memory, files: userFiles }, projects: projectDirs };
}

function resolveMemoryFile(filePath) {
  const resolved = toNativePath(filePath);
  const roots = [path.resolve(PATHS.memory), path.resolve(PATHS.projects)];
  const allowed = roots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
  if (!allowed) throw httpError(403, 'Refusing to read outside the memory folders');
  return resolved;
}

export async function readMemoryFile(filePath) {
  const resolved = resolveMemoryFile(filePath);
  try {
    const content = await fsp.readFile(resolved, 'utf8');
    return { path: resolved, content };
  } catch {
    throw httpError(404, 'No such memory file');
  }
}

export async function writeMemoryFile(filePath, content) {
  const resolved = resolveMemoryFile(filePath);
  if (!/\.(md|txt)$/i.test(resolved)) throw httpError(400, 'Memory files must be .md or .txt');
  ensureDir(path.dirname(resolved));
  await fsp.writeFile(resolved, String(content ?? ''), 'utf8');
  return { ok: true, path: resolved, bytes: Buffer.byteLength(String(content ?? '')) };
}

export async function deleteMemoryFile(filePath) {
  const resolved = resolveMemoryFile(filePath);
  try {
    await fsp.unlink(resolved);
    return { ok: true, path: resolved };
  } catch {
    throw httpError(404, 'No such memory file');
  }
}
