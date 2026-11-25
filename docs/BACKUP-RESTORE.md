# Database backup & restore

## What runs

`.github/workflows/db-backup.yml` runs **every night at 03:00 Cairo time** (01:00 UTC)
and on demand (Actions tab → DB Backup → Run workflow). Each run:

1. Dumps the production Railway Postgres with `pg_dump` (custom format, compressed).
2. **Verifies the dump by restoring it** into a scratch Postgres 18 container in the
   same job and counting restored tables. A backup that cannot restore fails the run,
   and GitHub emails the repo owner on scheduled-workflow failure.
3. Uploads the dump as a workflow artifact kept for **14 days**
   (Actions → DB Backup → pick a run → Artifacts).

## Required secret

The workflow needs one repository secret (Settings → Secrets and variables → Actions):

| Name                 | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| `BACKUP_DATABASE_URL` | Railway Postgres connection string (`postgresql://user:pass@host:port/dbname`) |

Without it the dump step fails fast. Rotate this secret whenever the DB password
changes.

## Manual restore

```bash
# Download staff-housing.dump from the run's artifacts, then:
createdb housing_restore
pg_restore --dbname "postgresql://user:pass@host:5432/housing_restore" \
  --no-owner --no-privileges --exit-on-error staff-housing.dump
```

The dump covers every schema (public + tenant schemas) in one file.

## Notes

- Dumps contain real employee PII. Artifacts inherit the repo's private access; never
  commit dumps to git (see `database/dumps/` incident, Nov 2026).
- Cost: ~5 CI minutes/night (well inside the free 2,000 private-repo minutes/month).
  Artifact storage: dump is ~15-30 MB compressed; 14 days of artifacts stays near the
  free 500 MB. Drop `retention-days` to 7 if GitHub warns about storage.
- For a second copy outside GitHub, add an upload step to S3/R2/Backblaze later; that
  needs a storage account and is intentionally not included here.
