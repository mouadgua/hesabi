// Production note: replace with Redis/Upstash for multi-instance deployments
//
// These Maps live on `global` so Turbopack/Next.js hot reloads don't wipe them.
// Same pattern as lib/prisma.js.

if (!global.__rl_sessionRequests) global.__rl_sessionRequests = new Map()
if (!global.__rl_emailUsed)       global.__rl_emailUsed       = new Map()
if (!global.__rl_accessLog)       global.__rl_accessLog       = []

const sessionRequests = global.__rl_sessionRequests  // sessionId → { count, windowStart }
const emailUsed       = global.__rl_emailUsed         // email     → timestamp
const accessLog       = global.__rl_accessLog         // newest first, capped at MAX_LOG

const MAX_LOG           = 500
const SESSION_MAX       = 2
const SESSION_WINDOW_MS = 60 * 60 * 1000          // 1 hour
const EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000     // 24 hours (secondary)

function cleanOldEntries() {
  const now = Date.now()
  for (const [sid, data] of sessionRequests) {
    if (now - data.windowStart > SESSION_WINDOW_MS) sessionRequests.delete(sid)
  }
  for (const [email, ts] of emailUsed) {
    if (now - ts > EMAIL_COOLDOWN_MS) emailUsed.delete(email)
  }
}

export function checkDemoRateLimit(sessionId, email) {
  cleanOldEntries()
  const now = Date.now()

  // ── Session check (primary gate) ─────────────────────────────────────────────
  if (sessionId) {
    const sData = sessionRequests.get(sessionId)
    if (sData) {
      const elapsed = now - sData.windowStart
      if (elapsed < SESSION_WINDOW_MS && sData.count >= SESSION_MAX) {
        const waitMinutes = Math.ceil((SESSION_WINDOW_MS - elapsed) / 60000)
        logAccess(sessionId, email, 'BLOCKED_SESSION')
        return { allowed: false, reason: 'session', waitMinutes }
      }
    }
  }

  // ── Email check (secondary) ──────────────────────────────────────────────────
  const emailTs = emailUsed.get(email)
  if (emailTs) {
    const elapsed = now - emailTs
    if (elapsed < EMAIL_COOLDOWN_MS) {
      const waitHours = Math.ceil((EMAIL_COOLDOWN_MS - elapsed) / 3600000)
      logAccess(sessionId, email, 'BLOCKED_EMAIL')
      return { allowed: false, reason: 'email', waitHours }
    }
  }

  return { allowed: true }
}

export function recordDemoRequest(sessionId, email, docType = 'unknown') {
  const now = Date.now()
  if (sessionId) {
    const sData = sessionRequests.get(sessionId)
    if (!sData || now - sData.windowStart > SESSION_WINDOW_MS) {
      sessionRequests.set(sessionId, { count: 1, windowStart: now })
    } else {
      sData.count += 1
    }
  }
  emailUsed.set(email, now)
  logAccess(sessionId, email, 'SUCCESS', docType)
}

function logAccess(sessionId, email, status, docType = null) {
  accessLog.unshift({ ts: new Date().toISOString(), sessionId, email, status, docType })
  if (accessLog.length > MAX_LOG) accessLog.length = MAX_LOG
}

export function getDemoLog()   { return accessLog }

export function getDemoStats() {
  const success = accessLog.filter(e => e.status === 'SUCCESS')
  const blocked = accessLog.filter(e => e.status.startsWith('BLOCKED'))
  return {
    total:          success.length,
    blocked:        blocked.length,
    uniqueSessions: new Set(accessLog.map(e => e.sessionId)).size,
    uniqueEmails:   new Set(success.map(e => e.email)).size,
    logSize:        accessLog.length,
  }
}
