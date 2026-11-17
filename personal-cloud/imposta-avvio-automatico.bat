@echo off
chcp 65001 >nul
title Nuvola Personale - Link auto-start
cd /d "%~dp0"
schtasks /create /tn "Nuvola-Link-Pubblico" /tr "\"%~dp0link-automatico.cmd\"" /sc onlogon /rl highest /f
echo.
echo  Done: every time the PC starts, the system waits for Tailscale
echo  to connect and then enables the public link on its own.
echo  You will never have to run anything by hand again.
echo.
echo  To remove the auto-start: rimuovi-avvio-automatico.bat
pause
