# Avancement — Hesabi SaaS
> Dernière mise à jour : 2026-07-03 · Stack : Next.js 16.2.4 / Prisma 6.19.3 / Supabase / Neon / Vercel

---

## Vue d'ensemble

| Domaine | État |
|---|---|
| Auth & onboarding | ✅ Complet |
| File manager (upload, dossiers, recherche) | ✅ Complet |
| Pipeline extraction IA | ✅ Complet |
| Vérification & correction des données | ✅ Complet |
| Learning loop | ✅ Complet |
| Export (Excel / CSV) | ✅ Complet (lang wirable) |
| Export masse (ZIP) | ✅ Complet |
| Page démo publique | ✅ Complet |
| Dashboard admin | ✅ Complet |
| Gestion des modèles d'extraction | ✅ Complet |
| Sécurité & hardening | ✅ Complet (post-audit) |
| Système de crédits | ✅ Corrigé (race condition fixée) |
| Abonnement / Stripe | 🔴 Non démarré |
| Rate limiter distribué (Redis) | 🟡 À faire |
| Pagination documents | 🟡 À faire |

---

## ✅ Terminé

### Auth & accès
- Inscription avec clé bêta obligatoire (`/register`) — validation côté serveur
- Connexion Supabase Auth, reset password, callback OAuth
- Onboarding guidé post-inscription (`/onboarding`)
- Middleware d'authentification edge (`middleware.js`) — protège `/dashboard/**` et `/api/admin/**`

### File manager
- Upload multi-fichiers (PDF, JPG, PNG, WEBP, HEIC — max 20 Mo)
- Validation magic bytes côté serveur (anti-spoofing)
- Organisation par clients + dossiers (drag-and-drop, renommage)
- Recherche temps réel dans la liste des documents
- Filtres par statut (En attente / En cours / À vérifier / Validé / Rejeté)
- Raccourcis clavier (sélection, extraction, suppression)
- Badge de notification en sidebar (documents en attente par client)
- NProgress entre les navigations

### Pipeline IA
- Classification automatique du document (facture / relevé / bon commande / reçu)
- Matching automatique template → type de document détecté
- Extraction Gemini 2.5 Flash Lite (PDF via REST v1beta) → fallback Flash
- Fallback OpenRouter : Claude Haiku → GPT-4o → Gemini Flash 1.5 → Qwen 2.5
- Circuit breaker par provider (3 échecs → 5 min de pause)
- Cache MD5 des réponses IA (200 entrées, en mémoire)
- Protection anti-injection dans tous les prompts
- Token budget adaptatif par type de document (1500 → 6000 tokens)
- Extraction séquentielle des documents (worker dédié `/api/worker-extraction`)
- Retry automatique en cas de réponse JSON invalide depuis le cache
- Sélection FR / EN pour l'extraction et l'export (toggle dans l'UI)

### Vérification & données
- Page de vérification par document (`/dashboard/verification/[id]`)
- Formulaire d'édition des données extraites
- Validation → statut VALIDE + redirect
- Re-extraction unitaire depuis la page de vérification
- Feedback "champ manquant" (stocké en DB pour analyse)

### Learning loop
- Corrections utilisateur enregistrées (`FieldCorrection`)
- Au bout de 3 corrections identiques → création d'une préférence (`UserFieldPreference`)
- Les préférences sont injectées dans le prompt d'extraction suivant

### Export
- Export Excel (`.xlsx`) et CSV depuis la sélection de documents
- Sélection des colonnes à exporter via modale
- Détection intelligente des lignes détaillées → onglet séparé Excel
- Traduction des labels FR/EN dans les headers Excel
- Export masse ZIP (recapitulatif Excel + fichiers originaux)
- Route `/api/export` et `/api/export-mass` — filtrées par `cabinet_id` (IDOR-safe)

### Page démo
- `/demo` : extraction gratuite sans compte (PDF, images)
- Rate limiter : 2 tentatives / session / heure + cooldown 24h par email
- Validation email, MIME type, magic bytes, taille
- Sélection des champs à extraire
- Persistance des tentatives en DB (`DemoAttempt`)

### Modèles d'extraction (Templates)
- Création manuelle d'un template (champs en snake_case)
- Création via IA à partir d'une image de document
- Import depuis colonnes Excel (feature learning loop)
- Modification et suppression de templates
- Duplication d'un template existant

### Abonnement & crédits
- Système de crédits : 1 upload = 1 crédit déduit
- Vérification atomique (updateMany conditionnel — race condition fixée)
- Remboursement automatique si l'upload Supabase échoue
- Page `/dashboard/settings/billing` — affichage des crédits restants, plan bêta
- Admin peut ajuster les crédits par cabinet

### Admin
- Dashboard `/admin` avec stats : cabinets, extractions, démo, tokens IA, coûts estimés
- Page utilisateurs : suspension, réactivation, changement de plan, suppression, ajustement crédits
- Page beta : génération de clés, révocation, édition des crédits par clé
- Page extractions : liste de toutes les extractions + filtres
- Page emails : historique Resend
- Page logs : audit trail de toutes les actions admin (`AdminLog`)
- Page ratings : avis utilisateurs avec lecture/archivage
- Page feedback : champs demandés manquants (`MissingFieldRequest`)
- Page visites : trafic site (`SiteVisit`)
- Route `/api/demo-admin` : stats démo en temps réel
- Toutes les actions admin loguées (`logAdminAction`)

### Sécurité (post-audit)
- IDOR prevention : toutes les queries filtrées par `cabinet_id`
- `OPENROUTER_API_KEY` jamais exposée côté client
- Injection shield dans tous les prompts Gemini / OpenRouter
- UUID v4 pour les noms de fichiers Supabase (nom original jamais dans le path)
- HSTS, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy
- `WORKER_SECRET` obligatoire en production
- Email admin hardcodé côté serveur uniquement
- Middleware edge pour redirect unauthenticated

### Infrastructure (post-audit)
- Cron recovery `/api/cron/recovery` (toutes les 5 min) — passe les documents bloqués en `EN_COURS_IA` depuis +10 min en `REJETE`
- `vercel.json` avec cron configuré
- Fix race condition crédits : `updateMany({ where: { credits: { gte: N } } })`
- Fix N+1 dans `findMatchingTemplate` : 1 requête OR au lieu de 4 séquentielles
- Fix bug `createTemplateFromImageAction` : mauvais destructuring de `aiExtract()`
- 6 nouveaux index Prisma (schema mis à jour — SQL dans `prisma/add_missing_indexes.sql`)

---

## 🟡 En cours / À faire

### 🔴 Urgent

#### Indexes DB (SQL à exécuter sur Supabase)
**Fichier prêt** : `prisma/add_missing_indexes.sql`
Action : coller dans le **SQL Editor Supabase** → `https://supabase.com/dashboard`
```
Client.cabinet_id · Document.template_id · Document.dossier_id
FieldCorrection.[user_id, document_type] · Dossier.client_id · AdminLog.createdAt
```

### 🟠 Haut impact

#### Rate limiter distribué (Redis / Upstash)
**Problème** : `lib/rateLimiter.js` et `global.__ai_cache` dans `lib/ai.js` sont en mémoire Node.js. Sur Vercel multi-instances, chaque instance a son propre état → rate limit contournable.

**À faire** :
1. Créer un KV Upstash sur le dashboard Vercel
2. Installer `@upstash/ratelimit` + `@upstash/redis`
3. Réécrire `lib/rateLimiter.js` avec `Ratelimit.slidingWindow`
4. Remplacer le cache MD5 dans `lib/ai.js` par `redis.get/set` avec TTL 1h
5. Ajouter `UPSTASH_REDIS_REST_URL` et `UPSTASH_REDIS_REST_TOKEN` dans Vercel env

#### Sélecteur de langue dans l'export modal
**Problème** : L'API `/api/export` supporte le paramètre `lang` (FR/EN), mais le composant `components/export-modal.jsx` n'a pas de toggle — l'export est toujours en français.

**À faire** : ajouter un toggle FR/EN dans `ExportModal` (même pattern que dans `ExtractionHub.jsx`) et une `<input type="hidden" name="lang" value={lang} />` dans le `<form>`.

### 🟡 Moyen terme

#### Pagination de la liste des documents
**Problème** : `DashboardHome.jsx` et les pages extraction chargent tous les documents sans limite. À 500+ docs, les requêtes et le rendu deviennent lourds.

**À faire** : cursor-based pagination Prisma (`take: 25` + `cursor`) + bouton "Charger plus" dans l'UI.

#### Migration `xlsx` → `exceljs`
**Problème** : `xlsx ^0.18.5` est ancienne (2022), CVEs connues, licence commerciale.

**À faire** :
```bash
npm remove xlsx && npm install exceljs
```
Réécrire `app/api/export/route.js` et `app/api/export-mass/route.js` avec l'API exceljs.

#### Unification des appels Gemini
**Problème** : `GoogleGenerativeAI` est instancié séparément dans `app/dashboard/actions.js` (fonction `extractInvoiceData`) et `app/api/demo-extraction/route.js`. Le reste du projet passe par `lib/ai.js` (REST direct).

**À faire** : migrer ces deux usages SDK vers `lib/ai.js`.

### 🔴 Non démarré

#### Stripe / Paiement
La page `/dashboard/settings/billing` affiche un bouton "Gérer l'abonnement" désactivé avec tooltip "Disponible après la bêta". Le schéma Prisma a déjà `stripe_customer_id` et `stripe_subscription_id` sur `Cabinet`.

**À faire (post-bêta)** :
- Configurer Stripe (produits, prix, webhooks)
- Portail client Stripe pour gestion de l'abonnement
- Gestion des plans (TRIAL → PRO → etc.)
- Webhook Stripe pour mise à jour des crédits / statut plan

---

## 📁 Carte des fichiers

```
app/
├── (public)
│   ├── page.js              Landing page
│   ├── demo/page.jsx         Page démo publique
│   ├── login/               Auth login
│   ├── register/            Inscription + beta key
│   ├── forgot-password/     Reset password
│   ├── reset-password/      Nouveau mot de passe
│   ├── onboarding/          Post-inscription wizard
│   └── support/             Page support publique
│
├── dashboard/
│   ├── page.jsx             Home (stats cabinet)
│   ├── DashboardHome.jsx    Composant principal dashboard
│   ├── actions.js           Server Actions (upload, extract, validate, templates)
│   ├── extraction/          File manager + hub d'extraction
│   ├── verification/[id]/   Page vérification document
│   ├── models/              Gestion des templates
│   └── settings/
│       ├── profile/         Profil utilisateur
│       ├── cabinet/         Infos cabinet (ICE, RIB, adresse…)
│       └── billing/         Crédits + plan (Stripe à venir)
│
├── admin/
│   ├── page.jsx             Dashboard overview avec stats
│   ├── admin-actions.js     Server Actions admin (suspend, plan, credits, beta)
│   ├── users/               Gestion cabinets/utilisateurs
│   ├── beta/                Gestion clés bêta
│   ├── extractions/         Historique global extractions
│   ├── emails/              Historique emails Resend
│   ├── logs/                Audit log admin
│   ├── ratings/             Avis utilisateurs
│   ├── feedback/            Champs manquants demandés
│   └── visits/              Visites site
│
└── api/
    ├── health/              Ping DB (monitoring)
    ├── upload/              Upload fichier → Supabase + DB
    ├── worker-extraction/   Pipeline IA (classif + extraction)
    ├── export/              Export Excel/CSV
    ├── export-mass/         Export ZIP (Excel + originaux)
    ├── clients/             CRUD clients
    ├── folders/             CRUD dossiers
    ├── corrections/save/    Save field correction
    ├── feedback/missing-field/ Champ manquant
    ├── notifications/       Notifications dashboard
    ├── contact/             Formulaire de contact
    ├── demo-extraction/     Extraction publique (démo)
    ├── demo-admin/          Stats démo pour admin
    ├── onboarding/complete/ Finalisation onboarding
    └── cron/recovery/       ✅ Recovery docs bloqués (nouveau)

lib/
├── ai.js                    Pipeline IA (Gemini + OpenRouter + circuit breaker + cache)
├── prisma.js                Singleton Prisma
├── rateLimiter.js           Rate limiter démo (in-memory — à migrer Redis)
├── sanitize.js              Validation inputs (email, MIME, magic bytes)
└── admin-auth.js            Guard admin + logAdminAction

utils/
└── buildExtractionPrompt.js  Construction du prompt (templates + learning loop + lang)

components/
├── app-sidebar.jsx          Sidebar dashboard
├── export-modal.jsx         Modale export (lang non branché)
├── keyboard-shortcuts.jsx   Raccourcis clavier
├── notification-dropdown.jsx Notifications
├── quality-survey.jsx       Enquête satisfaction
├── first-visit-hint.jsx     Hint première visite
├── FirstExtractionWizard.jsx Wizard première extraction
└── ui/                      Composants Shadcn/UI

prisma/
├── schema.prisma            13 modèles — indexes ajoutés (migration SQL à appliquer)
└── add_missing_indexes.sql  ✅ SQL prêt pour Supabase dashboard
```

---

## 🧪 Tests

```
__tests__/
├── lib/ai.test.js           Tests unitaires pipeline IA
├── lib/rateLimiter.test.js  Tests rate limiter
└── lib/sanitize.test.js     Tests validation inputs
```

Lancé avec `npm test` (Jest + ESM).

---

## Variables d'environnement requises

| Var | Usage |
|---|---|
| `DATABASE_URL` | URL pooler Neon (queries Prisma) |
| `DIRECT_URL` | URL directe Neon (migrations Prisma) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Upload côté serveur |
| `GEMINI_API_KEY` | Extraction PDF (Gemini 2.5) |
| `OPENROUTER_API_KEY` | Fallback images (Claude / GPT / Qwen) |
| `WORKER_SECRET` | Auth interne worker + cron |
| `NEXT_PUBLIC_APP_URL` | URL app (pour les fetch internes) |
| `RESEND_API_KEY` | Envoi d'emails |
| `IP_HASH_SALT` | Hachage des IPs démo |
| `UPSTASH_REDIS_REST_URL` | 🟡 À configurer (rate limiter Redis) |
| `UPSTASH_REDIS_REST_TOKEN` | 🟡 À configurer (rate limiter Redis) |

---

## Prochaines actions prioritaires

| # | Action | Effort | Prérequis |
|---|---|---|---|
| 1 | Exécuter `prisma/add_missing_indexes.sql` sur Supabase | 5 min | — |
| 2 | Configurer Upstash Redis + migrer rate limiter | 2h | Compte Upstash |
| 3 | Ajouter toggle FR/EN dans `export-modal.jsx` | 30 min | — |
| 4 | Pagination documents (`take: 25` + cursor) | 4h | — |
| 5 | Migration `xlsx` → `exceljs` | 3h | — |
| 6 | Intégration Stripe (post-bêta) | 2 jours | Compte Stripe |
