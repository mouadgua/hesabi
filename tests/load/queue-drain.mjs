#!/usr/bin/env node
/**
 * tests/load/queue-drain.mjs
 *
 * Éprouve la file d'attente d'extraction sous volume.
 *
 * Ce n'est pas un test k6 : k6 excelle à marteler un endpoint HTTP, alors que
 * la question posée ici est autre — « une file de N documents finit-elle par se
 * vider, et personne ne reste-t-il bloqué ? ». Cela demande d'ensemencer la
 * base, de déclencher le répartiteur, puis d'observer les statuts dans le
 * temps. k6 couvre la charge HTTP (voir health.js), ce script couvre le
 * comportement de la file.
 *
 * Les documents pointent volontairement vers des fichiers inexistants : chaque
 * extraction échoue immédiatement. On mesure ainsi l'ordonnancement, la
 * réservation atomique et l'auto-relance **sans consommer un seul appel IA**.
 *
 * Usage :
 *   node --env-file=.env tests/load/queue-drain.mjs [nombre] [--concurrent]
 *
 *   --concurrent : déclenche 5 répartiteurs en parallèle, pour vérifier
 *                  qu'aucun document n'est traité deux fois.
 */

import { PrismaClient } from '@prisma/client'

const COUNT      = Number(process.argv[2]) || 50
const CONCURRENT = process.argv.includes('--concurrent')
const APP_URL    = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const SECRET     = process.env.WORKER_SECRET
const PREFIX     = `loadtest-${Date.now()}-`

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_URL } } })

const ms = n => `${n.toString().padStart(5)} ms`

async function seed() {
  const u = await prisma.utilisateur.findFirst({
    where: { cabinet_id: { not: null } },
    select: { id: true, cabinet_id: true },
  })
  if (!u) throw new Error('Aucun utilisateur rattaché à un cabinet')
  const client = await prisma.client.findFirst({
    where: { cabinet_id: u.cabinet_id }, select: { id: true },
  })

  const now = Date.now()
  await prisma.document.createMany({
    data: Array.from({ length: COUNT }, (_, i) => ({
      client_id:         client.id,
      nom_fichier:       `${PREFIX}${i}.pdf`,
      chemin_storage:    `${u.cabinet_id}/inexistant-${i}.pdf`,
      statut:            'A_EXTRAIRE',
      lang:              'fr',
      queued_by_user_id: u.id,
      queued_at:         new Date(now + i),
    })),
  })
  return u.cabinet_id
}

async function counts() {
  const rows = await prisma.document.groupBy({
    by: ['statut'],
    where: { nom_fichier: { startsWith: PREFIX } },
    _count: true,
  })
  const out = { A_EXTRAIRE: 0, EN_COURS_IA: 0, A_VERIFIER: 0, REJETE: 0 }
  for (const r of rows) out[r.statut] = r._count
  return out
}

function kick() {
  return fetch(`${APP_URL}/api/worker-extraction`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-worker-secret': SECRET ?? '' },
    body:    '{}',
  }).then(r => r.json()).catch(e => ({ error: e.message }))
}

async function main() {
  console.log(`\n  File d'attente — ${COUNT} documents${CONCURRENT ? ', 5 répartiteurs simultanés' : ''}`)
  console.log(`  Cible : ${APP_URL}\n`)

  await seed()
  console.log(`  ${COUNT} documents mis en file`)

  const t0 = Date.now()
  const first = CONCURRENT
    ? await Promise.all(Array.from({ length: 5 }, kick))
    : [await kick()]

  if (CONCURRENT) {
    const servis = first.filter(r => r?.processed > 0).length
    const ecartes = first.filter(r => r?.skipped).length
    console.log(`  déclenchements  : 5 → ${servis} actif(s), ${ecartes} écarté(s) par le verrou`)
    if (servis > 1) console.log('  ⚠️  plusieurs répartiteurs actifs — le verrou n\'a pas tenu')
  } else {
    console.log(`  première réponse: ${JSON.stringify(first[0])}`)
  }

  // Observation du drainage
  console.log('\n  temps    en file  en cours  traités  rejetés')
  let stable = 0
  let last = null
  for (let i = 0; i < 60; i++) {
    const c = await counts()
    const done = c.A_VERIFIER + c.REJETE
    const line = `  ${ms(Date.now() - t0)}  ${String(c.A_EXTRAIRE).padStart(7)}  ${String(c.EN_COURS_IA).padStart(8)}  ${String(c.A_VERIFIER).padStart(7)}  ${String(c.REJETE).padStart(7)}`
    if (line !== last) { console.log(line); last = line }

    if (c.A_EXTRAIRE === 0 && c.EN_COURS_IA === 0) break
    // Détecte un blocage : plus rien ne bouge alors que la file n'est pas vide
    stable = done === (stable.done ?? -1) ? stable + 1 : 0
    await new Promise(r => setTimeout(r, 2000))
  }

  const finalCounts = await counts()
  const elapsed = Date.now() - t0
  const treated = finalCounts.A_VERIFIER + finalCounts.REJETE
  const stuck   = finalCounts.A_EXTRAIRE + finalCounts.EN_COURS_IA

  console.log('\n  ── Résultat ──────────────────────────────────────')
  console.log(`  documents traités   : ${treated} / ${COUNT}`)
  console.log(`  restés bloqués      : ${stuck}`)
  console.log(`  durée totale        : ${(elapsed / 1000).toFixed(1)} s`)
  console.log(`  débit               : ${(treated / (elapsed / 1000)).toFixed(1)} doc/s`)
  console.log(`  file entièrement drainée : ${stuck === 0 ? 'OUI' : 'NON'}`)

  const removed = await prisma.document.deleteMany({ where: { nom_fichier: { startsWith: PREFIX } } })
  console.log(`\n  nettoyage : ${removed.count} document(s) de test supprimé(s)`)

  await prisma.$disconnect()
  process.exit(stuck === 0 ? 0 : 1)
}

main().catch(async err => {
  console.error('\n  Échec :', err.message)
  await prisma.document.deleteMany({ where: { nom_fichier: { startsWith: PREFIX } } }).catch(() => {})
  await prisma.$disconnect()
  process.exit(1)
})
