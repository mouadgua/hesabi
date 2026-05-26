"use client"

import { useEffect, useRef, useState } from "react"
import { BellIcon, CheckCircleIcon, ClockIcon, XCircleIcon, ExternalLinkIcon } from "lucide-react"
import Link from "next/link"
import { useNotifications } from "@/components/notification-context"

const STATUS_CONFIG = {
  A_VERIFIER: {
    label: "À vérifier",
    icon: CheckCircleIcon,
    className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  },
  EN_COURS_IA: {
    label: "En cours",
    icon: ClockIcon,
    className: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  },
  REJETE: {
    label: "Rejeté",
    icon: XCircleIcon,
    className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
  },
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "À l'instant"
  if (minutes < 60) return `Il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `Il y a ${days}j`
}

export default function NotificationDropdown() {
  const { count: pendingCount, notifications, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)

  // Re-fetch with loading indicator each time the dropdown opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open])

  function toggle() {
    setOpen(v => !v)
  }

  return (
    <div className="relative" ref={ref}>
      {/* Bell trigger */}
      <button
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition-all hover:bg-slate-100 dark:hover:bg-white/[0.08] cursor-pointer"
      >
        <BellIcon className="size-4 text-slate-500 dark:text-slate-400" />
        {pendingCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#1D9E75] px-1 text-[9px] font-bold text-white shadow-sm">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-[calc(100vw-2rem)] max-w-sm sm:w-80 rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/[0.06]">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
            {pendingCount > 0 && (
              <span className="text-[10px] font-bold text-white bg-[#1D9E75] rounded-full px-2 py-0.5">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </div>

          {/* Body */}
          <div className="max-h-[min(420px,60vh)] overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="space-y-3 p-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-white/[0.06] shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-3/4 rounded bg-slate-100 dark:bg-white/[0.06]" />
                      <div className="h-2.5 w-1/2 rounded bg-slate-100 dark:bg-white/[0.06]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
                  <BellIcon className="size-5 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aucune notification</p>
                <p className="text-xs text-slate-400 dark:text-slate-600">Tous vos documents sont traités.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                {notifications.map(notif => {
                  const cfg = STATUS_CONFIG[notif.statut] ?? STATUS_CONFIG.A_VERIFIER
                  const Icon = cfg.icon
                  const filename = notif.nom_fichier?.replace(/^[a-z0-9]+_\d+\./, '') ?? 'Document'
                  const title = notif.fournisseur_detecte || filename
                  const sub = notif.client?.nom_entreprise ? `${notif.client.nom_entreprise} · ${cfg.label}` : cfg.label

                  return (
                    <li key={notif.id}>
                      <Link
                        href={`/dashboard/verification/${notif.id}`}
                        onClick={() => setOpen(false)}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.className}`}>
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{sub}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-600 shrink-0 mt-0.5">
                          {timeAgo(notif.updatedAt)}
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-100 dark:border-white/[0.06] px-4 py-2.5">
            <Link
              href="/dashboard/verification"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-[#1D9E75] hover:text-[#0F6E56] dark:hover:text-[#1D9E75]/80 transition-colors"
            >
              Voir toutes les notifications
              <ExternalLinkIcon className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
