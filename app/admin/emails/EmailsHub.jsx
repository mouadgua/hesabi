"use client"

import { useState, useMemo } from 'react'
import { SearchIcon, FilterXIcon, DownloadIcon, CheckCircle2Icon, UserCheckIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function exportCSV(rows) {
  const header = ['Email', 'Date', 'Demo complétée', 'Converti', 'Type doc', 'IP hash']
  const lines = rows.map(r => [
    r.email, r.createdAt, r.demo_completed ? 'Oui' : 'Non',
    r.converted ? 'Oui' : 'Non', r.doc_type ?? '', r.ip_hash ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `hesabi-emails-${new Date().toISOString().slice(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function EmailsHub({ initialRows }) {
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('all')
  const [contacted, setContacted] = useState(new Set())

  const filtered = useMemo(() => {
    let rows = initialRows
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r => r.email.toLowerCase().includes(q))
    }
    if (filter === 'converted') rows = rows.filter(r => r.converted)
    if (filter === 'not_converted') rows = rows.filter(r => !r.converted)
    if (filter === 'contacted') rows = rows.filter(r => contacted.has(r.id))
    return rows
  }, [initialRows, search, filter, contacted])

  const hasFilter = search || filter !== 'all'

  function toggleContacted(id) {
    setContacted(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const stats = {
    total:     initialRows.length,
    converted: initialRows.filter(r => r.converted).length,
    completed: initialRows.filter(r => r.demo_completed).length,
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Emails Collectés</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {stats.total} email{stats.total !== 1 ? 's' : ''} — {stats.converted} convertis — {stats.completed} démos complètes
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} className="gap-1.5 h-9">
          <DownloadIcon className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un email…" className="pl-9 h-9 text-sm" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', 'converted', 'not_converted', 'contacted'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-9 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filter === f
                  ? 'bg-[#1D9E75] text-white'
                  : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08]'
              }`}
            >
              {f === 'all' ? 'Tous' : f === 'converted' ? 'Convertis' : f === 'not_converted' ? 'Non convertis' : 'Contactés'}
            </button>
          ))}
          {hasFilter && (
            <button onClick={() => { setSearch(''); setFilter('all') }} className="h-9 px-3 rounded-lg text-xs text-slate-500 flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-white/[0.05] cursor-pointer">
              <FilterXIcon className="h-3.5 w-3.5" /> Effacer
            </button>
          )}
        </div>
        <span className="ml-auto text-xs text-slate-400">{filtered.length} / {initialRows.length}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left font-semibold">Email</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Démo</th>
                <th className="px-4 py-3 text-left font-semibold">Converti</th>
                <th className="px-4 py-3 text-left font-semibold">Type doc</th>
                <th className="px-4 py-3 text-left font-semibold">Contacté</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-sm text-slate-400">Aucun email collecté</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[13px] font-medium text-slate-800 dark:text-slate-100">{r.email}</td>
                  <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {r.demo_completed
                      ? <Badge className="text-[10px] border-0 bg-[#E1F5EE] text-[#085041] dark:bg-[#1D9E75]/20 dark:text-[#1D9E75]">Complète</Badge>
                      : <Badge className="text-[10px] border-0 bg-slate-100 text-slate-500">Non</Badge>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {r.converted
                      ? <span className="flex items-center gap-1 text-[12px] text-[#1D9E75]"><UserCheckIcon className="h-3.5 w-3.5" /> Oui</span>
                      : <span className="text-[12px] text-slate-400">—</span>
                    }
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500">{r.doc_type ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleContacted(r.id)}
                      className={`flex items-center gap-1 text-[12px] rounded-md px-2 py-1 transition-colors cursor-pointer ${
                        contacted.has(r.id)
                          ? 'bg-[#1D9E75]/10 text-[#1D9E75]'
                          : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]'
                      }`}
                    >
                      <CheckCircle2Icon className="h-3.5 w-3.5" />
                      {contacted.has(r.id) ? 'Oui' : 'Marquer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
