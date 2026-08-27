/**
 * lib/env.js
 *
 * Startup validation of the environment.
 *
 * Without this, the app boots happily with a missing key and only fails later,
 * inside a user's request, with an error that rarely names the real cause —
 * a missing WORKER_SECRET silently disabled a cron guard, and a missing
 * service role key fell back to the public anon key, breaking storage writes
 * in a way that looked like a permissions bug.
 *
 * Called once from instrumentation.js (server boot).
 */

// Required everywhere — the app cannot serve a single authenticated page without these.
const REQUIRED = [
  ['NEXT_PUBLIC_SUPABASE_URL',      'URL du projet Supabase'],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'Clé anon Supabase (client)'],
  ['SUPABASE_SERVICE_ROLE_KEY',     'Clé service role — uploads et storage côté serveur'],
  ['DATABASE_URL',                  'URL pooler de la base (requêtes Prisma)'],
]

// Required in production only. In development their absence is a warning:
// the app still runs, degraded, which is what you want locally.
const REQUIRED_IN_PROD = [
  ['DIRECT_URL',        'URL directe de la base (migrations, scripts)'],
  ['GEMINI_API_KEY',    'Extraction IA principale — ou GEMINI_API_KEYS pour plusieurs clés'],
  ['WORKER_SECRET',     'Authentifie le worker d\'extraction et le cron de recovery'],
  ['NEXT_PUBLIC_APP_URL', 'URL publique — sans elle les appels internes au worker pointent sur localhost'],
]

// Optional: the feature they power is simply unavailable without them.
const OPTIONAL = [
  ['GEMINI_API_KEYS',                       'Clés du tableau de bord, séparées par des virgules — relais automatique sur quota'],
  ['GEMINI_DEMO_API_KEY',                   'Clé réservée à la démo publique — isole son quota de celui des cabinets'],
  ['OPENROUTER_API_KEY',                    'Chaîne de repli IA (Claude / GPT / Qwen)'],
  ['RESEND_API_KEY',                        'Envoi d\'emails (formulaire de contact)'],
  ['IP_HASH_SALT',                          'Hachage des IP de la démo — un défaut faible est utilisé sinon'],
  ['DEMO_ADMIN_SECRET',                     'Accès aux statistiques de la démo'],
  // DSN Sentry : sans lui, aucune erreur n'est remontée. Facultatif au sens
  // où l'application fonctionne sans, mais c'est alors sans filet.
  ['SENTRY_DSN',                            'Remontée des erreurs serveur'],
  ['NEXT_PUBLIC_SENTRY_DSN',                'Remontée des erreurs navigateur — figé au build'],
  ['UPSTASH_REDIS_REST_URL',                'Rate limiting distribué'],
  ['UPSTASH_REDIS_REST_TOKEN',              'Rate limiting distribué'],
  ['AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',  'OCR Azure (mode hybride)'],
  ['AZURE_DOCUMENT_INTELLIGENCE_KEY',       'OCR Azure (mode hybride)'],
]

const isSet = name => {
  const v = process.env[name]
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Checks the environment and reports.
 * @returns {{ ok: boolean, missing: string[], degraded: string[] }}
 */
export function validateEnv({ log = true } = {}) {
  const isProd = process.env.NODE_ENV === 'production'

  const missing  = []   // hard failures
  const degraded = []   // features unavailable / running degraded

  for (const [name, why] of REQUIRED) {
    if (!isSet(name)) missing.push(`${name} — ${why}`)
  }
  for (const [name, why] of REQUIRED_IN_PROD) {
    if (isSet(name)) continue
    ;(isProd ? missing : degraded).push(`${name} — ${why}`)
  }
  for (const [name, why] of OPTIONAL) {
    if (!isSet(name)) degraded.push(`${name} — ${why}`)
  }

  // A silent fallback from service role to the anon key looks like a
  // permissions bug at runtime; surface it as its own line.
  if (!isSet('SUPABASE_SERVICE_ROLE_KEY') && isSet('NEXT_PUBLIC_SUPABASE_ANON_KEY')) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY absente — le code retomberait sur la clé anon publique, les écritures storage échoueraient')
  }

  if (log) {
    if (missing.length) {
      console.error(
        `\n[env] ${missing.length} variable(s) requise(s) manquante(s)` +
        `${isProd ? ' — DÉMARRAGE EN PRODUCTION COMPROMIS' : ''} :`
      )
      for (const m of missing) console.error(`  ✗ ${m}`)
    }
    if (degraded.length) {
      console.warn(`\n[env] ${degraded.length} fonctionnalité(s) indisponible(s) :`)
      for (const d of degraded) console.warn(`  · ${d}`)
    }
    if (!missing.length && !degraded.length) {
      console.log('[env] Toutes les variables attendues sont présentes.')
    }
  }

  return { ok: missing.length === 0, missing, degraded }
}

/**
 * URL publique de l'application, pour les appels que le serveur s'adresse à
 * lui-même (relance du répartiteur d'extraction, notamment).
 *
 * L'ordre compte. `NEXT_PUBLIC_APP_URL` d'abord : c'est le domaine stable, et
 * en production c'est celui qu'on veut. `VERCEL_URL` ensuite, que la plateforme
 * renseigne seule à chaque déploiement — sans ce repli, un déploiement de
 * preview n'a aucune URL à se donner et le code retombait sur localhost, où
 * une fonction serverless ne trouve évidemment personne. Le worker traitait
 * alors son premier lot puis n'arrivait plus à se relancer.
 *
 * @returns {string} URL absolue, sans barre oblique finale
 */
export function getAppUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')

  const vercel = process.env.VERCEL_URL?.trim()
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`

  return 'http://localhost:3000'
}
