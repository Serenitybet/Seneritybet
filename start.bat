@echo off
title Serenitybet — Démarrage des services
echo.
echo =========================================
echo     SERENITYBET — Démarrage
echo =========================================
echo.

set NODE_OPTIONS=--max-old-space-size=3072

echo [1/3] Démarrage de l'API (port 4000)...
start "API Serenitybet :4000" cmd /k "cd /d "%~dp0packages\api" && set NODE_OPTIONS=--max-old-space-size=512 && pnpm dev"

timeout /t 5 /nobreak > nul

echo [2/3] Démarrage du site web (port 3000)...
start "Web Serenitybet :3000" cmd /k "cd /d "%~dp0apps\web" && set NODE_OPTIONS=--max-old-space-size=1536 && pnpm dev"

timeout /t 8 /nobreak > nul

echo [3/3] Démarrage du backoffice (port 3001)...
start "Backoffice Serenitybet :3001" cmd /k "cd /d "%~dp0apps\backoffice" && set NODE_OPTIONS=--max-old-space-size=1536 && pnpm dev"

echo.
echo =========================================
echo  Tous les services démarrent...
echo.
echo  - Site web     : http://localhost:3000
echo  - Backoffice   : http://localhost:3001
echo  - API          : http://localhost:4000
echo =========================================
echo.
echo Attendez 30-60 secondes que tout soit prêt.
pause
