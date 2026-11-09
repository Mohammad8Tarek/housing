# Sunrise Frontends - Simple Startup
# Usage: .\frontend.ps1
# Scripts live in scripts\windows; resolve the repository root
$Root = (Resolve-Path "$PSScriptRoot\..\..").Path

$ErrorActionPreference = "Continue"

$env:PORT = "9000"
$env:API_PORT = "4000"

cd "$Root"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host "Sunrise Frontends" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host ""

# Build Employee Portal
Write-Host "Building Employee Portal..." -ForegroundColor Yellow
cd "$Root\artifacts\employee-portal"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Employee Portal build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""

# Build Housing Portal
Write-Host "Building Housing Portal..." -ForegroundColor Yellow
cd "$Root\artifacts\housing"
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Housing Portal build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host "Starting Servers..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Magenta
Write-Host ""

# Start Employee Portal on port 10000
Write-Host "Starting Employee Portal on port 10000..." -ForegroundColor Green
cd "$Root\artifacts\employee-portal"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\artifacts\employee-portal'; npx vite preview --config vite.config.ts --port 10000 --host 0.0.0.0" -WindowName "Sunrise Employee Portal"

Start-Sleep -Seconds 2

# Start Housing Portal on port 9000
Write-Host "Starting Housing Portal on port 9000..." -ForegroundColor Green
cd "$Root\artifacts\housing"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\artifacts\housing'; `$env:PORT='9000'; `$env:API_PORT='4000'; npx vite preview --config vite.config.ts --port 9000 --host 0.0.0.0" -WindowName "Sunrise Housing Portal"

Write-Host ""
Write-Host "=========================================" -ForegroundColor Green
Write-Host "Both portals started!" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green
Write-Host ""

Write-Host "Access URLs:" -ForegroundColor Magenta
Write-Host "  Employee Portal: http://localhost:10000" -ForegroundColor Cyan
Write-Host "  Housing Portal:  http://localhost:9000" -ForegroundColor Cyan
Write-Host ""

Write-Host "Close the popup windows to stop the servers" -ForegroundColor Yellow
