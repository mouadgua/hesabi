"use client"

import { useState, useMemo } from 'react'
import { SearchIcon, FilterXIcon, DownloadIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const ACTION_COLORS = {
  SUSPEND_CABINET:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  DELETE_CABINET:        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REACTIVATE_CABINET:    'bg-[#E1F5EE] text-[#085041] dark:bg-[#1D9E75]/20 dark:text-[#1D9E75]',
  UPDATE_PLAN:           'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  ADJUST_CREDITS:        'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  GENERATE_BETA_KEYS:    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  REVOKE_BETA_KEY:       'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  UPDATE_KEY_CREDITS:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  UPDATE_DEFAULT_CREDITS:'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
}

function fmt(iso) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function exportCSV(rows) {
  const header = ['Date', 'Action', 'Entité', 'ID entité', 'Détails', 'IP']
  const lines = rows.map(r => [
    r.createdAt, r.action, r.entity ?? '', r.entity_id ?? '',
    JSON.stringify(r.details ?? {}), r.ip ?? '',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  const csv = [header.join(','), ...lines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `hesabi-logs-${new Date().toISOString().slice(0,10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

export default function LogsHub({ rows }) {
  const [search, setSearch]   = useState('')
  const [entity, setEntity]   = useState('all')

  const entities = useMemo(() => {
    const s = new Set(rows.map(r => r.entity).filter(Boolean))
    return [...s]
  }, [rows])

  const filtered = useMemo(() => {
    let r = rows
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(x =>
        x.action.toLowerCase().includes(q) ||
        (x.entity_id ?? '').toLowerCase().includes(q) ||
        JSON.stringify(x.details ?? {}).toLowerCase().includes(q)
      )
    }
    if (entity !== 'all') r = r.filter(x => x.entity === entity)
    return r
  }, [rows, search, entity])

  const hasFilter = search || entity !== 'all'

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Logs Admin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {rows.length} action{rows.length !== 1 ? 's' : ''} enregistrée{rows.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCSV(filtered)} className="gap-1.5 h-9">
          <DownloadIcon className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher action, ID, détails…" className="pl-9 h-9 text-sm" />
        </div>
        <Select value={entity} onValueChange={setEntity}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Entité" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes entités</SelectItem>
            {entities.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setEntity('all') }} className="h-9 gap-1.5 text-slate-500">
            <FilterXIcon className="h-3.5 w-3.5" /> Effacer
          </Button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} / {rows.length}</span>
      </div>

      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Action</th>
                <th className="px-4 py-3 text-left font-semibold">Entité</th>
                <th className="px-4 py-3 text-left font-semibold">Détails</th>
                <th className="px-4 py-3 text-left font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-sm text-slate-400">Aucun log</td></tr>
              )}
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] border-0 font-mono ${ACTION_COLORS[r.action] ?? 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300'}`}>
                      {r.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[12px] text-slate-500">{r.entity ?? '—'}</div>
                    {r.entity_id && <div className="text-[10px] text-slate-400 font-mono truncate max-w-[120px]">{r.entity_id}</div>}
                  </td>
                  <td className="px-4 py-3">
                    {r.details && Object.keys(r.details).length > 0 && (
                      <code className="text-[10px] bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 max-w-[200px] truncate block">
                        {JSON.stringify(r.details)}
                      </code>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-400 font-mono">{r.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
