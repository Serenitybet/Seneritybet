#!/usr/bin/env bash
# Sauvegarde quotidienne de la base PostgreSQL de production.
# À lancer via cron sur le VPS (voir scripts/README.md).
set -euo pipefail

BACKUP_DIR="/opt/serenitybet/backups"
RETENTION_DAYS=30
CONTAINER="serenitybet_postgres"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
FILE="$BACKUP_DIR/serenitybet_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE"

# Supprime les sauvegardes plus vieilles que $RETENTION_DAYS jours
find "$BACKUP_DIR" -name "serenitybet_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date)] Sauvegarde créée : $FILE ($(du -h "$FILE" | cut -f1))"
