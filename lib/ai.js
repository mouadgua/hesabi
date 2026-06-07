/**
 * lib/ai.js — OpenRouter multi-provider AI service
 *
 * Replaces direct @google/generative-ai calls in the extraction worker.
 * Provides: fallback chain, per-attempt retry, circuit breaker, response cache.
 *
 * Production note: circuit breaker & cache live on `global.*` (same pattern as
 * lib/prisma.js). They survive Turbopack hot reloads but are per-instance.
 * For multi-instance deployments, migrate to Upstash Redis.
 */

import crypto from 'crypto'

const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions'

// Priority fallback chain — vision-capable models only (images)
const PROVIDERS = [
  'google/gemini-flash-1.5',
  'anthropic/claude-haiku-4-5',
  'qwen/qwen3.7-plus',
  'openai/gpt-4o',
]

// PDF documents require inline base64 support — only Gemini handles this via OpenRouter.
// Claude/GPT-4o/Qwen reject application/pdf in image_url content blocks.
const PDF_PROVIDERS = ['google/gemini-flash-1.5']

const TIMEOUT_MS        = 15_000
const RETRY_DELAYS      = [500, 1000]    // ms between attempts before moving to next provider
const CIRCUIT_THRESHOLD = 3              // consecutive failures to open circuit
const CIRCUIT_OPEN_MS   = 5 * 60 * 1000 // 5 minutes
const MAX_CACHE_SIZE    = 200

// Global state — survives hot reloads
if (!global.__ai_circuit) global.__ai_circuit = {}
if (!global.__ai_cache)   global.__ai_cache   = new Map()

const circuitState = global.__ai_circuit // { [model]: { failures, openedAt } }
const responseCache = global.__ai_cache  // Map<cacheKey, string>

// ── Cache helpers ──────────────────────────────────────────────────────────────

function makeCacheKey(prompt, base64) {
  const fileDigest   = crypto.createHash('md5').update(base64.slice(0, 8192)).digest('hex')
  const promptDigest = crypto.createHash('md5').update(prompt).digest('hex')
  return `${fileDigest}:${promptDigest}`
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

// ── HTTP helpers ───────────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function callProvider(model, messages, maxTokens) {
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

  const data     = await res.json()
  const content  = data.choices?.[0]?.message?.content ?? ''
  const tokensIn  = data.usage?.prompt_tokens ?? 0
  const tokensOut = data.usage?.completion_tokens ?? 0

  console.log(`[AI] provider=${model} duration=${duration}ms in=${tokensIn} out=${tokensOut}`)

  if (!content) throw new Error('Réponse vide du modèle')
  return content
}

function buildMessages(prompt, mimeType, base64) {
  const dataUrl = `data:${mimeType};base64,${base64}`
  return [
    {
      role: 'user',
      content: [
        { type: 'text',      text: prompt },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ]
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Call the AI fallback chain with retry + circuit breaker.
 *
 * @param {string} prompt       - Full prompt text
 * @param {string} mimeType     - MIME type of the document (application/pdf, image/jpeg…)
 * @param {string} base64       - Raw base64 of the document (no data-URL prefix)
 * @param {object} [opts]
 * @param {number} [opts.maxTokens=1500] - Output token budget
 * @param {boolean} [opts.useCache=true] - Whether to check/write cache
 * @returns {Promise<string>}   - Raw AI response text
 * @throws {Error}              - 'ALL_PROVIDERS_FAILED' if every provider exhausted
 */
export async function aiExtract(prompt, mimeType, base64, { maxTokens = 1500, useCache = true } = {}) {
  // ── Size warning ─────────────────────────────────────────────────────────────
  const approxBytes = Math.ceil((base64.length * 3) / 4)
  if (approxBytes > 800 * 1024) {
    console.warn(`[AI] large file warning: ~${Math.round(approxBytes / 1024)}KB (recommandé < 800KB)`)
  }

  // ── Cache lookup ─────────────────────────────────────────────────────────────
  const key = makeCacheKey(prompt, base64)
  if (useCache && responseCache.has(key)) {
    console.log('[AI] cache hit')
    return responseCache.get(key)
  }

  const messages = buildMessages(prompt, mimeType, base64)

  // PDFs can only be processed by Gemini — other providers reject application/pdf in image_url.
  // Force-try Gemini for PDFs even if its circuit is open (circuit may have tripped on image failures).
  const isPdf    = mimeType === 'application/pdf'
  const providers = isPdf ? PDF_PROVIDERS : PROVIDERS

  // ── Provider loop ─────────────────────────────────────────────────────────────
  for (const model of providers) {
    if (!isPdf && isCircuitOpen(model)) {
      console.log(`[AI] circuit open — skipping ${model}`)
      continue
    }
    if (isPdf) console.log(`[AI] PDF mode — forcing ${model}`)

    let lastErr
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
      }
      try {
        const content = await callProvider(model, messages, maxTokens)
        recordSuccess(model)

        // Write to cache
        if (useCache) {
          if (responseCache.size >= MAX_CACHE_SIZE) {
            responseCache.delete(responseCache.keys().next().value)
          }
          responseCache.set(key, content)
        }

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

/**
 * Returns current circuit breaker status for monitoring.
 */
export function getAICircuitStatus() {
  return Object.fromEntries(
    Object.entries(circuitState).map(([model, c]) => [
      model,
      {
        failures: c.failures,
        open: isCircuitOpen(model),
        opensAt: new Date(c.openedAt + CIRCUIT_OPEN_MS).toISOString(),
      },
    ]),
  )
}

/**
 * Returns cache stats for monitoring.
 */
export function getAICacheStats() {
  return { size: responseCache.size, max: MAX_CACHE_SIZE }
}
