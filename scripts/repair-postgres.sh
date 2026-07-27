#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.yml}"
SERVICE_NAME="${2:-db}"
VOLUME_NAME="${3:-postgres_data}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

echo "[postgres-repair] Stopping containers..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

echo "[postgres-repair] Removing PostgreSQL volume '$VOLUME_NAME'..."
docker volume rm "$VOLUME_NAME" >/dev/null 2>&1 || true

echo "[postgres-repair] Starting service '$SERVICE_NAME'..."
docker compose -f "$COMPOSE_FILE" up -d "$SERVICE_NAME"

echo "[postgres-repair] Service status:"
docker compose -f "$COMPOSE_FILE" ps
