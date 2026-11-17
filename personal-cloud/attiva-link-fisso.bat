@echo off
chcp 65001 >nul
title Nuvola Personale - Remote access link
cd /d "%~dp0"
set TS=C:\Program Files\Tailscale\tailscale.exe

echo [1/4] Checking the Tailscale connection...
"%TS%" status >nul 2>&1
if errorlevel 1 (
  echo   Not connected - trying to connect...
  "%TS%" up --timeout=20s
  if errorlevel 1 (
    echo [ERROR] Tailscale will not connect. Click the Tailscale icon near
    echo the clock, sign in, then run this script again.
    pause
    exit /b 1
  )
)
echo   OK.

echo [2/4] Checking that the cloud is running on port 3000...
curl -s -o nul --max-time 5 http://localhost:3000
if errorlevel 1 (
  echo   Cloud not running - starting it...
  start "Nuvola Personale" cmd /c "node server.js"
  ping -n 5 127.0.0.1 >nul
)
curl -s -o nul --max-time 5 http://localhost:3000
if errorlevel 1 (
  echo [ERROR] The cloud does NOT start. Check that the folder contains
  echo    server.js, package.json and the public folder.
  echo    If something is missing, the project is incomplete: copy the missing files.
  pause
  exit /b 1
)
echo   OK.

echo [3/4] Enabling the permanent public link (funnel --bg)...
"%TS%" funnel --bg 3000
if errorlevel 1 (
  echo [ERROR] Tailscale refused the funnel. Read the message above:
  echo it usually asks to enable Funnel from the admin console
  echo ^(https://login.tailscale.com/admin/acls^). Then run this script again.
  pause
  exit /b 1
)
echo   OK.

echo [4/4] Getting the PC address...
set "NOME="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(& '%TS%' status --json | ConvertFrom-Json).Self.DNSName.TrimEnd('.')"`) do set "NOME=%%i"
if "%NOME%"=="" (
  echo [ERROR] Cannot read the PC Tailscale name. Try again in a minute.
  pause
  exit /b 1
)

cls
echo ==============================================================
echo   [OK] LINK ENABLED AND PERMANENT
echo.
echo   YOUR ADDRESS:
echo.
echo   https://%NOME%
echo.
echo   REAL TEST: turn off your phone Wi-Fi (mobile data only)
echo   and open this address. If it opens, it works from anywhere.
echo   It also survives PC restarts.
echo ==============================================================
pause
