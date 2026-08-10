# Checklist avant bêta — Hesabi

> Audit réalisé le 2026-08-10 par lecture du code réel (`app/`, `lib/`, `components/`, `prisma/`, `utils/`, `proxy.js`, `vercel.json`, `__tests__/`).
> **Chaque statut ci-dessous est vérifié contre le code, pas contre AVANCEMENT.md.**

## 🔍 Vérifications d'infrastructure — 2026-08-10

Résultats obtenus en interrogeant directement Supabase Storage et la base de production.

| Vérification | Résultat |
|---|---|
| Bucket `documents` privé | ✅ **`public=false`** — accès anonyme refusé sur 3 vecteurs (URL publique, chemin authentifié, clé anon) → **S6 levé** |
| Bucket `logos` | Public — normal, ce sont des logos affichés dans l'UI |
| Colonnes attendues par le code | ✅ Toutes présentes (`file_hash`, `document_language_detected`, `extraction_method_used`, `extraction_cost_est`, `Cabinet.extraction_method`) → les uploads ne sont **pas** cassés |
| Index de `add_missing_indexes.sql` | ⚠️ **4 manquants** : `Client_cabinet_id_idx`, `Document_template_id_idx`, `Document_dossier_id_idx`, `Dossier_client_id_idx` |
| Exposition PostgREST | ✅ **Aucun grant** `anon`/`authenticated` sur les tables → base inatteignable via l'API REST Supabase (RLS désactivé sur `Document`/`Client`/`Cabinet` n'est donc **pas** exploitable) |
| Upstash Redis | ✅ `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` présents → **S10 débloqué** |
| Sentry | ❌ **`SENTRY_DSN` absent du `.env`** → **A1 et A2 restent bloqués** |
| k6 | ✅ Installé (v2.2.0) → **T6 débloqué** |
| Variables absentes du `.env` local | `SENTRY_DSN`, `DEMO_ADMIN_SECRET`, `RESEND_API_KEY`, `IP_HASH_SALT`, `NEXT_PUBLIC_APP_URL` — à confirmer côté Vercel (voir F1) |

**Effet de bord constaté** : sans grant `authenticated` sur `Document`, l'abonnement Supabase Realtime d'`ExtractionHub.jsx:192` ne peut recevoir aucun événement. Le rafraîchissement de l'UI repose en réalité sur le polling de secours (`setInterval` 4 s). Non bloquant, mais la fonctionnalité annoncée ne fonctionne pas.

---

## ⚠️ Écarts constatés entre AVANCEMENT.md et le code réel

| Affirmation dans AVANCEMENT.md | Réalité observée |
|---|---|
| « IDOR prevention : toutes les queries filtrées par `cabinet_id` » | **Faux** — 4 actions serveur sans filtrage (voir S1–S3) |
| « Lancé avec `npm test` (Jest + ESM) » | **Faux** — le script `test` n'existe pas dans `package.json` |
| « Sécurité & hardening ✅ Complet (post-audit) » | Partiel — voir section Sécurité |

---

## 🔴 BLOQUANT AVANT BÊTA

### Sécurité

- [ ] **S1 — IDOR : modification/suppression de modèles d'un autre cabinet**
  `updateTemplateAction` (app/dashboard/actions.js:421) et `deleteTemplateAction` (:440) font `update`/`delete` par `id` **sans aucun filtrage `cabinet_id`**. Tout utilisateur authentifié peut renommer, réécrire ou supprimer les modèles d'extraction de n'importe quel cabinet.
  · Fichier : `app/dashboard/actions.js:404-442`
  · Sévérité : **bloquant** · Effort : **15 min**

- [x] ~~**S2 — IDOR : écriture de modèle dans un cabinet arbitraire**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-idor-create-template`)
  `cabinet_id` est désormais résolu depuis la session (`user.id` → `Utilisateur.cabinet_id`) et **n'est plus jamais lu depuis le formulaire**, aligné sur `createTemplateFromColumnsAction` qui appliquait déjà le bon pattern.
  **Découverte pendant le correctif** : l'action était en réalité **cassée en production**. Le formulaire (`ManualCreator.jsx`) envoie `nom_modele` + `tags`, alors que l'action exigeait `cabinet_id` + `structure_json` — jamais envoyés. Elle levait donc systématiquement « Données manquantes », et la « Création Manuelle » ne fonctionnait pour personne. L'IDOR restait néanmoins exploitable en appelant la Server Action directement avec un `cabinet_id` forgé.
  Le correctif traite les deux : lecture de `tags`, normalisation des clés en snake_case (même logique que l'action voisine), `cabinet_id` côté serveur.
  **Vérifié sur l'app réelle** : création de modèle OK (2/2), persistance après rechargement, et contrôle en base — `cabinet_id` du modèle = celui de la session. `structure_json` générée correctement (`{"montant_ht":null,"date_de_facture":null}`). Modèle de test supprimé.

- [ ] **S3 — IDOR + vol de crédits via `uploadToDriveAction`**
  `client_id` vient du formulaire, `prisma.client.findUnique({ where: { id: clientId } })` ne vérifie pas l'appartenance au cabinet. Conséquence : décrément des crédits **du cabinet victime** et dépôt de documents chez lui. Action non utilisée par l'UI actuelle mais **exportée, donc invocable directement** (les Server Actions sont adressables par ID).
  · Fichier : `app/dashboard/actions.js:12-71`
  · Sévérité : **bloquant** · Effort : **15 min** (ou suppression pure si code mort confirmé)

- [x] ~~**S4 — Cron `recovery` en fail-open**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-cron-failopen`)
  Le garde-fou échoue désormais **en fermeture**, aligné sur `worker-extraction` : secret absent en production → **503**, la route refuse de s'exécuter et journalise la raison. En développement, un avertissement explicite remplace le silence. Les deux en-têtes restent acceptés (`Authorization: Bearer` pour le cron Vercel, `x-worker-secret` pour les appels manuels).
  **Vérifié sur build de production réel** (`next start`, port 3100) :
  | Cas | Avant | Après |
  |---|---|---|
  | Prod, secret absent, sans header | *200 — exécutait* | **503** `Cron non configuré` |
  | Prod, secret absent, header quelconque | *200 — exécutait* | **503** |
  | Prod, secret présent, `Bearer` valide | 200 | **200** (non-régression) |
  | Prod, secret présent, `x-worker-secret` valide | 200 | **200** (non-régression) |
  | Prod, secret présent, secret faux | 401 | **401** |
  Test effectué à vide (0 document `EN_COURS_IA` de +10 min) — aucune donnée modifiée.

- [ ] **S5 — Aucun rate limiting sur l'authentification**
  `login`, `registerUser`, `sendResetEmail` et `/api/contact` n'ont **aucune limitation**. Brute-force sur les mots de passe, énumération de comptes, spam du formulaire de contact. Le seul rate limiter existant ne couvre que `/demo`.
  · Fichiers : `app/login/actions.js`, `app/register/actions.js`, `app/forgot-password/actions.js`, `app/api/contact/route.js`
  · Sévérité : **bloquant** · Effort : **1 h** (in-memory) — voir S10 pour la version distribuée

- [x] ~~**S6 — Confidentialité du bucket Supabase `documents`**~~ — **✅ LEVÉ le 2026-08-10**
  Vérifié via l'API Storage : `public=false`. Trois tentatives d'accès anonyme (URL publique, chemin authentifié, clé anon seule) renvoient toutes HTTP 400, sans divulguer l'existence de l'objet. La lecture légitime passe bien par `createSignedUrl` (1 h).

### Tests

- [ ] **T1 — Aucun test d'isolation multi-tenant**
  Rien dans `__tests__/` ne vérifie qu'un cabinet ne peut pas atteindre les données d'un autre. **C'est précisément ce qui a laissé passer S1, S2 et S3.** Sans ce filet, chaque nouvelle action serveur peut réintroduire une fuite.
  · Fichier : `__tests__/` (à créer)
  · Sévérité : **bloquant** · Effort : **3-4 h**

- [x] ~~**T2 — Le script `npm test` n'existe pas**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-npm-test`)
  Ajout de `test` (`jest`), `test:watch` et `test:coverage` dans `package.json`.
  Vérifié : `npm test` → **60/60, exit 0**. `npm run test:coverage` → **exit 1**, seuil de 70 % non atteint (lignes 45,49 % / fonctions 38,63 %) — c'est le comportement voulu, la CI du point T3 s'appuiera dessus.

- [ ] **T3 — Aucune CI**
  Pas de `.github/workflows/`, pas de hook pre-commit. Rien n'exécute tests, lint ou build avant un déploiement.
  · Sévérité : **bloquant** · Effort : **45 min**

### Alertes & observabilité

- [ ] **A1 — Sentry est un stub non fonctionnel**
  `instrumentation.js` retourne immédiatement si `SENTRY_DSN` est absent, et le bloc `init()` est **entièrement commenté**. `@sentry/nextjs` n'est pas installé. **Aucune erreur de production n'est capturée aujourd'hui.**
  · Fichier : `instrumentation.js:4-12`
  · Sévérité : **bloquant** · Effort : **1 h** · **[OUTIL EXTERNE REQUIS : Sentry]**

- [ ] **A2 — Aucune alerte sur le pipeline d'extraction**
  Le circuit breaker s'ouvre, `ALL_PROVIDERS_FAILED` se déclenche, le cron récupère 40 documents bloqués — tout cela finit en `console.error` que personne ne lit. Correspond aux sections 1 et 2 de `checkliste_requirements.md`, marquées bloquantes.
  · Fichiers : `lib/ai.js:235,265`, `app/api/cron/recovery/route.js:36`, `app/api/worker-extraction/route.js`
  · Sévérité : **bloquant** · Effort : **2-3 h** · **[OUTIL EXTERNE REQUIS : Sentry ou webhook Slack]**

- [ ] **A3 — Aucun monitoring de disponibilité**
  `/api/health` existe et est correct (retourne 503 si la DB tombe), mais **rien ne l'interroge**. Une panne totale reste invisible jusqu'à la plainte d'un cabinet.
  · Fichier : `app/api/health/route.js`
  · Sévérité : **bloquant** · Effort : **20 min** · **[OUTIL EXTERNE REQUIS : UptimeRobot / BetterStack / Vercel Monitoring]**

### Fiabilité opérationnelle

- [ ] **F1 — Aucune validation des variables d'environnement au démarrage**
  Aucun garde-fou : l'app démarre sans `GEMINI_API_KEY`, sans `WORKER_SECRET` (→ S4), sans `SUPABASE_SERVICE_ROLE_KEY`. Les échecs surviennent silencieusement au premier usage, en production. Correspond au point « Variable d'environnement/secret manquant au démarrage » de `checkliste_requirements.md`.
  · Fichier : `instrumentation.js` (emplacement naturel)
  · Sévérité : **bloquant** · Effort : **45 min**

- [ ] **F2 — Repli silencieux du service role vers la clé anon**
  `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY` : si la clé service role manque, le code bascule sur la clé publique **sans rien signaler**, et les opérations storage échouent de façon incompréhensible.
  · Fichiers : `app/api/upload/route.js:12`, `app/api/export-mass/route.js:10`, `app/api/worker-extraction/route.js:33`
  · Sévérité : **bloquant** · Effort : **15 min** (couvert par F1)

- [ ] **F3 — Sauvegardes jamais vérifiées ni documentées**
  Aucune trace de stratégie de sauvegarde dans le dépôt. Neon et Supabase font des snapshots par défaut selon le plan, mais **la rétention n'est pas documentée et aucune restauration n'a jamais été testée**. `checkliste_requirements.md` liste explicitement « Test de restauration effectué et documenté (pas juste supposé fonctionner) ».
  · Sévérité : **bloquant (à vérifier)** · Effort : **1-2 h** · **[OUTIL EXTERNE REQUIS : consoles Neon + Supabase]**

- [ ] **F4 — Index de performance manquants + migrations sans historique**
  ✅ Vérifié : **toutes les colonnes attendues existent** en production, les uploads ne sont donc pas cassés.
  ⚠️ Reste : **4 index de `add_missing_indexes.sql` ne sont pas appliqués** — `Client_cabinet_id_idx`, `Document_template_id_idx`, `Document_dossier_id_idx`, `Dossier_client_id_idx`. Ils portent sur les colonnes de jointure utilisées par **toutes** les requêtes filtrées par cabinet : impact direct sur les temps de réponse à mesure que les données grossissent.
  ⚠️ Reste : pas de `prisma/migrations/`, 6 fichiers `.sql` appliqués manuellement, aucun moyen de savoir quel environnement est à jour.
  · Fichiers : `prisma/add_missing_indexes.sql`, `prisma/*.sql`
  · Sévérité : **bloquant** · Effort : **30 min**

---

## 🟠 IMPORTANT (à traiter rapidement après le lancement)

- [ ] **S7 — Validation des clés bêta incomplète et non atomique**
  Le schéma `BetaKey` porte `is_active`, `expires_at`, `max_uses`, `use_count`, `email` — **le code n'en vérifie aucun**, il ne teste que `used`. De plus le check et le `update` sont séparés : deux inscriptions simultanées avec la même clé passent toutes les deux (même faille que la race condition crédits déjà corrigée ailleurs).
  · Fichier : `app/register/actions.js:32-62`
  · Sévérité : important · Effort : **45 min**

- [ ] **S8 — CSP autorise `'unsafe-inline'` sur les scripts**
  `script-src 'self' 'unsafe-inline'` annule une grande partie de la protection XSS de la CSP.
  · Fichier : `next.config.mjs:18`
  · Sévérité : important · Effort : **2-3 h** (migration vers nonces)

- [ ] **S9 — Aucune validation d'appartenance sur `document_id` du feedback**
  `missing-field` accepte n'importe quel UUID de document sans vérifier le cabinet. Donnée analytique en écriture seule, donc impact limité, mais c'est un identifiant cross-tenant stocké tel quel.
  · Fichier : `app/api/feedback/missing-field/route.js:23-35`
  · Sévérité : important · Effort : **15 min**

- [ ] **S10 — Rate limiting et circuit breaker non distribués**
  `lib/rateLimiter.js`, le rate limit admin de `proxy.js`, le circuit breaker et le cache IA de `lib/ai.js` vivent tous dans des `Map` en mémoire. Sur Vercel multi-instances, chaque instance a son propre état → limites contournables et circuit breaker inefficace.
  · Fichiers : `lib/rateLimiter.js:6-12`, `proxy.js:9`, `lib/ai.js:35-38`
  · Sévérité : important · Effort : **2-3 h** · **[OUTIL EXTERNE REQUIS : Upstash Redis]**

- [ ] **T4 — Couverture réelle 44,6 % contre un seuil de 70 %**
  `npx jest --coverage` **échoue déjà** (lignes 45,49 %, fonctions 38,63 %), mais rien n'exécute cette commande. La couverture ne mesure que `lib/` et `utils/` : `app/` (toutes les routes API et Server Actions) est à **0 %**.
  · Fichiers : `jest.config.mjs:18-22`, `__tests__/`
  · Sévérité : important · Effort : **continu**

- [ ] **T5 — Aucun test E2E**
  Aucun parcours utilisateur automatisé (inscription → upload → extraction → vérification → export). Playwright est disponible mais non intégré au dépôt.
  · Sévérité : important · Effort : **1 journée**

- [ ] **A4 — Logs non structurés**
  53 appels `console.log/error/warn` en texte libre, sans identifiant de corrélation, sans `cabinet_id`, sans niveau exploitable. Impossible de reconstituer le parcours d'un document en incident.
  · Fichiers : `app/`, `lib/` (53 occurrences)
  · Sévérité : important · Effort : **2-3 h**

- [ ] **F5 — Le worker d'extraction ne tient pas la charge (Phase 3/4 jamais réalisée)**
  `/api/worker-extraction` traite les documents dans une **boucle séquentielle unique** plafonnée à `maxDuration = 90`s. Un lot de 700 documents dépasse largement ce budget : l'invocation est tuée et les documents restants restent bloqués jusqu'au cron. Aucune file d'attente, aucun ordonnancement équitable entre cabinets, aucune limite de concurrence vis-à-vis de Gemini/Azure.
  · Fichier : `app/api/worker-extraction/route.js:37,129`
  · Sévérité : important · Effort : **1-2 jours**

---

## 🟢 PEUT ATTENDRE

- [ ] **T6 — Aucun test de charge** — comportement inconnu au-delà de quelques utilisateurs simultanés. Effort : 1 journée · **[OUTIL EXTERNE REQUIS : k6 / Artillery]**
- [ ] **A5 — `/api/demo-admin` expose un état par instance** — le circuit et le cache retournés ne reflètent qu'une seule instance Vercel, donnant une vision trompeuse. Résolu par S10. Effort : inclus dans S10.
- [ ] **S11 — `dangerouslySetInnerHTML` dans `components/ui/chart.jsx:72`** — composant shadcn standard qui injecte des variables CSS de thème, non alimenté par des données utilisateur. À ne pas modifier sans raison, mais à connaître.

---

## ✅ Points vérifiés et conformes

| Point | Preuve dans le code |
|---|---|
| Aucun secret en dur | Scan `sk-*`, `eyJ*`, `AIza*`, `service_role` sur `app/ lib/ utils/ components/ prisma/` : aucun résultat |
| `.env` non versionné | `.gitignore:34` (`.env*`) + `git ls-files` ne le remonte pas |
| Garde admin systématique | 9 actions dans `admin-actions.js`, 10 appels `requireAdmin()` + 10 `logAdminAction()` |
| Admin en défense en profondeur | `proxy.js:64-80` (middleware) **et** `lib/admin-auth.js:15` (par route) |
| Pas de fuite d'existence de `/admin` | Redirection silencieuse vers `/` (`proxy.js:79`) |
| Headers de sécurité | HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy (`next.config.mjs:6-29`) |
| Lecture des documents par URL signée | `createSignedUrl(…, 3600)` (`verification/[id]/page.jsx:52`) |
| Validation des uploads | Extension + taille + MIME + magic bytes + intégrité (`app/api/upload/route.js:45-84`) |
| Résilience providers IA | Circuit breaker par modèle + chaîne de fallback + `ALL_PROVIDERS_FAILED` (`lib/ai.js:63-75,235,265`) |
| Crédits sans race condition | `updateMany` conditionnel (`app/api/upload/route.js:136`) |
| IDOR correct sur les routes API | `clients`, `folders`, `export`, `export-mass`, `export-templates`, `notifications`, `upload`, `upload/precheck` filtrent bien par `cabinet_id` |
| Secrets hors des URLs | `/api/demo-admin` utilise l'en-tête `x-admin-secret`, pas un query param |
| `/api/health` sans fuite d'information | Statut DB + latence uniquement, aucun détail interne (`app/api/health/route.js`) |

---

## 🔑 Actions humaines préalables

> **Phase B ne peut pas démarrer sur ces points tant que la clé / l'accès n'est pas fourni.**

| Réf | Outil requis | État au 2026-08-10 |
|---|---|---|
| **A1** | **Sentry** | ❌ **`SENTRY_DSN` absent du `.env`** — si tu l'as créé côté Vercel uniquement, il me le faut aussi en local pour développer et tester l'intégration |
| **A2** | **Sentry ou Slack** | ❌ Dépend du DSN ci-dessus, ou d'une URL de webhook Slack |
| **A3** | **UptimeRobot** | ⏳ Configuré d'après toi — se paramètre côté service, pas de clé requise dans le code. À confirmer : la sonde pointe-t-elle bien sur `/api/health` ? |
| **S10** | **Upstash Redis** | ✅ **Clés présentes** — débloqué |
| **S6** | **Console Supabase** | ✅ **Vérifié par mes soins** — bucket privé, accès anonyme refusé |
| **F3** | **Consoles Neon + Supabase** | ⏳ Rétention à confirmer + restauration test à réaliser (hors code) |
| **T6** | **k6** | ✅ **Installé (v2.2.0)** — débloqué |

**Traitables immédiatement, sans dépendance externe :**
S1, S2, S3, S4, S5, S7, S8, S9 · T1, T2, T3, T4, T5 · A4 · F1, F2, F4, F5

---

## Ordre de traitement proposé

Trié par sévérité, puis par effort croissant — les gains rapides et bloquants d'abord.

| # | Réf | Point | Effort | Prêt ? |
|---|---|---|---|---|
| ~~1~~ | ~~T2~~ | ~~Script `npm test`~~ | ~~2 min~~ | **✅ Fait 2026-08-10** |
| ~~2~~ | ~~S4~~ | ~~Fail-open du cron~~ | ~~10 min~~ | **✅ Fait 2026-08-10** |
| ~~3~~ | ~~S2~~ | ~~IDOR création de modèle~~ | ~~10 min~~ | **✅ Fait 2026-08-10** |
| 4 | S1 | IDOR modification/suppression de modèle | 15 min | ✅ |
| 5 | S3 | IDOR + crédits `uploadToDriveAction` | 15 min | ✅ |
| 6 | F4 | 4 index manquants + procédure de migration | 30 min | ✅ |
| 7 | T3 | Pipeline CI | 45 min | ✅ |
| 8 | F1+F2 | Validation des variables d'env au démarrage | 45 min | ✅ |
| 9 | S5 | Rate limiting sur l'authentification | 1 h | ✅ (Upstash dispo) |
| 10 | A1 | Sentry opérationnel | 1 h | ❌ **DSN manquant** |
| 11 | A2 | Alertes pipeline d'extraction | 2-3 h | ❌ dépend de A1 |
| 12 | A3 | Sonde de disponibilité | 20 min | ⏳ à confirmer |
| 13 | T1 | Tests d'isolation multi-tenant | 3-4 h | ✅ |
| 14 | F3 | Sauvegardes vérifiées et documentées | 1-2 h | ⏳ hors code |
| 15 | S7 | Durcissement des clés bêta | 45 min | ✅ |
| 16 | S9 | Appartenance du `document_id` feedback | 15 min | ✅ |
| 17 | S10 | Rate limiting distribué | 2-3 h | ✅ (Upstash dispo) |
| 18 | A4 | Logs structurés | 2-3 h | ✅ |
| 19 | S8 | CSP sans `unsafe-inline` | 2-3 h | ✅ |
| 20 | T5 | Tests E2E | 1 j | ✅ |
| 21 | F5 | File d'attente d'extraction (Phase 3/4) | 1-2 j | ✅ |
| 22 | T4 | Remonter la couverture à 70 % | continu | ✅ |
| 23 | T6 | Tests de charge | 1 j | ✅ (k6 installé) |
