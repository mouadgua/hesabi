"use client"

import { useState, useMemo } from 'react'
import { SearchIcon, FilterXIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

const DH_PER_1K_IN  = 0.025
const DH_PER_1K_OUT = 0.10

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function confidenceColor(score) {
  if (score === null || score === undefined) return 'text-slate-400'
  if (score >= 0.8) return 'text-[#1D9E75]'
  if (score >= 0.5) return 'text-amber-500'
  return 'text-red-500'
}

function statutBadge(s) {
  const map = {
    VALIDE:      'bg-[#E1F5EE] text-[#085041] dark:bg-[#1D9E75]/20 dark:text-[#1D9E75]',
    A_VERIFIER:  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    REJETE:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    EN_COURS_IA: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    A_EXTRAIRE:  'bg-slate-100 text-slate-500 dark:bg-white/[0.05] dark:text-slate-400',
  }
  return <Badge className={`text-[10px] border-0 ${map[s] ?? ''}`}>{s}</Badge>
}

function providerShort(p) {
  if (!p) return '—'
  return p.replace('anthropic/', '').replace('openai/', '').replace('google/', '').replace('qwen/', '').replace('/qwen2.5-vl-72b-instruct', 'qwen')
}

function StatCard({ label, value, sub, color }) {
  return (
    <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03]">
      <CardContent className="p-4">
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">{label}</p>
        <p className={`text-xl font-bold tabular-nums ${color ?? 'text-slate-900 dark:text-slate-100'}`}>{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function ExtractionsHub({ docs, stats }) {
  const [search, setSearch]     = useState('')
  const [statut, setStatut]     = useState('all')
  const [provider, setProvider] = useState('all')

  const providers = useMemo(() => {
    const s = new Set(docs.map(d => d.ai_provider).filter(Boolean))
    return [...s].map(p => ({ value: p, label: providerShort(p) }))
  }, [docs])

  const filtered = useMemo(() => {
    let rows = docs
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(d =>
        (d.nom_fichier ?? '').toLowerCase().includes(q) ||
        (d.cabinet_nom ?? '').toLowerCase().includes(q) ||
        (d.document_type ?? '').toLowerCase().includes(q)
      )
    }
    if (statut !== 'all') rows = rows.filter(d => d.statut === statut)
    if (provider !== 'all') rows = rows.filter(d => d.ai_provider === provider)
    return rows
  }, [docs, search, statut, provider])

  const hasFilter = search || statut !== 'all' || provider !== 'all'

  const docCost = (d) => {
    if (!d.tokens_in && !d.tokens_out) return null
    return ((d.tokens_in ?? 0) / 1000) * DH_PER_1K_IN + ((d.tokens_out ?? 0) / 1000) * DH_PER_1K_OUT
  }

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Extractions & Usage</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Coût IA, providers et statistiques globales</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total extractions" value={stats.total} />
        <StatCard label="Taux de succès" value={stats.success_rate != null ? `${stats.success_rate}%` : '—'} color={stats.success_rate > 80 ? 'text-[#1D9E75]' : 'text-amber-500'} />
        <StatCard label="Taux fallback" value={stats.fallback_rate != null ? `${stats.fallback_rate}%` : '—'} sub="Claude/GPT/Qwen" />
        <StatCard label="Score IA moyen" value={stats.avg_confidence != null ? `${Math.round(stats.avg_confidence * 100)}%` : '—'} sub="confiance classification" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tokens consommés" value={`${((stats.tokens_in + stats.tokens_out) / 1000).toFixed(0)}K`} sub={`${(stats.tokens_in/1000).toFixed(0)}K in · ${(stats.tokens_out/1000).toFixed(0)}K out`} />
        <StatCard label="Coût estimé (DH)" value={`${stats.cost_dh.toFixed(2)} DH`} color="text-amber-600 dark:text-amber-400" />
        <StatCard label="Coût estimé (USD)" value={`$${stats.cost_usd.toFixed(3)}`} color="text-amber-600 dark:text-amber-400" />
        <StatCard label="Temps moyen" value={stats.avg_processing_ms != null ? `${(stats.avg_processing_ms / 1000).toFixed(1)}s` : '—'} sub="par extraction" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nom fichier, cabinet, type…" className="pl-9 h-9 text-sm" />
        </div>
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Statut" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="VALIDE">VALIDE</SelectItem>
            <SelectItem value="A_VERIFIER">À VÉRIFIER</SelectItem>
            <SelectItem value="REJETE">REJETÉ</SelectItem>
            <SelectItem value="EN_COURS_IA">EN COURS</SelectItem>
          </SelectContent>
        </Select>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger className="h-9 w-36 text-sm"><SelectValue placeholder="Provider" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous providers</SelectItem>
            {providers.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        {hasFilter && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatut('all'); setProvider('all') }} className="h-9 gap-1.5 text-slate-500">
            <FilterXIcon className="h-3.5 w-3.5" /> Effacer
          </Button>
        )}
        <span className="ml-auto text-xs text-slate-400 tabular-nums">{filtered.length} / {docs.length}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left font-semibold">Document</th>
                <th className="px-4 py-3 text-left font-semibold">Cabinet</th>
                <th className="px-4 py-3 text-left font-semibold">Date</th>
                <th className="px-4 py-3 text-left font-semibold">Provider</th>
                <th className="px-4 py-3 text-left font-semibold">Durée</th>
                <th className="px-4 py-3 text-left font-semibold">Score</th>
                <th className="px-4 py-3 text-left font-semibold">Coût</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">Aucun résultat</td></tr>
              )}
              {filtered.map(d => {
                const cost = docCost(d)
                return (
                  <tr key={d.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100 truncate max-w-[180px]">{d.nom_fichier ?? 'Sans nom'}</p>
                      {d.document_type && <p className="text-[11px] text-slate-400">{d.document_type}</p>}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">{d.cabinet_nom}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{fmt(d.createdAt)}</td>
                    <td className="px-4 py-3">
                      {d.ai_provider
                        ? <span className="font-mono text-[11px] bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">{providerShort(d.ai_provider)}</span>
                        : <span className="text-slate-300 dark:text-slate-600">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums">
                      {d.processing_ms != null ? `${(d.processing_ms / 1000).toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[13px] font-semibold tabular-nums ${confidenceColor(d.confidence)}`}>
                        {d.confidence != null ? `${Math.round(d.confidence * 100)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums">
                      {cost != null ? `${cost.toFixed(3)} DH` : '—'}
                    </td>
                    <td className="px-4 py-3">{statutBadge(d.statut)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
