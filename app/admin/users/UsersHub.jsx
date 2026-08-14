"use client"

import { useState, useMemo, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  SearchIcon, FilterXIcon, MoreHorizontalIcon, ShieldOffIcon,
  ShieldCheckIcon, CreditCardIcon, Trash2Icon, UserIcon,
  ChevronUpIcon, ChevronDownIcon, ChevronsUpDownIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  suspendCabinetAction, reactivateCabinetAction,
  updateCabinetPlanAction, deleteCabinetAction,
} from '../admin-actions'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function planBadge(plan, planStatus, suspended) {
  if (suspended) return <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">Suspendu</Badge>
  const map = {
    TRIAL:    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    ACTIVE:   'bg-[#E1F5EE] text-[#085041] dark:bg-[#1D9E75]/20 dark:text-[#1D9E75]',
    CANCELED: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400',
  }
  return (
    <Badge className={`text-[10px] border-0 ${map[planStatus] ?? map.TRIAL}`}>
      {planStatus} · {plan}
    </Badge>
  )
}

function sortIcon(col, sort) {
  if (sort.col !== col) return <ChevronsUpDownIcon className="h-3 w-3 opacity-30" />
  return sort.dir === 'asc'
    ? <ChevronUpIcon className="h-3 w-3 text-[#1D9E75]" />
    : <ChevronDownIcon className="h-3 w-3 text-[#1D9E75]" />
}

// ── Modals ─────────────────────────────────────────────────────────────────────

function SuspendModal({ cabinet, open, onClose, onRefresh }) {
  const [isPending, start] = useTransition()
  const [reason, setReason] = useState('')

  async function submit(e) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('cabinet_id', cabinet.id)
    fd.append('reason', reason)
    start(async () => {
      try {
        await suspendCabinetAction(fd)
        toast.success(`Cabinet «${cabinet.nom}» suspendu.`)
        onClose()
        onRefresh()
      } catch (err) { toast.error(`Erreur lors de la suspension : ${err?.message ?? err}`) }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <ShieldOffIcon className="h-4 w-4" /> Suspendre le cabinet
          </DialogTitle>
          <DialogDescription>
            L'accès au dashboard sera bloqué pour «&nbsp;<strong>{cabinet?.nom}</strong>&nbsp;».
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Raison (optionnel)</Label>
            <Input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Ex: Quota dépassé, non-paiement…"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white" disabled={isPending}>
              {isPending ? 'Suspension…' : 'Suspendre'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ReactivateModal({ cabinet, open, onClose, onRefresh }) {
  const [isPending, start] = useTransition()

  function submit() {
    const fd = new FormData()
    fd.append('cabinet_id', cabinet.id)
    start(async () => {
      try {
        await reactivateCabinetAction(fd)
        toast.success(`Cabinet «${cabinet.nom}» réactivé.`)
        onClose()
        onRefresh()
      } catch (err) { toast.error(`Erreur : ${err?.message ?? err}`) }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1D9E75]">
            <ShieldCheckIcon className="h-4 w-4" /> Réactiver le cabinet
          </DialogTitle>
          <DialogDescription>
            Rétablir l'accès pour «&nbsp;<strong>{cabinet?.nom}</strong>&nbsp;» ?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white" onClick={submit} disabled={isPending}>
            {isPending ? 'Réactivation…' : 'Réactiver'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PlanModal({ cabinet, open, onClose, onRefresh }) {
  const [isPending, start] = useTransition()
  const [plan, setPlan]               = useState(cabinet?.plan             ?? 'PRO')
  const [status, setStatus]           = useState(cabinet?.plan_status      ?? 'TRIAL')
  const [limit, setLimit]             = useState(String(cabinet?.credits_limit ?? 15))
  const [credits, setCredits]         = useState(String(cabinet?.credits       ?? 15))
  const [exMethod, setExMethod]       = useState(cabinet?.extraction_method ?? 'gemini')

  // Sync when cabinet changes (useEffect to avoid infinite-loop risk in useMemo)
  useEffect(() => {
    if (!cabinet) return
    setPlan(cabinet.plan)
    setStatus(cabinet.plan_status)
    setLimit(String(cabinet.credits_limit))
    setCredits(String(cabinet.credits))
    setExMethod(cabinet.extraction_method ?? 'gemini')
  }, [cabinet?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('cabinet_id', cabinet.id)
    fd.append('plan', plan)
    fd.append('plan_status', status)
    fd.append('credits_limit', limit)
    fd.append('credits', credits)
    fd.append('extraction_method', exMethod)
    start(async () => {
      try {
        await updateCabinetPlanAction(fd)
        toast.success('Plan mis à jour.')
        onClose()
        onRefresh()
      } catch (err) { toast.error(`Erreur lors de la mise à jour : ${err?.message ?? err}`) }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCardIcon className="h-4 w-4 text-[#1D9E75]" /> Modifier le plan
          </DialogTitle>
          <DialogDescription>
            Cabinet : <strong>{cabinet?.nom}</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type de plan</Label>
              <Select value={plan} onValueChange={setPlan}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BETA">BETA</SelectItem>
                  <SelectItem value="PRO">PRO</SelectItem>
                  <SelectItem value="ENTERPRISE">ENTERPRISE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRIAL">TRIAL</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="CANCELED">CANCELED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quota (limite)</Label>
              <Input type="number" min={0} value={limit} onChange={e => setLimit(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Crédits actuels</Label>
              <Input type="number" min={0} value={credits} onChange={e => setCredits(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Méthode d&apos;extraction</Label>
            <Select value={exMethod} onValueChange={setExMethod}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="azure">Azure OCR + modèle gratuit (défaut)</SelectItem>
                <SelectItem value="hybrid_azure">Azure hybride — texte brut</SelectItem>
                <SelectItem value="gemini">Gemini seul — repli</SelectItem>
              </SelectContent>
            </Select>
            {(exMethod === 'azure' || exMethod === 'hybrid_azure') && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                Azure OCR requis — assure-toi que AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT et KEY sont configurés.
                Facturation à la page.
              </p>
            )}
            {exMethod === 'gemini' && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Repli sans Azure. À n&apos;utiliser que si Azure est indisponible.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white" disabled={isPending}>
              {isPending ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteModal({ cabinet, open, onClose, onRefresh }) {
  const [isPending, start] = useTransition()
  const [confirm, setConfirm] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (confirm !== cabinet?.nom) return
    const fd = new FormData()
    fd.append('cabinet_id', cabinet.id)
    start(async () => {
      try {
        await deleteCabinetAction(fd)
        toast.success(`Cabinet «${cabinet.nom}» supprimé.`)
        onClose()
        onRefresh()
      } catch (err) { toast.error(`Erreur lors de la suppression : ${err?.message ?? err}`) }
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); setConfirm('') } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2Icon className="h-4 w-4" /> Supprimer le cabinet
          </DialogTitle>
          <DialogDescription>
            Cette action est <strong>irréversible</strong>. Tous les documents, clients et données seront supprimés.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Tapez <code className="bg-slate-100 dark:bg-white/10 px-1 rounded text-xs">{cabinet?.nom}</code> pour confirmer</Label>
            <Input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder={cabinet?.nom}
              className="border-red-300 dark:border-red-800 focus-visible:ring-red-500"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={isPending || confirm !== cabinet?.nom}
            >
              {isPending ? 'Suppression…' : 'Supprimer définitivement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProfileModal({ cabinet, open, onClose }) {
  if (!cabinet) return null
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-[#1D9E75]" /> {cabinet.nom}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2 text-sm">
          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              ['Plan', `${cabinet.plan} · ${cabinet.plan_status}`],
              ['Crédits', `${cabinet.credits} / ${cabinet.credits_limit}`],
              ['Extractions', cabinet.total_extractions],
              ['Inscrit le', fmt(cabinet.createdAt)],
              ['Dernière activité', fmt(cabinet.last_active)],
              ['Statut', cabinet.suspended ? 'Suspendu' : 'Actif'],
            ].map(([label, val]) => (
              <div key={label} className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] p-3">
                <p className="text-[10px] text-slate-400 mb-0.5">{label}</p>
                <p className="font-semibold text-slate-800 dark:text-slate-100 truncate">{val}</p>
              </div>
            ))}
          </div>

          {/* Raison suspension */}
          {cabinet.suspended && cabinet.suspend_reason && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <strong>Raison suspension :</strong> {cabinet.suspend_reason}
            </div>
          )}

          {/* Utilisateurs */}
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
              Utilisateurs ({cabinet.utilisateurs?.length ?? 0})
            </p>
            <div className="space-y-1.5">
              {cabinet.utilisateurs?.map(u => (
                <div key={u.id} className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.05] px-3 py-2">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800 dark:text-slate-100">{u.nom}</p>
                    <p className="text-[11px] text-slate-400">{u.email}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{u.role}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Row actions dropdown ───────────────────────────────────────────────────────

function ActionsMenu({ cab, onSuspend, onReactivate, onPlan, onDelete, onView }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md">
          <MoreHorizontalIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onView(cab)} className="cursor-pointer">
          <UserIcon className="h-3.5 w-3.5 mr-2" /> Voir le profil
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPlan(cab)} className="cursor-pointer">
          <CreditCardIcon className="h-3.5 w-3.5 mr-2" /> Modifier le plan
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {cab.suspended ? (
          <DropdownMenuItem onClick={() => onReactivate(cab)} className="cursor-pointer text-[#1D9E75] focus:text-[#1D9E75]">
            <ShieldCheckIcon className="h-3.5 w-3.5 mr-2" /> Réactiver
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onSuspend(cab)} className="cursor-pointer text-amber-600 focus:text-amber-600">
            <ShieldOffIcon className="h-3.5 w-3.5 mr-2" /> Suspendre
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(cab)} className="cursor-pointer text-red-600 focus:text-red-600">
          <Trash2Icon className="h-3.5 w-3.5 mr-2" /> Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Main table ─────────────────────────────────────────────────────────────────

const COLS = [
  { key: 'nom',               label: 'Cabinet' },
  { key: 'email',             label: 'Email' },
  { key: 'plan_status',       label: 'Statut' },
  { key: 'createdAt',         label: 'Inscrit' },
  { key: 'last_active',       label: 'Dernière activité' },
  { key: 'total_extractions', label: 'Extractions' },
  { key: 'credits',           label: 'Crédits' },
]

export default function UsersHub({ initialData }) {
  const router = useRouter()
  const [search, setSearch]       = useState('')
  const [planFilter, setPlan]     = useState('all')
  const [statusFilter, setStatus] = useState('all')
  const [sort, setSort]           = useState({ col: 'createdAt', dir: 'desc' })

  // Modals
  const [suspendTarget,    setSuspend]    = useState(null)
  const [reactivateTarget, setReactivate] = useState(null)
  const [planTarget,       setPlanTarget] = useState(null)
  const [deleteTarget,     setDelete]     = useState(null)
  const [viewTarget,       setView]       = useState(null)

  const filtered = useMemo(() => {
    let rows = [...initialData]

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(c =>
        c.nom.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.nom_user.toLowerCase().includes(q)
      )
    }

    if (planFilter !== 'all') rows = rows.filter(c => c.plan_status === planFilter)

    if (statusFilter === 'active')    rows = rows.filter(c => !c.suspended)
    if (statusFilter === 'suspended') rows = rows.filter(c => c.suspended)

    rows.sort((a, b) => {
      let av = a[sort.col], bv = b[sort.col]
      if (av == null) av = ''
      if (bv == null) bv = ''
      if (typeof av === 'number') return sort.dir === 'asc' ? av - bv : bv - av
      return sort.dir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })

    return rows
  }, [initialData, search, planFilter, statusFilter, sort])

  function toggleSort(col) {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'desc' }
    )
  }

  const hasFilter = search || planFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Utilisateurs</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {initialData.length} cabinet{initialData.length !== 1 ? 's' : ''} enregistrés
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou email…"
            className="pl-9 h-9 text-sm"
          />
        </div>

        <Select value={planFilter} onValueChange={setPlan}>
          <SelectTrigger className="h-9 w-36 text-sm">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les plans</SelectItem>
            <SelectItem value="TRIAL">TRIAL</SelectItem>
            <SelectItem value="ACTIVE">ACTIVE</SelectItem>
            <SelectItem value="CANCELED">CANCELED</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-40 text-sm">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actifs</SelectItem>
            <SelectItem value="suspended">Suspendus</SelectItem>
          </SelectContent>
        </Select>

        {hasFilter && (
          <Button
            variant="ghost" size="sm"
            onClick={() => { setSearch(''); setPlan('all'); setStatus('all') }}
            className="h-9 gap-1.5 text-slate-500"
          >
            <FilterXIcon className="h-3.5 w-3.5" /> Effacer
          </Button>
        )}

        <span className="ml-auto text-xs text-slate-400 tabular-nums">
          {filtered.length} / {initialData.length} résultats
        </span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200/60 dark:border-white/[0.07] bg-white dark:bg-white/[0.02] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-slate-50/70 dark:bg-white/[0.02]">
                {COLS.map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-300 select-none whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {label} {sortIcon(key, sort)}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100/60 dark:divide-white/[0.04]">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={COLS.length + 1} className="py-12 text-center text-sm text-slate-400 dark:text-slate-600">
                    Aucun résultat
                  </td>
                </tr>
              )}
              {filtered.map(cab => (
                <tr
                  key={cab.id}
                  className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate max-w-[160px]">{cab.nom}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{cab.nom_user}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300 text-[13px] truncate max-w-[180px]">
                    {cab.email}
                  </td>
                  <td className="px-4 py-3">
                    {planBadge(cab.plan, cab.plan_status, cab.suspended)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {fmt(cab.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
                    {fmt(cab.last_active)}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                    {cab.total_extractions}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[13px] font-semibold tabular-nums ${cab.credits <= 2 ? 'text-red-500' : cab.credits <= 5 ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
                      {cab.credits}
                    </span>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">/{cab.credits_limit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ActionsMenu
                      cab={cab}
                      onSuspend={setSuspend}
                      onReactivate={setReactivate}
                      onPlan={setPlanTarget}
                      onDelete={setDelete}
                      onView={setView}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <SuspendModal    cabinet={suspendTarget}    open={!!suspendTarget}    onClose={() => setSuspend(null)}    onRefresh={() => router.refresh()} />
      <ReactivateModal cabinet={reactivateTarget} open={!!reactivateTarget} onClose={() => setReactivate(null)} onRefresh={() => router.refresh()} />
      <PlanModal       cabinet={planTarget}       open={!!planTarget}       onClose={() => setPlanTarget(null)} onRefresh={() => router.refresh()} />
      <DeleteModal     cabinet={deleteTarget}     open={!!deleteTarget}     onClose={() => setDelete(null)}     onRefresh={() => router.refresh()} />
      <ProfileModal    cabinet={viewTarget}       open={!!viewTarget}       onClose={() => setView(null)} />
    </div>
  )
}
