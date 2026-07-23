@echo off
REM ============================================================
REM Sunrise Housing - Automated Production Deployment Script
REM ============================================================

echo ============================================================
echo [1/5] Validating Environment Variables...
echo ============================================================

REM Load variables from .env if running locally
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        if "%%A"=="DATABASE_URL" if "%DATABASE_URL%"=="" set DATABASE_URL=%%B
        if "%%A"=="SESSION_SECRET" if "%SESSION_SECRET%"=="" set SESSION_SECRET=%%B
        if "%%A"=="NODE_ENV" if "%NODE_ENV%"=="" set NODE_ENV=%%B
    )
)

if "%DATABASE_URL%"=="" (
    echo [ERROR] DATABASE_URL is not set! 
    echo Please configure your database connection string before deploying.
    exit /b 1
)

if "%SESSION_SECRET%"=="" (
    echo [ERROR] SESSION_SECRET is not set!
    echo Please configure a secure session secret before deploying.
    exit /b 1
)

echo Environment validation passed.
echo.

echo ============================================================
echo [2/5] Running Database Migrations...
echo ============================================================
call npm run db:migrate --workspace=@workspace/db
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database migrations failed!
    exit /b 1
)
call run-indexes-migration.bat
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Indexes migration failed!
    exit /b 1
)
echo.

echo ============================================================
echo [3/5] Building Backend API Server...
echo ============================================================
call npm run build --workspace=@workspace/api-server
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed!
    exit /b 1
)
echo.

echo ============================================================
echo [4/5] Building Frontend Portals...
echo ============================================================
call npm run build --workspace=@workspace/housing
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Housing frontend build failed!
    exit /b 1
)
call npm run build --workspace=@workspace/employee-portal
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Employee Portal build failed!
    exit /b 1
)
echo.

echo ============================================================
echo [5/5] Deployment Package Ready!
echo ============================================================
echo All builds and migrations completed successfully.
echo.
echo To start the production server, run:
echo    npm start --workspace=@workspace/api-server
echo.
echo NOTE: Ensure NODE_ENV=production is set when starting the server.
echo ============================================================
exit /b 0
