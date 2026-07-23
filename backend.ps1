# Sunrise Backend - Simple Startup
# Usage: .\backend.ps1

$ErrorActionPreference = "Stop"

# Settings
$env:DATABASE_URL = "postgresql://postgres:admin123@localhost:5432/staff-housing"
$env:PORT = "4000"
$env:SESSION_SECRET = "sunrise-secret-2025"
$env:NODE_ENV = "development"

# Go to server directory
cd "$PSScriptRoot\artifacts\api-server"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host "Sunrise Backend" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "Building..." -ForegroundColor Yellow
node ./build.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting Sunrise Backend on port 4000..." -ForegroundColor Green
Write-Host ""

node --enable-source-maps ./dist/index.mjs

Read-Host "Press Enter to exit"
