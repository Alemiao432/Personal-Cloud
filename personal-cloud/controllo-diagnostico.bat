@echo off
chcp 65001 >nul
title Nuvola Personale - Diagnostic check
cd /d "%~dp0"
set TS=C:\Program Files\Tailscale\tailscale.exe

echo [1/4] Tailscale status:
"%TS%" status
echo.

echo [2/4] Public link status (funnel):
"%TS%" funnel status
echo.

echo [3/4] Cloud on port 3000:
curl -s -o nul -w "Response: %%{http_code}\n" --max-time 5 http://localhost:3000
echo.

echo [4/4] Public link test:
set "NOME="
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(& '%TS%' status --json | ConvertFrom-Json).Self.DNSName.TrimEnd('.')"`) do set "NOME=%%i"
if "%NOME%"=="" (
  echo   Cannot read the PC Tailscale name.
) else (
  echo   Address: https://%NOME%
  curl -s -o nul -w "Response: %%{http_code}\n" --max-time 15 "https://%NOME%"
)
echo.
echo ==============================================================
echo  HOW TO READ THE RESULTS
echo  [1] empty or error   = Tailscale not connected (icon near
echo      the clock, sign in)
echo  [2] "no funnels"     = public link not active: run
echo      attiva-link-fisso.bat
echo  [3] not 200          = the cloud is not running: check that
echo      the folder has server.js, package.json and public
echo  [4] 200              = all OK, the link works from anywhere
echo ==============================================================
pause
