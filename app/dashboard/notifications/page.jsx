"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  BellIcon, CheckCircleIcon, ClockIcon, XCircleIcon,
  CheckIcon, CheckCheckIcon, ExternalLinkIcon, FilterIcon,
} from "lucide-react"
import { useNotifications } from "@/components/notification-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

const STATUS_CONFIG = {
  A_VERIFIER: {
    label: "À vérifier",
    icon: CheckCircleIcon,
    badgeClass: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20",
    iconClass: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10",
  },
  EN_COURS_IA: {
    label: "En cours",
    icon: ClockIcon,
    badgeClass: "bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20",
    iconClass: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10",
  },
  REJETE: {
    label: "Rejeté",
    icon: XCircleIcon,
    badgeClass: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20",
    iconClass: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10",
  },
}

const FILTERS = [
  { key: "ALL",        label: "Toutes" },
  { key: "A_VERIFIER", label: "À vérifier" },
  { key: "REJETE",     label: "Rejetées" },
  { key: "EN_COURS_IA",label: "En cours" },
]

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

export default function NotificationsPage() {
  const { notifications, dismiss, dismissAll } = useNotifications()
  const [filter, setFilter] = useState("ALL")

  const filtered = useMemo(() =>
    filter === "ALL"
      ? notifications
      : notifications.filter(n => n.statut === filter),
    [notifications, filter]
  )

  const counts = useMemo(() => ({
    ALL:         notifications.length,
    A_VERIFIER:  notifications.filter(n => n.statut === "A_VERIFIER").length,
    REJETE:      notifications.filter(n => n.statut === "REJETE").length,
    EN_COURS_IA: notifications.filter(n => n.statut === "EN_COURS_IA").length,
  }), [notifications])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">

      {/* Page header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 dark:text-slate-100">
            <BellIcon className="size-5 text-[#1D9E75]" />
            Notifications
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {notifications.length === 0
              ? "Aucune notification en attente."
              : `${notifications.length} document${notifications.length > 1 ? "s" : ""} en attente de traitement.`}
          </p>
        </div>

        {notifications.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={dismissAll}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300"
          >
            <CheckCheckIcon className="size-3.5" />
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      {notifications.length > 0 && (
        <div className="mb-4 flex gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-white/[0.04] border border-slate-200/60 dark:border-white/[0.06] w-fit">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                filter === f.key
                  ? "bg-white dark:bg-white/[0.08] text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              }`}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  filter === f.key
                    ? "bg-[#1D9E75] text-white"
                    : "bg-slate-200 dark:bg-white/[0.08] text-slate-500 dark:text-slate-400"
                }`}>
                  {counts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] py-20 gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06]">
            <BellIcon className="size-6 text-slate-300 dark:text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              {filter === "ALL" ? "Aucune notification" : "Aucune notification dans cette catégorie"}
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-600">
              {filter === "ALL"
                ? "Tous vos documents sont traités."
                : "Essayez un autre filtre."}
            </p>
          </div>
          {filter !== "ALL" && (
            <button
              onClick={() => setFilter("ALL")}
              className="text-xs text-[#1D9E75] hover:underline mt-1"
            >
              Voir toutes les notifications
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/60 dark:border-white/[0.06] bg-white/60 dark:bg-white/[0.02] overflow-hidden divide-y divide-slate-100 dark:divide-white/[0.04]">
          {filtered.map(notif => {
            const cfg    = STATUS_CONFIG[notif.statut] ?? STATUS_CONFIG.A_VERIFIER
            const Icon   = cfg.icon
            const filename = notif.nom_fichier?.replace(/^[a-z0-9]+_\d+\./, '') ?? 'Document'
            const title  = notif.fournisseur_detecte || filename
            const client = notif.client?.nom_entreprise

            return (
              <div key={notif.id} className="group flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors">

                {/* Status icon */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${cfg.iconClass}`}>
                  <Icon className="size-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {title}
                    </span>
                    <Badge className={`text-[10px] font-semibold px-1.5 py-0 ${cfg.badgeClass}`}>
                      {cfg.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                    {client ? `${client} · ` : ""}{filename}{" · "}{timeAgo(notif.updatedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/dashboard/verification/${notif.id}`}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] font-medium text-[#1D9E75] hover:underline transition-opacity"
                  >
                    Ouvrir
                    <ExternalLinkIcon className="size-3" />
                  </Link>

                  <button
                    onClick={() => dismiss(notif.id)}
                    title="Marquer comme lu"
                    className="flex items-center justify-center h-7 w-7 rounded-full border border-slate-200 dark:border-white/[0.10] bg-white dark:bg-white/[0.04] text-slate-400 hover:border-[#1D9E75] hover:text-[#1D9E75] hover:bg-[#E1F5EE] dark:hover:bg-[#1D9E75]/20 transition-all"
                    aria-label="Marquer comme lu"
                  >
                    <CheckIcon className="size-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
