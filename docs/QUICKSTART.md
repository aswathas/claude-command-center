# Quickstart — plug the Command Center into **your** Claude Code

This is the onboarding page for people who cloned the repo and want the
dashboard pointed at the Claude Code install on their own machine.

Nothing here is Claude-Code-version-specific. The dashboard reads files; if
Claude Code changes where it keeps them, the dashboard changes with it.

---

## 1. Install

**macOS / Linux**

```bash
git clone https://github.com/aswathas/claude-command-center.git
cd claude-command-center
./scripts/install.sh
```

**Windows**

```powershell
git clone https://github.com/aswathas/claude-command-center.git
cd claude-command-center
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
```

**Or do it by hand** (Node.js 18+):

```bash
npm install
npm run build
npm start
```

Then open <http://127.0.0.1:8787>.

---

## 2. Check that it found the right install

Before you start the server, run:

```bash
npm run doctor
```

It prints the exact paths it detected and what is actually on disk:

```
Claude home
  CLAUDE_HOME /Users/you/.claude found
  CLAUDE_JSON /Users/you/.claude.json found

What is on disk
  skills        148 enabled · 33 parked
  plugins       29 installed · 11 enabled · 16 marketplaces
  mcp servers   5 global · 2 across project scopes
  memory        6 user memory files · 25 files in 6 project memory folders
  transcripts   1292 jsonl files · 869 MB across 52 project folders
```

Nothing is uploaded and no secret is printed — it counts files and prints
paths.

If the paths are wrong, set them explicitly (see below). If the counts are
zero, the dashboard will still run; it just has nothing to show yet.

---

## 3. Point it at a different install

The dashboard reads two paths:

| Variable | Default | What it holds |
|---|---|---|
| `CLAUDE_HOME` | `~/.claude` | skills, plugins, settings, memory, transcripts |
| `CLAUDE_JSON` | `~/.claude.json` | global + per-project MCP servers |

**macOS / Linux**

```bash
CLAUDE_HOME=/path/to/.claude \
CLAUDE_JSON=/path/to/.claude.json \
npm start
```

**Windows PowerShell**

```powershell
$env:CLAUDE_HOME = "C:\path\to\.claude"
$env:CLAUDE_JSON = "C:\path\to\.claude.json"
npm start
```

**Windows cmd**

```cmd
set CLAUDE_HOME=C:\path\to\.claude
set CLAUDE_JSON=C:\path\to\.claude.json
npm start
```

Use this when you want to:

- run a second dashboard against a **scratch profile** while you test;
- point a dashboard at a **different machine's** exported `.claude` folder;
- keep a **clean profile** for experiments next to your real one.

### Two dashboards, two profiles

Run one on the default profile and one on a scratch profile, on different
ports. The port is read from the `CCC_PORT` environment variable (8787 by
default).

```bash
npm start                                             # your real install, 127.0.0.1:8787
CCC_PORT=8788 CLAUDE_HOME=/tmp/scratch npm start       # a scratch profile, :8788
```

> The transcript index is stored **inside the Claude home it indexes**
> (`~/.claude/.command-center/cache`), so two dashboards pointed at two
> different installs never overwrite each other's cache.

---

## 4. What it writes, and how to undo it

Everything the dashboard writes goes to one of three places: the Claude home,
the app's own cache, or `~/.claude.json`. Anything else is refused.

| Action | Effect | Reversible by |
|---|---|---|
| Disable a skill | folder moves to `~/.claude/skills-off/` | enabling it again |
| Disable a plugin | `enabledPlugins` entry removed from `settings.json` | re-enabling in the panel |
| Disable an MCP server | entry parked in the parked-servers file | re-enabling in the panel |
| Edit settings / memory | the file is rewritten | `settings.json.bak.<timestamp>` beside it |

Every config write keeps a timestamped backup of the previous contents:

```bash
ls ~/.claude/settings.json.bak.*
```

Deleting a skill folder is **not** what "disable" does. Nothing is destroyed
by a toggle.

---

## 5. Phone access

`Settings → Phone access` moves the console from loopback onto your LAN
address and prints a QR code in the panel.

- Every API call needs the access code.
- Tasks started from the phone are ordinary `claude -p` runs; stopping one
  kills its process tree.
- Switching phone access **off** puts the console back on `127.0.0.1`
  immediately.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Port 8787 already in use | another instance is running | stop it, or start on another port |
| The Skills page is empty | `CLAUDE_HOME` points somewhere else | run `npm run doctor`, check the path |
| Token totals are 0 | no transcripts under `~/.claude/projects` | run one Claude Code session, then Rebuild the index |
| The UI shows the old build | `dist/` is stale | `npm run build` |
| A skill is missing | it was parked earlier | look in `~/.claude/skills-off/` |
| Settings edits vanish | a placeholder was saved over a secret | restore `settings.json.bak.<timestamp>` |

---

## 7. Uninstall

The dashboard itself is just a folder:

```bash
rm -rf claude-command-center
```

Your Claude Code install is untouched. If you parked skills while trying it,
they are still in `~/.claude/skills-off/` — move them back to `~/.claude/skills/`
to restore them.

---

## License

MIT. See [LICENSE](../LICENSE).
