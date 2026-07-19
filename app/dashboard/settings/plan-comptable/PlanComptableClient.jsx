"use client"

import { useState, useTransition, useMemo } from "react"
import { Input }    from "@/components/ui/input"
import { Button }   from "@/components/ui/button"
import { Badge }    from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  PlusIcon, PencilIcon, SearchIcon, CheckIcon, XIcon,
  ChevronLeftIcon, ChevronRightIcon,
} from "lucide-react"

const PAGE_SIZE = 50
import { createCompteAction, updateCompteAction, toggleActifAction } from "./actions"

const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8]

const CLASS_LABELS = {
  1: 'Financement permanent',
  2: 'Actif immobilisé',
  3: 'Actif circulant',
  4: 'Passif circulant',
  5: 'Trésorerie',
  6: 'Charges',
  7: 'Produits',
  8: 'Résultats',
}

export default function PlanComptableClient({ comptes, cabinetId }) {
  const [search,     setSearch]     = useState('')
  const [classeFilter, setClasseFilter] = useState('all')
  const [showInactif, setShowInactif] = useState(false)
  const [openAdd,    setOpenAdd]    = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [error,      setError]      = useState('')
  const [page,       setPage]       = useState(1)
  const [isPending,  startTransition] = useTransition()

  // Form state for add/edit dialog
  const [form, setForm] = useState({ code: '', libelle: '', classe: '1' })

  const filtered = useMemo(() => {
    let list = comptes
    if (!showInactif) list = list.filter(c => c.actif)
    if (classeFilter !== 'all') list = list.filter(c => c.classe === parseInt(classeFilter))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.code.toLowerCase().includes(q) || c.libelle.toLowerCase().includes(q)
      )
    }
    return list
  }, [comptes, search, classeFilter, showInactif])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const paginated  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset page when filters change
  useMemo(() => { setPage(1) }, [search, classeFilter, showInactif]) // eslint-disable-line react-hooks/exhaustive-deps

  function openAddDialog() {
    setForm({ code: '', libelle: '', classe: '1' })
    setError('')
    setOpenAdd(true)
  }

  function openEditDialog(compte) {
    setEditTarget(compte)
    setForm({ code: compte.code, libelle: compte.libelle, classe: String(compte.classe) })
    setError('')
  }

  function handleAdd() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('code',    form.code)
      fd.set('libelle', form.libelle)
      fd.set('classe',  form.classe)
      const res = await createCompteAction(fd)
      if (res?.error) { setError(res.error); return }
      setOpenAdd(false)
    })
  }

  function handleEdit() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('id',      editTarget.id)
      fd.set('libelle', form.libelle)
      fd.set('actif',   String(editTarget.actif))
      const res = await updateCompteAction(fd)
      if (res?.error) { setError(res.error); return }
      setEditTarget(null)
    })
  }

  function handleToggle(compte) {
    startTransition(async () => {
      await toggleActifAction(compte.id, !compte.actif)
    })
  }

  const isStandardMap = useMemo(() => {
    const m = new Map()
    comptes.forEach(c => m.set(c.id, c.is_standard))
    return m
  }, [comptes])

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Rechercher un compte..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={classeFilter} onValueChange={setClasseFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Toutes les classes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {CLASSES.map(cl => (
              <SelectItem key={cl} value={String(cl)}>Classe {cl}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInactif(v => !v)}
          className={showInactif ? 'bg-slate-100 dark:bg-white/10' : ''}
        >
          {showInactif ? 'Masquer inactifs' : 'Afficher inactifs'}
        </Button>

        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog} className="bg-[#1D9E75] hover:bg-[#17835f] text-white">
              <PlusIcon className="w-4 h-4 mr-2" /> Nouveau compte
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Ajouter un compte personnalisé</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs mb-1 block">Code</Label>
                <Input
                  placeholder="ex: 6131001"
                  value={form.code}
                  onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Libellé</Label>
                <Input
                  placeholder="ex: Loyer bureau Casablanca"
                  value={form.libelle}
                  onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Classe</Label>
                <Select value={form.classe} onValueChange={v => setForm(f => ({ ...f, classe: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map(cl => (
                      <SelectItem key={cl} value={String(cl)}>
                        {cl} — {CLASS_LABELS[cl]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <Button
                onClick={handleAdd}
                disabled={isPending || !form.code || !form.libelle}
                className="w-full bg-[#1D9E75] hover:bg-[#17835f] text-white"
              >
                {isPending ? 'Enregistrement...' : 'Créer le compte'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={v => !v && setEditTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Modifier le compte {editTarget?.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs mb-1 block">Libellé</Label>
              <Input
                value={form.libelle}
                onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button
              onClick={handleEdit}
              disabled={isPending || !form.libelle}
              className="w-full bg-[#1D9E75] hover:bg-[#17835f] text-white"
            >
              {isPending ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-white/[0.07] bg-slate-50/80 dark:bg-white/[0.03]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Libellé</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Classe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Statut</th>
                <th className="w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400 text-sm">
                    Aucun compte trouvé
                  </td>
                </tr>
              )}
              {paginated.map(compte => (
                <tr
                  key={compte.id}
                  className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03] ${
                    !compte.actif ? 'opacity-50' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono font-semibold text-slate-700 dark:text-slate-200">
                    {compte.code}
                  </td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                    {compte.libelle}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {compte.classe}
                  </td>
                  <td className="px-4 py-3">
                    {compte.is_standard ? (
                      <Badge variant="outline" className="text-[10px] border-blue-200 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                        CGNC
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] border-[#A8DCC9] text-[#1D9E75]">
                        Cabinet
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium ${
                      compte.actif
                        ? 'text-emerald-600'
                        : 'text-slate-400'
                    }`}>
                      {compte.actif
                        ? <><CheckIcon className="w-3 h-3" /> Actif</>
                        : <><XIcon className="w-3 h-3" /> Inactif</>
                      }
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {!compte.is_standard && (
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditDialog(compte)}
                          title="Modifier"
                        >
                          <PencilIcon className="w-3.5 h-3.5 text-slate-400" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-slate-400 hover:text-slate-600"
                          onClick={() => handleToggle(compte)}
                          disabled={isPending}
                        >
                          {compte.actif ? 'Désactiver' : 'Activer'}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-2.5 border-t border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-4">
          <span className="text-xs text-slate-400">
            {filtered.length} résultat{filtered.length > 1 ? 's' : ''}
            {' · '}
            {comptes.filter(c => !c.is_standard).length} perso
            {' · '}
            {comptes.filter(c => c.is_standard).length} CGNC
          </span>

          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeftIcon className="w-3.5 h-3.5" />
              </button>

              {/* Page number pills */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce((acc, p, i, arr) => {
                  if (i > 0 && p - arr[i - 1] > 1) acc.push('…')
                  acc.push(p)
                  return acc
                }, [])
                .map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-300 dark:text-slate-600">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors ${
                        p === safePage
                          ? 'bg-[#1D9E75] text-white'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.06] dark:text-slate-400'
                      }`}
                    >
                      {p}
                    </button>
                  )
                )
              }

              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRightIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
