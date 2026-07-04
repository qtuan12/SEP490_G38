@echo off
title BPG CMS Development Launcher
echo ==========================================
echo    STARTING BPG CMS DEVELOPERS SERVERS
echo ==========================================
echo.

:: 1. Start Backend (.NET Core API) in a new console window
echo [1/2] Launching Backend (.NET Core) on http://localhost:5160...
start "BPG CMS Backend" cmd /k "cd BPG_CMS_BE && dotnet run --project src/BPG.Api"

:: 2. Start Frontend (Vite App) in a new console window
echo [2/2] Launching Frontend (React + Vite) on http://localhost:5173...
start "BPG CMS Frontend" cmd /k "cd BPG_CMS_FE && npm run dev"
exit
