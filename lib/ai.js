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
import { logger } from '@/lib/logger'
import { geminiKeys } from '@/lib/gemini'


const OPENROUTER_API = 'https://openrouter.ai/api/v1/chat/completions'

// Vision-capable providers on OpenRouter (images + HEIC + WEBP)
// Order: fastest/cheapest first, most reliable last.
// google/gemini-2.0-flash-001 removed — "No endpoints found" on OpenRouter.
// Chaîne de vision — reçoit le document lui-même. Utilisée par la classification
// et la génération de modèles au tableau de bord. Ces modèles sont payants : les
// équivalents gratuits en vision sont rares et instables (voir C3).
const PROVIDERS = [
  'anthropic/claude-haiku-4-5',
  'google/gemini-flash-1.5',
  'openai/gpt-4o',
  'qwen/qwen2.5-vl-72b-instruct',
]

// Chaîne de texte — reçoit la sortie de l'OCR Azure, jamais le document.
// Entièrement gratuite, répartie sur trois éditeurs pour qu'une saturation chez
// l'un n'arrête pas les extractions.
//
// Chaque modèle a été appelé pour de vrai le 2026-08-14, pas seulement lu dans
// un catalogue. Ce test a écarté des candidats qui paraissaient bons : gpt-oss-20b
// et gemma-4-31b renvoyaient déjà 429, laguna et lightning répondaient vite mais
// pas en JSON. L'ordre suit la capacité, pas la vitesse : sur des montants
// comptables, une réponse juste en 3 s vaut mieux qu'une réponse douteuse en 1 s.
const TEXT_PROVIDERS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'google/gemma-4-26b-a4b-it:free',
  'cohere/north-mini-code:free',
  'nvidia/nemotron-3-nano-30b-a3b:free',
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
      logger.warn('Circuit : Redis indisponible, état local utilisé', { provider: model, raison: err.message })
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
      logger.warn('Circuit : écriture Redis impossible, état local utilisé', { provider: model, raison: err.message })
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
    logger.warn('Circuit : réinitialisation Redis impossible', { provider: model, raison: err.message })
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

  logger.info('Appel provider terminé', { provider: model, durationMs: duration, tokensIn, tokensOut })

  if (!content) throw new Error('Réponse vide du modèle')

  // L'usage était calculé pour le journal puis abandonné. Le renvoyer permet de
  // le persister sur le document : sans lui, l'écran d'administration ne pouvait
  // afficher aucune consommation, quel que soit le volume traité.
  return { content, tokensIn, tokensOut }
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

// Modèles vérifiés par appel réel sur les quatre clés, le 2026-08-29.
//
// Les 2.5 passent en dernier recours, pas en tête : Google les a fermés aux
// comptes récents (« no longer available to new users », 404 sur
// generateContent). Deux clés sur quatre les refusaient déjà. La liste
// /models les annonce pourtant comme disponibles — seul l'appel réel dit la
// vérité, c'est ce qui a permis de le voir.
//
// Les 3.x répondent sur toutes les clés ; elles ouvrent donc la chaîne.
const GEMINI_PDF_MODELS = [
  'gemini-3.5-flash-lite',   // le plus rapide, disponible partout
  'gemini-3.6-flash',        // repli, meilleure qualité
  'gemini-2.5-flash-lite',   // anciens comptes uniquement
  'gemini-2.5-flash',
]
const GEMINI_PDF_TIMEOUT = 60_000

async function extractPdfWithGemini(prompt, base64, maxTokens) {
  // Même source de clés que lib/gemini.js : une seule définition, sinon les deux
  // chemins finiraient par diverger sur ce qui est configuré.
  const keys = geminiKeys()
  if (!keys.length) throw new Error('Aucune clé Gemini configurée (GEMINI_API_KEY ou GEMINI_API_KEYS)')

  let lastErr
  for (const apiKey of keys) {
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
        // Un quota atteint ne se contourne pas en changeant de modèle : le
        // plafond porte sur le projet. On abandonne cette clé tout de suite.
        if (res.status === 429 || /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(errText)) {
          logger.warn('Quota Gemini atteint sur le chemin PDF — clé suivante', { model })
          break
        }
        logger.warn('Modèle Gemini PDF en échec', { model, raison: lastErr.message })
        continue
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (!text) { lastErr = new Error(`Réponse vide de ${model}`); continue }
      const tokensIn  = data.usageMetadata?.promptTokenCount     ?? 0
      const tokensOut = data.usageMetadata?.candidatesTokenCount ?? 0
      logger.info('Extraction PDF Gemini réussie', { model, chars: text.length, tokensIn, tokensOut })
      return { content: text, tokensIn, tokensOut }
    } catch (err) {
      lastErr = err
      logger.warn('Exception sur modèle Gemini PDF', { model, raison: err.message })
    } finally {
      clearTimeout(timer)
    }
  }
  }

  throw lastErr ?? new Error('Toutes les clés et modèles Gemini PDF ont échoué')
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
    logger.warn('Fichier volumineux', { approxKB: Math.round(approxBytes / 1024) })
  }

  const cacheKey = makeCacheKey(prompt, base64)
  if (useCache) {
    const cached = cacheGet(cacheKey)
    if (cached) { logger.debug('Réponse servie depuis le cache'); return { content: cached, provider: 'cache' } }
  }

  // ── PDF path ──────────────────────────────────────────────────────────────
  // Primary: Gemini 1.5-flash-latest via direct REST API.
  // Fallback: Gemini on OpenRouter (same model family, accepts PDF as base64).
  if (mimeType === 'application/pdf') {
    logger.debug('Chemin PDF — Gemini 2.5 en direct')
    try {
      const { content, tokensIn, tokensOut } = await extractPdfWithGemini(prompt, base64, maxTokens)
      if (useCache) cacheSet(cacheKey, content)
      return { content, provider: 'gemini-pdf', tokensIn, tokensOut }
    } catch (err) {
      // Aucun repli ici, par choix. Le commentaire et le journal en promettaient
      // un vers OpenRouter, mais aucun code ne l'a jamais tenté : l'erreur était
      // levée juste après. Plutôt que d'implémenter une promesse que
      // l'architecture ne veut pas — le PDF relève d'Azure au tableau de bord et
      // de Gemini seul à la démo — on dit ce qui se passe réellement.
      logger.warn('Gemini PDF en échec — aucun repli sur ce chemin', { raison: err.message })
      alertAllProvidersFailed({ lastError: `PDF : Gemini a échoué — ${err.message}` })
    }

    throw new Error('ALL_PROVIDERS_FAILED')
  }

  // ── Image path — OpenRouter fallback chain ────────────────────────────────
  const messages = buildImageMessages(prompt, mimeType, base64)

  // Conservée hors de la boucle : c'est la dernière erreur de la chaîne
  // entière qu'on veut joindre à l'alerte finale.
  let chainLastErr
  for (const model of PROVIDERS) {
    if (await isCircuitOpen(model)) {
      logger.info('Circuit ouvert — provider écarté', { provider: model })
      continue
    }

    let lastErr
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
      try {
        const { content, tokensIn, tokensOut } = await callOpenRouter(model, messages, maxTokens)
        await recordSuccess(model)
        if (useCache) cacheSet(cacheKey, content)
        return { content, provider: model, tokensIn, tokensOut }
      } catch (err) {
        lastErr = err
        logger.warn('Tentative provider échouée', { provider: model, tentative: attempt + 1, total: RETRY_DELAYS.length + 1, raison: err.message })
      }
    }

    chainLastErr = lastErr
    await recordFailure(model, lastErr?.message)
    logger.warn('Provider épuisé — passage au repli suivant', { provider: model, raison: lastErr?.message })
  }

  alertAllProvidersFailed({ lastError: chainLastErr?.message })
  throw new Error('ALL_PROVIDERS_FAILED')
}

/**
 * Structuration à partir de texte seul — étape qui suit l'OCR Azure.
 *
 * Azure ayant déjà lu le document, cette étape ne reçoit que du texte : des
 * modèles de texte suffisent. C'est ce qui rend le gratuit viable ici, alors
 * qu'il ne l'est pas pour la vision — les modèles de vision gratuits sont
 * rares et instables, les modèles de texte gratuits sont nombreux.
 *
 * Les trois modèles viennent de trois éditeurs différents, pour qu'une panne
 * chez l'un n'interrompe pas les extractions.
 *
 * `validate` permet de traiter une réponse inexploitable comme un échec, et donc
 * de passer au modèle suivant. Sans ce garde-fou, un modèle qui répond en prose
 * au lieu du JSON demandé passait pour un succès : l'erreur ne surgissait qu'à
 * l'analyse, chez l'appelant, trop tard pour essayer quelqu'un d'autre — et le
 * document partait en rejet. Les modèles gratuits le font assez souvent pour que
 * ce ne soit pas une précaution théorique.
 *
 * @param {string} prompt
 * @param {number} [maxTokens]
 * @param {{ validate?: (content: string) => boolean }} [options]
 * @returns {Promise<{ content: string, model: string }>}
 * @throws {Error} 'ALL_PROVIDERS_FAILED' si toute la chaîne échoue
 */
export async function openRouterText(prompt, maxTokens = 3000, { validate } = {}) {
  const messages = [{ role: 'user', content: prompt }]

  let chainLastErr
  for (const model of TEXT_PROVIDERS) {
    if (await isCircuitOpen(model)) {
      logger.info('Circuit ouvert — modèle texte écarté', { provider: model })
      continue
    }

    let lastErr
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]))
      try {
        const { content, tokensIn, tokensOut } = await callOpenRouter(model, messages, maxTokens)
        if (validate && !validate(content)) {
          throw new Error('Réponse inexploitable — format attendu non respecté')
        }
        await recordSuccess(model)
        return { content, model, tokensIn, tokensOut }
      } catch (err) {
        lastErr = err
        logger.warn('Tentative texte échouée', { provider: model, tentative: attempt + 1, raison: err.message })
      }
    }

    chainLastErr = lastErr
    await recordFailure(model, lastErr?.message)
    logger.warn('Modèle texte épuisé — passage au repli suivant', { provider: model, raison: lastErr?.message })
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
