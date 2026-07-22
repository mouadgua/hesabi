/**
 * lib/extraction.js — Unified document extraction orchestrator
 *
 * Routes each document to the right extraction pipeline:
 *
 *   'azure'        → Azure DI layout → extractEssential JSON → Gemini text structuring
 *                    Best accuracy; handles PDFs, images, tables, key-value pairs.
 *
 *   'hybrid_azure' → Azure DI layout → plain text → Gemini text structuring
 *                    Kept for backward compatibility; 'azure' is preferred.
 *
 *   'gemini'       → aiExtract() (Gemini PDF vision / OpenRouter images)
 *                    Fallback when Azure is not configured.
 *
 * All paths return { content, provider, method_used, cost_est }.
 */

import { aiExtract } from '@/lib/ai'
import { analyzeLayout, extractEssential, simplifyForLLM } from '@/lib/azureOcr'

// Gemini text-only models for the structuring step (no vision, cheaper + faster)
const GEMINI_TEXT_MODELS  = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
const GEMINI_TEXT_TIMEOUT = 30_000

// Rough cost estimates in USD
const COST_AZURE_PER_PAGE = 0.0015  // $1.50 / 1000 pages
const COST_GEMINI_PER_DOC = 0.0001

// ── Gemini text-only call (structuring step after Azure OCR) ──────────────────

async function callGeminiText(prompt, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante')

  let lastErr
  for (const model of GEMINI_TEXT_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), GEMINI_TEXT_TIMEOUT)

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents:         [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        lastErr = new Error(`Gemini text ${model}: ${res.status} — ${errText.slice(0, 200)}`)
        console.warn('[extraction]', lastErr.message)
        continue
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) { lastErr = new Error(`Réponse vide de ${model}`); continue }

      console.log(`[extraction] Gemini text ok (${model}) — ${text.length} chars`)
      return { content: text, model }
    } catch (err) {
      lastErr = err
      console.warn(`[extraction] ${model} exception:`, err.message)
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastErr ?? new Error('Gemini text: tous les modèles ont échoué')
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Extract data from a document using the configured method.
 *
 * @param {string} base64
 * @param {string} mimeType
 * @param {string} prompt               - Full extraction prompt
 * @param {object} options
 * @param {string} [options.extractionMethod='azure']
 * @param {number} [options.maxTokens=3000]
 * @param {boolean}[options.useCache=true]
 *
 * @returns {Promise<{ content, provider, method_used, cost_est }>}
 * @throws {Error} 'ALL_PROVIDERS_FAILED' (gemini path only)
 */
export async function extractDocument(base64, mimeType, prompt, {
  extractionMethod = 'azure',
  maxTokens = 3000,
  useCache = true,
} = {}) {

  // ── Azure (primary): Azure DI → essential JSON → Gemini text ─────────────────
  if (extractionMethod === 'azure') {
    console.log('[extraction] azure — Azure DI layout → extractEssential → Gemini text')

    const azureResult   = await analyzeLayout(base64, mimeType)
    const essential     = extractEssential(azureResult.analyzeResult)

    const structurePrompt =
      prompt +
      `\n\nDONNÉES EXTRAITES PAR AZURE DOCUMENT INTELLIGENCE (${essential.pageCount} page(s)) :\n` +
      '```json\n' + JSON.stringify(essential, null, 2) + '\n```\n' +
      `\nUtilise uniquement les données ci-dessus pour remplir les champs demandés. ` +
      `Ne génère pas de données fictives si un champ est absent.`

    const { content, model } = await callGeminiText(structurePrompt, maxTokens)

    return {
      content,
      provider:    `azure+${model}`,
      method_used: 'azure',
      cost_est:    COST_AZURE_PER_PAGE * essential.pageCount + COST_GEMINI_PER_DOC,
    }
  }

  // ── Hybrid Azure (backward compat): Azure DI → plain text → Gemini text ──────
  if (extractionMethod === 'hybrid_azure') {
    console.log('[extraction] hybrid_azure — Azure DI layout → plain text → Gemini text')

    const azureResult = await analyzeLayout(base64, mimeType)
    const cleanText   = simplifyForLLM(azureResult)

    const hybridPrompt =
      prompt +
      `\n\nCONTENU DU DOCUMENT (extrait par Azure OCR — ${azureResult.pages} page(s)) :\n` +
      '```\n' + cleanText + '\n```'

    const { content, model } = await callGeminiText(hybridPrompt, maxTokens)

    return {
      content,
      provider:    `hybrid_azure+${model}`,
      method_used: 'hybrid_azure',
      cost_est:    COST_AZURE_PER_PAGE * azureResult.pages + COST_GEMINI_PER_DOC,
    }
  }

  // ── Gemini path (fallback / legacy) ──────────────────────────────────────────
  if (extractionMethod === 'gemini') {
    const result = await aiExtract(prompt, mimeType, base64, { maxTokens, useCache })
    return {
      content:     result.content,
      provider:    result.provider,
      method_used: result.provider,
      cost_est:    COST_GEMINI_PER_DOC,
    }
  }

  throw new Error(`extractDocument: méthode inconnue "${extractionMethod}"`)
}
