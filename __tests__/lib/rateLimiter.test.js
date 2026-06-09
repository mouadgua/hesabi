// We test the rate limiter by manipulating the global Maps it uses.
// Each test clears state to ensure isolation.

// Import after clearing so we get a fresh module
let checkDemoRateLimit, recordDemoRequest, getDemoLog, getDemoStats

beforeAll(async () => {
  // Clear all global state before importing
  delete global.__rl_sessionRequests
  delete global.__rl_emailUsed
  delete global.__rl_accessLog
  const mod = await import('../../lib/rateLimiter.js')
  checkDemoRateLimit = mod.checkDemoRateLimit
  recordDemoRequest  = mod.recordDemoRequest
  getDemoLog         = mod.getDemoLog
  getDemoStats       = mod.getDemoStats
})

beforeEach(() => {
  // Reset the Maps referenced by the module
  global.__rl_sessionRequests.clear()
  global.__rl_emailUsed.clear()
  global.__rl_accessLog.length = 0
})

// ── checkDemoRateLimit ─────────────────────────────────────────────────────────

describe('checkDemoRateLimit', () => {
  test('allows first request for a new session', () => {
    const result = checkDemoRateLimit('session-1', 'a@example.com')
    expect(result.allowed).toBe(true)
  })

  test('blocks after SESSION_MAX (2) requests in the same window', () => {
    const sid = 'session-x'
    const email = 'x@example.com'
    // Use up the quota
    recordDemoRequest(sid, email)
    recordDemoRequest(sid, email + '2')

    const blocked = checkDemoRateLimit(sid, 'new@example.com')
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toBe('session')
    expect(blocked.waitMinutes).toBeGreaterThan(0)
  })

  test('blocks same email used within cooldown period', () => {
    const email = 'repeat@example.com'
    recordDemoRequest('sess-A', email)
    // Different session but same email
    const result = checkDemoRateLimit('sess-B', email)
    expect(result.allowed).toBe(false)
    expect(result.reason).toBe('email')
    expect(result.waitHours).toBeGreaterThan(0)
  })

  test('allows different session+email combination', () => {
    recordDemoRequest('sess-1', 'user1@test.com')
    const r = checkDemoRateLimit('sess-2', 'user2@test.com')
    expect(r.allowed).toBe(true)
  })

  test('session check takes priority over email check', () => {
    const sid = 'priority-sess'
    recordDemoRequest(sid, 'p@test.com')
    recordDemoRequest(sid, 'p2@test.com')
    // Now session is exhausted — even with a new email, session blocks first
    const r = checkDemoRateLimit(sid, 'brand-new@test.com')
    expect(r.allowed).toBe(false)
    expect(r.reason).toBe('session')
  })
})

// ── recordDemoRequest ─────────────────────────────────────────────────────────

describe('recordDemoRequest', () => {
  test('records a session request and logs it', () => {
    recordDemoRequest('rec-sess', 'rec@example.com', 'facture')
    const log = getDemoLog()
    expect(log.length).toBe(1)
    expect(log[0].status).toBe('SUCCESS')
    expect(log[0].email).toBe('rec@example.com')
    expect(log[0].docType).toBe('facture')
  })

  test('increments count for same session on repeated calls', () => {
    const sid = 'count-sess'
    recordDemoRequest(sid, 'c@example.com')
    recordDemoRequest(sid, 'c2@example.com')
    // After 2, next check should be blocked
    const r = checkDemoRateLimit(sid, 'c3@example.com')
    expect(r.allowed).toBe(false)
  })

  test('works without a session ID', () => {
    expect(() => recordDemoRequest(null, 'nosess@test.com')).not.toThrow()
  })
})

// ── getDemoStats ──────────────────────────────────────────────────────────────

describe('getDemoStats', () => {
  test('returns zero stats on empty log', () => {
    const s = getDemoStats()
    expect(s.total).toBe(0)
    expect(s.blocked).toBe(0)
    expect(s.logSize).toBe(0)
  })

  test('counts successes and blocked correctly', () => {
    recordDemoRequest('s1', 'a@t.com')
    recordDemoRequest('s2', 'b@t.com')
    // Trigger a session block
    recordDemoRequest('s1', 'c@t.com')  // exceeds quota
    checkDemoRateLimit('s1', 'd@t.com') // this logs BLOCKED_SESSION

    const s = getDemoStats()
    expect(s.total).toBeGreaterThanOrEqual(2)   // at least 2 successes
    expect(s.blocked).toBeGreaterThanOrEqual(1)  // at least 1 block
  })

  test('counts unique sessions and emails', () => {
    recordDemoRequest('sess-A', 'a@t.com')
    recordDemoRequest('sess-B', 'b@t.com')
    const s = getDemoStats()
    expect(s.uniqueSessions).toBeGreaterThanOrEqual(2)
    expect(s.uniqueEmails).toBeGreaterThanOrEqual(2)
  })
})
