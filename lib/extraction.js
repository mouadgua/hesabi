/**
 * lib/extraction.js — Unified document extraction orchestrator
 *
 * Routes each document to the right extraction pipeline based on the cabinet's
 * extraction_method setting:
 *
 *   'gemini'       → aiExtract() (existing Gemini/OpenRouter path — unchanged)
 *   'hybrid_azure' → Azure OCR → text → Gemini text-only
 *
 * Both paths return the same { content, provider, method_used, cost_est } shape
 * so nothing downstream (worker, verification page, learning loop) needs to change.
 */

import { aiExtract } from '@/lib/ai'
import { analyzeLayout, simplifyForLLM } from '@/lib/azureOcr'

// Cascade for text-only Gemini calls (hybrid path)
const GEMINI_TEXT_MODELS  = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
const GEMINI_TEXT_TIMEOUT = 30_000

// Rough cost estimates in USD — for comparison in admin dashboard
const COST_AZURE_PER_PAGE = 0.0015  // $1.50 / 1000 pages
const COST_GEMINI_PER_DOC = 0.0001  // ~$0.0001 per document average

// ── Private: Gemini text-only call (no vision, no inline_data) ────────────────

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
 * Extract data from a document using the cabinet's configured method.
 *
 * @param {string} base64            - Document content in base64
 * @param {string} mimeType          - MIME type (application/pdf, image/jpeg…)
 * @param {string} prompt            - Full extraction prompt from buildExtractionPrompt
 * @param {Object} options
 * @param {string} [options.extractionMethod='gemini'] - 'gemini' | 'hybrid_azure'
 * @param {number} [options.maxTokens=3000]
 * @param {boolean}[options.useCache=true]   - Only applies to the gemini path
 *
 * @returns {Promise<{
 *   content:     string,   // Raw AI response (JSON string)
 *   provider:    string,   // e.g. 'gemini-pdf' | 'hybrid_azure+gemini-2.5-flash-lite'
 *   method_used: string,   // 'gemini-pdf' | 'hybrid_azure'
 *   cost_est:    number,   // Estimated cost in USD
 * }>}
 *
 * @throws {Error} 'ALL_PROVIDERS_FAILED' if every path is exhausted (gemini only)
 */
export async function extractDocument(base64, mimeType, prompt, {
  extractionMethod = 'gemini',
  maxTokens = 3000,
  useCache = true,
} = {}) {

  // ── Gemini path — delegates entirely to existing lib/ai.js ──────────────────
  if (extractionMethod === 'gemini') {
    const result = await aiExtract(prompt, mimeType, base64, { maxTokens, useCache })
    return {
      content:     result.content,
      provider:    result.provider,
      method_used: result.provider,
      cost_est:    COST_GEMINI_PER_DOC,
    }
  }

  // ── Hybrid Azure path ────────────────────────────────────────────────────────
  if (extractionMethod === 'hybrid_azure') {
    console.log('[extraction] hybrid_azure — Azure OCR → Gemini text')

    const azureResult = await analyzeLayout(base64, mimeType)
    const cleanText   = simplifyForLLM(azureResult)

    // Inject OCR text into the prompt instead of passing the raw image/PDF
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

  throw new Error(`extractDocument: méthode inconnue "${extractionMethod}"`)
}
