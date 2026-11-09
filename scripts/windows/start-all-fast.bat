@echo off
setlocal
title Sunrise Housing System (Fast Start)

echo =====================================
echo  Starting Sunrise Housing System
echo  (Skipping Builds)
echo =====================================
echo.

echo Starting Backend...
start "Sunrise Backend" cmd /c "%~dp0start-backend-fast.bat"

echo Starting Frontends...
start "Sunrise Frontends" cmd /c "%~dp0start-frontend-fast.bat"

echo.
echo All services are starting up in separate windows!
echo - Backend: Port 4000
echo - Housing Portal: Port 9000
echo - Employee Portal: Port 10000
echo.
pause
endlocal
