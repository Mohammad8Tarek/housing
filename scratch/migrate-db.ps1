$ErrorActionPreference = "Stop"

$PG_BIN = "C:\Program Files\PostgreSQL\18\bin"

Write-Host "Dumping local database..."
$env:PGPASSWORD = "admin123"
& "$PG_BIN\pg_dump.exe" -U postgres -h localhost -p 5432 -F c -f local_backup.dump staff-housing

Write-Host "Restoring to remote database..."
$env:PGPASSWORD = "FnAaKoiLFczmGZdCBIUwAJTHnDNHXFbV"
& "$PG_BIN\pg_restore.exe" -U postgres -h tokaido.proxy.rlwy.net -p 22778 -d railway --clean --if-exists --no-owner --no-privileges -F c local_backup.dump

Write-Host "Migration completed successfully!"
