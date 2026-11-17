@echo off
chcp 65001 >nul
schtasks /delete /tn "Nuvola-Link-Pubblico" /f
echo Auto-start removed.
pause
