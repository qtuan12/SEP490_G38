@echo off
title BPG CMS Development Launcher
echo ==========================================
echo    STARTING BPG CMS DEVELOPERS SERVERS
echo ==========================================
echo.

:: 1. Start Backend (.NET Core API) in a new console window
echo [1/2] Launching Backend (.NET Core) on https://localhost:7111...
start "BPG CMS Backend" cmd /k "cd BPG_CMS_BE && dotnet run --project src/BPG.Api --launch-profile https"

:: 2. Start Frontend (React + Vite) in a new console window
echo [2/2] Launching Frontend (React + Vite) on https://localhost:5173...
start "BPG CMS Frontend" cmd /k "cd BPG_CMS_FE && npm run dev"
exit
