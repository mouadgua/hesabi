"use client"

import { useEffect, useRef, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'

NProgress.configure({ showSpinner: false, minimum: 0.08, trickleSpeed: 200 })

function RouteChangeListener() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    NProgress.done()
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

      NProgress.start()
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [])

  return (
    <Suspense fallback={null}>
      <RouteChangeListener />
    </Suspense>
  )
}
