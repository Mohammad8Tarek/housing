param(
  [string]$ComposeFile = "docker-compose.yml",
  [string]$ServiceName = "db",
  [string]$VolumeName = "postgres_data",
  [switch]$SkipVolumeRemoval
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $ComposeFile)) {
  throw "Compose file not found: $ComposeFile"
}

Write-Host "[postgres-repair] Using compose file: $ComposeFile"
Write-Host "[postgres-repair] Stopping containers..."
docker compose -f $ComposeFile down --remove-orphans

if (-not $SkipVolumeRemoval) {
  Write-Host "[postgres-repair] Removing PostgreSQL data volume '$VolumeName'..."
  docker volume rm $VolumeName -f 2>$null | Out-Null
}

Write-Host "[postgres-repair] Starting database service '$ServiceName'..."
docker compose -f $ComposeFile up -d $ServiceName

Write-Host "[postgres-repair] Checking service status..."
docker compose -f $ComposeFile ps

Write-Host "[postgres-repair] Done."
Write-Host "[postgres-repair] If this is a hosted PostgreSQL service (Railway/Render/etc.), create a fresh database and update DATABASE_URL to the new connection string."
