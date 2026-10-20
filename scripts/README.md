# Sauvegarde / restauration de la base de données

## Sauvegarde automatique quotidienne

Sur le VPS, exécutez une fois pour planifier la sauvegarde chaque nuit à 3h :

```bash
chmod +x /opt/serenitybet/scripts/backup-db.sh /opt/serenitybet/scripts/restore-db.sh
crontab -e
```

Ajoutez cette ligne dans l'éditeur, puis sauvegardez/quittez :

```
0 3 * * * /opt/serenitybet/scripts/backup-db.sh >> /opt/serenitybet/backups/backup.log 2>&1
```

Les sauvegardes sont stockées dans `/opt/serenitybet/backups/` (fichiers `.sql.gz`), avec les 30 derniers jours conservés automatiquement (les plus anciennes sont supprimées).

Pour tester manuellement sans attendre 3h :

```bash
/opt/serenitybet/scripts/backup-db.sh
ls -lh /opt/serenitybet/backups/
```

## Restauration en cas d'attaque / problème

```bash
/opt/serenitybet/scripts/restore-db.sh /opt/serenitybet/backups/serenitybet_2026-10-20_030000.sql.gz
```

Le script demande une confirmation explicite avant d'écraser la base actuelle.

## ⚠️ Limite importante

Ces sauvegardes sont stockées **sur le même serveur** que l'application. Elles protègent contre une erreur humaine, une corruption de données ou un bug, mais **pas** contre une attaque qui compromettrait le serveur entier (le serveur et ses sauvegardes seraient perdus ensemble).

Pour une vraie protection contre ce scénario, il faudrait copier régulièrement les sauvegardes vers un stockage externe (S3, Backblaze, etc.) — à mettre en place plus tard si besoin.
