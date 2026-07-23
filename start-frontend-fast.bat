@echo off
setlocal
title Sunrise Frontends (Fast)

set PORT=9000
set API_PORT=4100
set VITE_API_PORT=4100

echo.
echo =========================================
echo  Starting Portals (Fast Start)
echo =========================================
echo.

echo Starting Employee Portal on port 10000...
cd /d "%~dp0artifacts\employee-portal"
start "Sunrise Employee Portal" cmd /k "npx vite preview --config vite.config.ts --port 10000 --host 0.0.0.0"

echo Starting Housing Portal on port 9000...
cd /d "%~dp0artifacts\housing"
set PORT=9000
set API_PORT=4100
set VITE_API_PORT=4100
start "Sunrise Housing Portal" cmd /k "npx vite preview --config vite.config.ts --port 9000 --host 0.0.0.0"

echo.
echo =========================================
echo  Both portals started from existing build!
echo  Employee Portal : http://localhost:10000
echo  Housing Portal  : http://localhost:9000
echo =========================================
echo.
pause

endlocal
