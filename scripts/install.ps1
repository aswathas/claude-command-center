# Claude Command Center — one-command setup for Windows.
#
#   git clone https://github.com/aswathas/claude-command-center.git
#   cd claude-command-center
#   powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1
#
# It installs dependencies, builds the console, detects the Claude Code install
# on this machine, and tells you where to open it.

$ErrorActionPreference = 'Stop'

function Say  { Write-Host $args[0] }
function Ok   { Write-Host "✓ $args[0]" -ForegroundColor Green }
function Warn { Write-Host "! $args[0]" -ForegroundColor Yellow }
function Die  { Write-Host "✗ $args[0]" -ForegroundColor Red; exit 1 }

Say ""
Say "Claude Command Center — setup"

Push-Location (Join-Path $PSScriptRoot '..')

try {
    # --- 1. node -----------------------------------------------------------
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Die "node is not on PATH. Install Node.js 18 or newer, then run this again."
    }
    $nodeVersion = (node -v)
    $major = [int]($nodeVersion.TrimStart('v').Split('.')[0])
    if ($major -lt 18) { Die "node $nodeVersion is too old. This needs Node.js 18 or newer." }
    Ok "node $nodeVersion"

    # --- 2. claude code (informational) -----------------------------------
    $claude = Get-Command claude -ErrorAction SilentlyContinue
    if ($claude) { Ok "claude CLI found at $($claude.Source)" }
    else { Warn "no 'claude' CLI on PATH - the dashboard still runs, it just has nothing to drive" }

    # --- 3. dependencies ---------------------------------------------------
    Say ""
    Say "installing dependencies..."
    npm install --no-audit --no-fund | Out-Host
    Ok "dependencies installed"

    # --- 4. build ----------------------------------------------------------
    Say ""
    Say "building the console..."
    npm run build | Out-Host
    Ok "console built"

    # --- 5. detect the install --------------------------------------------
    Say ""
    npm run doctor | Out-Host

    # --- 6. next steps -----------------------------------------------------
    Say "Setup complete."
    Say ""
    Say "  start it      npm start"
    Say "  then open     http://127.0.0.1:8787"
    Say ""
    Say "  Phone access is off by default. Turn it on in Settings -> Phone access;"
    Say "  the console stays on loopback until you do."
    Say ""
}
finally {
    Pop-Location
}
