/**
 * lib/ai.js — AI extraction service
 *
 * PDFs   → Gemini v1beta direct REST (gemini-2.5-flash-lite → gemini-2.5-flash)
 *           gemini-1.5-flash and gemini-2.0-flash unavailable on this key.
 *
 * Images → OpenRouter fallback chain (Claude Haiku → GPT-4o → Qwen)
 *          with per-provider retry, circuit breaker, and MD5 response cache.
 *
 * Global state (`global.__ai_*`) survives Turbopack hot reloads.
 */

import crypto from 'crypto'
import { alertCircuitOpened, alertAllProvidersFailed } from '@/lib/alerts'
import { redisCommand, isRedisConfigured } from '@/lib/redis'


const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions'

// Vision-capable providers on OpenRouter (images + HEIC + WEBP)
// Order: fastest/cheapest first, most reliable last.
// google/gemini-2.0-flash-001 removed — "No endpoints found" on OpenRouter.
const PROVIDERS = [
  'anthropic/claude-haiku-4-5',
  'google/gemini-flash-1.5',
  'openai/gpt-4o',
  'qwen/qwen2.5-vl-72b-instruct',
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
//
// L'état vit dans Redis, partagé par toutes les instances Vercel. En mémoire,
// chaque instance avait sa propre vision : un provider en panne était bien
// écarté sur l'instance qui l'avait constaté, mais les autres continuaient de
// l'appeler — le disjoncteur ne disjonctait qu'à un endroit sur N.
//
// Le repli mémoire reste actif si Redis est absent ou injoignable : mieux vaut
// un circuit breaker local qu'aucun.

const circuitKey = model => `ai:circuit:${model}`

async function isCircuitOpen(model) {
  if (isRedisConfigured()) {
    try {
      const raw = await redisCommand(['GET', circuitKey(model)])
      if (!raw) return false
      const c = typeof raw === 'string' ? JSON.parse(raw) : raw
      return c.failures >= CIRCUIT_THRESHOLD
    } catch (err) {
      console.warn(`[AI] circuit: Redis indisponible (${err.message}) — état local`)
    }
  }
  const c = circuitState[model]
  if (!c || c.failures < CIRCUIT_THRESHOLD) return false
  return Date.now() - c.openedAt < CIRCUIT_OPEN_MS
}

async function recordFailure(model, lastError) {
  // Toujours tenu à jour localement : c'est le repli si Redis tombe.
  if (!circuitState[model]) circuitState[model] = { failures: 0, openedAt: 0 }
  const local = circuitState[model]
  local.failures += 1
  local.openedAt = Date.now()

  let failures = local.failures
  let crossedThreshold = failures === CIRCUIT_THRESHOLD

  if (isRedisConfigured()) {
    try {
      // INCR puis EXPIRE au premier échec : la fenêtre part du premier échec
      // et n'est pas repoussée par les suivants.
      const countKey = `${circuitKey(model)}:count`
      const count = await redisCommand(['INCR', countKey])
      if (count === 1) {
        await redisCommand(['EXPIRE', countKey, String(CIRCUIT_OPEN_MS / 1000)])
      }
      failures = count
      crossedThreshold = count === CIRCUIT_THRESHOLD
      if (count >= CIRCUIT_THRESHOLD) {
        await redisCommand([
          'SET', circuitKey(model),
          JSON.stringify({ failures: count, openedAt: Date.now() }),
          'EX', String(CIRCUIT_OPEN_MS / 1000),
        ])
      }
    } catch (err) {
      console.warn(`[AI] circuit: écriture Redis impossible (${err.message}) — état local`)
    }
  }

  // Alerte au franchissement du seuil uniquement, pas à chaque échec suivant.
  if (crossedThreshold) {
    alertCircuitOpened(model, { failures, lastError })
  }
}

async function recordSuccess(model) {
  delete circuitState[model]
  if (!isRedisConfigured()) return
  try {
    await redisCommand(['DEL', circuitKey(model), `${circuitKey(model)}:count`])
  } catch (err) {
    // Sans importance : les clés portent un TTL et expireront d'elles-mêmes.
    console.warn(`[AI] circuit: réinitialisation Redis impossible (${err.message})`)
  }
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

// ── PDF extraction via Google REST API (v1beta) ───────────────────────────────
// Confirmed working models (tested 2026-06-08):
//   gemini-2.5-flash-lite → 2.4s, most detailed output  ← primary
//   gemini-2.5-flash       → 6.4s, good output           ← fallback
// gemini-1.5-flash / gemini-2.0-flash: unavailable on this key (404 / limit:0)

const GEMINI_PDF_MODELS  = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']
const GEMINI_PDF_TIMEOUT = 60_000

async function extractPdfWithGemini(prompt, base64, maxTokens) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY manquante')

  let lastErr
  for (const model of GEMINI_PDF_MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
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
        lastErr = new Error(`Gemini ${model}: ${res.status} — ${errText.slice(0, 200)}`)
        console.warn(`[AI] ${model} failed:`, lastErr.message)
        continue
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) { lastErr = new Error(`Réponse vide de ${model}`); continue }
      console.log(`[AI] Gemini PDF ok (${model}) — ${text.length} chars`)
      return text
    } catch (err) {
      lastErr = err
      console.warn(`[AI] ${model} exception:`, err.message)
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastErr ?? new Error('Tous les modèles Gemini PDF ont échoué')
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
    if (cached) { console.log('[AI] cache hit'); return { content: cached, provider: 'cache' } }
  }

  // ── PDF path ──────────────────────────────────────────────────────────────
  // Primary: Gemini 1.5-flash-latest via direct REST API.
  // Fallback: Gemini on OpenRouter (same model family, accepts PDF as base64).
  if (mimeType === 'application/pdf') {
    console.log('[AI] PDF mode — trying Gemini 2.5 (direct REST)')
    try {
      const content = await extractPdfWithGemini(prompt, base64, maxTokens)
      if (useCache) cacheSet(cacheKey, content)
      return { content, provider: 'gemini-pdf' }
    } catch (err) {
      console.warn('[AI] Gemini direct failed, trying OpenRouter Gemini fallback:', err.message)
    }

    alertAllProvidersFailed({ lastError: 'PDF : Gemini direct et repli OpenRouter ont échoué' })
    throw new Error('ALL_PROVIDERS_FAILED')
  }

  // ── Image path — OpenRouter fallback chain ────────────────────────────────
  const messages = buildImageMessages(prompt, mimeType, base64)

  // Conservée hors de la boucle : c'est la dernière erreur de la chaîne
  // entière qu'on veut joindre à l'alerte finale.
  let chainLastErr
  for (const model of PROVIDERS) {
    if (await isCircuitOpen(model)) {
      console.log(`[AI] circuit open — skipping ${model}`)
      continue
    }

    let lastErr
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
      try {
        const content = await callOpenRouter(model, messages, maxTokens)
        await recordSuccess(model)
        if (useCache) cacheSet(cacheKey, content)
        return { content, provider: model }
      } catch (err) {
        lastErr = err
        console.warn(`[AI] ${model} attempt ${attempt + 1}/${RETRY_DELAYS.length + 1} failed: ${err.message}`)
      }
    }

    chainLastErr = lastErr
    await recordFailure(model, lastErr?.message)
    console.error(`[AI] ${model} exhausted — moving to fallback. Last error: ${lastErr?.message}`)
  }

  alertAllProvidersFailed({ lastError: chainLastErr?.message })
  throw new Error('ALL_PROVIDERS_FAILED')
}

/**
 * État réel des circuits, tous providers confondus.
 * Interroge Redis quand il est disponible : sinon la console d'administration
 * ne montrerait que l'état de l'instance qui répond, ce qui est trompeur —
 * un circuit ouvert ailleurs passerait pour fermé.
 */
export async function getAICircuitStatus() {
  const out = {}
  // Union des providers actifs et de ceux ayant un état enregistré : se limiter
  // à PROVIDERS masquerait un circuit encore ouvert sur un modèle retiré de la
  // chaîne, ce qui est précisément ce qu'on veut voir.
  const models = new Set([...PROVIDERS, ...Object.keys(circuitState)])
  for (const model of models) {
    let entry = null
    if (isRedisConfigured()) {
      try {
        const raw = await redisCommand(['GET', circuitKey(model)])
        if (raw) entry = typeof raw === 'string' ? JSON.parse(raw) : raw
      } catch { /* on retombe sur l'état local ci-dessous */ }
    }
    entry ??= circuitState[model]
    if (!entry) continue
    out[model] = {
      failures: entry.failures,
      open:     entry.failures >= CIRCUIT_THRESHOLD,
      opensAt:  new Date(entry.openedAt + CIRCUIT_OPEN_MS).toISOString(),
      source:   isRedisConfigured() ? 'redis' : 'mémoire',
    }
  }
  return out
}

export function getAICacheStats() {
  // Le cache de réponses reste volontairement local : c'est une optimisation
  // dont l'absence est sans conséquence (un miss relance simplement l'appel),
  // et faire transiter des réponses de plusieurs dizaines de Ko par Redis à
  // chaque extraction coûterait plus qu'il ne rapporterait.
  return { size: responseCache.size, max: MAX_CACHE_SIZE, scope: 'instance' }
}
