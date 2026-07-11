# Audit Technique — Hesabi SaaS
> Date : 2026-07-01 · Stack : Next.js 16.2.4, Prisma 6.19.3, Supabase, Neon (PostgreSQL), Vercel

---

## Résumé exécutif

| Priorité | Nb | Thème |
|---|---|---|
| 🔴 CRITIQUE | 2 | Race condition crédits, bug aiExtract (corrigé) |
| 🟠 HAUT | 3 | Rate limiter in-memory, documents bloqués, pas de middleware |
| 🟡 MOYEN | 5 | N+1 templates, indexes DB manquants, cache mono-instance, upload sans rate limit, CSP unsafe-inline |
| 🟢 BAS | 4 | xlsx vulnérable, genAI dupliqué, CSP nonce, logs d'audit incomplets |

---

## 🔴 CRITIQUE

### C1 — Race condition dans le système de crédits
**Fichiers** : `app/dashboard/actions.js` (uploadToDriveAction), `app/api/upload/route.js`

**Problème** : Le check et la décrémentation des crédits ne sont pas atomiques.
```
1. Thread A : lit credits=1, OK
2. Thread B : lit credits=1, OK  ← même instant
3. Thread A : décrémente → credits=0
4. Thread B : décrémente → credits=-1  ← NÉGATIF, crédit volé
```
Un utilisateur peut ouvrir deux onglets et soumettre simultanément pour utiliser 2× plus de crédits que son quota.

**Fix recommandé** : utiliser une transaction Prisma avec `$transaction` et `decrement` conditionnel :
```js
// Option A — Prisma transaction (lecture + écriture atomique)
await prisma.$transaction(async (tx) => {
  const cabinet = await tx.cabinet.findUniqueOrThrow({
    where: { id: cabinetId },
    select: { credits: true },
  })
  if (cabinet.credits < filesCount) throw new Error('Crédits insuffisants')
  await tx.cabinet.update({
    where: { id: cabinetId },
    data: { credits: { decrement: filesCount } },
  })
})

// Option B — UPDATE conditionnel (plus performant, 1 requête)
const result = await prisma.cabinet.updateMany({
  where: { id: cabinetId, credits: { gte: filesCount } },
  data: { credits: { decrement: filesCount } },
})
if (result.count === 0) throw new Error('Crédits insuffisants')
```

---

### C2 — Bug : `createTemplateFromImageAction` retourne toujours une erreur
**Fichier** : `app/dashboard/actions.js:390` ← **DÉJÀ CORRIGÉ dans cette session**

`aiExtract()` retourne `{ content, provider }` mais le code utilisait `raw` (l'objet entier) comme string → `TypeError: raw.replace is not a function`. La création de modèle via IA était donc impossible.

**Correction appliquée** : `const { content: raw } = await aiExtract(...)`

---

## 🟠 HAUT

### H1 — Rate limiter in-memory : contournable en production
**Fichier** : `lib/rateLimiter.js`

**Problème** : Le rate limiter utilise `global.__rl_*` (Maps Node.js). Sur Vercel, chaque instance serverless a sa propre mémoire. Avec N instances en parallèle (scale out), un utilisateur peut faire N × SESSION_MAX = N × 2 requêtes sans être bloqué.

Le commentaire dans le code le reconnaît : *"Production note: replace with Redis/Upstash"*.

**Impact** : La démo peut être abusée, ce qui coûte des tokens Gemini.

**Fix** : Migrer vers Upstash Redis avec `@upstash/ratelimit` :
```js
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(2, '1 h'),
})
```

**Même problème** pour `global.__ai_cache` (cache MD5 des réponses IA) : chaque instance a son propre cache de 200 entrées, donc aucune réutilisation inter-instances.

---

### H2 — Documents bloqués en `EN_COURS_IA` en cas de timeout Vercel
**Fichier** : `app/api/worker-extraction/route.js`

**Problème** : Si le worker atteint la limite de 90s (Vercel `maxDuration`) sur un grand batch, les documents restent définitivement en statut `EN_COURS_IA`. Il n'y a aucun mécanisme de recovery.

**Scénario** : 10 documents → worker timeout après 8 docs → 2 docs stuck forever.

**Fix recommandé** :
```js
// Option A — Cron Vercel qui passe en REJETE les docs bloqués >5min
// vercel.json: { "crons": [{ "path": "/api/cron/recovery", "schedule": "*/5 * * * *" }] }

// Option B — Mettre un timestamp sur le statut EN_COURS_IA et récupérer dans le dashboard
await prisma.document.updateMany({
  where: {
    statut: 'EN_COURS_IA',
    updatedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }, // >10min
  },
  data: { statut: 'REJETE', error_message: 'Timeout serveur — relancez l\'extraction.' },
})
```

---

### H3 — Pas de middleware d'authentification
**Fichier** : `middleware.js` — **inexistant**

**Problème** : Chaque route protégée (`/dashboard/**`) appelle `supabase.auth.getUser()` individuellement. Cela fait :
- 1 appel Supabase Auth **par Server Action** et **par API Route**
- Pas de validation au edge level → une requête non authentifiée traverse tout le serveur avant d'être rejetée
- Latence inutile (50-100ms par appel Auth)

**Fix recommandé** — créer `middleware.ts` :
```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(...)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && request.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/admin/:path*'],
}
```

---

## 🟡 MOYEN

### M1 — N+1 queries dans `findMatchingTemplate`
**Fichier** : `app/api/worker-extraction/route.js:70-87`

**Problème** : Pour chaque document, la fonction lance jusqu'à 4 requêtes DB séquentielles (une par mot-clé) pour trouver le bon template.

```js
for (const kw of keywords) {           // jusqu'à 4 itérations
  const tmpl = await prisma.templateExtraction.findFirst({...}) // 1 requête par kw
  if (tmpl) return tmpl
}
```

**Fix** : une seule requête `OR` :
```js
async function findMatchingTemplate(type, cabinetId) {
  const keywords = { facture: ['facture'], releve_bancaire: ['relev', 'bancaire', 'bank'], ... }[type] ?? []
  if (!keywords.length) return null

  return prisma.templateExtraction.findFirst({
    where: {
      cabinet_id: cabinetId,
      OR: keywords.map(kw => ({ nom_modele: { contains: kw, mode: 'insensitive' } })),
    },
  })
}
```

---

### M2 — Index manquants dans le schéma Prisma
**Fichier** : `prisma/schema.prisma`

Les colonnes suivantes sont utilisées comme filtres fréquents mais n'ont pas d'index explicite :

| Modèle | Champ | Utilisé dans |
|---|---|---|
| `Utilisateur` | `cabinet_id` | Toutes les routes auth (findUnique where id, mais pas cabinet_id) |
| `Client` | `cabinet_id` | Tous les findMany/findFirst scopés au cabinet |
| `Document` | `template_id` | Worker, template update cascade |
| `Document` | `dossier_id` | Queries dossier |
| `FieldCorrection` | `user_id, document_type` | Learning loop |
| `Dossier` | `client_id` | Queries dossiers par client |
| `AdminLog` | `createdAt` | Dashboard admin (tri par date) |
| `DemoAttempt` | `email, createdAt` | Stats admin |
| `SiteVisit` | `createdAt` | Stats admin |

**Fix** — ajouter dans `schema.prisma` :
```prisma
model Client {
  @@index([cabinet_id])
}
model Document {
  @@index([template_id])
  @@index([dossier_id])
  // déjà présents : [client_id, statut] et [statut, updatedAt] ✓
}
model FieldCorrection {
  @@index([user_id, document_type])
}
model Dossier {
  @@index([client_id])
}
model AdminLog {
  @@index([createdAt(sort: Desc)])
}
```

> `Utilisateur.id` est la PK donc indexé. `cabinet_id` sur Utilisateur est rarement filtré directement (on passe toujours par `where: { id: user.id }`), donc moins urgent.

---

### M3 — Cache IA mono-instance inefficace
**Fichier** : `lib/ai.js`

Le cache MD5 de 200 entrées (`global.__ai_cache`) ne survit pas aux cold starts Vercel et n'est pas partagé entre les instances. En production avec trafic moyen, son efficacité réelle est proche de 0%.

**Fix** : soit supprimer la complexité (le cache ne sert qu'en dev), soit migrer vers Upstash Redis avec TTL :
```js
import { Redis } from '@upstash/redis'
const redis = Redis.fromEnv()

async function cacheGet(key) { return redis.get(key) }
async function cacheSet(key, value) { redis.set(key, value, { ex: 3600 }) } // 1h TTL
```

---

### M4 — Pas de rate limiting sur `/api/upload`
**Fichier** : `app/api/upload/route.js`

Un utilisateur authentifié avec des crédits restants peut bombarder le endpoint d'upload. Le check de crédits protège la facturation mais pas la bande passante Supabase (uploads de 20 Mo × N).

**Fix simple** : utiliser les crédits comme rate limit naturel (déjà en place) + ajouter un check de taille totale par session si nécessaire.

---

### M5 — CSP : `unsafe-inline` pour les scripts en production
**Fichier** : `next.config.mjs`

```js
`script-src 'self' 'unsafe-inline'`
```

`unsafe-inline` autorise tous les scripts inline, réduisant l'efficacité de la CSP contre le XSS. En production, `unsafe-eval` est retiré (bien), mais `unsafe-inline` reste.

**Fix** : utiliser des nonces CSP via Next.js middleware (disponible depuis Next.js 13.4+) :
```ts
// middleware.ts
const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
const cspHeader = `script-src 'self' 'nonce-${nonce}'`
```
Note : nécessite de retirer `'unsafe-inline'` des directives.

---

## 🟢 BAS

### B1 — `xlsx ^0.18.5` : version obsolète avec CVEs
**Fichier** : `package.json`

SheetJS `xlsx` 0.18.x est très ancienne (2022) et contient des vulnérabilités connues. La licence commerciale de SheetJS rend les mises à jour difficiles.

**Alternative recommandée** : `exceljs` (MIT, activement maintenu) :
```bash
npm remove xlsx && npm install exceljs
```
Migration limitée à `app/api/export/route.js` (~30 lignes à réécrire).

---

### B2 — Instance `GoogleGenerativeAI` dupliquée
**Fichiers** : `app/dashboard/actions.js:7` et `app/api/demo-extraction/route.js:7`

```js
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
```

Cette instance est créée deux fois dans deux modules distincts. Ce n'est pas un bug (serverless = pas d'état partagé) mais c'est incohérent avec l'architecture de `lib/ai.js` qui centralise les appels Gemini via REST API. La fonction `extractInvoiceData` dans `actions.js` utilise le SDK Gemini alors que tout le reste utilise REST direct — deux chemins de code pour la même chose.

**Recommandation** : unifier tous les appels AI dans `lib/ai.js`.

---

### B3 — Traitement séquentiel des documents dans le worker
**Fichier** : `app/api/worker-extraction/route.js`

```js
for (const docId of documentIds) {  // séquentiel
  // classify → download → extract → save
}
```

Pour 5 documents, les appels AI sont séquentiels. Avec `Promise.all` sur des batches de 2-3, on diviserait par 2-3 le temps total.

**Attention** : Gemini/OpenRouter ont des rate limits. Passer à `Promise.all` sans contrôle peut déclencher des 429. Recommandé : `Promise.all` par batch de 3 maximum.

---

### B4 — `AdminLog` : actions non loguées
**Fichier** : `lib/admin-auth.js`

Certaines actions admin dans `app/admin/admin-actions.js` n'appellent pas `logAdminAction`. Vérifier que toutes les mutations (suspend, delete, adjust quota, generate key) sont auditées.

---

## Performance — Profil général

### Latences attendues (ordre de grandeur)

| Opération | Temps estimé | Goulot |
|---|---|---|
| Auth Supabase (getUser) | 30–80ms | 1 appel par requête |
| Prisma query (Neon pooled) | 10–50ms | Connection pool |
| Classification Gemini PDF | 2–6s | Gemini API |
| Extraction Gemini PDF (facture) | 4–12s | Gemini API |
| Extraction Gemini PDF (relevé) | 8–25s | Token budget 6000 |
| Upload Supabase 5MB | 500ms–2s | Bandwidth |
| Health check `/api/health` | DB ping seul | ~20ms |

### Points chauds identifiés

1. **Pas de connection pooling configuré explicitement** — Neon fournit un pooler PgBouncer via `DATABASE_URL` (avec `?pgbouncer=true`). Vérifier que l'URL contient bien le mode pooling.
2. **`DashboardHome.jsx` (261 lignes) charge tous les documents** — pas de pagination. Avec 500+ documents par cabinet, la query peut peser.
3. **Worker traite les documents séquentiellement** (voir B3).

---

## Sécurité — Points positifs ✅

- IDOR prevention partout : toutes les queries filtrent par `cabinet_id`
- `OPENROUTER_API_KEY` jamais exposée côté client
- Magic bytes validation sur tous les uploads (PDF, images)
- Injection shield dans tous les prompts Gemini
- UUID v4 pour les chemins Supabase (pas le nom original du fichier)
- HSTS, X-Frame-Options, CSP, Referrer-Policy configurés
- `WORKER_SECRET` requis en production
- Admin email hardcodé côté serveur uniquement

---

## Checklist prioritaire

| # | Action | Effort | Impact |
|---|---|---|---|
| 1 | Fix race condition crédits (updateMany conditionnel) | 1h | Critique |
| 2 | ~~Fix bug `aiExtract` dans `createTemplateFromImageAction`~~ | ✅ Fait | Critique |
| 3 | Migrer rate limiter → Upstash Redis | 2h | Haut |
| 4 | Créer `middleware.ts` pour guard `/dashboard` | 1h | Haut |
| 5 | Cron de recovery pour docs `EN_COURS_IA` bloqués | 2h | Haut |
| 6 | Fix `findMatchingTemplate` : 1 requête OR | 30min | Moyen |
| 7 | Ajouter indexes Prisma manquants + `prisma migrate` | 1h | Moyen |
| 8 | Remplacer `xlsx` par `exceljs` | 3h | Bas/Sécurité |
| 9 | Unifier appels Gemini dans `lib/ai.js` | 2h | Bas |
| 10 | Pagination sur la liste des documents | 4h | Moyen (scale) |
