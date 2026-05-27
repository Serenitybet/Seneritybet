# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Serenitybet** — plateforme de paris sportifs complète avec backoffice opérationnel.
- Marché : Tchad (XAF — Franc CFA d'Afrique Centrale)
- Licence de jeux active au nom de Serenitybet
- Paiements mobiles : Airtel Money, Orange Money, Moov Money (Flooz)

---

## Architecture

Le projet est organisé en deux applications Next.js distinctes et une API backend partagée :

```
serenitybet/
├── apps/
│   ├── web/          # Site client (Next.js 14, App Router)
│   └── backoffice/   # Interface admin (Next.js 14, App Router)
├── packages/
│   ├── api/          # Node.js + Express + Prisma (API REST partagée)
│   ├── db/           # Schéma Prisma + migrations PostgreSQL
│   └── shared/       # Types TypeScript, utilitaires communs
├── docker-compose.yml
└── turbo.json        # Monorepo Turborepo
```

### Modules backend (`packages/api/src/`)

| Module | Responsabilité |
|---|---|
| `auth` | Inscription, connexion, refresh JWT, KYC, limites responsables |
| `sports` | Sync événements/cotes via API externe, gestion marchés |
| `betting` | Validation et placement des paris, calcul des gains, gestion risque |
| `wallet` | Dépôts/retraits XAF, intégration Mobile Money, historique |
| `backoffice` | Routes admin : utilisateurs, rapports, outils trader, configuration |
| `notifications` | SMS/email transactionnel (confirmations paris, retraits) |

### Flux de données clés

- **Cotes** : TheOddsAPI (ou BetRadar) → `sports-service` → Redis (cache TTL court) → clients
- **Paris** : Client → validation `betting-engine` (solde, cotes actuelles, limites) → PostgreSQL → notification
- **Portefeuille** : API Mobile Money (webhook confirmation) → `wallet-service` → PostgreSQL
- **Sessions** : JWT access token (15 min) + refresh token httpOnly cookie (7 jours) stocké Redis

---

## Stack technique

| Couche | Techno |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Node.js, Express, Prisma ORM |
| Base de données | PostgreSQL 15 (données), Redis 7 (cache, sessions, queues) |
| Monorepo | Turborepo + pnpm workspaces |
| Auth | JWT (access + refresh), bcrypt |
| File d'attente | BullMQ (Redis) pour tâches async (sync cotes, notifications) |
| Tests | Vitest (unit), Supertest (intégration API) |

---

## Commandes de développement

### Installation
```bash
pnpm install          # Installe toutes les dépendances (monorepo)
pnpm db:migrate       # Applique les migrations Prisma
pnpm db:seed          # Données de test (sports, utilisateurs démo)
```

### Développement
```bash
pnpm dev                        # Lance web + backoffice + api en parallèle
pnpm dev --filter=web           # Site client uniquement
pnpm dev --filter=api           # API uniquement
pnpm dev --filter=backoffice    # Backoffice uniquement
```

### Tests
```bash
pnpm test                          # Tous les tests
pnpm test --filter=api             # Tests API uniquement
pnpm vitest run src/betting        # Un seul module
pnpm vitest run --reporter=verbose # Avec détail
```

### Build & lint
```bash
pnpm build       # Build de production (tous les packages)
pnpm lint        # ESLint sur tout le monorepo
pnpm typecheck   # TypeScript strict sur tout le monorepo
```

### Base de données
```bash
pnpm prisma studio                      # GUI Prisma (inspection BDD)
pnpm prisma migrate dev --name <nom>    # Nouvelle migration
pnpm prisma generate                    # Regénère le client après modif schéma
```

---

## Variables d'environnement

Fichier `.env` à la racine de `packages/api/` :

```
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
JWT_REFRESH_SECRET=...
ODDS_API_KEY=...          # TheOddsAPI
AIRTEL_MONEY_API_KEY=...
ORANGE_MONEY_API_KEY=...
MOOV_MONEY_API_KEY=...
```

---

## Conventions

- **Langue** : Code en anglais (variables, fonctions, commentaires), interface utilisateur en français
- **Types** : Types Prisma générés = source de vérité ; ne pas dupliquer les types manuellement
- **Cotes** : Toujours stockées et manipulées au format décimal européen (ex. `2.50`)
- **Montants** : Toujours en **centimes XAF** (entiers) dans la BDD pour éviter les flottants
- **Risque** : Tout pari dont le gain potentiel dépasse le seuil configuré passe en validation manuelle (backoffice)
- **Routes admin** : Préfixe `/api/admin/` — protégées par middleware `requireRole('admin' | 'trader' | 'finance')`
