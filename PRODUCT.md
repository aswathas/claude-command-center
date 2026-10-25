# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: the owner of this Windows machine and the only operator of the
dashboard. They work at a desk, often at night, and they are already deep in
Claude Code. They know the CLI well and distrust it for discovery — they cannot
see at a glance which skills are installed, which are parked, which plugins are
enabled, or what last month cost.

The same person may open the dashboard on their phone over the home network to
check on a long-running job, stop it, or start a new one. The phone is not a
secondary surface; it is the surface where "is it still going?" gets answered.

There are no other users, no accounts, no shared installs.

## Product Purpose

A single control surface over one Claude Code installation. The dashboard reads
the exact files Claude Code reads — `settings.json`, `settings.local.json`,
`CLAUDE.md`, `~/.claude.json`, the skill folders, the plugin registry, the
memory folders — and the exact transcripts Claude Code writes, and turns them
into something a person can scan, understand, and change.

Success means the operator never needs the CLI to answer "what is installed,
what is on, what did it cost, what is still running". Every change it makes is
one they could have made by hand, and every change it makes is reversible.

## Positioning

It is not a wrapper around a CLI, and it is not a usage report exported from
somewhere else. It reads the same on-disk state Claude Code itself reads, in
the same machine, and it writes back to those files with a backup beside each
one. The token numbers are computed from the transcripts Claude Code actually
wrote, using Claude Code's own session accounting for cost — so they cannot
drift from the tool's own view of the same history.

## Operating Context

- One Windows 11 machine. One node process, normally bound to `127.0.0.1`.
- The transcript archive is around 1 GB across roughly 1,100 session files, and
  it grows every time Claude Code runs. First read takes seconds; later reads
  must come from a cache.
- The operator's `.claude` directory holds a live API token. Anything that
  displays configuration must not leak it by accident.
- Claude Code jobs live as records under `~/.claude/jobs/<id>/state.json`, with
  no process id inside them; actual running work is visible as processes.
- The operator wants the phone reachable, but only deliberately.

## Capabilities and Constraints

**Reads:** every session transcript under `~/.claude/projects`; `settings.json`;
`settings.local.json`; `CLAUDE.md`; `~/.claude.json`; installed and parked
skill folders; the plugin registry and marketplace catalogue; user and
per-project memory folders; running processes; Claude Code job records.

**Writes:** skill enable/disable by moving folders between `skills/` and
`skills-off/`; plugin enable/disable through `enabledPlugins`; MCP server
add/edit/disable in `~/.claude.json`; settings fields and the raw settings
document; the local settings document; `CLAUDE.md`; memory file contents.

**Tasks:** start a headless Claude Code run in a chosen project and watch its
output; stop a running task the dashboard owns; report the state of Claude
Code's own job records.

**Constraints, all deliberate:**

- Secrets are masked on read and merged back on write; a round-trip must never
  replace a real token with a placeholder.
- Every write to a config file keeps a timestamped backup beside it.
- No destructive default. Deleting means deleting, and it is never a default
  action on a control.
- The server binds to loopback unless phone access is explicitly enabled, and
  phone access requires a per-install access code.
- Writes are confined to the Claude home, the app's own cache, and
  `~/.claude.json`.
- `~/.claude/credentials.json` is never read or served.

**Open decisions:** whether phone access should support more than start and
stop (for example editing settings from the phone), and whether the operator
wants the dashboard to be able to run Claude Code itself as a long-lived
service rather than only on demand.

## Evidence on Hand

The real install: about 175 skill folders, 29 installed plugins, 11 global MCP
servers, 28 project scopes, 26 memory files, and roughly 1,100 transcripts
totalling around 1 GB. Everything shown in the dashboard comes from those files.

There are no testimonials, no benchmarks, no pricing, no external services, and
no marketing claims. Future work must not fabricate any of them.

## Product Principles

1. **The truth is on disk.** Read the same files the tool reads. Never show a
   number that cannot be traced to a path.
2. **Nothing happens by accident.** A mutation is deliberate, confirmed,
   backed up, and reversible. Read paths never write.
3. **One machine, one operator.** Personal, local, no accounts, no telemetry
   leaving the box.
4. **Every figure explains itself.** A number shows where it came from; a
   chart has a table alternative; a hidden value says it is hidden.
5. **The phone answers "what is still running?"** and can stop or start work.
   If it cannot be done from the phone, it should not be a core task.

## Accessibility & Inclusion

Keyboard reachable throughout, including every switch and chart mark, with a
visible focus ring. Text contrast at least 4.5:1 in both themes. Charts carry
a table alternative so no value is reachable only by hovering. Motion respects
`prefers-reduced-motion`. Touch targets sized for a phone, since the phone is
a real target, not a courtesy.
