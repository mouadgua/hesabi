# HESABI — Documentation Complète

> **Hesabi** est un SaaS B2B marocain d'extraction automatique de documents comptables par IA.
> Il permet aux cabinets d'expertise comptable de numériser, extraire et vérifier les données de leurs documents (factures, relevés bancaires, bons de commande, reçus) sans saisie manuelle.

---

## C'est quoi concrètement ?

Un comptable reçoit chaque mois des centaines de factures, relevés bancaires et bons de commande de ses clients. Aujourd'hui il les saisit à la main dans son logiciel comptable. Hesabi automatise ça :

1. Il **uploade** le document (PDF ou image)
2. L'IA **lit** le document et **extrait** toutes les données utiles (montant, fournisseur, date, lignes d'article, etc.)
3. Le comptable **vérifie** et **corrige** si besoin en 1 clic
4. Il **exporte** les données en Excel/CSV pour son logiciel

L'IA apprend des corrections faites par le comptable et s'améliore au fil du temps.

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 16 App Router (React 19) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | Supabase Auth (email/password) |
| Base de données | PostgreSQL via Prisma ORM |
| Stockage fichiers | Supabase Storage |
| IA principale (PDF) | Google Gemini 2.5 Flash Lite / 2.5 Flash (direct REST) |
| IA fallback (images) | OpenRouter → Claude Haiku → GPT-4o → Qwen 2.5 VL |
| Email | Resend |
| Déploiement | Vercel |

---

## Architecture multi-tenant

```
Cabinet (accounting firm / tenant)
├── Utilisateurs (users avec rôles)
├── Clients (entreprises clientes du cabinet)
│   ├── Documents (fichiers uploadés)
│   │   └── Dossiers (classement par dossier)
│   └── Templates d'extraction (modèles IA personnalisés)
└── Crédits (quota d'extractions)
```

Un **Cabinet** = un abonnement = un espace isolé. Tous les accès sont scopés au `cabinet_id` (anti-IDOR). Les utilisateurs d'un cabinet peuvent avoir le rôle `EXPERT_COMPTABLE` ou `COLLABORATEUR`.

---

## Pages & Routes

### Pages publiques

| Route | Description |
|-------|-------------|
| `/` | Landing page avec animations GSAP, présentation produit, pricing, CTA |
| `/demo` | Demo gratuite sans compte — extraction limitée (2/heure par session) |
| `/login` | Connexion email/password (Supabase) |
| `/register` | Inscription via clé bêta uniquement |
| `/forgot-password` | Demande de reset mot de passe |
| `/reset-password` | Formulaire de nouveau mot de passe |
| `/support` | FAQ publique + contacts (WhatsApp, email) |

### Dashboard utilisateur (authentifié)

| Route | Description |
|-------|-------------|
| `/dashboard` | Accueil — stats globales (docs totaux, validés, en attente, modèles) + 5 derniers documents |
| `/dashboard/extraction` | Hub principal — upload + liste des 200 docs récents avec filtres (client, statut, type, recherche) |
| `/dashboard/models` | Gestion des templates d'extraction (créer manuellement, via Excel, ou par image) |
| `/dashboard/verification` | File de vérification — tous les docs `A_VERIFIER` à corriger |
| `/dashboard/verification/[id]` | Page détail d'un document — viewer PDF + formulaire de correction champ par champ |
| `/dashboard/settings` | Hub paramètres |
| `/dashboard/settings/profile` | Modifier nom/email |
| `/dashboard/settings/cabinet` | Infos du cabinet (nom, logo, ICE, adresse, RIB…) |
| `/dashboard/settings/billing` | Solde de crédits + statut abonnement |
| `/dashboard/support` | FAQ in-app |
| `/onboarding` | Wizard 3 étapes au premier login (Upload → IA → Modèles + préférences de champs) |

### Admin panel (accès restreint)

| Route | Description |
|-------|-------------|
| `/admin` | Dashboard global — stats totaux, répartition statuts docs, coût IA estimé, providers utilisés |
| `/admin/users` | Liste tous les cabinets — crédits, plan, statut, nb extractions. Modifier plan/crédits, suspendre, supprimer |
| `/admin/beta` | Génération + gestion des clés bêta (expiry, usage, crédits alloués, révocation) |
| `/admin/extractions` | Audit des extractions — voir les données extraites par cabinet, filtrer par type/statut |
| `/admin/ratings` | Avis et notes laissés par les utilisateurs (1-5 étoiles + commentaire) |
| `/admin/emails` | Log des soumissions du formulaire de contact |
| `/admin/logs` | Journal de toutes les actions admin (AdminLog) |
| `/admin/feedback` | Agrégation des demandes de champs manquants par utilisateurs |
| `/admin/visits` | Analytiques du site (visites, device, demo attempts) |

---

## API Routes

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /api/upload` | Auth | Upload fichier → crée Document en DB, décrémente 1 crédit, stocke dans Supabase Storage |
| `POST /api/worker-extraction` | Interne | Worker principal : classification → template matching → IA → parse JSON → stocke résultat |
| `POST /api/demo-extraction` | Public (RL) | Même que worker mais sans auth ni stockage. Rate-limité. |
| `GET /api/notifications` | Auth | 15 dernières notifications (docs A_VERIFIER / REJETE / EN_COURS) |
| `POST /api/corrections/save` | Auth | Enregistre une correction. Au 3ème correctif identique → auto-apprentissage |
| `POST /api/feedback/missing-field` | Auth | Signalement d'un champ manquant |
| `POST /api/folders` | Auth | Créer un dossier (imbrication supportée) |
| `GET /api/clients` | Auth | Lister les clients du cabinet |
| `POST /api/clients` | Auth | Créer un client |
| `POST /api/export` | Auth | Export Excel/CSV des documents sélectionnés (multi-feuilles) |
| `POST /api/export-mass` | Auth | Export massif : recap Excel + ZIP des fichiers originaux |
| `POST /api/contact` | Public (RL) | Formulaire de contact — envoie email via Resend |
| `POST /api/onboarding/complete` | Auth | Marque onboarding terminé + save préférences champs |
| `GET /api/health` | Public | Health check DB (SELECT 1 + latence) |
| `GET /api/demo-admin` | Secret header | Stats démo + état circuit breaker + cache IA |
| `PATCH /api/admin/ratings/[id]` | Admin | Marquer un avis comme lu |

---

## Fonctionnalités détaillées

### 1. Extraction IA

Le cœur du produit. Voici ce qui se passe quand un fichier est uploadé :

```
Upload
  → Validation (extension, MIME, magic bytes, taille max 20MB, crédits suffisants)
  → Stockage Supabase Storage
  → Document créé en DB (statut: A_EXTRAIRE)
  → Worker déclenché
      → Classification du type (facture / relevé bancaire / bon de commande / reçu / autre)
      → Auto-match template si confiance ≥ 0.7
      → Construction du prompt (base + préférences utilisateur + template)
      → Appel IA (Gemini PDF ou OpenRouter images)
      → Parse JSON robuste (3 stratégies)
      → Validation des données extraites
      → Stockage dans Document.donnees_extraites (JSON)
      → Statut → A_VERIFIER
```

**Types de documents supportés** :
- **Facture** : fournisseur, date, n°facture, montant HT/TVA/TTC, ICE, articles (tableau)
- **Relevé bancaire** : banque, titulaire, RIB, période, solde ouverture/clôture, lignes (tableau)
- **Bon de commande** : fournisseur, n°BC, date, total HT/TTC, articles (tableau)
- **Reçu** : émetteur, date, montant, mode de paiement, référence

**Chaîne de providers IA** :
- PDF → `gemini-2.5-flash-lite` (primaire, ~2.4s) → `gemini-2.5-flash` (fallback, ~6.4s)
- Images → `anthropic/claude-haiku-4-5` → `openai/gpt-4o` → `qwen/qwen2.5-vl-72b-instruct`

**Fiabilité** :
- Circuit breaker : après 3 échecs sur un provider → pause 5 min automatique
- Cache MD5 : même fichier + prompt → résultat depuis cache (200 entrées max)
- Budget tokens dynamique : relevés bancaires = 6 000 tokens, factures = 3 000, reçus = 1 500
- Retry automatique si le cache contient une réponse corrompue

### 2. Système de Templates

Les comptables créent des **modèles d'extraction** personnalisés pour leurs fournisseurs habituels (ex : un template "Facture Marjane" avec exactement les champs voulus).

3 façons de créer un template :
- **Manuel** : saisie des noms de champs via formulaire
- **Depuis Excel** : import d'un fichier Excel → les en-têtes de colonnes deviennent les champs
- **Depuis une image** : upload d'une image de facture → l'IA suggère automatiquement la structure

L'auto-match cherche si un template correspond par mot-clé au type de document détecté.

### 3. Boucle d'apprentissage (Learning Loop)

Quand un utilisateur corrige un champ extrait incorrectement :
1. La correction est enregistrée dans `FieldCorrection`
2. Si le même champ est corrigé **3 fois de la même façon**, il est auto-appris
3. Le champ est ajouté dans `UserFieldPreference.preferred_fields`
4. Toutes les prochaines extractions pour ce type de document incluront ce champ en priorité

Les utilisateurs peuvent aussi :
- **Exclure** des champs qu'ils ne veulent pas
- **Renommer** des champs (aliases : `montant_ttc` → `Total TTC`)
- **Signaler** un champ manquant (remonte dans l'admin pour amélioration produit)

### 4. Système de crédits

- 1 crédit = 1 extraction
- Crédits alloués à l'inscription via clé bêta (configurable par l'admin)
- L'admin peut modifier manuellement les crédits d'un cabinet
- Vérification avant chaque upload (bloqué si crédits = 0)
- Stripe prêt à être branché (champs `stripe_customer_id`, `stripe_subscription_id`, `plan_status`)

### 5. Export des données

- **Excel multi-feuilles** : une feuille principale (données scalaires) + une feuille par type de tableau (articles, lignes bancaires)
- **CSV** simple
- **Export massif** : ZIP contenant les fichiers originaux + un Excel récapitulatif
- **Sélection de colonnes** avant export
- Tout est scopé au cabinet (anti-IDOR)

### 6. Gestion multi-clients

Chaque cabinet a plusieurs **Clients** (les entreprises dont il gère la comptabilité). Les documents sont classés par client + par dossier. Support de dossiers imbriqués (comme un système de fichiers).

### 7. Demo publique

Sans créer de compte, n'importe qui peut tester l'extraction sur `/demo` :
- Upload un fichier (PDF ou image)
- Choisit les champs qu'il veut extraire
- Reçoit le JSON extrait en temps réel
- Limité à 2 extractions / heure / session + 1 / 24h / email
- L'IA utilisée est identique à la version production

### 8. Accès bêta

L'inscription est **fermée** — uniquement via clé bêta. L'admin génère des clés via le panel :
- Clés avec date d'expiration, nb d'utilisations max, crédits alloués, email cible
- Format : `HESABI-BETA-XXXXXXXX`
- Lors de l'inscription, la clé est validée → cabinet créé → crédits attribués

### 9. Sécurité

| Mesure | Implémentation |
|--------|----------------|
| Auth | Supabase sessions (cookie HTTP-only) |
| Admin | Vérification email hardcodée côté serveur sur chaque requête admin |
| IDOR | Toutes les requêtes DB scopées par `cabinet_id` |
| Injection IA | Prompt système anti-injection injecté avant chaque appel IA |
| Upload | Validation magic bytes (octets réels du fichier, pas juste l'extension) |
| XSS | Sanitisation de tous les inputs utilisateur |
| Rate limiting | Demo : 2/h/session. Contact form : 3/h/IP |
| CSP | Content-Security-Policy strict (frame-src, connect-src, script-src…) |
| HTTPS | HSTS activé (`max-age=63072000; includeSubDomains; preload`) |

### 10. Observabilité

- **Health check** `/api/health` : état DB + latence
- **AdminLog** : toutes les actions admin avec IP + timestamp
- **Circuit breaker IA** : logs console + état consultable via `/api/demo-admin`
- **Erreurs extraction** : message d'erreur stocké dans `Document.error_message`, statut `REJETE`
- **Provider tracking** : `Document.ai_provider` + `processing_ms` + `tokens_in` / `tokens_out`

---

## Modèles de données (Prisma)

```
Cabinet              → tenant principal (cabinet comptable)
  ├── Utilisateur    → users du cabinet (rôle: EXPERT_COMPTABLE | COLLABORATEUR)
  ├── Client         → clients de la firm
  │   ├── Document   → fichiers extraits (PDF / image)
  │   └── Dossier    → classement fichiers (imbrication supportée)
  └── TemplateExtraction → modèles IA personnalisés

FieldCorrection        → audit des corrections faites par utilisateur
UserFieldPreference    → préférences apprises par utilisateur × type de document
MissingFieldRequest    → demandes de champs manquants

BetaKey       → clés d'accès bêta (expiry, usage, crédits)
AdminLog      → journal des actions admin
DemoAttempt   → historique démo publique (rate limiting + analytics)
SiteVisit     → analytics visites (path, device, IP hashée)
UserRating    → avis utilisateurs (1-5 étoiles + commentaire)
```

---

## Cycle de vie d'un document

```
A_EXTRAIRE → EN_COURS_IA → A_VERIFIER → VALIDE
                        ↘             ↗
                          REJETE
```

| Statut | Signification |
|--------|---------------|
| `A_EXTRAIRE` | Uploadé, en attente de traitement |
| `EN_COURS_IA` | Worker en cours d'extraction |
| `A_VERIFIER` | Extraction réussie, attend vérification humaine |
| `VALIDE` | Vérifié et validé par le comptable |
| `REJETE` | Échec IA ou rejeté manuellement (error_message disponible) |

---

## Variables d'environnement requises

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Base de données
DATABASE_URL=
DIRECT_URL=

# IA (jamais en NEXT_PUBLIC_)
GEMINI_API_KEY=
OPENROUTER_API_KEY=

# Email
RESEND_API_KEY=

# Sécurité
WORKER_SECRET=             # header requis pour /api/worker-extraction en prod
DEMO_ADMIN_SECRET=         # header pour /api/demo-admin
IP_HASH_SALT=              # salt pour hashing IP dans rate limiter

# Stripe (optionnel, non câblé)
STRIPE_PUBLIC_KEY=
STRIPE_SECRET_KEY=
```

---

## Résumé en une phrase

> **Hesabi est un SaaS B2B marocain qui automatise la saisie comptable en extrayant par IA les données des factures, relevés bancaires et bons de commande — avec apprentissage continu des corrections, gestion multi-clients, export Excel multi-feuilles, et un panel admin complet.**
