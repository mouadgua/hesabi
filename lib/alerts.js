/**
 * lib/alerts.js
 *
 * Sends operational alerts to Sentry for the events that matter but aren't
 * exceptions: a provider circuit opening, the whole fallback chain running dry,
 * the recovery cron sweeping up an unusual number of documents.
 *
 * These already produced console.error lines, which nobody reads. The point
 * here is to make them reach the same place as crashes, with enough context to
 * act on, and without paging anyone over a single transient failure.
 *
 * Every function is non-throwing: an alerting problem must never take down the
 * pipeline it is watching.
 */

import * as Sentry from '@sentry/nextjs'

/** Deduplication window per alert key — avoids 300 identical events in a batch. */
const THROTTLE_MS = 5 * 60 * 1000
if (!global.__alertThrottle) global.__alertThrottle = new Map()
const throttle = global.__alertThrottle

function shouldSend(key) {
  const now  = Date.now()
  const last = throttle.get(key)
  if (last && now - last < THROTTLE_MS) return false
  throttle.set(key, now)
  // Keep the map from growing without bound on a long-lived instance.
  if (throttle.size > 200) {
    for (const [k, t] of throttle) if (now - t > THROTTLE_MS) throttle.delete(k)
  }
  return true
}

function send({ key, level, message, context, tags }) {
  try {
    if (!shouldSend(key)) return false
    Sentry.withScope(scope => {
      scope.setLevel(level)
      scope.setTag('alert', key.split(':')[0])
      for (const [k, v] of Object.entries(tags ?? {})) scope.setTag(k, String(v))
      if (context) scope.setContext('détail', context)
      // Grouped by message so Sentry aggregates occurrences instead of
      // creating a fresh issue for every document id.
      Sentry.captureMessage(message, level)
    })
    return true
  } catch (err) {
    console.error('[alerts] Envoi impossible :', err.message)
    return false
  }
}

/**
 * A provider's circuit just opened: that provider is failing repeatedly and is
 * now being skipped. Usually means an upstream incident, not a bug here.
 */
export function alertCircuitOpened(model, { failures, lastError } = {}) {
  return send({
    key:     `circuit-open:${model}`,
    level:   'warning',
    message: `Circuit breaker ouvert sur le provider IA « ${model} »`,
    tags:    { provider: model },
    context: { model, failures, lastError: lastError?.slice(0, 300) },
  })
}

/**
 * Every provider in the fallback chain failed for one document. No extraction
 * is possible right now — this is the one that warrants immediate attention.
 */
export function alertAllProvidersFailed({ documentId, cabinetId, lastError } = {}) {
  return send({
    // Keyed without the document id so a 300-document batch produces one alert,
    // not 300.
    key:     'all-providers-failed',
    level:   'error',
    message: 'Chaîne de providers IA épuisée — aucune extraction possible',
    tags:    { cabinet: cabinetId ?? 'inconnu' },
    context: { documentId, cabinetId, lastError: lastError?.slice(0, 300) },
  })
}

/**
 * The recovery cron released documents stuck in EN_COURS_IA. A couple is the
 * safety net doing its job; a batch means something upstream is wrong —
 * a worker dying mid-run, or the 90 s invocation ceiling being hit.
 */
export function alertStuckDocumentsRecovered(count, { threshold = 5 } = {}) {
  if (count < threshold) return false
  return send({
    key:     'stuck-recovered',
    level:   count >= 20 ? 'error' : 'warning',
    message: `${count} document(s) bloqués récupérés par le cron — le worker n'a pas terminé`,
    tags:    { count: String(count) },
    context: { count, threshold, piste: 'worker interrompu, ou plafond de 90 s atteint sur un gros lot' },
  })
}

/**
 * A document failed extraction for a reason worth knowing about. Skips the
 * expected business outcomes (unreadable file, unrecognised document) so the
 * signal stays about the platform, not about user input quality.
 */
const EXPECTED_FAILURES = [
  'Document non reconnu',
  'Fichier illisible',
  "L'IA n'a trouvé aucune donnée",
]

export function alertExtractionFailed({ documentId, cabinetId, reason } = {}) {
  if (reason && EXPECTED_FAILURES.some(e => reason.includes(e))) return false
  return send({
    key:     `extraction-failed:${(reason ?? 'inconnu').slice(0, 40)}`,
    level:   'warning',
    message: `Échec d'extraction : ${reason ?? 'raison inconnue'}`,
    tags:    { cabinet: cabinetId ?? 'inconnu' },
    context: { documentId, cabinetId, reason },
  })
}

/** Exposed for tests: clears the throttle window. */
export function __resetAlertThrottle() {
  throttle.clear()
}
