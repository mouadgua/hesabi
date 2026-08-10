"use client"

import { useState, useTransition, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  ChevronLeftIcon, ChevronRightIcon, Trash2Icon, AlertTriangleIcon,
} from "lucide-react"

const PAGE_SIZE = 50
import {
  createCompteAction, updateCompteAction, toggleActifAction,
  setActifBulkAction, deleteComptesAction, inspectDeleteAction,
} from "./actions"

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
  const router = useRouter()
  const [search,     setSearch]     = useState('')
  const [classeFilter, setClasseFilter] = useState('all')
  const [showInactif, setShowInactif] = useState(false)
  const [openAdd,    setOpenAdd]    = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [error,      setError]      = useState('')
  const [page,       setPage]       = useState(1)
  const [isPending,  startTransition] = useTransition()

  // Multi-select + delete confirmation
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [deletePreview, setDeletePreview] = useState(null) // { deletable, blocked, loading }
  const [bulkError, setBulkError] = useState('')

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
  useEffect(() => { setPage(1) }, [search, classeFilter, showInactif])

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
      router.refresh()
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
      router.refresh()
    })
  }

  function handleToggle(compte) {
    startTransition(async () => {
      await toggleActifAction(compte.id, !compte.actif)
      router.refresh()
    })
  }

  // ── Multi-select ──────────────────────────────────────────────────────────
  // Only cabinet-owned comptes are selectable — shared CGNC standards can
  // never be modified or deleted.

  const selectableOnPage = paginated.filter(c => !c.is_standard)
  const allPageSelected  = selectableOnPage.length > 0 &&
    selectableOnPage.every(c => selectedIds.has(c.id))

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAllOnPage() {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allPageSelected) selectableOnPage.forEach(c => next.delete(c.id))
      else                 selectableOnPage.forEach(c => next.add(c.id))
      return next
    })
  }

  function clearSelection() { setSelectedIds(new Set()) }

  const selectedComptes = useMemo(
    () => comptes.filter(c => selectedIds.has(c.id)),
    [comptes, selectedIds]
  )
  const selectedActifCount   = selectedComptes.filter(c => c.actif).length
  const selectedInactifCount = selectedComptes.length - selectedActifCount

  function handleBulkSetActif(actif) {
    setBulkError('')
    startTransition(async () => {
      const res = await setActifBulkAction([...selectedIds], actif)
      if (res?.error) { setBulkError(res.error); return }
      clearSelection()
      router.refresh()
    })
  }

  // Ask the server what would happen before showing the confirmation dialog,
  // so the user sees exactly what gets deleted and what is refused.
  function openDeleteDialog(ids) {
    setBulkError('')
    setDeletePreview({ loading: true, deletable: [], blocked: [], ids })
    startTransition(async () => {
      const res = await inspectDeleteAction(ids)
      setDeletePreview({ loading: false, deletable: res.deletable ?? [], blocked: res.blocked ?? [], ids })
    })
  }

  function confirmDelete() {
    const ids = deletePreview?.deletable.map(c => c.id) ?? []
    if (ids.length === 0) { setDeletePreview(null); return }
    startTransition(async () => {
      const res = await deleteComptesAction(ids)
      setDeletePreview(null)
      if (res?.error) { setBulkError(res.error); return }
      clearSelection()
      router.refresh()
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

      {/* Bulk action bar — only appears with a selection */}
      {selectedIds.size > 0 && (
        <div
          role="toolbar"
          aria-label="Actions groupées sur la sélection"
          className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-[#1D9E75]/30 bg-[#E1F5EE]/60 dark:bg-[#1D9E75]/10 dark:border-[#1D9E75]/20"
        >
          <span className="text-sm font-medium text-[#085041] dark:text-[#1D9E75]">
            {selectedIds.size} compte{selectedIds.size > 1 ? 's' : ''} sélectionné{selectedIds.size > 1 ? 's' : ''}
          </span>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {selectedActifCount > 0 && (
              <Button
                variant="outline" size="sm" disabled={isPending}
                onClick={() => handleBulkSetActif(false)}
              >
                Désactiver{selectedInactifCount > 0 ? ` (${selectedActifCount})` : ''}
              </Button>
            )}
            {selectedInactifCount > 0 && (
              <Button
                variant="outline" size="sm" disabled={isPending}
                onClick={() => handleBulkSetActif(true)}
              >
                Réactiver{selectedActifCount > 0 ? ` (${selectedInactifCount})` : ''}
              </Button>
            )}
            <Button
              variant="outline" size="sm" disabled={isPending}
              onClick={() => openDeleteDialog([...selectedIds])}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:hover:bg-red-500/10"
            >
              <Trash2Icon className="w-3.5 h-3.5 mr-1.5" /> Supprimer
            </Button>
            <Button variant="ghost" size="sm" onClick={clearSelection} disabled={isPending}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {bulkError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-400">
          <AlertTriangleIcon className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{bulkError}</span>
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deletePreview} onOpenChange={v => !v && setDeletePreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer définitivement</DialogTitle>
          </DialogHeader>

          {deletePreview?.loading ? (
            <p className="text-sm text-slate-500 py-4">Vérification des dépendances…</p>
          ) : (
            <div className="space-y-4 pt-1">
              {deletePreview?.deletable.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    {deletePreview.deletable.length} compte{deletePreview.deletable.length > 1 ? 's' : ''} sera{deletePreview.deletable.length > 1 ? 'ont' : ''} supprimé{deletePreview.deletable.length > 1 ? 's' : ''} :
                  </p>
                  <ul className="max-h-40 overflow-y-auto space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    {deletePreview.deletable.map(c => (
                      <li key={c.id} className="flex items-start gap-2">
                        <span className="font-mono font-semibold shrink-0">{c.code}</span>
                        <span className="truncate">{c.libelle}</span>
                        {c.documentsADetacher > 0 && (
                          <span className="ml-auto shrink-0 text-amber-600 dark:text-amber-400">
                            {c.documentsADetacher} doc. détaché{c.documentsADetacher > 1 ? 's' : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {deletePreview?.blocked.length > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-3">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-400 mb-2">
                    {deletePreview.blocked.length} compte{deletePreview.blocked.length > 1 ? 's' : ''} conservé{deletePreview.blocked.length > 1 ? 's' : ''} — utilisé{deletePreview.blocked.length > 1 ? 's' : ''} par des écritures validées :
                  </p>
                  <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-400/90">
                    {deletePreview.blocked.map(c => (
                      <li key={c.id} className="flex items-start gap-2">
                        <span className="font-mono font-semibold shrink-0">{c.code}</span>
                        <span className="ml-auto shrink-0">{c.documentsValides} doc. validé{c.documentsValides > 1 ? 's' : ''}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400/70 mt-2">
                    Désactivez-les plutôt pour les retirer des suggestions sans toucher aux écritures.
                  </p>
                </div>
              )}

              {deletePreview?.deletable.length === 0 && deletePreview?.blocked.length === 0 && (
                <p className="text-sm text-slate-500">Aucun compte supprimable dans cette sélection.</p>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setDeletePreview(null)} disabled={isPending}>
                  Annuler
                </Button>
                {deletePreview?.deletable.length > 0 && (
                  <Button
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                    onClick={confirmDelete}
                    disabled={isPending}
                  >
                    {isPending ? 'Suppression…' : `Supprimer (${deletePreview.deletable.length})`}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200/60 dark:border-white/[0.07] bg-slate-50/80 dark:bg-white/[0.03]">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllOnPage}
                    disabled={selectableOnPage.length === 0}
                    title="Sélectionner les comptes cabinet de cette page"
                    aria-label="Sélectionner les comptes cabinet de cette page"
                    className="rounded border-gray-300 text-[#1D9E75] cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-28">Code</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Libellé</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Classe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-24">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-20">Statut</th>
                <th className="w-40" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 text-sm">
                    Aucun compte trouvé
                  </td>
                </tr>
              )}
              {paginated.map(compte => (
                <tr
                  key={compte.id}
                  className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03] ${
                    !compte.actif ? 'opacity-50' : ''
                  } ${selectedIds.has(compte.id) ? 'bg-[#E1F5EE]/40 dark:bg-[#1D9E75]/5' : ''}`}
                >
                  <td className="px-4 py-3">
                    {!compte.is_standard && (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(compte.id)}
                        onChange={() => toggleSelect(compte.id)}
                        aria-label={`Sélectionner le compte ${compte.code}`}
                        className="rounded border-gray-300 text-[#1D9E75] cursor-pointer"
                      />
                    )}
                  </td>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                          onClick={() => openDeleteDialog([compte.id])}
                          disabled={isPending}
                          title="Supprimer définitivement"
                        >
                          <Trash2Icon className="w-3.5 h-3.5" />
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
