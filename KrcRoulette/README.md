# KrcRoulette — Documentation complète du projet

## 📌 Vue d'ensemble
Système de gestion de roulette virtuelle en salle physique (casino physique numérisé).
Plateforme multi-shops, multi-villes, avec backoffice centralisé.

---

## 🏗️ Architecture — 4 applications

### 1. BACKOFFICE (application web)
- Interface admin centrale accessible depuis n'importe quel navigateur
- Géré par le Super Admin uniquement

### 2. GRAND SERVEUR CENTRAL
- Cerveau invisible du système
- Connecté au backoffice et à TOUS les mini-serveurs
- Gère la base de données, le RTP, les timers, les rapports

### 3. MINI-SERVEUR (1 installé par shop)
- PC/mini-PC installé physiquement dans chaque shop
- Connecté à l'écran TV (diffuse la roulette)
- Communique UNIQUEMENT avec :
  ✅ Le grand serveur central
  ✅ Les caisses de SON shop (via code de travail)
  ❌ Jamais avec un autre mini-serveur
  ❌ Jamais avec la caisse d'un autre shop
- Plusieurs mini-serveurs peuvent avoir le même code (grande salle = multi-écrans)

### 4. CAISSE (application web sur PC/tablette)
- Utilisée par les caissiers dans chaque shop
- Enregistre les mises des parieurs
- Imprime ticket physique + QR code
- Scanne QR code pour valider ticket gagnant
- Communique UNIQUEMENT avec le mini-serveur de SON shop

---

## 🔑 Code de travail
- Généré depuis le backoffice pour chaque shop
- Installé sur le mini-serveur ET toutes les caisses du shop
- Permet la communication entre mini-serveur et caisses
- Un même code peut être utilisé sur plusieurs caisses (affluence)
- Un même code peut être utilisé sur plusieurs mini-serveurs (grande salle multi-écrans)
- Ticket imprimé dans shop A refusé dans shop B

---

## 👥 Hiérarchie des utilisateurs

```
SUPER ADMIN (propriétaire)
└── Admin Ville (permissions configurables case à cocher)
    └── Shops (rangés en dossiers par ville)
        └── Caissier(s) rattachés à leur shop uniquement
```

### Niveaux d'accès
- **Super Admin** : accès total, seul à pouvoir tout configurer
- **Admin Ville** : gère uniquement SA ville, permissions accordées case à case par Super Admin
- **Caissier** : accès uniquement à SON shop

### Connexion
- Login par nom d'utilisateur + mot de passe uniquement

---

## 💰 Système de crédit (cascade)

```
Super Admin → attribue crédit à Admin Ville (ex: 1 000 000 FCFA)
Admin Ville → recharge ses shops depuis son propre crédit
Shop        → solde diminue à chaque mise enregistrée
            → solde remonte si ticket gagnant payé par caissier
```

### Exemple
```
Shop ouvre avec 50 000 FCFA
- Mise enregistrée 1 000 FCFA → solde = 49 000 FCFA
- Ticket gagnant payé 2 000 FCFA → solde = 51 000 FCFA
```

### Règles crédit
- Historique complet de toutes les recharges visible
- Alerte quand crédit shop passe sous un seuil configurable
- Demandes de rechargement gérées HORS système (WhatsApp, téléphone)
- Super Admin recharge Admin Ville manuellement depuis backoffice

---

## 🎰 Système de jeux

### Roulette (premier jeu)
- Roulette européenne (1 zéro)
- Lancement automatique en boucle selon timer configuré
- Timer configurable par shop depuis le backoffice
- Résultat affiché sur l'écran TV du shop

### Multi-jeux (futur)
- Le backoffice permet d'activer/désactiver des jeux par shop
- Système de cases à cocher par shop (ex: ☑ Roulette ☐ Blackjack ☐ Crash)
- Nouveaux jeux ajoutables sans refonte du système

---

## ⚙️ Système RTP (Retour sur Total Paris)

### Principe
- RTP défini par le Super Admin, applicable à TOUS les shops
- Limite calculée sur horizon MENSUEL (pas journalier)
- Des jours peuvent finir en négatif ou en positif
- À la fin du mois, la limite globale doit être respectée

### Exemple
```
RTP = 85%
Total misé sur le mois : 4 500 000 FCFA
Total payé max autorisé : 3 825 000 FCFA (85%)
```

### Comportement de l'algorithme
- Imprévisible : l'algorithme décide lui-même QUAND serrer
- Peut serrer dès l'ouverture ou attendre la fin de journée
- Surveille l'horizon mensuel pour s'ajuster
- Si RTP mensuel trop haut → algorithme serre plus fort
- Si RTP mensuel bas → algorithme peut être généreux

### Mode bonus (activable sur tout shop à tout moment)
- RTP temporairement à 90% (plus généreux)
- Durée configurable en jours depuis backoffice
- Applicable aux nouveaux shops ET aux anciens
- Activable/désactivable manuellement par Super Admin

### Alertes RTP
- 🟡 Alerte jaune : RTP mensuel dépasse 88%
- 🔴 Alerte rouge : RTP mensuel dépasse 92%
- Vue temps réel du RTP par shop dans backoffice
- Projection fin de mois visible

---

## 🎫 Ticket physique

### Contenu du ticket
```
NOM DU SHOP — Partie #XXXX
━━━━━━━━━━━━━━━━━━━━━━━━━━
Rouge .............. 500 FCFA
Noir ............... 300 FCFA
Numéro 7 ........... 200 FCFA
Numéro 14 .......... 500 FCFA
━━━━━━━━━━━━━━━━━━━━━━━━━━
TOTAL MISÉ ........ 1500 FCFA
━━━━━━━━━━━━━━━━━━━━━━━━━━
[QR CODE]
ID: TK-20260827-0842
```

### Règles tickets
- Un joueur peut miser sur autant de numéros/couleurs qu'il veut sur un seul ticket
- QR code sert UNIQUEMENT à vérifier/valider un ticket gagnant
- Ticket du shop 1 refusé dans le shop 2
- Imprimante thermique physique

---

## 📊 Rapports

- **Journalier** : généré automatiquement à minuit
- **Manuel** : possible à tout moment
- **Hebdomadaire et mensuel** disponibles
- **Export Excel** direct
- **Historique** de toutes les recharges

---

## 🖥️ Stack technique recommandée

| Composant | Technologie |
|---|---|
| Frontend backoffice | HTML + CSS + JavaScript |
| Backend grand serveur | Node.js + Express |
| Base de données | PostgreSQL |
| Temps réel | Socket.io |
| Authentification | JWT + bcrypt |
| Impression tickets | Bibliothèque thermique |
| QR Code | qrcode.js (génération) + jsQR (scan) |
| Export Excel | SheetJS |

---

## 💵 Monnaie
- Franc CFA (FCFA) uniquement

---

## 📁 Structure du projet

```
KrcRoulette/
├── backoffice/          → Interface admin web
│   ├── index.html       → Page de connexion
│   ├── pages/           → Dashboard, shops, users...
│   ├── css/             → Styles
│   └── js/              → Logique frontend
│
├── grand-serveur/       → Serveur central Node.js
│   ├── server.js        → Point d'entrée
│   ├── config/          → Config DB, env
│   ├── routes/          → API routes
│   ├── models/          → Modèles de données
│   └── middlewares/     → Auth, sécurité
│
├── mini-serveur/        → App installée dans chaque shop
│   ├── index.html       → Affichage roulette (plein écran TV)
│   └── src/app.js       → Logique + Socket.io client
│
└── caisse/              → App caissier
    ├── index.html       → Interface caisse
    ├── css/              → Styles
    └── js/app.js         → Logique caisse
```

---

## 🚀 Ordre de développement

1. ✅ Structure du projet créée
2. 🔄 **Backoffice** (EN COURS)
   - Page de connexion
   - Dashboard Super Admin
   - Gestion villes/dossiers
   - Gestion shops
   - Gestion utilisateurs + permissions
   - Système de crédit
   - Gestion des jeux
   - RTP + alertes temps réel
   - Rapports + Export Excel
3. ⏳ Grand serveur (Node.js + PostgreSQL)
4. ⏳ Mini-serveur (roulette + Socket.io)
5. ⏳ Caisse (mises + tickets + QR code)

---

## 📝 Notes importantes
- Projet physique (casino en salle, pas en ligne)
- Connexion internet nécessaire entre shops et grand serveur
- Mode offline prévu pour chaque shop (si coupure internet)
- Design : sombre et professionnel (inspiré Melbet)
- Police : Syne (titres) + DM Mono (textes)
- Couleur principale : #f5c518 (jaune/or)
