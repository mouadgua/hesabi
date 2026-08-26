"use client"

import { usePathname } from 'next/navigation'
import { Analytics } from '@vercel/analytics/react'

/**
 * Mesure d'audience, limitée aux pages publiques.
 *
 * Deux raisons de ne pas la monter partout :
 *
 * 1. Les pages authentifiées servent une CSP stricte à nonce avec
 *    `strict-dynamic`. Le paquet @vercel/analytics n'expose pas de prop `nonce`
 *    (vérifié en 2.0.1), son script y serait donc bloqué — sans rien casser,
 *    mais en salissant la console à chaque navigation.
 *
 * 2. Le plan Hobby inclut 50 000 événements par mois, partagés entre tous les
 *    projets du compte. La navigation interne d'un cabinet dans son tableau de
 *    bord n'est pas du trafic à analyser : la compter reviendrait à dépenser le
 *    quota pour une donnée qu'on ne regardera jamais.
 */
const PRIVATE_PREFIXES = ['/dashboard', '/admin']

export default function PublicAnalytics() {
  const pathname = usePathname()
  if (PRIVATE_PREFIXES.some(p => pathname?.startsWith(p))) return null
  return <Analytics />
}
