/**
 * lib/logger.js
 *
 * Journalisation structurée pour le pipeline d'extraction.
 *
 * Le problème que ça résout : 70 appels `console.*` en texte libre, sans rien
 * qui relie les lignes entre elles. Quand un cabinet signale « mon document n'a
 * pas été traité », il fallait deviner lesquelles des lignes de log lui
 * appartenaient. Avec un identifiant de corrélation, on filtre sur le document
 * et on obtient son parcours complet — classification, provider retenu, durée,
 * cause de l'échec.
 *
 * Le contexte circule via `AsyncLocalStorage` plutôt qu'en paramètre : le faire
 * traverser `aiExtract` → `extractDocument` → `callOpenRouter` aurait imposé un
 * argument supplémentaire à toute la chaîne, pour une donnée que seul le
 * journal utilise.
 *
 * En production : une ligne JSON par événement, que Vercel indexe. En
 * développement : sortie lisible, le JSON étant illisible à l'œil.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'

const store = new AsyncLocalStorage()

const isProd = process.env.NODE_ENV === 'production'

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 }
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? (isProd ? LEVELS.info : LEVELS.debug)

/**
 * Exécute `fn` avec un contexte de journalisation attaché. Tout log émis
 * pendant l'exécution — y compris dans les fonctions appelées — le porte.
 *
 * @param {object} context  ex. { documentId, cabinetId }
 */
export function withLogContext(context, fn) {
  const parent = store.getStore()
  return store.run(
    { correlationId: parent?.correlationId ?? randomUUID(), ...parent, ...context },
    fn
  )
}

/** Identifiant de corrélation courant, s'il y en a un. */
export function currentCorrelationId() {
  return store.getStore()?.correlationId ?? null
}

function emit(level, message, data) {
  if (LEVELS[level] < MIN_LEVEL) return

  const context = store.getStore() ?? {}
  const entry = {
    ts:    new Date().toISOString(),
    level,
    msg:   message,
    ...context,
    ...data,
  }

  // console.* reste l'unique sortie : Vercel capture stdout/stderr, et un
  // transport dédié ajouterait une dépendance pour aucun gain ici.
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log

  if (isProd) {
    sink(JSON.stringify(entry))
    return
  }

  // Développement : lisible d'un coup d'œil, contexte en fin de ligne.
  const { ts, level: _l, msg, correlationId, ...rest } = entry
  const short = correlationId ? correlationId.slice(0, 8) : '--------'
  const extras = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : ''
  sink(`[${level.toUpperCase()}] [${short}] ${msg}${extras}`)
}

export const logger = {
  debug: (msg, data) => emit('debug', msg, data),
  info:  (msg, data) => emit('info',  msg, data),
  warn:  (msg, data) => emit('warn',  msg, data),
  error: (msg, data) => emit('error', msg, data),

  /**
   * Journalise une erreur en aplatissant son message et son type — un objet
   * Error sérialisé en JSON donne `{}`, ce qui est le piège classique.
   */
  exception: (msg, err, data) => emit('error', msg, {
    ...data,
    error:     err?.message ?? String(err),
    errorType: err?.name ?? 'Error',
  }),
}
