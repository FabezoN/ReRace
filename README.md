## ReRace - Plateforme de Revente de Billets F1

Plateforme sécurisée de **revente et achat de billets de Formule 1**, avec :

- Calendrier F1 **2026** synchronisé automatiquement depuis l'API Jolpica
- Achat sécurisé via **Stripe Checkout**
- Stockage des justificatifs de billets sur **Supabase Storage**
- Espace utilisateur avec **profil**, **historique d'achats** et **validation des billets**
- Système de **signalement** (litige acheteur → remboursement Stripe + alerte admin)
- Tableau de bord **Admin** (stats, gestion tickets, utilisateurs, signalements)
- Monitoring des erreurs via **Sentry**
- Architecture **monorepo** (`client` + `server`)

---

## Architecture

- **`/client`** : Frontend React 19 + TypeScript + Vite + Tailwind CSS
  - Routage avec **React Router**
  - Contexte d'authentification basé sur **Supabase Auth**
  - Pages principales :
    - `RacesPage` : calendrier 2026
    - `RaceTicketsPage` : billets d'un Grand Prix
    - `SellPage` : mise en vente d'un billet
    - `PaymentSuccessPage` / `PaymentCancelPage`
    - `AuthLoginPage` / `AuthRegisterPage`
    - `ProfilePage` : profil, historique d'achats, validation billets
    - `AdminDashboard` : statistiques, tickets, users, signalements (ADMIN)

- **`/server`** : API NestJS + Prisma + PostgreSQL
  - **Prisma** : modèles `User`, `GrandPrix`, `Ticket`, `Transaction`, `Dispute`, `AuditLog`
  - **Supabase** : PostgreSQL + Storage bucket `tickets`
  - **Stripe** : paiements Checkout + webhooks + remboursements
  - **Sentry** : monitoring des erreurs en production (`@sentry/nestjs`)
  - **Sécurité** :
    - JWT Supabase (`JwtAuthGuard`) + `RolesGuard` (ADMIN)
    - `Helmet` (headers HTTP sécurisés)
    - CORS restreint au domaine frontend (`FRONTEND_URL`)
    - Rate limiting global (`ThrottlerModule`, 100 req/min)
    - `ValidationPipe` global (whitelist + forbidNonWhitelisted)
    - `ApiKeyGuard` pour les routes de synchronisation calendrier

---

## Prérequis

- Node.js **20+**
- npm
- **Docker Desktop** (pour l'environnement local école)
- Compte **Supabase** (base de données + storage)
- Compte **Stripe** (clé test)
- Compte **Sentry** (monitoring, gratuit)

---

## Configuration Backend (`/server`)

```bash
cd server
npm install
npx prisma generate
npx prisma db push
```

### Variables d'environnement (`server/.env`)

```env
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FRONTEND_URL=http://localhost:5173
API_KEY=
SENTRY_DSN=
NODE_ENV=development
```

---

## Environnement hybride (Docker local + Supabase)

Un `docker-compose.yml` à la racine lance une base **PostgreSQL locale** pour l'environnement école (réseau bloqué).

Scripts dans `server/package.json` :

```json
{
  "env:school": "cp .env.docker .env",
  "env:home":   "cp .env.supabase .env",
  "docker:up":  "docker-compose -f ../docker-compose.yml up -d",
  "docker:down":"docker-compose -f ../docker-compose.yml down",
  "seed:local": "npx prisma db push && npx prisma db seed"
}
```

**À l'école (réseau bloqué)**
```bash
cd server
npm run docker:up
npm run env:school
npm run seed:local
npm run start:dev
```

**À la maison (Supabase cloud)**
```bash
cd server
npm run env:home
npm run start:dev
```

---

## Configuration Frontend (`/client`)

```bash
cd client
npm install
npm run dev
```

Frontend accessible sur `http://localhost:5173`.

Variables (`client/.env`) :
```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
```

---

## Routage Frontend

| Route | Description | Auth |
|---|---|---|
| `/races` | Calendrier F1 2026 | Non |
| `/races/:id` | Billets d'un Grand Prix | Non |
| `/sell` | Vendre un billet | Oui |
| `/auth/login` | Connexion | Non |
| `/auth/register` | Inscription | Non |
| `/payment/success?session_id=...` | Confirmation Stripe | Non |
| `/payment/cancel?ticket_id=...` | Paiement annulé | Non |
| `/profile` | Profil + historique + validation billets | Oui |
| `/admin` | Tableau de bord admin | ADMIN |

---

## Paiement & Billets

- **Achat** : session Stripe Checkout avec frais de service 5%, billet en `PENDING`
- **Webhook** : à la confirmation, transaction `COMPLETED`, billet `SOLD`
- **Annulation** : billet remis en `ON_SALE`
- **Téléchargement** : bouton sur la page succès et dans le profil (bucket Supabase)

### Validation des billets (post-GP)

Après le Grand Prix, l'acheteur peut depuis son profil :
- **"Billet Valide"** → transaction marquée `VALID`, vendeur libéré
- **"Billet Non Valide"** → remboursement Stripe initié + `Dispute` créée + signalement remonté à l'admin

Si l'acheteur ne valide pas dans les **7 jours après le GP**, une tâche cron auto-valide la transaction chaque nuit à 3h00.

---

## Espace Utilisateur

- Modifier prénom / nom
- Voir l'historique des achats (ticket, Grand Prix, statut de validation)
- Valider ou contester un billet après le GP
- Télécharger son billet (PDF/image)

---

## Sécurité (OWASP Top 10)

| Mesure | Couverture |
|---|---|
| `Helmet` | Headers HTTP sécurisés (XSS, clickjacking…) |
| CORS restreint | Seul `FRONTEND_URL` est autorisé |
| `ThrottlerModule` | Rate limiting 100 req/min (brute force) |
| JWT Supabase | Expiration vérifiée, signature validée |
| `ValidationPipe` | Whitelist + transformation des DTO |
| `ApiKeyGuard` | Routes de sync calendrier protégées |
| Webhook Stripe | Signature vérifiée côté backend |
| Logs sans données sensibles | Pas d'email/token dans les logs |

---

## CI/CD & Déploiement

Deux workflows GitHub Actions :

**Backend** (`.github/workflows/deploy-backend.yml`)
1. Tests Jest (54 tests)
2. Build image Docker multi-stage
3. Push sur Google Artifact Registry
4. Déploiement sur **Google Cloud Run**

**Frontend** (`.github/workflows/deploy-frontend.yml`)
1. Build Vite
2. Déploiement via hook **Render**

Les variables sensibles sont stockées dans GitHub Secrets et injectées à la fois dans l'image et dans Cloud Run.

---

## Monitoring

**Sentry** (`@sentry/nestjs`) capture automatiquement :
- Erreurs non gérées (500)
- Exceptions HTTP (404, 403…) via `SentryGlobalFilter`
- Traces de performance (10% en production)

Configuration : variable `SENTRY_DSN` dans `.env` et sur Cloud Run.

---

## Tests

```bash
cd server
npm run test          # 54 tests unitaires
npm run test:cov      # avec couverture de code
```

Couverture des services principaux :
- `PaymentsService` : checkout, webhook, verify, cancel, validateTicket, disputeTicket
- `TicketsService` : création, liste, filtres
- `GrandPrixService` : synchronisation calendrier

---

## Structure du Projet

```text
ReRace/
├── client/
│   ├── public/circuits/      # Images des circuits
│   └── src/
│       ├── components/       # UI (Header, listes, formulaires…)
│       ├── pages/            # Pages routées
│       ├── services/         # Appels API
│       ├── contexts/         # AuthContext (Supabase)
│       └── lib/              # Axios + config API
│
├── server/
│   └── src/
│       ├── instrument.ts     # Sentry (initialisé en premier)
│       ├── auth/             # JWT Supabase, guards, roles
│       ├── grand-prix/       # Sync calendrier + cron validation
│       ├── tickets/          # Gestion des billets
│       ├── payments/         # Stripe (checkout, webhook, validation, litige)
│       ├── admin/            # Dashboard admin
│       ├── prisma/           # PrismaService
│       └── dto/              # DTO (UpdateProfile…)
│   ├── prisma/schema.prisma  # Schéma BDD
│   └── Dockerfile            # Build multi-stage NestJS
│
├── docker-compose.yml        # PostgreSQL local (mode école)
├── .github/workflows/        # CI/CD GitHub Actions
└── README.md
```

---

## Stack Technique

| Couche | Technologie |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Axios, React Router |
| Backend | NestJS, TypeScript, Prisma ORM |
| Base de données | PostgreSQL (Supabase cloud + Docker local) |
| Auth | Supabase Auth (JWT) |
| Paiement | Stripe Checkout + Webhooks |
| Storage | Supabase Storage |
| Monitoring | Sentry (@sentry/nestjs) |
| Infra | Docker, Google Cloud Run, GitHub Actions, Render |
| Tests | Jest (unitaires, 54 tests) |

---

## Licence

Projet propriétaire — **Projet de Fin d'Étude**
