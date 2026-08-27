/**
 * lib/site.js — Adresse publique du site, pour tout ce qu'un moteur ou un
 * réseau social lit : URL canonique, plan du site, robots.txt, Open Graph.
 *
 * Distincte de getAppUrl() volontairement. Celle-ci sert aux appels que le
 * serveur s'adresse à lui-même et retombe sur localhost, ce qui est correct en
 * développement. Pour le SEO ce repli est un piège : robots.txt et le plan du
 * site sont générés au moment du build, donc un build sans variable
 * d'environnement publiait un plan pointant vers localhost — invisible pour un
 * moteur, et silencieux.
 *
 * Le repli est donc le domaine de production, jamais une adresse locale.
 */
const FALLBACK = 'https://hesabi.ma'

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!explicit) return FALLBACK
  if (/localhost|127\.0\.0\.1/.test(explicit)) return FALLBACK
  return explicit.replace(/\/+$/, '')
}
