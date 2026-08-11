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
| Index de `add_missing_indexes.sql` | ✅ **8 appliqués le 2026-08-10** (4 FK + 4 composites), tous valides — voir F4 |
| Exposition PostgREST | ✅ **Aucun grant** `anon`/`authenticated` sur les tables → base inatteignable via l'API REST Supabase (RLS désactivé sur `Document`/`Client`/`Cabinet` n'est donc **pas** exploitable) |
| Upstash Redis | ✅ `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` présents → **S10 débloqué** |
| Sentry | ✅ SDK installé et **DSN disponible** (`sentry.server.config.js`) → A1/A2 débloqués, reste le câblage |
| k6 | ✅ Installé (v2.2.0) → **T6 débloqué** |
| Variables absentes du `.env` local | `RESEND_API_KEY`, `IP_HASH_SALT`, `DEMO_ADMIN_SECRET` — fonctionnalités secondaires. `SENTRY_DSN` est facultative (DSN déjà en dur). **`NEXT_PUBLIC_APP_URL` renseignée le 2026-08-11** (`http://localhost:3000` en local) — chaîne dashboard → worker vérifiée fonctionnelle. **⚠️ À définir sur l'URL de production côté Vercel avant le lancement** |

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

### Régressions découvertes en testant (hors audit initial)

- [x] ~~**R1 — Tous les uploads renvoyaient HTTP 500**~~ — **✅ CORRIGÉ le 2026-08-10** (`hotfix/upload-crypto-createhash`)
  Deux causes cumulées, toutes deux introduites par la fonctionnalité de déduplication et **jamais détectées avant aujourd'hui** :
  1. `crypto.createHash(...)` sans import — dans un route handler Next.js, le `crypto` global est la **Web Crypto API** : elle expose `randomUUID()` (utilisé plus bas, d'où l'illusion que `crypto` était le module Node) mais **pas** `createHash`. Corrigé par `import { createHash } from 'node:crypto'`.
  2. **Client Prisma périmé** — `file_hash` était présent dans `schema.prisma` et en base, mais absent du client généré : `PrismaClientValidationError` sur la requête de déduplication. Corrigé par `prisma generate` (voir aussi F4 : rien n'automatise cette étape).
  **Pourquoi ça n'avait pas été vu** : les vérifications précédentes s'arrêtaient à `node --check` et `next build`, qui ne voient pas une erreur d'exécution. Aucun upload réel n'avait été effectué.
  **Vérifié cette fois de bout en bout** : `POST /api/upload` → **200**, crédit décrémenté (36 → 35), `file_hash` calculé (64 hex), classification aboutie (`type=facture`, `langue=fr`), document rattaché au bon cabinet. Ré-upload du même fichier → `{"duplicate":true}` : **la déduplication n'avait jamais fonctionné depuis sa fusion**. Document de test et fichier storage supprimés, crédit restitué.

### Sécurité

- [x] ~~**S1 — IDOR : modification/suppression de modèles d'un autre cabinet**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-idor-update-delete-template`)
  Les deux actions passent de `update`/`delete` par `id` nu à `updateMany`/`deleteMany` scopés `{ id, cabinet_id }`, avec contrôle du `count` retourné. Message identique (« Modèle introuvable ») que le modèle n'existe pas ou appartienne à autrui — pas de sondage possible d'identifiants entre cabinets.
  Ajout au passage : `Document.template_id` étant une FK restreinte, la suppression d'un modèle encore utilisé renvoie désormais un message explicite (« utilisé par N document(s) ») au lieu d'une erreur Prisma brute.
  **Vérifié par simulation d'attaque réelle** — cabinet témoin isolé créé en base, puis interception des requêtes Playwright pour remplacer l'identifiant de mon modèle par celui du modèle victime :
  | Attaque (payload falsifié) | Résultat |
  |---|---|
  | Modifier le modèle d'un autre cabinet | **Refusé** — « Modèle introuvable » |
  | Supprimer le modèle d'un autre cabinet | **Refusé** — « Modèle introuvable » |
  | Contrôle en base après les 2 attaques | Modèle victime **intact** : nom inchangé, `structure_json` inchangée |
  | Modifier / supprimer **mon propre** modèle | **Accepté** (2/2) — aucune régression |
  Données de test entièrement supprimées (cabinet témoin + modèles).

- [x] ~~**S2 — IDOR : écriture de modèle dans un cabinet arbitraire**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-idor-create-template`)
  `cabinet_id` est désormais résolu depuis la session (`user.id` → `Utilisateur.cabinet_id`) et **n'est plus jamais lu depuis le formulaire**, aligné sur `createTemplateFromColumnsAction` qui appliquait déjà le bon pattern.
  **Découverte pendant le correctif** : l'action était en réalité **cassée en production**. Le formulaire (`ManualCreator.jsx`) envoie `nom_modele` + `tags`, alors que l'action exigeait `cabinet_id` + `structure_json` — jamais envoyés. Elle levait donc systématiquement « Données manquantes », et la « Création Manuelle » ne fonctionnait pour personne. L'IDOR restait néanmoins exploitable en appelant la Server Action directement avec un `cabinet_id` forgé.
  Le correctif traite les deux : lecture de `tags`, normalisation des clés en snake_case (même logique que l'action voisine), `cabinet_id` côté serveur.
  **Vérifié sur l'app réelle** : création de modèle OK (2/2), persistance après rechargement, et contrôle en base — `cabinet_id` du modèle = celui de la session. `structure_json` générée correctement (`{"montant_ht":null,"date_de_facture":null}`). Modèle de test supprimé.

- [x] ~~**S3 — IDOR + vol de crédits via `uploadToDriveAction`**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-idor-upload-action`)
  **Action supprimée** plutôt que corrigée. Code mort confirmé rigoureusement : une seule occurrence dans tout le dépôt — sa propre définition, zéro appelant (`grep` sur `.js/.jsx/.ts/.tsx`, plus vérification de l'historique git). `/api/upload` est l'unique voie d'upload depuis la refonte, et porte en plus la déduplication, la validation d'intégrité et la classification précoce.
  Maintenir une seconde voie d'upload inutilisée revenait à garder une surface d'attaque et un risque de divergence. Un commentaire à son emplacement documente la suppression et sa raison.
  Vérifié : build production OK, 60/60 tests, aucune référence résiduelle.

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

- [x] ~~**S5 — Aucun rate limiting sur l'authentification**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-auth-ratelimit`)
  `lib/authRateLimit.js` — compteurs **distribués via Upstash Redis** (INCR + EXPIRE en REST, sans SDK supplémentaire), donc partagés entre instances Vercel. Repli mémoire si Redis est absent (dev, CI) ou en panne.
  Couvre `login`, `registerUser`, `sendResetEmail` et `/api/contact` — ce dernier avait déjà un compteur, mais **en mémoire** : il suffisait de retomber sur une autre instance pour repartir de zéro (mon audit initial le comptait à tort comme absent).
  **Défaut de conception corrigé grâce au test** : ma première version limitait à 10 tentatives par IP. Or un cabinet comptable sort par **une seule IP de bureau** — quelques fautes de frappe d'un employé auraient verrouillé toute la structure. Les budgets sont donc dissociés : **serré par compte** (10 / 15 min — c'est lui qui arrête le brute force), **large par IP** (60 / 15 min — n'attrape qu'un balayage massif). Une connexion réussie **efface les compteurs**, seuls les échecs s'accumulent.
  **Choix assumé : fail open.** Une panne Redis ne doit pas verrouiller les utilisateurs hors de leur compte ; l'incident est journalisé et la fenêtre de risque bornée. C'est l'inverse du cron (S4, fail closed), parce que le mode de défaillance y est la mutation massive de données, ici un déni de service à des clients légitimes.
  **Vérifié contre Upstash réel** : compteur persisté et relu entre processus. **Vérifié sur l'app** : brute-force bloqué à la 11ᵉ tentative, utilisateur légitime de la **même IP** connecté sans entrave, compte attaqué toujours protégé.
  10 tests unitaires ajoutés (`__tests__/lib/authRateLimit.test.js`) — total **70**.

- [x] ~~**S6 — Confidentialité du bucket Supabase `documents`**~~ — **✅ LEVÉ le 2026-08-10**
  Vérifié via l'API Storage : `public=false`. Trois tentatives d'accès anonyme (URL publique, chemin authentifié, clé anon seule) renvoient toutes HTTP 400, sans divulguer l'existence de l'objet. La lecture légitime passe bien par `createSignedUrl` (1 h).

### Tests

- [x] ~~**T1 — Aucun test d'isolation multi-tenant**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-tenant-isolation`)
  `__tests__/security/tenantIsolation.test.js` — plutôt que de tester quelques cas choisis, le test **balaye tout le code serveur** (~50 sites d'appel Prisma sur 8 modèles appartenant à un cabinet) et exige que chacun soit scopé.
  **Analyse à l'échelle de la fonction**, parce que le pattern sûr et majoritaire est « vérifier puis agir » : une première requête scopée confirme l'appartenance, les opérations suivantes se font par id. Une analyse appel par appel produisait 17 faux positifs sur ce pattern légitime.
  **Exceptions justifiées** (`ALLOWLIST`) : cron système, console et routes d'administration, démo publique, plan CGNC partagé. Chaque entrée doit porter sa raison — un test vérifie qu'aucune justification n'est vide.
  **Le garde-fou a été validé en réintroduisant réellement la faille S1** : suppression de modèle par id sans scope. Deux tests tombent immédiatement, en nommant fichier, ligne et fonction — `deleteTemplateAction() → prisma.templateExtraction.delete({ where: { id: templateId } })`. Fichier restauré à l'identique ensuite.
  S'y ajoutent 4 tests de non-régression ciblant précisément les failles corrigées (S1, S2, S3, S9), pour qu'elles ne puissent pas revenir discrètement.
  7 tests ajoutés — total **89**.

- [x] ~~**T2 — Le script `npm test` n'existe pas**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-npm-test`)
  Ajout de `test` (`jest`), `test:watch` et `test:coverage` dans `package.json`.
  Vérifié : `npm test` → **60/60, exit 0**. `npm run test:coverage` → **exit 1**, seuil de 70 % non atteint (lignes 45,49 % / fonctions 38,63 %) — c'est le comportement voulu, la CI du point T3 s'appuiera dessus.

- [x] ~~**T3 — Aucune CI**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-ci`)
  `.github/workflows/ci.yml` sur `push main` + toute pull request, avec annulation des exécutions obsolètes (`concurrency`).
  Job **verify** (bloquant) : `npm ci` → **`prisma generate`** → `lint` → `test` → `build`. L'étape `prisma generate` est là délibérément : sans elle, un `schema.prisma` modifié laisse un client périmé, le build passe et l'application casse à l'exécution — exactement la panne d'uploads du jour.
  Job **coverage** (informatif, `continue-on-error`) : publie le chiffre sans bloquer, le seuil de 70 % n'étant pas tenu aujourd'hui (~45 %). À repasser en bloquant une fois T1/T4 traités.
  **Deux obstacles rencontrés et levés** :
  · `next build` échoue sans variables d'environnement (`supabaseUrl is required`, évalué au chargement du module). Le workflow fournit 5 valeurs factices — vérifié qu'elles suffisent, et aucune connexion réseau n'est établie pendant le build.
  · `npm run lint` était **déjà en échec** (1 erreur) : la CI aurait été rouge dès le premier commit. L'erreur portait sur `<a href="/">` dans `app/global-error.jsx` — un faux positif, car `next/link` dépend du routeur qui peut être lui-même en panne dans cet écran. Exception documentée plutôt que « corrigée ». `coverage/` a par ailleurs été ajouté aux ignorés ESLint (artefacts générés).
  **Vérifié localement** en reproduisant les conditions CI (`.env` retiré, env factice) : `prisma generate`, `lint`, `test`, `build` — les 4 étapes OK.

### Alertes & observabilité

- [x] ~~**A1 — Sentry est un stub non fonctionnel**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-env-validation`)
  L'assistant Sentry avait posé le SDK et les configs, mais `instrumentation.js` conservait l'ancien stub et **n'importait jamais** `sentry.server.config.js` : ni le serveur ni le client ne s'initialisaient. Ajout des imports par runtime (`nodejs` / `edge`) et de l'export **`onRequestError`**, sans lequel les erreurs des route handlers App Router ne remontent pas.
  **Vérifié par sonde temporaire** (route créée, interrogée, puis supprimée) : `initialized: true`, `dsnPresent: true`, `eventId` généré, et surtout **`flushed: true`** — l'événement a réellement été transmis à Sentry, pas seulement mis en file.
  Les pages de démonstration ajoutées par l'assistant (`app/sentry-example-page/`, `app/api/sentry-example-api/`) ont été supprimées : elles n'ont pas leur place en production. Vérifié absentes du build.
  À noter : le DSN est inscrit en dur dans les configs — c'est un point d'ingestion public, pas un secret.

- [x] ~~**A2 — Aucune alerte sur le pipeline d'extraction**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-pipeline-alerts`)
  `lib/alerts.js` regroupe les alertes opérationnelles au lieu de les disperser dans le code. Quatre signaux, branchés sur les points de défaillance réels :
  | Signal | Déclencheur | Niveau |
  |---|---|---|
  | Circuit ouvert | un provider IA franchit le seuil d'échecs (`lib/ai.js`) | warning |
  | Chaîne épuisée | tous les providers ont échoué (`ALL_PROVIDERS_FAILED`, 2 emplacements) | error |
  | Documents débloqués | le cron en récupère ≥ 5 — signe que le worker n'a pas terminé | warning, error à ≥ 20 |
  | Échec d'extraction | motif inattendu (`app/api/worker-extraction`) | warning |
  **Deux choix de conception** :
  · **Anti-spam par regroupement** (5 min par clé) : un lot de 300 documents en échec produit **une** alerte, pas 300. Vérifié par test.
  · **Les échecs métier attendus sont ignorés** — « Document non reconnu », « Fichier illisible », « aucune donnée pertinente » relèvent de la qualité du document fourni par l'utilisateur, pas d'un incident de plateforme. Les noyer dans les alertes les rendrait inutilisables.
  Toutes les fonctions sont non-bloquantes : une panne d'alerting ne doit pas casser le pipeline qu'elle surveille (testé).
  **Vérifié contre le vrai Sentry** via une sonde temporaire (créée, interrogée, supprimée) : les 4 signaux partent, les 2 cas devant rester silencieux le restent, et **`flushed: true`** — transmission effective.
  **Bug attrapé au passage** : ma première version référençait `lastErr` hors de sa portée dans `lib/ai.js`. Les tests existants l'ont détecté immédiatement — corrigé par une variable dédiée à la dernière erreur de toute la chaîne.
  12 tests ajoutés (`__tests__/lib/alerts.test.js`) — total **82**.

- [ ] **A3 — Aucun monitoring de disponibilité**
  `/api/health` existe et est correct (retourne 503 si la DB tombe), mais **rien ne l'interroge**. Une panne totale reste invisible jusqu'à la plainte d'un cabinet.
  · Fichier : `app/api/health/route.js`
  · Sévérité : **bloquant** · Effort : **20 min** · **[OUTIL EXTERNE REQUIS : UptimeRobot / BetterStack / Vercel Monitoring]**

### Fiabilité opérationnelle

- [x] ~~**F1 — Aucune validation des variables d'environnement au démarrage**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-env-validation`)
  `lib/env.js` + appel depuis `instrumentation.js` (démarrage serveur, avant toute requête). Trois niveaux : **requis partout**, **requis en production seulement** (avertissement en dev, où l'app doit rester lançable en mode dégradé), et **facultatif** (la fonctionnalité concernée est simplement indisponible).
  Chaque variable est accompagnée de sa conséquence concrète, pas seulement de son nom — par ex. « `NEXT_PUBLIC_APP_URL` — sans elle les appels internes au worker pointent sur localhost ».
  **Vérifié dans les deux sens** : environnement vide en production → 8 manquantes + 9 dégradées listées explicitement ; environnement réel → **0 manquante, 5 dégradées** (`NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `IP_HASH_SALT`, `DEMO_ADMIN_SECRET`, `SENTRY_DSN`) — exactement les manques relevés pendant l'audit.

- [x] ~~**F2 — Repli silencieux du service role vers la clé anon**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-env-validation`)
  Traité dans `lib/env.js` par une ligne dédiée : si `SUPABASE_SERVICE_ROLE_KEY` manque alors que la clé anon est présente, le rapport dit explicitement que le code retomberait sur la clé publique et que les écritures storage échoueraient — au lieu de laisser apparaître, plus tard, ce qui ressemble à un problème de permissions.

- [ ] **F3 — Sauvegardes jamais vérifiées ni documentées**
  Aucune trace de stratégie de sauvegarde dans le dépôt. Neon et Supabase font des snapshots par défaut selon le plan, mais **la rétention n'est pas documentée et aucune restauration n'a jamais été testée**. `checkliste_requirements.md` liste explicitement « Test de restauration effectué et documenté (pas juste supposé fonctionner) ».
  · Sévérité : **bloquant (à vérifier)** · Effort : **1-2 h** · **[OUTIL EXTERNE REQUIS : consoles Neon + Supabase]**

- [x] ~~**F4 — Index de performance manquants + migrations sans historique**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-db-indexes`)
  **8 index appliqués en production** avec `CREATE INDEX CONCURRENTLY` (aucun verrou de table, écritures non interrompues), tous vérifiés `indisvalid AND indisready` :
  · 4 clés étrangères : `Client_cabinet_id_idx`, `Document_template_id_idx`, `Document_dossier_id_idx`, `Dossier_client_id_idx`
  · 4 composites que l'audit initial avait manqués, révélés par le nouveau script : `Document(client_id, statut)`, `Document(statut, updatedAt)`, `FieldCorrection(user_id, document_type)`, `AdminLog(createdAt DESC)`
  **Impact mesuré** — `EXPLAIN ANALYZE` sur la requête principale du dashboard (documents d'un cabinet par statut) : `Index Scan using Document_client_id_statut_idx`, exécution **0,079 ms**. Le `Seq Scan` restant sur `Client` est correct (11 lignes — Postgres préfère à raison le scan séquentiel).
  **`npm run db:check` ajouté** (`scripts/db-check.mjs`) : compare schéma attendu et base réelle sur trois axes — colonnes, index (avec validité), et **fraîcheur du client Prisma généré**. Sortie 1 en cas d'écart, donc utilisable comme garde-fou de CI.
  C'est précisément l'outil qui aurait évité la panne d'uploads du jour : il détecte à la fois une colonne absente en base et un client généré périmé, deux choses que `next build` ne voit pas.
  `prisma/add_missing_indexes.sql` réécrit pour refléter les 8 index et documenter la contrainte `CONCURRENTLY` (pas de transaction).
  **Reste hors périmètre** : la bascule vers `prisma migrate` avec historique versionné — opération à risque sur une base de production existante, à décider séparément.

---

## 🟠 IMPORTANT (à traiter rapidement après le lancement)

- [x] ~~**S7 — Validation des clés bêta incomplète et non atomique**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-betakey-feedback`)
  Le schéma portait `is_active`, `expires_at`, `max_uses`/`use_count` et `email` — **aucun n'était vérifié** : une clé révoquée, expirée, épuisée ou nominative restait utilisable par n'importe qui. Les quatre contrôles sont ajoutés, chacun avec son message distinct.
  **Consommation rendue atomique** : le contrôle et la mise à jour étaient deux requêtes séparées, donc deux inscriptions simultanées avec la même clé passaient toutes les deux. La clé est désormais réservée par un `updateMany` conditionnel unique — même parade que pour les crédits — et **relâchée** si la création du compte échoue ensuite, pour ne pas perdre une clé valide sur un email déjà pris.
  **Vérifié sur le formulaire réel** : les 5 cas de rejet (révoquée, expirée, réservée à une autre adresse, quota atteint, inexistante) refusés avec le bon message ; une clé valide aboutit toujours à l'inscription (redirection `/onboarding`).
  **Atomicité vérifiée** : 5 réservations simultanées sur une clé `max_uses: 1` → **une seule** réussit, `use_count` final = 1.
  Comptes et clés de test entièrement supprimés (Supabase Auth + base).

- [ ] **S8 — CSP autorise `'unsafe-inline'` sur les scripts**
  `script-src 'self' 'unsafe-inline'` annule une grande partie de la protection XSS de la CSP.
  · Fichier : `next.config.mjs:18`
  · Sévérité : important · Effort : **2-3 h** (migration vers nonces)

- [x] ~~**S9 — Aucune validation d'appartenance sur `document_id` du feedback**~~ — **✅ FAIT le 2026-08-10** (`feature/checklist-betakey-feedback`)
  L'identifiant est désormais vérifié comme appartenant au cabinet de l'appelant avant d'être stocké. S'il ne l'est pas, il est **ignoré** (mis à `null`) plutôt que de faire échouer la requête : c'est une donnée analytique, et perdre le retour utilisateur serait pire que perdre la référence au document.

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
| ~~4~~ | ~~S1~~ | ~~IDOR modification/suppression de modèle~~ | ~~15 min~~ | **✅ Fait 2026-08-10** |
| ~~5~~ | ~~S3~~ | ~~IDOR + crédits `uploadToDriveAction`~~ | ~~15 min~~ | **✅ Fait 2026-08-10** |
| ~~6~~ | ~~F4~~ | ~~Index manquants + procédure de migration~~ | ~~30 min~~ | **✅ Fait 2026-08-10** |
| ~~7~~ | ~~T3~~ | ~~Pipeline CI~~ | ~~45 min~~ | **✅ Fait 2026-08-10** |
| ~~8~~ | ~~F1+F2~~ | ~~Validation des variables d'env au démarrage~~ | ~~45 min~~ | **✅ Fait 2026-08-10** |
| ~~9~~ | ~~S5~~ | ~~Rate limiting sur l'authentification~~ | ~~1 h~~ | **✅ Fait 2026-08-10** |
| ~~10~~ | ~~A1~~ | ~~Sentry opérationnel~~ | ~~1 h~~ | **✅ Fait 2026-08-10** |
| ~~11~~ | ~~A2~~ | ~~Alertes pipeline d'extraction~~ | ~~2-3 h~~ | **✅ Fait 2026-08-10** |
| 12 | A3 | Sonde de disponibilité | 20 min | ⏳ à confirmer |
| ~~13~~ | ~~T1~~ | ~~Tests d'isolation multi-tenant~~ | ~~3-4 h~~ | **✅ Fait 2026-08-10** |
| 14 | F3 | Sauvegardes vérifiées et documentées | 1-2 h | ⏳ hors code |
| ~~15~~ | ~~S7~~ | ~~Durcissement des clés bêta~~ | ~~45 min~~ | **✅ Fait 2026-08-10** |
| ~~16~~ | ~~S9~~ | ~~Appartenance du `document_id` feedback~~ | ~~15 min~~ | **✅ Fait 2026-08-10** |
| 17 | S10 | Rate limiting distribué | 2-3 h | ✅ (Upstash dispo) |
| 18 | A4 | Logs structurés | 2-3 h | ✅ |
| 19 | S8 | CSP sans `unsafe-inline` | 2-3 h | ✅ |
| 20 | T5 | Tests E2E | 1 j | ✅ |
| 21 | F5 | File d'attente d'extraction (Phase 3/4) | 1-2 j | ✅ |
| 22 | T4 | Remonter la couverture à 70 % | continu | ✅ |
| 23 | T6 | Tests de charge | 1 j | ✅ (k6 installé) |
