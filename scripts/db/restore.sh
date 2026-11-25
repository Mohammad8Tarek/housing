#!/usr/bin/env bash
# استعادة نسخة احتياطية يدوياً مع حماية من التشغيل الخاطئ
# Manual restore of a dump made by backup.sh or the nightly workflow.
#
# Usage / الاستخدام:
#   # Full dump into a scratch database:
#   scripts/db/restore.sh --dump staff-housing.dump \
#     --target-url "postgresql://user:pass@host:5432/housing_restore" --confirm housing_restore
#
#   # One property's schema, in place (drops and recreates that schema's objects):
#   scripts/db/restore.sh --dump property-3.dump --target-url "$DATABASE_URL" --confirm railway
#
# Safety: --confirm must exactly equal the target database name or the script
# exits. Test on a scratch database before touching a live one.
set -euo pipefail

DUMP=""
TARGET=""
CONFIRM=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dump)       DUMP="$2"; shift 2 ;;
    --target-url) TARGET="$2"; shift 2 ;;
    --confirm)    CONFIRM="$2"; shift 2 ;;
    -h|--help)    sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "restore.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$DUMP" && -n "$TARGET" ]] || { echo "restore.sh: --dump and --target-url are required" >&2; exit 2; }
[[ -f "$DUMP" ]] || { echo "restore.sh: dump file not found: $DUMP" >&2; exit 2; }

DBNAME="${TARGET##*/}"
DBNAME="${DBNAME%%\?*}"
[[ -n "$CONFIRM" ]] || { echo "restore.sh: re-run with --confirm ${DBNAME} to proceed" >&2; exit 2; }
[[ "$CONFIRM" == "$DBNAME" ]] || { echo "restore.sh: --confirm (${CONFIRM}) does not match target database (${DBNAME})" >&2; exit 2; }

echo "restore.sh: archive contents (first objects):"
pg_restore --list "$DUMP" | grep -E "SCHEMA -|TABLE DATA" | head -20
echo "restore.sh: restoring ${DUMP} into database ${DBNAME}"
pg_restore --dbname "$TARGET" --no-owner --no-privileges --clean --if-exists "$DUMP"
echo "restore.sh: done."
