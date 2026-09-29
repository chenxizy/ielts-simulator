@echo off
setlocal

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install Node.js and try again.
  pause
  exit /b 1
)

set "SIMULATOR_URL="
for /f "delims=" %%U in ('node "%~dp0launcher.mjs"') do set "SIMULATOR_URL=%%U"
if not defined SIMULATOR_URL (
  pause
  exit /b 1
)

start "" "%SIMULATOR_URL%"
if errorlevel 1 (
  echo Could not open the default browser. Open %SIMULATOR_URL% manually.
  pause
  exit /b 1
)
