"use client"

import { useEffect } from 'react'

export default function KeyboardShortcuts() {
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('app:new-client'))
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
        e.preventDefault()
        document.dispatchEvent(new CustomEvent('app:upload'))
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return null
}
