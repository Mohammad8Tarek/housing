@echo off
setlocal
title Sunrise Backend (Fast)

:: Database and Environment Settings
set DATABASE_URL=postgresql://postgres:admin123@localhost:5432/staff-housing
set PORT=4100
set SESSION_SECRET=sunrise-secret-2025
set NODE_ENV=development

:: Go to server directory
cd /d "%~dp0artifacts\api-server"

echo.
echo =====================================
echo  Sunrise Backend (Fast Start)
echo =====================================
echo.

echo Starting Sunrise Backend from existing build on port 4000...
echo.

call node --enable-source-maps ./dist/index.mjs

pause
endlocal
