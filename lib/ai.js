/**
 * lib/ai.js — AI extraction service
 *
 * PDFs  → Google Generative AI SDK directly (Gemini 1.5 Flash via GEMINI_API_KEY).
 *          OpenRouter's Gemini endpoint slug changed; SDK path is stable and reliable.
 *
 * Images → OpenRouter fallback chain (Gemini 2.0 Flash → Claude Haiku → Qwen → GPT-4o)
 *          with per-provider retry, circuit breaker, and MD5 response cache.
 *
 * Global state (`global.__ai_*`) survives Turbopack hot reloads (same pattern as lib/prisma.js).
 */

import crypto from 'crypto'

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions'

// Vision-capable providers on OpenRouter (images only)
const PROVIDERS = [
  'google/gemini-2.0-flash-001',
  'anthropic/claude-haiku-4-5',
  'qwen/qwen2.5-vl-72b-instruct',
  'openai/gpt-4o',
]

const TIMEOUT_MS        = 15_000
const RETRY_DELAYS      = [500, 1000]
const CIRCUIT_THRESHOLD = 3
const CIRCUIT_OPEN_MS   = 5 * 60 * 1000
const MAX_CACHE_SIZE    = 200

// Global state — survives hot reloads
if (!global.__ai_circuit) global.__ai_circuit = {}
if (!global.__ai_cache)   global.__ai_cache   = new Map()

const circuitState  = global.__ai_circuit
const responseCache = global.__ai_cache

// ── Cache helpers ──────────────────────────────────────────────────────────────

function makeCacheKey(prompt, base64) {
  const fileDigest   = crypto.createHash('md5').update(base64.slice(0, 8192)).digest('hex')
  const promptDigest = crypto.createHash('md5').update(prompt).digest('hex')
  return `${fileDigest}:${promptDigest}`
}

function cacheGet(key) {
  return responseCache.get(key) ?? null
}

function cacheSet(key, value) {
  if (responseCache.size >= MAX_CACHE_SIZE) {
    responseCache.delete(responseCache.keys().next().value)
  }
  responseCache.set(key, value)
}

// ── Circuit breaker ────────────────────────────────────────────────────────────

function isCircuitOpen(model) {
  const c = circuitState[model]
  if (!c || c.failures < CIRCUIT_THRESHOLD) return false
  return Date.now() - c.openedAt < CIRCUIT_OPEN_MS
}

function recordFailure(model) {
  if (!circuitState[model]) circuitState[model] = { failures: 0, openedAt: 0 }
  circuitState[model].failures += 1
  circuitState[model].openedAt = Date.now()
}

function recordSuccess(model) {
  delete circuitState[model]
}

// ── HTTP helpers (OpenRouter) ──────────────────────────────────────────────────

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function callOpenRouter(model, messages, maxTokens) {
  const start = Date.now()
  const key   = process.env.OPENROUTER_API_KEY
  if (!key) throw new Error('OPENROUTER_API_KEY manquante')

  const res = await fetchWithTimeout(
    OPENROUTER_API,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer':  'https://hesabi.ma',
        'X-Title':       'hesabi',
      },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
    },
    TIMEOUT_MS,
  )

  const duration = Date.now() - start

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
  }

  const data      = await res.json()
  const content   = data.choices?.[0]?.message?.content ?? ''
  const tokensIn  = data.usage?.prompt_tokens ?? 0
  const tokensOut = data.usage?.completion_tokens ?? 0

  console.log(`[AI] provider=${model} duration=${duration}ms in=${tokensIn} out=${tokensOut}`)

  if (!content) throw new Error('Réponse vide du modèle')
  return content
}

function buildImageMessages(prompt, mimeType, base64) {
  return [
    {
      role: 'user',
      content: [
        { type: 'text',      text: prompt },
        { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    },
  ]
}

// ── PDF extraction via Google REST API v1 (bypasses SDK version issues) ───────
// The @google/generative-ai SDK defaults to v1beta; gemini-1.5-flash only exists
// in v1. We call the REST endpoint directly to control the API version precisely.

const GEMINI_PDF_MODEL = 'gemini-1.5-flash'
const GEMINI_PDF_TIMEOUT = 60_000

async function extractPdfWithGemini(prompt, base64, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante')

  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_PDF_MODEL}:generateContent?key=${apiKey}`

  const body = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
      ],
    }],
    generationConfig: { maxOutputTokens: maxTokens },
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_PDF_TIMEOUT)

  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Gemini v1 API: ${res.status} — ${errText.slice(0, 300)}`)
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!text) throw new Error('Réponse vide de Gemini PDF')
    console.log(`[AI] Gemini PDF ok — ${text.length} chars`)
    return text
  } finally {
    clearTimeout(timer)
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Extract data from a document (PDF or image).
 *
 * PDFs  → Gemini SDK directly (GEMINI_API_KEY).
 * Images → OpenRouter fallback chain (OPENROUTER_API_KEY).
 *
 * @throws {Error} message 'ALL_PROVIDERS_FAILED' if every path exhausted
 */
export async function aiExtract(prompt, mimeType, base64, { maxTokens = 1500, useCache = true } = {}) {
  const approxBytes = Math.ceil((base64.length * 3) / 4)
  if (approxBytes > 800 * 1024) {
    console.warn(`[AI] large file: ~${Math.round(approxBytes / 1024)}KB`)
  }

  const cacheKey = makeCacheKey(prompt, base64)
  if (useCache) {
    const cached = cacheGet(cacheKey)
    if (cached) { console.log('[AI] cache hit'); return cached }
  }

  // ── PDF path ──────────────────────────────────────────────────────────────
  if (mimeType === 'application/pdf') {
    console.log('[AI] PDF mode — using Gemini SDK directly')
    try {
      const content = await extractPdfWithGemini(prompt, base64, maxTokens)
      if (useCache) cacheSet(cacheKey, content)
      return content
    } catch (err) {
      console.error('[AI] Gemini PDF extraction failed:', err.message)
      throw new Error('ALL_PROVIDERS_FAILED')
    }
  }

  // ── Image path — OpenRouter fallback chain ────────────────────────────────
  const messages = buildImageMessages(prompt, mimeType, base64)

  for (const model of PROVIDERS) {
    if (isCircuitOpen(model)) {
      console.log(`[AI] circuit open — skipping ${model}`)
      continue
    }

    let lastErr
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
      try {
        const content = await callOpenRouter(model, messages, maxTokens)
        recordSuccess(model)
        if (useCache) cacheSet(cacheKey, content)
        return content
      } catch (err) {
        lastErr = err
        console.warn(`[AI] ${model} attempt ${attempt + 1}/${RETRY_DELAYS.length + 1} failed: ${err.message}`)
      }
    }

    recordFailure(model)
    console.error(`[AI] ${model} exhausted — moving to fallback. Last error: ${lastErr?.message}`)
  }

  throw new Error('ALL_PROVIDERS_FAILED')
}

export function getAICircuitStatus() {
  return Object.fromEntries(
    Object.entries(circuitState).map(([model, c]) => [
      model,
      { failures: c.failures, open: isCircuitOpen(model), opensAt: new Date(c.openedAt + CIRCUIT_OPEN_MS).toISOString() },
    ]),
  )
}

export function getAICacheStats() {
  return { size: responseCache.size, max: MAX_CACHE_SIZE }
}
