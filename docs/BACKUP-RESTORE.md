# Database backup & restore / النسخ الاحتياطي والاستعادة

Last updated: 25/11/2026

## What runs / ماذا يعمل

`.github/workflows/db-backup.yml` runs **every night at 03:00 Cairo time** (01:00 UTC)
and on demand (Actions tab -> DB Backup -> Run workflow). Each run:

1. Dumps the production Railway Postgres with `pg_dump` (custom format, compressed).
2. **Verifies the dump by restoring it** into a scratch Postgres 18 container in the
   same job and counting restored tables. A backup that cannot restore fails the run,
   and GitHub emails the repo owner on scheduled-workflow failure.
3. Uploads the dump as a workflow artifact kept for **14 days**
   (Actions -> DB Backup -> pick a run -> Artifacts).

تعمل المهمة كل ليلة الساعة 03:00 بتوقيت القاهرة: تفريغ كامل لقاعدة البيانات،
ثم التحقق من النسخة باستعادتها فعلياً داخل قاعدة مؤقتة، ثم حفظها كأرتيفاكت لمدة 14 يوماً.

## Required secret / السر المطلوب

The workflow needs one repository secret (Settings -> Secrets and variables -> Actions):

| Name                  | Value                                                                          |
| --------------------- | ------------------------------------------------------------------------------ |
| `BACKUP_DATABASE_URL` | Railway Postgres connection string (`postgresql://user:pass@host:port/dbname`) |

Without it the dump step fails fast. Rotate this secret whenever the DB password
changes (planned under security item #1).

## Manual backup / النسخ اليدوي

### From GitHub (recommended) / من GitHub (مفضل)

Actions -> DB Backup -> Run workflow:

- Leave **Property ID** empty for a full backup (all schemas).
- Enter a **Property ID** (e.g. `3`) to back up only that property.
  The schema name is resolved from `public.properties.schema_name` (fallback
  naming `prop_<id>`), so the ID is the property's numeric ID in the app.

The dump lands in that run's artifacts within a few minutes.

### From your machine / من جهازك

```bash
# Full backup:
scripts/db/backup.sh --url "$DATABASE_URL" --out staff-housing.dump

# One property only:
scripts/db/backup.sh --url "$DATABASE_URL" --property 3 --out property-3.dump
```

Needs `pg_dump`/`psql` 18 installed locally and a DB connection string.

## Manual restore / الاستعادة اليدوية

`restore.sh` refuses to run unless `--confirm` equals the exact target database
name, so a paste mistake cannot overwrite the wrong database.

```bash
# Full dump into a NEW scratch database (safe test):
createdb housing_restore
scripts/db/restore.sh --dump staff-housing.dump \
  --target-url "postgresql://user:pass@host:5432/housing_restore" --confirm housing_restore

# One property, restored in place over its existing schema:
scripts/db/restore.sh --dump property-3.dump \
  --target-url "$DATABASE_URL" --confirm <target_db_name>
```

- A full dump covers every schema (public + all tenant schemas) in one file.
- A property dump contains only that property's tenant schema. Restoring it
  **in place** drops and recreates that schema's objects; shared `public`
  structure (buildings, floors, the properties row) is not touched and comes
  from the full nightly dump if ever needed.
- Tenant tables reference `public.*`, so a property dump cannot be
  live-restored into an empty database; its workflow run verifies archive
  integrity instead, and the nightly full run live-tests restore of everything.

استعادة عقار واحد تحذف وتعيد إنشاء عناصر schema الخاصة به فقط دون المساس
بالبيانات المشتركة في public. لا يمكن استعادة نسخة عقار واحد في قاعدة فارغة
لأن جداوله تعتمد على جداول public المشتركة.

## Notes / ملاحظات

- Dumps contain real employee PII. Artifacts inherit the repo's private access; never
  commit dumps to git (see `database/dumps/` incident, Nov 2025 - 25/11/2026 cleanup pending).
- Cost: ~5 CI minutes/night (well inside the free 2,000 private-repo minutes/month).
  Artifact storage: dump is ~15-30 MB compressed; 14 days of artifacts stays near the
  free 500 MB. Drop `retention-days` to 7 if GitHub warns about storage.
- For a second copy outside GitHub, add an upload step to S3/R2/Backblaze later; that
  needs a storage account and is intentionally not included here.
