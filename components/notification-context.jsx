"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

const NotificationContext = createContext({
  count: 0,
  notifications: [],
  refresh: () => {},
  dismiss: (_id) => {},
  dismissAll: () => {},
})

const POLL_INTERVAL   = 30_000
const STORAGE_KEY     = 'hesabi_dismissed_notifs'
const MAX_DISMISSED   = 500  // prune after 500 to avoid unbounded growth

function loadDismissed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

function saveDismissed(set) {
  try {
    const arr = [...set]
    // Keep only the last MAX_DISMISSED to avoid unbounded growth
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr.slice(-MAX_DISMISSED)))
  } catch {}
}

export function NotificationProvider({ initialCount = 0, children }) {
  const [allNotifications, setAllNotifications] = useState([])
  const [dismissed, setDismissed] = useState(() => new Set())

  // Load dismissed IDs from localStorage on mount (client only)
  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications")
      const data = await res.json()
      setAllNotifications(data.notifications ?? [])
    } catch {
      // keep previous state
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [refresh])

  const notifications = useMemo(
    () => allNotifications.filter(n => !dismissed.has(n.id)),
    [allNotifications, dismissed]
  )

  const count = notifications.length

  const dismiss = useCallback((id) => {
    setDismissed(prev => {
      const next = new Set(prev)
      next.add(id)
      saveDismissed(next)
      return next
    })
  }, [])

  const dismissAll = useCallback(() => {
    setDismissed(prev => {
      const next = new Set(prev)
      allNotifications.forEach(n => next.add(n.id))
      saveDismissed(next)
      return next
    })
  }, [allNotifications])

  return (
    <NotificationContext.Provider value={{ count, notifications, refresh, dismiss, dismissAll }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
