@echo off
chcp 65001 >nul
title Nuvola Personale
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found.
  echo Download it from https://nodejs.org ^(LTS version^), install it, then try again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run: downloading dependencies, please wait a few seconds...
  call npm install --no-audit --no-fund
)

echo.
echo  Starting the cloud... Keep this window open.
echo  When the server is ready, open your browser at: http://localhost:3000
echo.
node server.js
pause
