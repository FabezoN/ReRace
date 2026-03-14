## ReRace - Plateforme de Revente de Billets F1

Plateforme sécurisée de **revente et achat de billets de Formule 1**, avec :

- Calendrier F1 **2026** synchronisé automatiquement depuis l’API Jolpica (`https://api.jolpi.ca/ergast/f1/2026/races`)
- Achat sécurisé via **Stripe Checkout**
- Stockage des justificatifs de billets sur **Supabase Storage**
- Espace utilisateur avec **profil** et **historique d’achats**
- Architecture **monorepo** (`client` + `server`)

---

## 🏗️ Architecture

- **`/client`** : Frontend React 19 + TypeScript + Vite + Tailwind CSS
  - Routage avec **React Router** (`/races`, `/races/:id`, `/sell`, `/auth/login`, `/auth/register`, `/payment/success`, `/payment/cancel`, `/profile`)
  - Contexte d’authentification basé sur **Supabase Auth**
  - Pages principales :
    - `RacesPage` : calendrier 2026
    - `RaceTicketsPage` : billets d’un Grand Prix
    - `SellPage` : mise en vente d’un billet
    - `PaymentSuccessPage` / `PaymentCancelPage`
    - `AuthLoginPage` / `AuthRegisterPage`
    - `ProfilePage` : profil utilisateur + historique d’achats

- **`/server`** : API NestJS + Prisma + PostgreSQL
  - **Prisma** : accès base de données (modèles `User`, `GrandPrix`, `Ticket`, `Transaction`, `AuditLog`)
  - **Supabase** :
    - PostgreSQL (mode “cloud”)
    - Storage bucket `tickets` pour les pièces jointes des billets
  - **Stripe** : paiements via Checkout + webhooks
  - **Sécurité** :
    - Authentification via **JWT Supabase** (`JwtStrategy`, `JwtAuthGuard`)
    - `ApiKeyGuard` pour certaines routes
    - `ValidationPipe` global pour valider et nettoyer les DTO

---

## 📋 Prérequis

- Node.js **20+**
- npm
- **Docker Desktop** (pour l’environnement local école)
- Compte **Supabase** (base de données + storage)
- Compte **Stripe** (clé test)

---

## ⚙️ Configuration Backend (`/server`)

Installation des dépendances :

```bash
cd server
npm install
```

Deux modes d’environnement sont prévus (fichiers non versionnés) : **Mode Supabase** (`.env.supabase`) et **Mode Docker** (`.env.docker`). Le fichier actif est `server/.env`, copié depuis l’un des deux via les scripts `env:school` / `env:home`.

### Prisma

```bash
cd server
npx prisma generate
npx prisma db push
```

Le **calendrier F1 2026** est synchronisé automatiquement au démarrage via `GrandPrixCronService` (API Jolpica).

---

## 🐳 Environnement hybride (Docker local + Supabase)

À la racine, un `docker-compose.yml` lance une base **PostgreSQL locale** :

```yaml
services:
  db:
    image: postgres:15-alpine
    container_name: rerace-local-db
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password123
      POSTGRES_DB: rerace_local
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

Dans `server/package.json`, des scripts facilitent le switch :

```json
{
  "scripts": {
    "env:school": "cp .env.docker .env && echo '🏠 Mode ÉCOLE (Docker) activé'",
    "env:home": "cp .env.supabase .env && echo '☁️ Mode MAISON (Supabase) activé'",
    "docker:up": "docker-compose -f ../docker-compose.yml up -d",
    "docker:down": "docker-compose -f ../docker-compose.yml down",
    "seed:local": "npx prisma db push && npx prisma db seed"
  }
}
```

### Utilisation recommandée

- **À l’école (réseau bloqué)**

```bash
cd server
npm run docker:up       # démarre PostgreSQL local
npm run env:school      # .env -> .env.docker
npm run seed:local      # initialise la BDD locale
npm run start:dev       # lance l'API Nest
```

- **À la maison (Supabase)**

```bash
cd server
npm run docker:down     # optionnel, arrête la BDD locale
npm run env:home        # .env -> .env.supabase
npm run start:dev
```

---

## 🌐 Configuration Frontend (`/client`)

Installation :

```bash
cd client
npm install
```

Créer un fichier `.env` dans `client/` avec les variables nécessaires à l’API et à Stripe (non versionné).

L’application se lance avec :

```bash
cd client
npm run dev
```

Frontend accessible sur `http://localhost:5173`.

---

## 🧭 Routage Frontend

Routage géré par **React Router** :

- `/races` : calendrier F1 2026
- `/races/:id` : billets d’un Grand Prix
- `/sell` : vendre un billet (protégé, nécessite connexion)
- `/auth/login` : page de connexion
- `/auth/register` : page d’inscription
- `/payment/success?session_id=...` : confirmation Stripe
- `/payment/cancel?ticket_id=...` : paiement annulé (remet le billet en vente)
- `/profile` : profil utilisateur + historique d’achats

Le header affiche :

- **Courses**
- **Mon profil** (si connecté)
- **+ Vendre un billet** (si connecté)
- Connexion / Inscription (si non connecté)

---

## 💳 Paiement & Billets

- Création de session Stripe Checkout côté backend (`/payments/create-checkout-session`)
  - Calcul des **frais de service (5%)**
  - Billet mis en statut `PENDING` pendant le paiement
- Webhook Stripe (`/payments/webhook`) :
  - En cas de succès : création d’une `Transaction` (montant, frais, total, `buyerEmail`, `buyerId` si l’email correspond à un compte existant), billet en `SOLD`
  - En cas d’annulation : endpoint `/payments/cancel` remet le billet en `ON_SALE`
- Après paiement :
  - Page **succès** `/payment/success` vérifie la session Stripe et affiche les détails du billet
  - Bouton **“Télécharger mon billet”** : télécharge l’image/pdf stocké dans le bucket Supabase `tickets`

---

## 👤 Espace Utilisateur

Modèle `User` (Prisma) :

- `email` (unique)
- `firstName` (modifiable, optionnel dans l’UI)
- `lastName` (modifiable, optionnel dans l’UI)
- `role` (`USER` ou `ADMIN`)

Endpoints :

- **GET `/profile`** : retourne `id`, `email`, `firstName`, `lastName`, `role`
- **PATCH `/profile`** : met à jour `firstName` / `lastName`
- **GET `/profile/purchases`** : retourne les transactions complétées de l’utilisateur (tickets + Grand Prix associés)

La page `/profile` permet :

- De **compléter/modifier** Prénom / Nom (non obligatoires)
- De voir **l’historique des billets achetés** + téléchargement du billet si une image est présente

---

## 📁 Structure du Projet (simplifiée)

```text
ReRace/
├── client/                   # Frontend React
│   ├── public/circuits/      # Images des circuits
│   ├── src/
│   │   ├── components/       # UI (Header, listes, formulaires...)
│   │   ├── pages/            # Pages routées (Races, Sell, Auth, Profile...)
│   │   ├── services/         # Appels API (GrandPrix, Tickets, Payments, Profile)
│   │   ├── contexts/         # AuthContext (Supabase)
│   │   └── lib/              # Axios + config API
│   └── vite.config.ts
│
├── server/                   # Backend NestJS
│   ├── src/
│   │   ├── auth/             # JWT Supabase, guards
│   │   ├── grand-prix/       # Sync calendrier, liste GP
│   │   ├── tickets/          # Gestion des billets
│   │   ├── payments/         # Stripe (Checkout + webhook)
│   │   ├── prisma/           # PrismaService
│   │   └── dto/              # DTO (UpdateProfile...)
│   ├── prisma/schema.prisma  # Schéma BDD
│   ├── Dockerfile            # Build multi-stage NestJS
│   └── README.md
│
├── docker-compose.yml        # PostgreSQL local (mode école)
├── .gitignore
└── README.md                 # Ce fichier
```

---

## 🔑 Bonnes pratiques / Sécurité

- Ne **jamais** exposer les credentials DB ou clés secrètes côté frontend
- Ne pas commiter les fichiers `.env*`
- Protéger les routes sensibles avec `JwtAuthGuard`
- Vérifier les signatures de webhook Stripe
- Configurer les **RLS / Policies** du bucket Supabase si on passe en mode privé + URLs signées

---

## 🛠️ Stack Technique

- **Frontend** : React 19, TypeScript, Vite, Tailwind CSS, Axios, React Router
- **Backend** : NestJS, TypeScript, Prisma, Stripe, Supabase (Auth + DB + Storage)
- **Base de données** : PostgreSQL (Supabase + option locale Docker)
- **Infra / Dev** : Docker, Node 20, Cron (synchronisation calendrier F1 2026)

---

## 📝 Licence

Projet propriétaire – **Projet de Fin d’Étude**
