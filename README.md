# Claude Command Center

A local control room for your Claude Code installation.

It reads the real files Claude Code uses — `~/.claude/settings.json`,
`~/.claude.json`, the skill folders, the plugin registry, the memory files, and
every session transcript — and lets you see and change them from a browser
instead of the CLI.

![The Console page](docs/console.png)

Everything runs on your machine. Nothing is uploaded, and there is no account.

**Field manual and screenshots:** https://aswathas.github.io/captain-code/

## What it does

| Page | Reads | Writes |
|---|---|---|
| Console | every transcript under `~/.claude/projects`, the job records, the running tasks | nothing |
| Tasks | the job records, the processes on the machine, the tasks this dashboard started | starts and stops headless `claude` runs |
| Skills | `~/.claude/skills`, `~/.claude/skills-off` | moves a folder between the two |
| Plugins | `plugins/installed_plugins.json`, marketplace catalogue | `enabledPlugins` in `settings.json` |
| MCP servers | `mcpServers` in `~/.claude.json` (global + per project) | `~/.claude.json`, parked servers file |
| Settings | `settings.json`, `settings.local.json`, `CLAUDE.md`, `.claude.json`, access config | all of them, with a backup each time |
| Memory | `~/.claude/memory` and every project memory folder | the memory files themselves |

## Install and run

Requires **Node.js 18+** and a working Claude Code CLI.

### The one-command way

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

The installer installs dependencies, builds the console, detects the Claude
Code install on the machine, and prints what it found.

### By hand

```bash
git clone https://github.com/aswathas/claude-command-center.git
cd claude-command-center
npm install
npm run build      # once, or after changing anything under src/
npm start          # serves the built app and the API on http://127.0.0.1:8787
```

For development with hot reload:

```bash
npm run dev        # API on 8787, Vite dev server on 5173
```

`start.cmd` (Windows) does the same thing in one click.

## Plug in your own Claude Code

The dashboard reads `~/.claude` and `~/.claude.json` by default — the install
you already have, auto-detected. It never asks you to import anything, and it
never talks to a server to find out what you have installed.

Check what it detected before you start it:

```bash
npm run doctor
```

```
Claude home
  CLAUDE_HOME /Users/you/.claude found
  CLAUDE_JSON /Users/you/.claude.json found

What is on disk
  skills        175 enabled · 3 parked
  plugins       29 installed · 12 enabled · 2 marketplaces
  mcp servers   11 global · 28 across project scopes
  memory        26 files in the user memory folder · 4 project memory folders
  transcripts   1291 jsonl files · 1402 MB across 57 project folders
```

To point it at a **different** install — a scratch profile, an exported
`.claude` folder, a second machine:

```bash
CLAUDE_HOME=/path/to/.claude \
CLAUDE_JSON=/path/to/.claude.json \
npm start
```

On Windows PowerShell:

```powershell
$env:CLAUDE_HOME = "C:\path\to\.claude"
$env:CLAUDE_JSON = "C:\path\to\.claude.json"
npm start
```

The transcript cache lives inside the Claude home it indexes, so two
dashboards on two different installs never fight over it. The port comes from
`CCC_PORT` (8787 by default).

Full onboarding, multiple profiles, troubleshooting and uninstall:
**[docs/QUICKSTART.md](docs/QUICKSTART.md)**.

## Running tasks from your phone

Settings → Phone access switches the console from loopback-only onto your
network. When it is on:

- the console answers on your machine's LAN address, printed in the terminal
  and shown as a QR code in the panel;
- every API call needs the access code, which is also printed in the terminal
  and can be rotated from the panel;
- the Tasks page can start a headless `claude` run in any project the machine
  already knows about, stream its output, and stop it.

Switch it back off and the console closes to the outside world immediately.

Tasks started this way are ordinary `claude -p` runs with bypassed
permissions, writing only to `~/.claude/.command-center/tasks`. Stopping one
kills its process tree.

## Token telemetry

Claude Code writes one JSONL transcript per session. Each assistant message
carries a `usage` block, and each session ends with a `cost-state` record that
holds Claude Code's own accounting.

The indexer:

- reads every transcript once and caches the result per file, keyed by
  (mtime, size), so a rescan only re-reads what changed;
- deduplicates messages on `(sessionId, message.id)`, because the same API
  message can be written more than once in a file;
- takes cost and the per-model split from the session's own `cost-state`
  record when one exists, and from the message stream otherwise;
- attributes a session's cost to a real day — the last message seen, then the
  session start time. No synthetic buckets.

The first scan of ~869 MB of transcripts across 1,292 session files takes
about 9 seconds. Later scans reuse the cache — a rescan over the same files
takes about 0.13 seconds. The Overview page has a **Rebuild transcript index**
button when you want a forced re-read.

## Safety rules the code enforces

- The server binds to `127.0.0.1`. Nothing listens on the network until you
  explicitly switch phone access on.
- `~/.claude/credentials.json` is never read or served.
- Secret-looking values (anything whose key matches token / secret / key /
  auth / cookie, and any value shaped like a provider key) are masked before
  they leave the process. They show as `125 chars · hidden`.
- Saving the raw `settings.json` editor merges the masked placeholders back
  into the stored secrets, so a round-trip can never overwrite a real token
  with a placeholder.
- Every write to a config file keeps a timestamped backup beside it
  (`settings.json.bak.<timestamp>`).
- Writes are restricted to the Claude home, the app cache, and `~/.claude.json`.
- Disabling a skill or an MCP server moves it aside; it is never deleted.

## Layout

```
server/
  index.js            Express API
  claude-home.js      paths, guarded read/write, backups
  doctor.js           detect the local Claude Code install (npm run doctor)
  redact.js           secret masking
  usage-index.js      transcript scanning and aggregation
  services/           skills, plugins, mcp, settings, memory
scripts/
  install.sh          one-command setup, macOS and Linux
  install.ps1         one-command setup, Windows
src/
  App.tsx             shell, navigation, theme
  pages/              one file per page
  components/         heatmap, charts, toggle, tooltip, toast
  styles/             design tokens and layout
docs/
  QUICKSTART.md       plug it into your own Claude Code
```

## Design notes

Dark-first instrument panel: deep blue-slate surfaces, Archivo for type, IBM
Plex Mono for data. Magnitude uses a single-hue sequential ramp; identity uses
the fixed categorical order from the dataviz palette, never a rainbow. Every
chart has a hover and focus readout and a table alternative, and the whole
thing respects `prefers-reduced-motion`.

`DESIGN.md` is the full design specification — palette, type scale, layout,
components, motion, and the anti-references this thing deliberately avoids.

## License

MIT. See [LICENSE](LICENSE).
