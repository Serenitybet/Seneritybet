#!/usr/bin/env bash
# Sauvegarde quotidienne de la base PostgreSQL de production.
# À lancer via cron sur le VPS (voir scripts/README.md).
set -euo pipefail

BACKUP_DIR="/opt/serenitybet/backups"
RETENTION_DAYS=30
CONTAINER="serenitybet_postgres"
TIMESTAMP="$(date +%Y-%m-%d_%H%M%S)"
FILE="$BACKUP_DIR/serenitybet_${TIMESTAMP}.sql.gz"

# Destination hors-serveur (Backblaze B2 via rclone). Voir scripts/README.md
# pour la configuration initiale du remote "b2" et du nom de bucket.
B2_REMOTE="b2:serenitybet-db-backups"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" sh -c 'pg_dump --clean --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$FILE"

# Supprime les sauvegardes locales plus vieilles que $RETENTION_DAYS jours
find "$BACKUP_DIR" -name "serenitybet_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete

echo "[$(date)] Sauvegarde locale créée : $FILE ($(du -h "$FILE" | cut -f1))"

# Copie hors-serveur — ne fait jamais échouer la sauvegarde locale si rclone
# n'est pas (encore) configuré : mieux vaut une sauvegarde locale seule que
# pas de sauvegarde du tout.
if command -v rclone >/dev/null 2>&1; then
  if rclone copy "$FILE" "$B2_REMOTE" 2>>"$BACKUP_DIR/rclone-errors.log"; then
    echo "[$(date)] Copiée hors-serveur vers $B2_REMOTE"
  else
    echo "[$(date)] ATTENTION : échec de la copie vers $B2_REMOTE (voir rclone-errors.log)" >&2
  fi
else
  echo "[$(date)] ATTENTION : rclone non installé — sauvegarde hors-serveur ignorée" >&2
fi
