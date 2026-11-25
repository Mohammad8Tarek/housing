#!/usr/bin/env bash
# نسخ احتياطي يدوي لقاعدة البيانات (كامل أو لعقار واحد)
# Manual database backup: full database or a single property.
#
# Usage / الاستخدام:
#   scripts/db/backup.sh --url "$DATABASE_URL" --out staff-housing.dump
#   scripts/db/backup.sh --url "$DATABASE_URL" --property 3 --out property-3.dump
#
# Full mode dumps every schema (public + all tenant schemas) in one
# custom-format file. Property mode dumps only that property's tenant schema
# (resolved from public.properties.schema_name). Dumps contain real
# resident/employee PII: never commit them to git.
set -euo pipefail

URL=""
OUT=""
PROP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url)      URL="$2"; shift 2 ;;
    --out)      OUT="$2"; shift 2 ;;
    --property) PROP="$2"; shift 2 ;;
    -h|--help)  sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "backup.sh: unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$URL" && -n "$OUT" ]] || { echo "backup.sh: --url and --out are required" >&2; exit 2; }

if [[ -n "$PROP" ]]; then
  [[ "$PROP" =~ ^[0-9]+$ ]] || { echo "backup.sh: --property must be a numeric property id" >&2; exit 2; }
  SCHEMA=$(psql "$URL" -Atc "SELECT schema_name FROM public.properties WHERE id = ${PROP}")
  [[ -n "$SCHEMA" ]] || { echo "backup.sh: no property with id ${PROP}" >&2; exit 1; }
  echo "backup.sh: dumping property ${PROP} (schema \"${SCHEMA}\")"
  pg_dump "$URL" --format=custom --no-owner --no-privileges --schema="$SCHEMA" --file="$OUT"
else
  echo "backup.sh: dumping full database (public + all tenant schemas)"
  pg_dump "$URL" --format=custom --no-owner --no-privileges --file="$OUT"
fi

ls -lh "$OUT"
