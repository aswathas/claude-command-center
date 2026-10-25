#!/usr/bin/env bash
# Claude Command Center — one-command setup for macOS and Linux.
#
#   git clone https://github.com/aswathas/claude-command-center.git
#   cd claude-command-center
#   ./scripts/install.sh
#
# It installs dependencies, builds the console, detects the Claude Code install
# on this machine, and tells you where to open it.

set -euo pipefail

BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); GREEN=$(printf '\033[32m')
YELLOW=$(printf '\033[33m'); RED=$(printf '\033[31m'); RESET=$(printf '\033[0m')

say()  { printf '%s\n' "$*"; }
ok()   { printf '%s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()  { printf '%s✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }

say ""
say "${BOLD}Claude Command Center — setup${RESET}"

cd "$(dirname "$0")/.."

# --- 1. node ---------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  die "node is not on PATH. Install Node.js 18 or newer, then run this again."
fi

NODE_VERSION=$(node -v)
NODE_MAJOR=$(node -v | sed 's/^v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  die "node $NODE_VERSION is too old. This needs Node.js 18 or newer."
fi
ok "node $NODE_VERSION"

# --- 2. claude code (informational) --------------------------------------
if command -v claude >/dev/null 2>&1; then
  ok "claude CLI found at $(command -v claude)"
else
  warn "no 'claude' CLI on PATH — the dashboard still runs, it just has nothing to drive"
fi

# --- 3. dependencies -------------------------------------------------------
say ""
say "${DIM}installing dependencies…${RESET}"
npm install --no-audit --no-fund
ok "dependencies installed"

# --- 4. build --------------------------------------------------------------
say ""
say "${DIM}building the console…${RESET}"
npm run build
ok "console built"

# --- 5. detect the install -------------------------------------------------
say ""
npm run doctor || true

# --- 6. next steps ---------------------------------------------------------
say "${BOLD}Setup complete.${RESET}"
say ""
say "  start it      ${BOLD}npm start${RESET}"
say "  then open     ${BOLD}http://127.0.0.1:8787${RESET}"
say ""
say "${DIM}  Phone access is off by default. Turn it on in Settings → Phone access;"
say "  the console stays on loopback until you do.${RESET}"
say ""
