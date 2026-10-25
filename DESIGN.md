# Design

## The world

A workshop console: the instrument panel of a machine you own, sitting on a
bench under a work lamp. Graphite castings, brass fittings, warm paper-white
legends, and a single cold steel accent for anything coming from the machine
rather than from you. It is a tool for operating, not a product page.

The operator's real tools are a terminal, a bench, a clipboard and a multimeter.
The interface should feel like the panel of an instrument that was built for
this one job, not like a website that was told to display numbers.

**Chosen over the previous world.** The first build was dark blue-slate with
Space Grotesk, a generic analytics shape: a hero number, a row of stat cards,
hairline tables. It read as generated. This world replaces it wholesale — warm
graphite, brass, machine labels, engraved rules, square machined controls, and
a control-surface layout where telemetry supports the controls instead of
performing at them.

## Palette

Roles, not colours. Both themes are separately chosen sets of steps for their
own surface — the light theme is a paper bench, not an inverted dark panel.

### Dark — "bench at night" (default)

| Role | Hex | Contrast on panel |
|---|---|---|
| ground | `#15140f` | — |
| panel | `#1c1b15` | — |
| raised | `#24221b` | — |
| line | `#2f2c23` | — |
| line-strong | `#3d392e` | — |
| ink | `#f0ead9` | 14.4:1 |
| ink-2 | `#b6ae9b` | 7.8:1 |
| ink-3 | `#8a8271` | 4.5:1 |
| brass (accent, live values) | `#d9a441` | 7.7:1 |
| brass-bright | `#f2c877` | 10.9:1 |
| rust (critical, stop) | `#cf6b50` | 5.1:1 |
| sage (ok, enabled) | `#7f9a6b` | 5.5:1 |
| steel (machine/system) | `#6f8fa6` | 5.1:1 |

### Light — "paper bench"

| Role | Hex | Contrast on panel |
|---|---|---|
| ground | `#ece7dc` | — |
| panel | `#f5f1e8` | — |
| raised | `#fbf8f1` | — |
| line | `#d8d1c2` | — |
| line-strong | `#bdb4a1` | — |
| ink | `#1d1a12` | 15.4:1 |
| ink-2 | `#57503f` | 7.1:1 |
| ink-3 | `#6f6656` | 5.1:1 |
| brass | `#8a6212` | 4.9:1 |
| rust | `#a63f2a` | 5.5:1 |
| sage | `#4f6b3e` | 5.3:1 |
| steel | `#3d5d75` | 6.2:1 |

### Magnitude ramp — brass, one hue, light→dark never rainbow

Dark ramp (low→high): `#241f14` `#3b3119` `#55441c` `#715620` `#8f6c26`
`#ad8430` `#cb9c3c` `#e6b54e`. Monotonic in lightness, lowest step 1.05:1
against the panel so "no activity" recedes into the surface.

Every chart in this product plots one series. There is no categorical palette
because nothing needs identity-by-colour: ranked bars are brass, the heatmap is
the brass ramp, and state is carried by rust, sage, and steel with a label
beside it — never by colour alone.

## Type

Two families, both self-hosted.

- **Archivo** — every label, heading, control, and sentence. It is a workhorse
  grotesque with squared terminals that sit well next to machined geometry.
  Weights 400 / 500 / 600 / 700.
- **IBM Plex Mono** — data only: numbers, timestamps, paths, commands, file
  sizes, ids, and code. Never as a costume for "technical". Micro-labels in
  the interface are Archivo at 11px, uppercase, tracked 0.14em — an engraved
  legend, not a mono label.

Scale: 11 / 12 / 13 / 15 / 18 / 23 / 30 / 44. Line height 1.5 for body, 1.15
for display numbers. Body measure 65–75ch. Tracking never below −0.02em.

## Layout

A machine bar across the top, a tab strip beneath it, then panels. No left
rail — the phone is a first-class target, and a horizontal strip survives the
viewport far better than a 250px column that must collapse.

```
┌──────────────────────────────────────────────────────────────────┐
│ CCC ▸ COMMAND CENTER      14:02 · LOCAL · 1 122 FILES · 2 RUNNING │  machine bar
├──────────────────────────────────────────────────────────────────┤
│ Console  Tasks  Skills  Plugins  MCP  Settings  Memory            │  tab strip
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─ RUNNING ─────────────────┐  ┌─ CONTROL ──────────────────┐   │
│  │ job ▸ build report   STOP │  │ Skills      142 on · 33 off│   │
│  │ job ▸ npm test       STOP │  │ Plugins      29 installed   │   │
│  └───────────────────────────┘  │ MCP          11 servers     │   │
│                                 └─────────────────────────────┘   │
│  ┌─ TOKEN BURN ──────────────────────────┐  ┌─ MODELS ─────────┐  │
│  │ ■■■■■□■■ heatmap, brass ramp           │  │ ▁▂▅▇▅▂▁ brass   │  │
│  └───────────────────────────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- Left-aligned throughout. Nothing centred except the numeric value inside its
  own readout cell.
- The machine bar is the only place with a scannable status line: local time,
  files indexed, tasks running, last scan.
- Panels are hairline-bounded rectangles on the ground, with 12–16px internal
  padding. No shadows, no rounded-corner card grid, no nested panels.
- Major panels on the Console page carry drafting registration marks at the
  top-left and bottom-right: two 10px L-shaped hairlines in brass at 40%.
- Dense by default. A control surface earns its density by making state
  legible in one glance.

## Components

**Panel header** — Archivo 600 at 15px, ink. A hairline rule runs from the end
of the header to the right edge of the panel, at the header's optical
baseline. Optional right-hand meta in Archivo 12px, ink-3. No eyebrow above
the header, ever.

**Readout cell** — a value in IBM Plex Mono, 23px, ink; a label above it in
Archivo 11px uppercase tracked, ink-3. Live or changed values take brass. Cells
divide with vertical hairlines; they do not each get a card.

**Switch** — a machined square: 30×16 track, 1px line-strong border, and a
square 12px brass slider with a 1px slot through it. Off state slides to the
left with the track at `--raised`. It is a control, not a pill.

**Button** — 28px tall, 1px line-strong border, `--raised` fill, Archivo 13px
500. Primary is brass fill with ink-on-brass text. Ghost is text only. Danger
is rust text, no border, no fill until hover.

**Heatmap cell** — square, 2px radius, 2px gap, brass ramp. Today's cell
carries a 1px brass outline. Hover raises the cell's opacity and shows a
value-first readout.

**Ranked bar** — brass fill, 4px rounded data end, 2px surface gap from the
track. The label is Archivo 12px ink-2; the value is IBM Plex Mono 12px ink.

**Table** — hairline rows, no zebra, no card. Header row is Archivo 11px
uppercase tracked ink-3. Numeric columns right-aligned with tabular figures.
A table wider than its panel scrolls inside the panel, never the page.

**Tabs** — Archivo 13px 500. The active tab is ink with a 2px brass
underbar; inactive tabs are ink-3. Underbar is the only state marker.

## Motion

One authored moment on first paint: the machine bar's status line resolves
from a blur, once. Everything else moves only in answer to a person: a switch
slider slides, a panel row fades in as it is written, a stopped task's log
stops. Duration 140–220ms, exponential ease-out. Nothing staggers on scroll.

## States

Hover: 8% ink wash on panel surfaces. Focus: 2px brass outline, 2px offset,
visible on every interactive element including switches and heatmap cells.
Disabled: 45% opacity, no pointer events. Empty: one line naming what is
missing and what to do, on the panel ground, never a dashed placeholder box.
Loading: a brass hairline sweep under the panel header. Error: rust text
naming the problem and the recovery, never a generic failure.

## Browser surfaces

Selection is brass at 30%. Focus rings are brass. Scrollbars are 10px,
line-strong thumb on a transparent track. Caret is brass. Tabular figures on
every number in a column. Underline offset 2px on links.

## Anti-references

Explicitly not this: a hero number with a small label and supporting stats; a
row of identical rounded stat cards; an all-caps eyebrow above every heading;
numbered section markers; pills and rounded toggles; blue-on-navy analytics
dark mode; mono type used as decoration; emoji or unicode glyphs standing in
for icons; hard offset shadows; gradient text; decorative glass.
