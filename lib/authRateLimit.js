/**
 * lib/authRateLimit.js
 *
 * Rate limiting for the unauthenticated entry points: login, registration,
 * password reset and the contact form. None of them had any limit, leaving
 * password brute-force, account enumeration and contact spam wide open.
 *
 * Backed by Upstash Redis so the counter is shared across Vercel instances —
 * an in-memory Map would be trivially bypassed by hitting a different one.
 * No SDK: the REST API is two fetch calls, and this avoids adding a dependency
 * for what amounts to INCR + EXPIRE.
 *
 * Fails **open** on Redis errors. A monitoring outage must not lock users out
 * of their own accounts; the risk window is bounded and logged. This is the
 * opposite trade-off from the cron guard (which fails closed) because there the
 * failure mode is mass data mutation, here it is denial of service to legitimate
 * users.
 */

const URL   = process.env.UPSTASH_REDIS_REST_URL
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

// In-memory fallback when Upstash isn't configured (local dev, CI).
// Per-instance only — good enough for development, never relied on in prod.
if (!global.__authRlFallback) global.__authRlFallback = new Map()
const fallback = global.__authRlFallback

/**
 * Budgets per action.
 *
 * Accounting firms sit behind a single office IP, so a per-IP budget tight
 * enough to stop brute force would lock out the whole firm the moment one
 * employee mistypes a few times. The limits are therefore split:
 *
 *   · per account  — tight, this is what actually stops brute force
 *   · per IP       — loose, only catches someone spraying many accounts
 *
 * Successful logins clear the counters (see resetAuthRateLimit), so a user who
 * fumbles their password twice and then succeeds carries nothing forward.
 */
export const LIMITS = {
  login:         { max: 10, windowSec: 15 * 60 },  // par compte : 10 échecs / 15 min
  loginIp:       { max: 60, windowSec: 15 * 60 },  // par IP : large, un bureau entier tient dedans
  register:      { max: 5,  windowSec: 60 * 60 },
  passwordReset: { max: 5,  windowSec: 60 * 60 },  // par email
  passwordResetIp: { max: 30, windowSec: 60 * 60 },// par IP, même raison
  contact:       { max: 5,  windowSec: 60 * 60 },
}

async function redis(command) {
  const res = await fetch(URL, {
    method:  'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(command),
    cache:   'no-store',
  })
  if (!res.ok) throw new Error(`Upstash HTTP ${res.status}`)
  const { result } = await res.json()
  return result
}

function checkFallback(key, max, windowSec) {
  const now = Date.now()
  const e = fallback.get(key)
  if (!e || now > e.resetAt) {
    fallback.set(key, { count: 1, resetAt: now + windowSec * 1000 })
    return { allowed: true, remaining: max - 1, retryAfterSec: 0 }
  }
  e.count += 1
  const retryAfterSec = Math.ceil((e.resetAt - now) / 1000)
  return e.count > max
    ? { allowed: false, remaining: 0, retryAfterSec }
    : { allowed: true, remaining: max - e.count, retryAfterSec }
}

/**
 * Records an attempt and says whether it is allowed.
 *
 * @param {keyof typeof LIMITS} action
 * @param {string} identifier  IP, or email for per-account limits
 * @returns {Promise<{allowed: boolean, remaining: number, retryAfterSec: number}>}
 */
export async function checkAuthRateLimit(action, identifier) {
  const limit = LIMITS[action]
  if (!limit) throw new Error(`Action inconnue pour le rate limit : ${action}`)

  const key = `authrl:${action}:${identifier}`
  const { max, windowSec } = limit

  if (!URL || !TOKEN) return checkFallback(key, max, windowSec)

  try {
    // INCR then EXPIRE only on first hit, so the window starts at the first
    // attempt and isn't extended by subsequent ones (no sliding lockout).
    const count = await redis(['INCR', key])
    if (count === 1) await redis(['EXPIRE', key, String(windowSec)])

    if (count > max) {
      const ttl = await redis(['TTL', key])
      return { allowed: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec }
    }
    return { allowed: true, remaining: max - count, retryAfterSec: 0 }
  } catch (err) {
    console.error(`[authRateLimit] Redis indisponible (${err.message}) — repli mémoire`)
    return checkFallback(key, max, windowSec)
  }
}

/**
 * Clears the counters for an identifier — call after a successful login so
 * that only *failed* attempts accumulate. Without this, a user who mistypes
 * their password a few times keeps burning budget for the rest of the window
 * even once they are in.
 */
export async function resetAuthRateLimit(action, identifier) {
  const key = `authrl:${action}:${identifier}`
  fallback.delete(key)
  if (!URL || !TOKEN) return
  try {
    await redis(['DEL', key])
  } catch (err) {
    // Non-fatal: the counter simply expires on its own at the end of the window.
    console.warn(`[authRateLimit] Reset impossible (${err.message})`)
  }
}

/** Client IP from the proxy headers, with a stable fallback. */
export function clientIp(headers) {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    '127.0.0.1'
  )
}

/** "3 minutes" / "2 heures" — for user-facing messages. */
export function formatRetryDelay(sec) {
  if (sec < 60) return `${sec} seconde${sec > 1 ? 's' : ''}`
  const min = Math.ceil(sec / 60)
  if (min < 60) return `${min} minute${min > 1 ? 's' : ''}`
  const h = Math.ceil(min / 60)
  return `${h} heure${h > 1 ? 's' : ''}`
}
