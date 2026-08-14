# Tests de charge

Deux outils, parce que deux questions différentes.

| Fichier | Question posée | Outil |
|---|---|---|
| `health.js` | l'application tient-elle la concurrence HTTP ? | k6 |
| `queue-drain.mjs` | une file de N documents finit-elle par se vider, sans laisser personne bloqué ? | Node + Prisma |

k6 excelle à marteler un endpoint. Mais « la file se draine-t-elle ? » demande d'ensemencer la base, de déclencher le répartiteur, puis d'observer les statuts dans le temps — ce n'est pas ce que k6 sait faire.

---

## Lancer

```bash
# 1. Un serveur doit tourner
npm run build && npx next start -p 3100

# Charge HTTP — montée 10 → 30 → 60 utilisateurs simultanés, ~85 s
k6 run tests/load/health.js
k6 run -e BASE_URL=https://hesabi.ma tests/load/health.js

# Drainage de la file (le serveur de dev suffit ici)
node --env-file=.env tests/load/queue-drain.mjs 50
node --env-file=.env tests/load/queue-drain.mjs 30 --concurrent   # 5 répartiteurs
```

`queue-drain.mjs` sort en code 1 si un document reste bloqué — utilisable comme garde-fou.

---

## Sans risque pour les données

Les documents de test pointent vers des fichiers de stockage **inexistants** : chaque extraction échoue immédiatement. On mesure donc l'ordonnancement, la réservation atomique et l'auto-relance **sans consommer un seul appel IA**, et sans toucher aux documents réels. Le script nettoie ses documents à la fin, y compris en cas d'échec.

`health.js` ne fait que des lectures.

---

## Lire les résultats honnêtement

**Un lancement local contre la base de production dépasse les seuils, et c'est attendu.** Mesuré depuis un poste de travail vers Supabase (Paris) :

| Concurrence | Latence base p50 |
|---|---|
| 1 | 299 ms |
| 5 | 420 ms |
| 20 | 360 ms |
| 60 | **1016 ms** |

Les ~300 ms à 1 utilisateur sont de l'aller-retour réseau pur — un poste de travail n'est pas à côté de la base. Sur Vercel déployé dans la même région, ce plancher tombe à quelques millisecondes. **Les valeurs absolues d'un lancement local ne disent donc rien de la production.**

Ce qui est en revanche lisible, c'est la **dégradation relative** : stable jusqu'à 20 utilisateurs simultanés, puis ×3 à 60. C'est une mise en file d'attente sur le pool de connexions.

Les seuils sont calibrés pour un déploiement où l'application et la base sont co-localisées. Les assouplir pour qu'un lancement local passe au vert reviendrait à les rendre inutiles là où ils comptent.

### Constat à traiter

`DATABASE_URL` utilise bien le pooler pgbouncer (port 6543, `?pgbouncer=true`), mais **aucune `connection_limit` n'est fixée**. Prisma retombe alors sur `nombre_de_cœurs × 2 + 1` par instance. En serverless, chaque instance ouvre son propre pool : le nombre d'instances multiplie la charge sur le pooler, qui a lui-même un plafond de connexions clientes.

C'est un paramètre de production — non modifié ici, à décider en connaissance de cause.

---

## Résultats obtenus (2026-08-10, en local)

**File d'attente — 50 documents**
- 50/50 traités, **0 bloqué**, 56,3 s, ~0,9 doc/s
- Le rythme par lots de 8 est nettement visible, l'auto-relance fonctionne sans intervention

**Concurrence — 5 répartiteurs simultanés**
- **1 actif, 4 écartés par le verrou** — c'est exactement le comportement attendu
- File drainée intégralement, aucun document traité deux fois

**Charge HTTP — 3 623 requêtes, pic à 60 utilisateurs**
- **0 % d'échec**, 0 % de réponse dégradée
- p95 972 ms · p99 1058 ms, dont ~967 ms passés en base : le code de la route est essentiellement gratuit
