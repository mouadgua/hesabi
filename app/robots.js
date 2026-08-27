import { siteUrl } from '@/lib/site'

/**
 * robots.txt — il n'existait pas, la route renvoyait 404.
 *
 * Sans lui, un moteur explore tout ce qu'il trouve, y compris les pages
 * authentifiées et les routes d'API : du budget d'exploration dépensé sur des
 * URL qui ne peuvent rien lui rendre, et qui répondent par des redirections
 * vers la connexion.
 *
 * Il déclare aussi l'emplacement du plan du site, ce qui reste le moyen le plus
 * direct de faire découvrir les pages publiques.
 */
export default function robots() {
  const base = siteUrl()
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      // Espaces privés ou sans intérêt pour un moteur : tout y est derrière une
      // session, et l'exploration n'y récolte que des redirections.
      disallow: ['/dashboard/', '/admin/', '/api/', '/onboarding/', '/reset-password/'],
    }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
