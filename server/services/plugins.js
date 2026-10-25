/**
 * Plugins: what is installed, which marketplace it came from, and whether
 * Claude Code will load it. The on/off switch lives in settings.json under
 * `enabledPlugins` as "<plugin>@<marketplace>": true|false.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { PATHS, readJson, writeJson } from '../claude-home.js';

async function marketplaceCatalog() {
  const catalog = new Map();
  try {
    const files = await fsp.readdir(PATHS.marketplaces);
    for (const dir of files) {
      const manifest = path.join(PATHS.marketplaces, dir, '.claude-plugin', 'marketplace.json');
      const data = await readJson(manifest);
      if (!data || !Array.isArray(data.plugins)) continue;
      for (const plugin of data.plugins) {
        const key = `${plugin.name}@${dir}`;
        catalog.set(key, {
          key,
          name: plugin.name,
          marketplace: dir,
          description: plugin.description || '',
          version: plugin.version || null,
          source: plugin.source || null,
          homepage: plugin.homepage || null,
          installed: false,
        });
      }
    }
  } catch {
    /* marketplace dir missing */
  }
  return catalog;
}

export async function listPlugins() {
  const installed = (await readJson(PATHS.installedPlugins, { plugins: {} }))?.plugins || {};
  const settings = (await readJson(PATHS.settings, {})) || {};
  const enabledMap = settings.enabledPlugins || {};
  const catalog = await marketplaceCatalog();

  const rows = [];

  for (const [pluginName, installs] of Object.entries(installed)) {
    for (const install of installs) {
      // installed_plugins.json already keys plugins as "<name>@<marketplace>".
      const key = pluginName.includes('@') ? pluginName : `${pluginName}@${install.scope}`;
      const resolvedKey = Object.keys(enabledMap).find((k) => k === key) || key;
      const entry = {
        key: resolvedKey,
        name: pluginName,
        marketplace: pluginName.includes('@') ? pluginName.split('@')[1] : null,
        version: install.version || null,
        scope: install.scope || 'user',
        installedAt: install.installedAt || null,
        updatedAt: install.lastUpdated || null,
        installPath: install.installPath || null,
        enabled: enabledMap[resolvedKey] === true,
        inEnabledMap: resolvedKey in enabledMap,
        description: catalog.get(resolvedKey)?.description || '',
        skills: [],
      };
      if (entry.installPath) {
        const skillsDir = path.join(entry.installPath, 'skills');
        try {
          entry.skills = (await fsp.readdir(skillsDir, { withFileTypes: true }))
            .filter((d) => d.isDirectory())
            .map((d) => d.name);
        } catch {
          entry.skills = [];
        }
      }
      rows.push(entry);
    }
  }

  for (const [key, meta] of catalog.entries()) {
    if (rows.some((r) => r.key === key)) continue;
    rows.push({
      key,
      name: meta.name,
      marketplace: meta.marketplace,
      version: meta.version,
      scope: null,
      installedAt: null,
      updatedAt: null,
      installPath: null,
      enabled: enabledMap[key] === true,
      inEnabledMap: key in enabledMap,
      description: meta.description,
      skills: [],
      available: true,
    });
  }

  return rows.sort((a, b) => {
    if (a.installedAt && b.installedAt) return b.installedAt.localeCompare(a.installedAt);
    return a.name.localeCompare(b.name);
  });
}

export async function setPluginEnabled(key, enabled) {
  const settings = (await readJson(PATHS.settings, {})) || {};
  if (!settings.enabledPlugins || typeof settings.enabledPlugins !== 'object') settings.enabledPlugins = {};
  settings.enabledPlugins[key] = Boolean(enabled);
  const backup = await writeJson(PATHS.settings, settings);
  return { ok: true, key, enabled: Boolean(enabled), backup };
}
