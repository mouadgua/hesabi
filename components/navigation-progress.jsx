"use client"

import { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import NProgress from 'nprogress'

NProgress.configure({ showSpinner: false, minimum: 0.08, speed: 200, trickleSpeed: 200 })

function NavigationEvents() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    NProgress.done()
  }, [pathname, searchParams])

  return null
}

export default function NavigationProgress() {
  useEffect(() => {
    const originalPushState = history.pushState.bind(history)
    history.pushState = function (...args) {
      NProgress.start()
      return originalPushState(...args)
    }

    return () => {
      history.pushState = originalPushState
    }
  }, [])

  return (
    <Suspense fallback={null}>
      <NavigationEvents />
    </Suspense>
  )
}
