@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo Installing dependencies...
  call npm install
)

if not exist dist\index.html (
  echo Building the interface...
  call npm run build
)

echo.
echo Claude Command Center -> http://127.0.0.1:8787
echo Press Ctrl+C to stop.
echo.

node server\index.js
