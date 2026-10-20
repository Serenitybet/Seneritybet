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

## Sauvegarde hors-serveur (Backblaze B2)

Les sauvegardes locales seules ne protègent pas contre une attaque qui compromettrait le serveur entier (le site et ses sauvegardes seraient perdus ensemble). `backup-db.sh` copie donc automatiquement chaque sauvegarde vers un bucket Backblaze B2, en plus de la copie locale — à configurer une seule fois :

### 1. Créer le compte et le bucket Backblaze

1. Créez un compte sur https://www.backblaze.com/b2/cloud-storage.html
2. Dans la console B2, créez un bucket **privé**, par exemple `serenitybet-db-backups` (le nom doit être unique dans tout Backblaze — ajoutez des chiffres si besoin)
3. Allez dans **Bucket Settings → Lifecycle Settings** et choisissez "Keep only the last version of the file, and delete older files after X days" avec X = 60, pour que B2 nettoie automatiquement les anciennes sauvegardes côté serveur
4. Allez dans **App Keys → Add a New Application Key** : nommez-la `serenitybet-backup`, restreignez-la au bucket créé, droits lecture+écriture. **Notez le `keyID` et la `applicationKey` affichés — la clé secrète n'est montrée qu'une seule fois.**

### 2. Installer et configurer rclone sur le VPS

```bash
sudo apt update && sudo apt install -y rclone
mkdir -p ~/.config/rclone
cat > ~/.config/rclone/rclone.conf <<'EOF'
[b2]
type = b2
account = VOTRE_KEY_ID
key = VOTRE_APPLICATION_KEY
EOF
```

Remplacez `VOTRE_KEY_ID` et `VOTRE_APPLICATION_KEY` par les valeurs notées à l'étape précédente.

Si le nom du bucket choisi n'est pas `serenitybet-db-backups`, modifiez la ligne `B2_REMOTE` dans `scripts/backup-db.sh` pour qu'elle corresponde (`b2:<nom-du-bucket>`).

### 3. Tester

```bash
/opt/serenitybet/scripts/backup-db.sh
rclone ls b2:serenitybet-db-backups
```

Le fichier `.sql.gz` le plus récent doit apparaître dans la liste.

## Restauration en cas d'attaque / problème

Si le serveur est intact, restaurez directement depuis la sauvegarde locale :

```bash
/opt/serenitybet/scripts/restore-db.sh /opt/serenitybet/backups/serenitybet_2026-10-20_030000.sql.gz
```

Si le serveur a été compromis/perdu et que vous repartez d'un nouveau serveur, téléchargez d'abord la sauvegarde depuis B2 :

```bash
rclone copy b2:serenitybet-db-backups/serenitybet_2026-10-20_030000.sql.gz /opt/serenitybet/backups/
/opt/serenitybet/scripts/restore-db.sh /opt/serenitybet/backups/serenitybet_2026-10-20_030000.sql.gz
```

Le script de restauration demande une confirmation explicite avant d'écraser la base actuelle.
