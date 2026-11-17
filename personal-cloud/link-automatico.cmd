@echo off
rem Waits for Tailscale to connect, then enables the public link (max ~5 minutes)
set TS=C:\Program Files\Tailscale\tailscale.exe
set /a t=0
:attendi
"%TS%" status >nul 2>&1
if not errorlevel 1 goto attiva
set /a t+=1
if %t% geq 30 exit /b 1
timeout /t 10 >nul
goto attendi
:attiva
"%TS%" funnel --bg 3000
exit /b 0
