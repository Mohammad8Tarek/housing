@echo off
setlocal
title Sunrise Frontends

set PORT=9000
set API_PORT=4000

echo.
echo =========================================
echo  Building Employee Portal...
echo =========================================
cd /d "%~dp0artifacts\employee-portal"
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Employee Portal build failed!
    pause
    exit /b 1
)

echo.
echo =========================================
echo  Building Housing Portal...
echo =========================================
cd /d "%~dp0artifacts\housing"
set PORT=9000
set API_PORT=4000
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Housing Portal build failed!
    pause
    exit /b 1
)

echo.
echo =========================================
echo  Starting Servers...
echo =========================================

echo Starting Employee Portal on port 10000...
cd /d "%~dp0artifacts\employee-portal"
start "Sunrise Employee Portal" cmd /k "npx vite preview --config vite.config.ts --port 10000 --host 0.0.0.0"

echo Starting Housing Portal on port 9000...
cd /d "%~dp0artifacts\housing"
set PORT=9000
set API_PORT=4000
start "Sunrise Housing Portal" cmd /k "npx vite preview --config vite.config.ts --port 9000 --host 0.0.0.0"

echo.
echo =========================================
echo  Both portals started!
echo  Employee Portal : http://localhost:10000
echo  Housing Portal  : http://localhost:9000
echo =========================================
echo.
pause

endlocal
