/**
 * lib/redis.js
 *
 * Accès minimal à Upstash Redis via son API REST.
 *
 * Pas de SDK : ce dont l'application a besoin tient en quelques commandes
 * (INCR, EXPIRE, GET, SET, DEL, TTL) et une dépendance de plus se paierait en
 * poids de bundle pour un gain nul.
 *
 * `isRedisConfigured()` permet à chaque appelant de choisir sa stratégie de
 * repli plutôt que d'en imposer une : le rate limiter accepte de dégrader en
 * mémoire, le circuit breaker aussi, mais pour des raisons différentes.
 */

const URL   = process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

export function isRedisConfigured() {
  return Boolean(URL && TOKEN)
}

/**
 * Exécute une commande Redis. Lève en cas d'échec réseau ou HTTP — c'est à
 * l'appelant de décider si l'indisponibilité est fatale ou non.
 *
 * @param {Array<string|number>} command  ex. ['INCR', 'ma:cle']
 * @param {{ timeoutMs?: number }} [opts]
 */
export async function redisCommand(command, { timeoutMs = 3000 } = {}) {
  if (!isRedisConfigured()) throw new Error('Upstash non configuré')

  // Un Redis lent ne doit jamais retarder une extraction : au-delà du délai,
  // on abandonne et l'appelant retombe sur son comportement dégradé.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(URL, {
      method:  'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(command),
      cache:   'no-store',
      signal:  controller.signal,
    })
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)
    const { result } = await res.json()
    return result
  } finally {
    clearTimeout(timer)
  }
}

/** Plusieurs commandes en un aller-retour. */
export async function redisPipeline(commands, { timeoutMs = 3000 } = {}) {
  if (!isRedisConfigured()) throw new Error('Upstash non configuré')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${URL}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(commands),
      cache:   'no-store',
      signal:  controller.signal,
    })
    if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)
    const rows = await res.json()
    return rows.map(r => r.result)
  } finally {
    clearTimeout(timer)
  }
}
