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

const TIMEOUT_VISION_MS = 60_000
const TIMEOUT_TEXT_MS   = 30_000

/**
 * Appelle Gemini en essayant chaque modèle dans l'ordre.
 * Le repli est ici interne à Gemini — jamais vers un autre fournisseur.
 */
async function callGemini(parts, maxTokens, timeoutMs, label) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante')

  let lastErr
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
        logger.warn('Modèle Gemini en échec', { label, model, raison: lastErr.message })
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

      logger.info('Appel Gemini réussi', { label, model, chars: text.length, tokensIn, tokensOut })
      return { content: text, model, tokensIn, tokensOut }
    } catch (err) {
      lastErr = err
      logger.warn('Exception sur modèle Gemini', { label, model, raison: err.message })
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastErr ?? new Error(`Gemini (${label}) : tous les modèles ont échoué`)
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
