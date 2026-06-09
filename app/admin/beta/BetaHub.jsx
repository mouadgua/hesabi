"use client"

import { useState, useMemo, useTransition } from 'react'
import { SearchIcon, CopyIcon, CheckIcon, FilterXIcon, KeyRoundIcon, PlusIcon, SettingsIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import {
  generateBetaKeyAction,
  revokeBetaKeyAction,
  updateBetaKeyCreditsAction,
  updateGlobalDefaultCreditsAction,
} from '../admin-actions'

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function keyStatus(k) {
  if (!k.is_active) return { label: 'Révoqué',   cls: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400' }
  if (k.used)       return { label: 'Utilisé',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
  if (k.expires_at && new Date(k.expires_at) < new Date()) return { label: 'Expiré', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' }
  return { label: 'Actif', cls: 'bg-[#E1F5EE] text-[#085041] dark:bg-[#1D9E75]/20 dark:text-[#1D9E75]' }
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-400 hover:text-slate-600 cursor-pointer transition-colors">
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-[#1D9E75]" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </button>
  )
}

export default function BetaHub({ initialKeys, totalCabinets, defaultCredits: initDef }) {
  const [keys, setKeys]           = useState(initialKeys)
  const [search, setSearch]       = useState('')
  const [filter, setFilter]       = useState('all')
  const [showGen, setShowGen]     = useState(false)
  const [showGlobal, setGlobal]   = useState(false)
  const [isPending, start]        = useTransition()

  // Generate form
  const [genCount,   setGenCount]   = useState('1')
  const [genCredits, setGenCredits] = useState(String(initDef))
  const [genEmail,   setGenEmail]   = useState('')
  const [genNote,    setGenNote]    = useState('')
  const [genExpiry,  setGenExpiry]  = useState('')
  const [genMaxUses, setGenMaxUses] = useState('1')

  // Global credits
  const [defCred, setDefCred] = useState(String(initDef))

  // Inline edit credits
  const [editingId,  setEditingId]  = useState(null)
  const [editCredit, setEditCredit] = useState('')

  const filtered = useMemo(() => {
    let rows = keys
    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(k => k.key.toLowerCase().includes(q) || (k.email ?? '').toLowerCase().includes(q) || (k.note ?? '').toLowerCase().includes(q))
    }
    if (filter === 'active')  rows = rows.filter(k => k.is_active && !k.used && (!k.expires_at || new Date(k.expires_at) > new Date()))
    if (filter === 'used')    rows = rows.filter(k => k.used)
    if (filter === 'revoked') rows = rows.filter(k => !k.is_active)
    if (filter === 'expired') rows = rows.filter(k => k.expires_at && new Date(k.expires_at) < new Date())
    return rows
  }, [keys, search, filter])

  const stats = useMemo(() => ({
    total:   keys.length,
    active:  keys.filter(k => k.is_active && !k.used).length,
    used:    keys.filter(k => k.used).length,
    revoked: keys.filter(k => !k.is_active).length,
  }), [keys])

  function handleGenerate() {
    start(async () => {
      const fd = new FormData()
      fd.set('count',     genCount)
      fd.set('credits',   genCredits)
      fd.set('email',     genEmail)
      fd.set('note',      genNote)
      fd.set('expires_at', genExpiry)
      fd.set('max_uses',  genMaxUses)
      try {
        const newKeys = await generateBetaKeyAction(fd)
        toast.success(`${newKeys.length} clé${newKeys.length > 1 ? 's' : ''} générée${newKeys.length > 1 ? 's' : ''}`)
        // Reload keys by appending optimistically
        const now = new Date().toISOString()
        const added = newKeys.map((key, i) => ({
          id:         `tmp-${i}`,
          key,
          email:      genEmail || null,
          note:       genNote  || null,
          used:       false,
          used_by:    null,
          used_at:    null,
          expires_at: genExpiry ? new Date(genExpiry).toISOString() : null,
          max_uses:   parseInt(genMaxUses) || 1,
          use_count:  0,
          credits:    parseInt(genCredits) || 15,
          is_active:  true,
          createdAt:  now,
        }))
        setKeys(prev => [...added, ...prev])
        setShowGen(false)
        setGenCount('1'); setGenEmail(''); setGenNote(''); setGenExpiry(''); setGenMaxUses('1')
      } catch (e) { toast.error(e.message) }
    })
  }

  function handleRevoke(keyId) {
    start(async () => {
      const fd = new FormData(); fd.set('key_id', keyId)
      try {
        await revokeBetaKeyAction(fd)
        setKeys(prev => prev.map(k => k.id === keyId ? { ...k, is_active: false } : k))
        toast.success('Clé révoquée')
      } catch (e) { toast.error(e.message) }
    })
  }

  function startEditCredits(k) {
    setEditingId(k.id); setEditCredit(String(k.credits))
  }

  function handleSaveCredits(keyId) {
    start(async () => {
      const fd = new FormData(); fd.set('key_id', keyId); fd.set('credits', editCredit)
      try {
        await updateBetaKeyCreditsAction(fd)
        setKeys(prev => prev.map(k => k.id === keyId ? { ...k, credits: parseInt(editCredit) } : k))
        setEditingId(null)
        toast.success('Crédits mis à jour')
      } catch (e) { toast.error(e.message) }
    })
  }

  function handleUpdateDefault() {
    start(async () => {
      const fd = new FormData(); fd.set('credits', defCred)
      try {
        await updateGlobalDefaultCreditsAction(fd)
        toast.success(`Défaut mis à jour : ${defCred} crédits`)
        setGlobal(false)
      } catch (e) { toast.error(e.message) }
    })
  }

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Beta & Codes d'accès</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{totalCabinets} cabinet{totalCabinets !== 1 ? 's' : ''} inscrits</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setGlobal(v => !v)} className="gap-1.5 h-9">
            <SettingsIcon className="h-3.5 w-3.5" /> Défaut crédits
          </Button>
          <Button size="sm" onClick={() => setShowGen(v => !v)} className="gap-1.5 h-9 bg-[#1D9E75] hover:bg-[#178060] text-white">
            <PlusIcon className="h-3.5 w-3.5" /> Générer
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, cls: '' },
          { label: 'Actifs',   value: stats.active,  cls: 'text-[#1D9E75]' },
          { label: 'Utilisés', value: stats.used,    cls: 'text-blue-600 dark:text-blue-400' },
          { label: 'Révoqués', value: stats.revoked, cls: 'text-slate-400' },
        ].map(s => (
          <Card key={s.label} className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/80 dark:bg-white/[0.03]">
            <CardContent className="p-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1">{s.label}</p>
              <p className={`text-xl font-bold tabular-nums ${s.cls || 'text-slate-900 dark:text-slate-100'}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Global default credits panel */}
      {showGlobal && (
        <Card className="rounded-2xl border border-[#1D9E75]/30 bg-[#1D9E75]/5 dark:bg-[#1D9E75]/5">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Crédits par défaut (nouveaux comptes beta)</p>
            <Input
              type="number"
              value={defCred}
              onChange={e => setDefCred(e.target.value)}
              className="w-24 h-8 text-sm"
              min={1}
            />
            <Button size="sm" disabled={isPending} onClick={handleUpdateDefault} className="h-8 bg-[#1D9E75] hover:bg-[#178060] text-white">
              Sauvegarder
            </Button>
            <p className="text-[12px] text-slate-400">Actuel : {initDef} crédits</p>
          </CardContent>
        </Card>
      )}

      {/* Generate panel */}
      {showGen && (
        <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white dark:bg-white/[0.02]">
          <CardContent className="p-5 space-y-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <KeyRoundIcon className="h-4 w-4 text-[#1D9E75]" /> Générer des clés beta
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Nombre (max 100)</label>
                <Input type="number" value={genCount} onChange={e => setGenCount(e.target.value)} min={1} max={100} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Crédits / clé</label>
                <Input type="number" value={genCredits} onChange={e => setGenCredits(e.target.value)} min={1} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Utilisations max</label>
                <Input type="number" value={genMaxUses} onChange={e => setGenMaxUses(e.target.value)} min={1} className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Email (optionnel)</label>
                <Input value={genEmail} onChange={e => setGenEmail(e.target.value)} placeholder="ex@email.com" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Note (optionnel)</label>
                <Input value={genNote} onChange={e => setGenNote(e.target.value)} placeholder="Partenaire, événement…" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Expiration (optionnel)</label>
                <Input type="date" value={genExpiry} onChange={e => setGenExpiry(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" disabled={isPending} onClick={handleGenerate} className="h-8 bg-[#1D9E75] hover:bg-[#178060] text-white">
                Générer {genCount} clé{parseInt(genCount) > 1 ? 's' : ''}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowGen(false)} className="h-8">Annuler</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Chercher clé, email, note…" className="pl-9 h-9 text-sm" />
        </div>
        {['all', 'active', 'used', 'revoked', 'expired'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-9 px-3 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              filter === f
                ? 'bg-[#1D9E75] text-white'
                : 'bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08]'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'active' ? 'Actifs' : f === 'used' ? 'Utilisés' : f === 'revoked' ? 'Révoqués' : 'Expirés'}
          </button>
        ))}
        {(search || filter !== 'all') && (
          <button onClick={() => { setSearch(''); setFilter('all') }} className="h-9 px-3 rounded-lg text-xs text-slate-500 flex items-center gap-1 hover:bg-slate-100 cursor-pointer">
            <FilterXIcon className="h-3.5 w-3.5" /> Effacer
          </button>
        )}
        <span className="ml-auto text-xs text-slate-400">{filtered.length} / {keys.length}</span>
      </div>

      {/* Keys table */}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/70 dark:bg-white/[0.02] text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 text-left font-semibold">Clé</th>
                <th className="px-4 py-3 text-left font-semibold">Email / Note</th>
                <th className="px-4 py-3 text-left font-semibold">Statut</th>
                <th className="px-4 py-3 text-left font-semibold">Crédits</th>
                <th className="px-4 py-3 text-left font-semibold">Utilisations</th>
                <th className="px-4 py-3 text-left font-semibold">Expiration</th>
                <th className="px-4 py-3 text-left font-semibold">Créé le</th>
                <th className="px-4 py-3 text-left font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">Aucune clé</td></tr>
              )}
              {filtered.map(k => {
                const st = keyStatus(k)
                const isEditing = editingId === k.id
                return (
                  <tr key={k.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[12px] text-slate-700 dark:text-slate-200">{k.key}</span>
                        <CopyBtn value={k.key} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {k.email && <p className="text-[12px] text-slate-600 dark:text-slate-300">{k.email}</p>}
                      {k.note  && <p className="text-[11px] text-slate-400 italic">{k.note}</p>}
                      {!k.email && !k.note && <span className="text-slate-300 dark:text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border-0 ${st.cls}`}>{st.label}</Badge>
                      {k.used_by && <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[100px]">{k.used_by}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input value={editCredit} onChange={e => setEditCredit(e.target.value)} className="w-16 h-7 text-xs" type="number" min={1} />
                          <button onClick={() => handleSaveCredits(k.id)} disabled={isPending} className="text-[11px] text-[#1D9E75] hover:underline cursor-pointer">OK</button>
                          <button onClick={() => setEditingId(null)} className="text-[11px] text-slate-400 hover:underline cursor-pointer">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => startEditCredits(k)} className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 hover:text-[#1D9E75] cursor-pointer transition-colors">
                          {k.credits}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 tabular-nums">
                      {k.use_count} / {k.max_uses ?? 1}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{fmt(k.expires_at)}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-400 tabular-nums whitespace-nowrap">{fmt(k.createdAt)}</td>
                    <td className="px-4 py-3">
                      {k.is_active && !k.used && (
                        <button
                          onClick={() => handleRevoke(k.id)}
                          disabled={isPending}
                          className="text-[11px] text-red-500 hover:text-red-700 dark:hover:text-red-300 cursor-pointer transition-colors"
                        >
                          Révoquer
                        </button>
                      )}
                    </td>
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
