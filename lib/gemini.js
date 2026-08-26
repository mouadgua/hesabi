/**
 * lib/gemini.js — Accès direct à l'API Gemini, sans aucun repli.
 *
 * Ce module existe pour rendre l'étanchéité des deux surfaces structurelle
 * plutôt que conventionnelle :
 *
 *   la démo publique  → ce module, et rien d'autre ;
 *   le tableau de bord → Azure puis OpenRouter (lib/extraction.js, lib/ai.js).
 *
 * Tant que la démo n'importe que d'ici, elle ne peut pas atteindre OpenRouter
 * par accident — c'est une garantie que le chemin partagé précédent ne pouvait
 * pas offrir : une image y basculait silencieusement sur la chaîne payante.
 *
 * Aucun repli vers un autre fournisseur n'est prévu, par choix. Si Gemini est
 * indisponible, la démo échoue et le dit ; elle ne dépense pas ailleurs.
 */

import { logger } from '@/lib/logger'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

// Modèles confirmés sur cette clé (testés le 2026-06-08) :
//   gemini-2.5-flash-lite → 2,4 s, sortie la plus détaillée  ← principal
//   gemini-2.5-flash      → 6,4 s, bonne sortie              ← repli
// gemini-1.5-flash et gemini-2.0-flash sont indisponibles ici (404 / limit:0).
const MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']

/**
 * Clés Gemini disponibles, dans l'ordre d'essai.
 *
 * `GEMINI_API_KEYS` accepte plusieurs clés séparées par des virgules ;
 * `GEMINI_API_KEY` reste accepté seul, pour ne rien casser.
 *
 * Plusieurs clés servent d'abord à la résilience : une clé révoquée, un quota
 * atteint ou une erreur passagère n'arrêtent plus les extractions, on passe à la
 * suivante. C'est le même principe que la chaîne de modèles, un cran au-dessus.
 */
export function geminiKeys() {
  const multi = (process.env.GEMINI_API_KEYS ?? '')
    .split(',').map(k => k.trim()).filter(Boolean)
  if (multi.length) return multi
  const single = process.env.GEMINI_API_KEY?.trim()
  return single ? [single] : []
}

/** Une erreur de quota se règle en changeant de clé, pas en changeant de modèle. */
function isQuotaError(message = '') {
  return /\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(message)
}

// Point de départ tournant : sans lui, la première clé encaisserait tout le
// trafic et atteindrait son plafond pendant que les autres restent inutilisées.
let cursor = 0

const TIMEOUT_VISION_MS = 60_000
const TIMEOUT_TEXT_MS   = 30_000

/**
 * Appelle Gemini en essayant chaque modèle dans l'ordre.
 * Le repli est ici interne à Gemini — jamais vers un autre fournisseur.
 */
async function callGemini(parts, maxTokens, timeoutMs, label) {
  const keys = geminiKeys()
  if (!keys.length) throw new Error('Aucune clé Gemini configurée (GEMINI_API_KEY ou GEMINI_API_KEYS)')

  // Les clés sont parcourues en boucle à partir d'un point tournant, et les
  // modèles à l'intérieur de chacune. Un quota atteint fait sauter directement à
  // la clé suivante : réessayer un autre modèle avec la même clé ne servirait à
  // rien, le plafond porte sur le projet et non sur le modèle.
  const start = cursor++ % keys.length
  let lastErr

  for (let ki = 0; ki < keys.length; ki++) {
    const apiKey = keys[(start + ki) % keys.length]
    const keyLabel = `clé ${((start + ki) % keys.length) + 1}/${keys.length}`
    let quotaHit = false

  for (const model of MODELS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents:         [{ parts }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        lastErr = new Error(`Gemini ${model}: ${res.status} — ${errText.slice(0, 200)}`)
        if (res.status === 429 || isQuotaError(errText)) {
          logger.warn('Quota Gemini atteint — passage à la clé suivante', { label, model, cle: keyLabel })
          quotaHit = true
          break
        }
        logger.warn('Modèle Gemini en échec', { label, model, cle: keyLabel, raison: lastErr.message })
        continue
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) { lastErr = new Error(`Réponse vide de ${model}`); continue }

      // Gemini renvoie sa consommation dans usageMetadata. On la remonte pour
      // qu'elle puisse être enregistrée sur le document : sans elle, le suivi
      // de consommation reste vide quel que soit le volume traité.
      const tokensIn  = data.usageMetadata?.promptTokenCount     ?? 0
      const tokensOut = data.usageMetadata?.candidatesTokenCount ?? 0

      logger.info('Appel Gemini réussi', { label, model, cle: keyLabel, chars: text.length, tokensIn, tokensOut })
      return { content: text, model, tokensIn, tokensOut }
    } catch (err) {
      lastErr = err
      if (isQuotaError(err.message)) { quotaHit = true; clearTimeout(timer); break }
      logger.warn('Exception sur modèle Gemini', { label, model, cle: keyLabel, raison: err.message })
    } finally {
      clearTimeout(timer)
    }
  }

    if (!quotaHit && keys.length > 1 && ki < keys.length - 1) {
      logger.info('Clé Gemini épuisée pour cette requête — essai de la suivante', { label, cle: keyLabel })
    }
  }

  throw lastErr ?? new Error(`Gemini (${label}) : toutes les clés et tous les modèles ont échoué`)
}

/**
 * Extraction depuis un document — PDF ou image indifféremment.
 *
 * Le type MIME est transmis tel quel à Gemini, qui accepte les deux de la même
 * façon. C'est ce qui permet à la démo de traiter une image sans emprunter la
 * chaîne de vision d'OpenRouter, comme c'était le cas auparavant.
 *
 * @param {string} prompt
 * @param {string} mimeType   application/pdf, image/jpeg, image/png…
 * @param {string} base64
 * @param {{ maxTokens?: number }} [options]
 * @returns {Promise<{ content: string, model: string }>}
 */
export async function geminiExtract(prompt, mimeType, base64, { maxTokens = 3000 } = {}) {
  return callGemini(
    [
      { text: prompt },
      { inline_data: { mime_type: mimeType, data: base64 } },
    ],
    maxTokens,
    TIMEOUT_VISION_MS,
    mimeType === 'application/pdf' ? 'pdf' : 'image',
  )
}

/**
 * Appel texte seul, sans document joint.
 *
 * @param {string} prompt
 * @param {number} [maxTokens]
 * @returns {Promise<{ content: string, model: string }>}
 */
export async function geminiText(prompt, maxTokens = 3000) {
  return callGemini([{ text: prompt }], maxTokens, TIMEOUT_TEXT_MS, 'texte')
}
