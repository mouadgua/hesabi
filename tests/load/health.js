/**
 * Test de charge — sonde de disponibilité.
 *
 * `/api/health` fait un aller-retour vers la base à chaque appel. C'est donc,
 * malgré son apparente simplicité, un révélateur direct de la santé du pool de
 * connexions : si Prisma sature, ça se voit ici avant de se voir ailleurs.
 *
 * Aucune écriture — sans risque sur les données.
 *
 * Usage :
 *   k6 run tests/load/health.js
 *   k6 run -e BASE_URL=https://hesabi.ma tests/load/health.js
 */

import http from 'k6/http'
import { check } from 'k6'
import { Trend, Rate } from 'k6/metrics'

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3100'

const dbLatency = new Trend('db_latency_ms')
const degraded  = new Rate('reponses_degradees')

export const options = {
  // p(99) n'est pas calculé par défaut — sans cette ligne il remonte à 0,
  // ce qui donne l'illusion d'une latence nulle en queue de distribution.
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],

  stages: [
    { duration: '20s', target: 10 },   // montée progressive
    { duration: '30s', target: 30 },   // palier
    { duration: '20s', target: 60 },   // pic
    { duration: '15s', target: 0 },    // redescente
  ],
  thresholds: {
    // Seuils volontairement stricts : cette route ne fait qu'un SELECT 1.
    // Si elle dépasse ces valeurs, le problème est dans la base ou le pool,
    // pas dans le code de la route.
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    db_latency_ms:     ['p(95)<500'],
    reponses_degradees: ['rate<0.01'],
  },
}

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, { tags: { name: 'health' } })

  check(res, {
    'statut 200':            r => r.status === 200,
    'base joignable':        r => r.json('db') === 'ok',
    'latence DB renseignée': r => typeof r.json('db_ms') === 'number',
  })

  const body = res.json()
  if (body?.db_ms != null) dbLatency.add(body.db_ms)
  degraded.add(body?.status !== 'ok')
}

export function handleSummary(data) {
  const m = data.metrics
  const p = (name, stat = 'p(95)') => Math.round(m[name]?.values?.[stat] ?? 0)

  const lignes = [
    '',
    '  ── Sonde de disponibilité ─────────────────────────────',
    `  requêtes            : ${m.http_reqs?.values?.count ?? 0}`,
    `  échecs              : ${((m.http_req_failed?.values?.rate ?? 0) * 100).toFixed(2)} %`,
    `  latence p95         : ${p('http_req_duration')} ms`,
    `  latence p99         : ${p('http_req_duration', 'p(99)')} ms`,
    `  latence base p95    : ${p('db_latency_ms')} ms`,
    `  réponses dégradées  : ${((m.reponses_degradees?.values?.rate ?? 0) * 100).toFixed(2)} %`,
    '',
  ]
  return {
    stdout: lignes.join('\n'),
    'tests/load/results/health.json': JSON.stringify(data, null, 2),
  }
}
