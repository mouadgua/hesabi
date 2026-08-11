/**
 * Tests for lib/ai.js
 *
 * Key constraints:
 *  - jest.useFakeTimers() freezes all setTimeout/setInterval.
 *    Tests that exercise retry loops MUST call `jest.runAllTimersAsync()` while
 *    the aiExtract promise is pending; otherwise the retry-delay Promises never
 *    resolve and the test hangs.
 *  - The module binds `const circuitState = global.__ai_circuit` at import time.
 *    Reassigning `global.__ai_circuit = {}` has NO effect on the module's local
 *    reference.  We reset in-place by clearing the original object's keys.
 */

jest.useFakeTimers()

let aiExtract, getAICircuitStatus, getAICacheStats
// Live references to the exact objects the module is using
let circuitRef
let cacheRef

const PROVIDERS = [
  'google/gemini-2.0-flash-001',
  'anthropic/claude-haiku-4-5',
  'qwen/qwen2.5-vl-72b-instruct',
  'openai/gpt-4o',
]

// ── Fetch response factories ───────────────────────────────────────────────────

const openRouterOk = (content = 'extracted') => ({
  ok: true,
  json: async () => ({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
})
const openRouterFail = (status = 500) => ({
  ok: false, status, text: async () => 'Error',
})
const geminiOk = (content = 'pdf extracted') => ({
  ok: true,
  json: async () => ({ candidates: [{ content: { parts: [{ text: content }] } }] }),
})
const geminiFail = (status = 503) => ({
  ok: false, status, text: async () => 'Gemini error',
})

// ── State reset ───────────────────────────────────────────────────────────────

function clearAIState() {
  if (circuitRef) Object.keys(circuitRef).forEach(k => delete circuitRef[k])
  if (cacheRef)   cacheRef.clear()
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeAll(async () => {
  process.env.OPENROUTER_API_KEY = 'test-key'
  process.env.GEMINI_API_KEY     = 'test-gemini-key'

  // Upstash désactivé : ces tests portent sur la logique du circuit breaker,
  // pas sur Redis. Les laisser actifs ferait passer les commandes Redis par le
  // `fetch` espionné et fausserait les comptages d'appels réseau.
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN

  if (!global.__ai_circuit) global.__ai_circuit = {}
  if (!global.__ai_cache)   global.__ai_cache   = new Map()

  const mod = await import('../../lib/ai.js')
  aiExtract          = mod.aiExtract
  getAICircuitStatus = mod.getAICircuitStatus
  getAICacheStats    = mod.getAICacheStats

  // Capture live references — module holds these same objects
  circuitRef = global.__ai_circuit
  cacheRef   = global.__ai_cache
})

beforeEach(() => {
  clearAIState()
  jest.clearAllMocks()
  jest.clearAllTimers()
})

afterEach(() => {
  jest.clearAllTimers()
})

// ── Helper: drive a promise that internally awaits fake timers ─────────────────
//
// Some aiExtract code paths contain `await new Promise(r => setTimeout(r, delay))`.
// With fake timers those never resolve unless we advance the clock.
// `jest.runAllTimersAsync()` fires pending fake timers AND flushes the microtask
// queue repeatedly until neither queue has work left.
async function driveTimers(promise) {
  await jest.runAllTimersAsync()
  return promise
}

// ── IMAGE PATH (OpenRouter) ────────────────────────────────────────────────────

describe('aiExtract — image path', () => {
  const PROMPT = 'Extract data'
  const MIME   = 'image/jpeg'
  const B64    = Buffer.alloc(64).toString('base64')

  test('returns content and provider on success', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(openRouterOk('invoice #1234'))
    const result = await aiExtract(PROMPT, MIME, B64, { useCache: false })
    expect(result.content).toBe('invoice #1234')
    expect(PROVIDERS).toContain(result.provider)
  })

  test('falls back to second provider when first exhausts all retries', async () => {
    let calls = 0
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      calls++
      return Promise.resolve(calls <= 3 ? openRouterFail() : openRouterOk('fallback ok'))
    })

    const promise = aiExtract(PROMPT, MIME, B64, { useCache: false })
    await jest.runAllTimersAsync()
    const result = await promise

    expect(result.content).toBe('fallback ok')
    expect(calls).toBeGreaterThanOrEqual(4)
  })

  test('throws ALL_PROVIDERS_FAILED when every provider fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(openRouterFail())

    // Attach rejection handler BEFORE advancing timers to avoid unhandled-rejection warning
    const expectation = expect(aiExtract(PROMPT, MIME, B64, { useCache: false })).rejects.toThrow('ALL_PROVIDERS_FAILED')
    await jest.runAllTimersAsync()
    await expectation
  }, 30_000)

  test('returns from cache on second identical call', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(openRouterOk('first'))

    const r1 = await aiExtract(PROMPT, MIME, B64, { useCache: true })
    expect(r1.provider).not.toBe('cache')
    const callsAfterFirst = spy.mock.calls.length

    const r2 = await aiExtract(PROMPT, MIME, B64, { useCache: true })
    expect(r2.provider).toBe('cache')
    expect(r2.content).toBe('first')
    expect(spy.mock.calls.length).toBe(callsAfterFirst) // no additional network call
  })

  test('skips cache when useCache=false', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(openRouterOk('no-cache'))
    await aiExtract(PROMPT, MIME, B64, { useCache: false })
    await aiExtract(PROMPT, MIME, B64, { useCache: false })
    expect(spy.mock.calls.length).toBe(2)
  })
})

// ── PDF PATH (Gemini) ──────────────────────────────────────────────────────────

describe('aiExtract — PDF path', () => {
  const PROMPT = 'Extract PDF'
  const MIME   = 'application/pdf'
  const B64    = Buffer.alloc(64).toString('base64')

  test('uses Gemini endpoint and returns gemini-pdf provider', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(geminiOk('pdf content'))
    const result = await aiExtract(PROMPT, MIME, B64, { useCache: false })
    expect(result.content).toBe('pdf content')
    expect(result.provider).toBe('gemini-pdf')
  })

  test('calls only the Gemini endpoint (not OpenRouter)', async () => {
    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(geminiOk())
    await aiExtract(PROMPT, MIME, B64, { useCache: false })
    expect(spy.mock.calls.length).toBe(1)
    expect(spy.mock.calls[0][0]).toContain('generativelanguage.googleapis.com')
  })

  test('throws ALL_PROVIDERS_FAILED when Gemini fails', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(geminiFail())
    await expect(aiExtract(PROMPT, MIME, B64, { useCache: false })).rejects.toThrow('ALL_PROVIDERS_FAILED')
  })
})

// ── CIRCUIT BREAKER ────────────────────────────────────────────────────────────

describe('Circuit breaker', () => {
  const PROMPT = 'cb-test'
  const MIME   = 'image/jpeg'
  const B64    = Buffer.alloc(32).toString('base64')

  test('skips a provider whose circuit is manually opened', async () => {
    // Write directly to the live object the module uses
    circuitRef[PROVIDERS[0]] = { failures: 3, openedAt: Date.now() }

    const spy = jest.spyOn(global, 'fetch').mockResolvedValue(openRouterOk('next provider'))
    await aiExtract(PROMPT, MIME, B64, { useCache: false })

    const body = JSON.parse(spy.mock.calls[0][1].body)
    expect(body.model).not.toBe(PROVIDERS[0])
  })

  test('getAICircuitStatus reflects manually set state', async () => {
    circuitRef[PROVIDERS[0]] = { failures: 3, openedAt: Date.now() }
    const status = await getAICircuitStatus()
    expect(status[PROVIDERS[0]]).toMatchObject({ failures: 3, open: true })
    expect(typeof status[PROVIDERS[0]].opensAt).toBe('string')
  })

  test('records failures after all providers exhausted', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(openRouterFail())

    const promise = aiExtract(PROMPT, MIME, B64, { useCache: false })
    // Attach handler before advancing timers
    const expectation = expect(promise).rejects.toThrow('ALL_PROVIDERS_FAILED')
    await jest.runAllTimersAsync()
    await expectation

    const status = await getAICircuitStatus()
    const hasFailures = Object.values(status).some(s => s.failures >= 1)
    expect(hasFailures).toBe(true)
  }, 30_000)
})

// ── CACHE STATS ────────────────────────────────────────────────────────────────

describe('getAICacheStats', () => {
  test('reports size 0 after reset', () => {
    const s = getAICacheStats()
    expect(s.size).toBe(0)
    expect(s.max).toBe(200)
  })

  test('size increases after a cached call', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(geminiOk('cached'))
    await aiExtract('cache-test', 'application/pdf', Buffer.alloc(32).toString('base64'), { useCache: true })
    expect(getAICacheStats().size).toBe(1)
  })
})

// ── MISSING API KEYS ──────────────────────────────────────────────────────────

describe('Missing API keys', () => {
  test('throws when GEMINI_API_KEY is absent for PDFs', async () => {
    const orig = process.env.GEMINI_API_KEY
    delete process.env.GEMINI_API_KEY
    await expect(
      aiExtract('prompt', 'application/pdf', Buffer.alloc(10).toString('base64'), { useCache: false })
    ).rejects.toThrow('ALL_PROVIDERS_FAILED')
    process.env.GEMINI_API_KEY = orig
  })

  test('throws when OPENROUTER_API_KEY is absent for images', async () => {
    const orig = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    // With no key the module throws before calling fetch, so no retry delays
    const expectation = expect(
      aiExtract('prompt', 'image/jpeg', Buffer.alloc(10).toString('base64'), { useCache: false })
    ).rejects.toThrow()
    await jest.runAllTimersAsync()
    await expectation
    process.env.OPENROUTER_API_KEY = orig
  }, 30_000)
})
