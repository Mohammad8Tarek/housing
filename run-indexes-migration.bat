@echo off
REM ============================================================
REM Sunrise Housing — Database Indexes Migration
REM Run this ONCE after first deployment or when upgrading
REM ============================================================

echo.
echo ========================================================
echo   Sunrise Housing - Running Database Index Migration
echo ========================================================
echo.

REM Load DATABASE_URL from .env if not already set
for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
  if "%%A"=="DATABASE_URL" (
    if "%DATABASE_URL%"=="" set DATABASE_URL=%%B
  )
)

if "%DATABASE_URL%"=="" (
  echo [ERROR] DATABASE_URL is not set.
  echo Please create a .env file with: DATABASE_URL=postgresql://...
  pause
  exit /b 1
)

echo [INFO] Running indexes migration...
echo [INFO] Database: %DATABASE_URL%
echo.

psql "%DATABASE_URL%" -f "scripts\add-missing-indexes.sql"

if %ERRORLEVEL% EQU 0 (
  echo.
  echo [SUCCESS] All indexes created successfully!
) else (
  echo.
  echo [WARNING] Some indexes may have failed. Check output above.
  echo           This is normal if indexes already exist.
)

echo.
pause
