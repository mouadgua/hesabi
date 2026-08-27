import { siteUrl } from '@/lib/site'

/**
 * Plan du site — il n'existait pas non plus.
 *
 * Seules les pages publiques y figurent. Les priorités traduisent l'intention :
 * l'accueil et la démo sont les deux portes d'entrée réelles, le reste est du
 * passage obligé qu'on ne cherche pas à faire remonter.
 */
export default function sitemap() {
  const base = siteUrl()
  const now = new Date()

  return [
    { url: `${base}/`,          lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/demo`,      lastModified: now, changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/support`,   lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/login`,     lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${base}/register`,  lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ]
}
