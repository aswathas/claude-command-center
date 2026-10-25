/**
 * Phone access. The dashboard is a personal tool for one machine, so it stays
 * on loopback until the operator explicitly opens it to the network — and
 * then every API call needs the access code.
 */
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { PATHS, STATE_DIR, readJson, writeWithBackup, ensureDir } from '../claude-home.js';

const ACCESS_FILE = path.join(STATE_DIR, 'access.json');

function makeCode() {
  // No 0/O/1/I — this gets read off a phone screen.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i += 1) code += alphabet[bytes[i] % alphabet.length];
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

export async function getAccess() {
  ensureDir(STATE_DIR);
  let config = await readJson(ACCESS_FILE);
  if (!config?.code) {
    config = { code: makeCode(), lanEnabled: false, createdAt: new Date().toISOString() };
    await writeWithBackup(ACCESS_FILE, JSON.stringify(config, null, 2) + '\n', { backup: false });
  }
  return {
    code: config.code,
    lanEnabled: Boolean(config.lanEnabled),
    createdAt: config.createdAt,
    lanIp: lanIp(),
    port: Number(process.env.CCC_PORT || 8787),
  };
}

export async function setLanEnabled(enabled) {
  const config = await getAccess();
  const next = { ...config, lanEnabled: Boolean(enabled), lanIp: undefined, port: undefined };
  await writeWithBackup(ACCESS_FILE, JSON.stringify(next, null, 2) + '\n', { backup: false });
  return getAccess();
}

export async function rotateCode() {
  const config = await getAccess();
  const next = { ...config, code: makeCode(), createdAt: new Date().toISOString() };
  await writeWithBackup(ACCESS_FILE, JSON.stringify(next, null, 2) + '\n', { backup: false });
  return getAccess();
}

export async function checkCode(candidate) {
  const config = await getAccess();
  if (!candidate) return false;
  return String(candidate).trim().toUpperCase() === String(config.code).toUpperCase();
}

export function lanIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

export function isLoopback(address) {
  if (!address) return true;
  const clean = String(address).replace(/^::ffff:/, '');
  return clean === '127.0.0.1' || clean === '::1' || clean.startsWith('127.');
}
