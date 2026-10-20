#!/usr/bin/env bash
# Restaure la base PostgreSQL à partir d'une sauvegarde créée par backup-db.sh.
# Usage : ./restore-db.sh /opt/serenitybet/backups/serenitybet_2026-10-20_030000.sql.gz
set -euo pipefail

CONTAINER="serenitybet_postgres"

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "Usage: $0 <fichier_sauvegarde.sql.gz>"
  exit 1
fi

FILE="$1"

echo "⚠️  Ceci va ÉCRASER la base de données actuelle avec le contenu de : $FILE"
read -r -p "Taper RESTAURER pour confirmer : " CONFIRM
if [ "$CONFIRM" != "RESTAURER" ]; then
  echo "Annulé."
  exit 1
fi

gunzip -c "$FILE" | docker exec -i "$CONTAINER" sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "[$(date)] Restauration terminée depuis $FILE"
