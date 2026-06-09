"use client"

import { useState, useMemo, useTransition } from 'react'
import { StarIcon, FilterXIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

function Stars({ n, size = 'sm' }) {
  const sz = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <StarIcon key={i} className={`${sz} ${i <= n ? 'fill-amber-400 text-amber-400' : 'text-slate-200 dark:text-slate-700'}`} />
      ))}
    </span>
  )
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

async function markReadAction(id, read) {
  await fetch(`/api/admin/ratings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read }),
  })
}

export default function RatingsHub({ rows: initialRows, avg, dist }) {
  const [rows, setRows]       = useState(initialRows)
  const [filter, setFilter]   = useState(0)
  const [showUnread, setUnread] = useState(false)
  const [isPending, start]    = useTransition()

  const filtered = useMemo(() => {
    let r = rows
    if (filter > 0) r = r.filter(x => x.rating === filter)
    if (showUnread) r = r.filter(x => !x.read)
    return r
  }, [rows, filter, showUnread])

  function toggleRead(id, current) {
    start(async () => {
      try {
        await markReadAction(id, !current)
        setRows(prev => prev.map(r => r.id === id ? { ...r, read: !current } : r))
      } catch { toast.error('Erreur.') }
    })
  }

  const unreadCount = rows.filter(r => !r.read).length

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Ratings & Inbox</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Feedback utilisateurs</p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-4 items-center">
        {avg !== null && (
          <div className="flex items-center gap-2">
            <Stars n={Math.round(avg)} size="md" />
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">{avg.toFixed(1)}</span>
            <span className="text-sm text-slate-400">/ 5 · {rows.length} avis</span>
          </div>
        )}
        {avg === null && (
          <p className="text-sm text-slate-400">Aucun rating reçu pour l'instant.</p>
        )}
      </div>

      {/* Distribution */}
      {rows.length > 0 && (
        <div className="space-y-1.5">
          {dist.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2 text-sm">
              <button
                onClick={() => setFilter(filter === star ? 0 : star)}
                className={`flex items-center gap-1 w-20 shrink-0 cursor-pointer ${filter === star ? 'text-[#1D9E75] font-semibold' : 'text-slate-500'}`}
              >
                <StarIcon className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {star} étoile{star > 1 ? 's' : ''}
              </button>
              <div className="flex-1 h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: rows.length > 0 ? `${(count / rows.length) * 100}%` : '0%' }}
                />
              </div>
              <span className="text-[12px] text-slate-400 tabular-nums w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 items-center flex-wrap">
        <button
          onClick={() => setUnread(v => !v)}
          className={`h-9 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${showUnread ? 'bg-[#1D9E75] text-white' : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}
        >
          Non lus {unreadCount > 0 && `(${unreadCount})`}
        </button>
        {(filter > 0 || showUnread) && (
          <button onClick={() => { setFilter(0); setUnread(false) }} className="h-9 px-3 rounded-lg text-xs text-slate-500 flex items-center gap-1 hover:bg-slate-100 cursor-pointer">
            <FilterXIcon className="h-3.5 w-3.5" /> Effacer
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} / {rows.length}</span>
      </div>

      {/* Table */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-400 rounded-xl border border-dashed border-slate-200 dark:border-white/[0.07]">
            Aucun rating{rows.length > 0 ? ' correspondant au filtre' : ''}. Les ratings soumis depuis le dashboard apparaîtront ici.
          </div>
        )}
        {filtered.map(r => (
          <div
            key={r.id}
            className={`rounded-xl border p-4 transition-colors ${r.read ? 'border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.02]' : 'border-[#1D9E75]/30 bg-[#1D9E75]/5 dark:bg-[#1D9E75]/5'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Stars n={r.rating} />
                  {!r.read && <Badge className="text-[10px] border-0 bg-[#1D9E75] text-white">Nouveau</Badge>}
                </div>
                <p className="text-[12px] text-slate-400">{r.email ?? 'Anonyme'} · {fmt(r.createdAt)}</p>
              </div>
              <button
                onClick={() => toggleRead(r.id, r.read)}
                disabled={isPending}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                {r.read ? 'Marquer non lu' : 'Marquer lu'}
              </button>
            </div>
            {r.comment && (
              <p className="mt-2 text-[13px] text-slate-700 dark:text-slate-200 leading-relaxed">{r.comment}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
