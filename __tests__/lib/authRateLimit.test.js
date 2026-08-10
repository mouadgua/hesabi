/**
 * Tests du rate limiter d'authentification.
 *
 * Upstash n'est volontairement pas configuré ici : ces tests exercent le repli
 * mémoire, qui est le chemin emprunté en CI et en développement local. Le
 * chemin Redis est vérifié séparément contre une instance réelle.
 */

let checkAuthRateLimit, LIMITS, formatRetryDelay, clientIp

beforeEach(async () => {
  jest.resetModules()
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.UPSTASH_REDIS_REST_TOKEN
  global.__authRlFallback = new Map()
  ;({ checkAuthRateLimit, LIMITS, formatRetryDelay, clientIp } = await import('@/lib/authRateLimit'))
})

describe('checkAuthRateLimit', () => {
  it('autorise les tentatives sous la limite', async () => {
    const { max } = LIMITS.login
    for (let i = 1; i <= max; i++) {
      const r = await checkAuthRateLimit('login', 'ip:1.2.3.4')
      expect(r.allowed).toBe(true)
      expect(r.remaining).toBe(max - i)
    }
  })

  it('bloque au-delà de la limite et indique un délai', async () => {
    const { max } = LIMITS.login
    for (let i = 0; i < max; i++) await checkAuthRateLimit('login', 'ip:5.6.7.8')

    const blocked = await checkAuthRateLimit('login', 'ip:5.6.7.8')
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('compte séparément deux identifiants distincts', async () => {
    const { max } = LIMITS.login
    for (let i = 0; i < max; i++) await checkAuthRateLimit('login', 'ip:10.0.0.1')

    expect((await checkAuthRateLimit('login', 'ip:10.0.0.1')).allowed).toBe(false)
    // Une autre IP ne doit pas être affectée
    expect((await checkAuthRateLimit('login', 'ip:10.0.0.2')).allowed).toBe(true)
  })

  it('compte séparément deux actions pour un même identifiant', async () => {
    const { max } = LIMITS.register
    for (let i = 0; i < max; i++) await checkAuthRateLimit('register', 'ip:9.9.9.9')

    expect((await checkAuthRateLimit('register', 'ip:9.9.9.9')).allowed).toBe(false)
    // Le budget login de la même IP reste intact
    expect((await checkAuthRateLimit('login', 'ip:9.9.9.9')).allowed).toBe(true)
  })

  it('rejette une action inconnue plutôt que de laisser passer', async () => {
    await expect(checkAuthRateLimit('inexistant', 'ip:1.1.1.1')).rejects.toThrow(/Action inconnue/)
  })

  it('repart à zéro une fois la fenêtre expirée', async () => {
    const { max } = LIMITS.login
    for (let i = 0; i < max; i++) await checkAuthRateLimit('login', 'ip:7.7.7.7')
    expect((await checkAuthRateLimit('login', 'ip:7.7.7.7')).allowed).toBe(false)

    // Simule l'expiration en reculant la date de fin de fenêtre
    const entry = global.__authRlFallback.get('authrl:login:ip:7.7.7.7')
    entry.resetAt = Date.now() - 1

    expect((await checkAuthRateLimit('login', 'ip:7.7.7.7')).allowed).toBe(true)
  })

  it('bascule sur le repli mémoire si Redis échoue, sans bloquer l\'utilisateur', async () => {
    jest.resetModules()
    process.env.UPSTASH_REDIS_REST_URL   = 'https://exemple-invalide.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token-invalide'
    global.__authRlFallback = new Map()
    global.fetch = jest.fn().mockRejectedValue(new Error('réseau indisponible'))
    const mod = await import('@/lib/authRateLimit')

    const r = await mod.checkAuthRateLimit('login', 'ip:2.2.2.2')
    expect(r.allowed).toBe(true)   // fail open : une panne Redis ne verrouille personne
    delete global.fetch
  })
})

describe('formatRetryDelay', () => {
  it('formate secondes, minutes et heures', () => {
    expect(formatRetryDelay(30)).toBe('30 secondes')
    expect(formatRetryDelay(1)).toBe('1 seconde')
    expect(formatRetryDelay(120)).toBe('2 minutes')
    expect(formatRetryDelay(3600)).toBe('1 heure')
    expect(formatRetryDelay(7200)).toBe('2 heures')
  })
})

describe('clientIp', () => {
  const h = map => ({ get: k => map[k] ?? null })

  it('prend la première IP de x-forwarded-for', () => {
    expect(clientIp(h({ 'x-forwarded-for': '203.0.113.1, 70.41.3.18' }))).toBe('203.0.113.1')
  })

  it('retombe sur x-real-ip puis sur une valeur par défaut', () => {
    expect(clientIp(h({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7')
    expect(clientIp(h({}))).toBe('127.0.0.1')
  })
})
