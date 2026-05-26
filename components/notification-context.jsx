"use client"

import { createContext, useContext, useEffect, useState } from "react"

const NotificationContext = createContext({ count: 0, notifications: [], refresh: () => {} })

const POLL_INTERVAL = 30_000

export function NotificationProvider({ initialCount = 0, children }) {
  const [count, setCount] = useState(initialCount)
  const [notifications, setNotifications] = useState([])

  async function refresh() {
    try {
      const res = await fetch("/api/notifications")
      const data = await res.json()
      const notifs = data.notifications ?? []
      setNotifications(notifs)
      setCount(notifs.length)
    } catch {
      // keep previous state
    }
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return (
    <NotificationContext.Provider value={{ count, notifications, refresh }}>
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationContext)
}
