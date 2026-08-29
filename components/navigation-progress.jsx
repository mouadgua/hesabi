"use client"

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { startProgress, doneProgress } from '@/lib/progress'

function RouteChangeListener() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    doneProgress()
  }, [pathname, searchParams])

  return null
}

export default function NavigationProgress() {
  const currentPath = useRef(typeof window !== 'undefined' ? window.location.pathname : '')

  useEffect(() => {
    function handleClick(e) {
      const anchor = e.target.closest('a[href]')
      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return
      // Skip external, hash, mailto, tel links
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto') || href.startsWith('tel')) return
      // Skip same-page
      const target = href.split('?')[0]
      if (target === window.location.pathname) return

      startProgress()
    }

    // Les boutons qui naviguent par router.push ne produisent pas de clic sur
    // un lien : la barre restait muette sur « Vérifier », « Quitter », ou tout
    // retour après une action. On les couvre en observant l'API d'historique,
    // que Next.js utilise sous le capot.
    const { pushState, replaceState } = window.history
    window.history.pushState = function (...args) {
      startProgress()
      return pushState.apply(this, args)
    }
    window.history.replaceState = function (...args) {
      startProgress()
      return replaceState.apply(this, args)
    }

    document.addEventListener('click', handleClick, true)
    return () => {
      document.removeEventListener('click', handleClick, true)
      // Restauration : laisser les fonctions remplacées après démontage
      // ferait démarrer une barre que plus personne ne termine.
      window.history.pushState = pushState
      window.history.replaceState = replaceState
    }
  }, [])

  return (
    <Suspense fallback={null}>
      <RouteChangeListener />
    </Suspense>
  )
}
