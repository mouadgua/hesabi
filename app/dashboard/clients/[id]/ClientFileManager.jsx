"use client"

import { useState, useEffect, useCallback, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { createBrowserSupabase } from '@/utils/supabase/client'
import {
  uploadToDriveAction, extractDocumentsAction,
  deleteDocumentsAction, createFolderAction
} from '@/app/dashboard/actions'
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import ExportModal from './ExportModal'
import FirstExtractionWizard from '@/components/FirstExtractionWizard'
import {
  ArrowLeftIcon, UploadCloudIcon, FileIcon, FolderIcon, FolderOpenIcon,
  PlayIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon, TrashIcon,
  EyeIcon, XCircleIcon, SearchIcon, DownloadIcon, FolderPlusIcon,
  Loader2Icon, SparklesIcon, FilterIcon, XIcon, FileTextIcon,
  ChevronRightIcon, ReceiptIcon, LandmarkIcon, ShoppingCartIcon,
  TicketIcon, HelpCircleIcon, ShieldAlertIcon
} from "lucide-react"

// ─── Status helpers ─────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  A_EXTRAIRE: { label: 'À Extraire', color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
  EN_COURS_IA: { label: 'En cours…', color: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', spin: true },
  A_VERIFIER: { label: 'À Vérifier', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  VALIDE: { label: 'Validé', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  REJETE: { label: 'Erreur', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
}

function StatusBadge({ statut }) {
  const cfg = STATUS_CONFIG[statut] || STATUS_CONFIG.A_EXTRAIRE
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${cfg.spin ? 'animate-pulse' : ''}`} />
      {cfg.label}
    </span>
  )
}

// ─── Document type icons + labels ───────────────────────────────────────────

const DOC_TYPE_CONFIG = {
  facture:         { icon: ReceiptIcon,      label: 'Facture',          color: 'text-violet-600' },
  releve_bancaire: { icon: LandmarkIcon,     label: 'Relevé bancaire',  color: 'text-blue-600'   },
  bon_commande:    { icon: ShoppingCartIcon, label: 'Bon de commande',  color: 'text-orange-600' },
  recu:            { icon: TicketIcon,       label: 'Reçu',             color: 'text-teal-600'   },
  autre:           { icon: HelpCircleIcon,   label: 'Autre',            color: 'text-gray-400'   },
}

function DocTypeIcon({ type, className = 'w-4 h-4' }) {
  const cfg = DOC_TYPE_CONFIG[type]
  if (!cfg) return null
  const Icon = cfg.icon
  return <Icon className={`${className} ${cfg.color}`} title={cfg.label} />
}

// ─── Type badge colour ───────────────────────────────────────────────────────

const TYPE_COLORS = [
  'bg-violet-50 text-violet-700 border-violet-200',
  'bg-cyan-50 text-cyan-700 border-cyan-200',
  'bg-rose-50 text-rose-700 border-rose-200',
  'bg-teal-50 text-teal-700 border-teal-200',
  'bg-orange-50 text-orange-700 border-orange-200',
]
const typeColorMap = new Map()
let colorIdx = 0
function getTypeColor(type) {
  if (!typeColorMap.has(type)) {
    typeColorMap.set(type, TYPE_COLORS[colorIdx % TYPE_COLORS.length])
    colorIdx++
  }
  return typeColorMap.get(type)
}

// ─── Card thumbnail ──────────────────────────────────────────────────────────

const GRADIENT_PALETTES = [
  'from-indigo-100 to-purple-100',
  'from-blue-100 to-cyan-100',
  'from-rose-100 to-orange-100',
  'from-emerald-100 to-teal-100',
  'from-amber-100 to-yellow-100',
]
function cardGradient(name = '') {
  const code = name.charCodeAt(0) || 0
  return GRADIENT_PALETTES[code % GRADIENT_PALETTES.length]
}

// ─── Skeleton card ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <Skeleton className="h-36 w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
    </div>
  )
}

// ─── Document card ───────────────────────────────────────────────────────────

function DocumentCard({ doc, isSelected, onToggle, onDoubleClick, onDelete }) {
  const gradient = cardGradient(doc.nom_fichier)
  const typeName = doc.template?.nom_modele || 'IA Libre'
  const typeColor = doc.template ? getTypeColor(typeName) : 'bg-indigo-50 text-indigo-700 border-indigo-200'
  const lowConfidence = doc.document_type_confidence != null && doc.document_type_confidence < 0.7

  return (
    <div
      className={`relative group bg-white rounded-xl border shadow-sm overflow-hidden cursor-pointer
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 select-none
        ${isSelected ? 'ring-2 ring-indigo-500 border-indigo-400' : 'border-gray-200'}`}
      onDoubleClick={onDoubleClick}
    >
      {/* Checkbox (visible on hover or selected) */}
      <div className={`absolute top-2.5 left-2.5 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggle}
          onClick={e => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 cursor-pointer shadow-sm bg-white"
        />
      </div>

      {/* Low-confidence badge */}
      {lowConfidence && doc.document_type && (
        <div className="absolute top-2.5 right-2.5 z-10">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-700 text-[10px] font-semibold">
            <ShieldAlertIcon className="w-3 h-3" /> À vérifier
          </span>
        </div>
      )}

      {/* Thumbnail */}
      <div className={`h-36 bg-gradient-to-br ${gradient} flex items-center justify-center border-b border-gray-100 relative`}>
        {doc.document_type && doc.document_type !== 'autre' ? (
          <DocTypeIcon type={doc.document_type} className="w-12 h-12 opacity-30" />
        ) : (
          <FileTextIcon className="w-12 h-12 text-indigo-300" strokeWidth={1} />
        )}
        {/* Fournisseur chip */}
        {doc.fournisseur_detecte && (
          <div className="absolute bottom-2 left-2 right-2">
            <p className="text-[10px] text-gray-600 bg-white/80 backdrop-blur-sm rounded px-1.5 py-0.5 truncate font-medium">
              {doc.fournisseur_detecte}
            </p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <p className="font-medium text-gray-900 text-sm truncate mb-2" title={doc.nom_fichier}>
          {doc.nom_fichier || `Document_${doc.id.substring(0, 6)}`}
        </p>
        <div className="flex items-center justify-between mb-2.5 gap-1">
          <span className="text-xs text-gray-400 shrink-0">
            {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
          </span>
          <div className="flex items-center gap-1 min-w-0">
            {doc.document_type && (
              <DocTypeIcon type={doc.document_type} className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[11px] font-medium truncate ${typeColor}`}>
              {typeName}
            </span>
          </div>
        </div>
        <StatusBadge statut={doc.statut} />
      </div>

      {/* Hover action overlay */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[1px] opacity-0 group-hover:opacity-100
        transition-opacity duration-200 flex items-center justify-center gap-2 rounded-xl">
        <Link href={`/dashboard/verification?id=${doc.id}`} onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="secondary" className="bg-white text-gray-800 hover:bg-gray-100 shadow-sm gap-1.5 text-xs">
            <EyeIcon className="w-3.5 h-3.5" /> Ouvrir
          </Button>
        </Link>
        {doc.donnees_extraites && Object.keys(doc.donnees_extraites).length > 0 && (
          <ExportModal selectedDocs={[doc]} trigger={
            <Button size="sm" variant="secondary" className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm gap-1.5 text-xs">
              <DownloadIcon className="w-3.5 h-3.5" /> Exporter
            </Button>
          } />
        )}
        <Button
          size="sm"
          variant="destructive"
          className="shadow-sm gap-1.5 text-xs"
          onClick={e => { e.stopPropagation(); onDelete() }}
        >
          <TrashIcon className="w-3.5 h-3.5" /> Supprimer
        </Button>
      </div>
    </div>
  )
}

// ─── Split-view Drawer ───────────────────────────────────────────────────────

function SplitDrawer({ doc, onClose }) {
  const hasData = doc?.donnees_extraites && Object.keys(doc.donnees_extraites).length > 0

  return (
    <Sheet open={!!doc} onOpenChange={open => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[90vw] p-0 flex flex-col">
        {doc && (
          <>
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b bg-white shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 truncate">{doc.nom_fichier}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Date(doc.createdAt).toLocaleDateString('fr-FR')} •{' '}
                  <StatusBadge statut={doc.statut} />
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasData && <ExportModal selectedDocs={[doc]} />}
                <Link href={`/dashboard/verification?id=${doc.id}`}>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <EyeIcon className="w-4 h-4" /> Espace complet
                  </Button>
                </Link>
              </div>
            </div>

            {/* Split body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: PDF */}
              <div className="w-1/2 bg-gray-100 border-r relative">
                {doc.signedUrl ? (
                  <iframe src={doc.signedUrl} className="w-full h-full absolute inset-0 border-0" title={doc.nom_fichier} />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    <FileIcon className="w-8 h-8 mr-2 text-gray-300" /> Aperçu indisponible
                  </div>
                )}
              </div>

              {/* Right: extracted data */}
              <div className="w-1/2 overflow-y-auto p-5 space-y-4 bg-gray-50">
                {hasData ? (
                  <>
                    <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Données extraites</h4>
                    {Object.entries(doc.donnees_extraites).map(([key, value]) => {
                      const isComplex = typeof value === 'object' && value !== null
                      return (
                        <div key={key} className="bg-white rounded-lg border p-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                            {key.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-gray-800 font-medium break-words">
                            {isComplex ? JSON.stringify(value, null, 2) : (String(value) || '—')}
                          </p>
                        </div>
                      )
                    })}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <SparklesIcon className="w-10 h-10 text-indigo-200 mb-3" />
                    <p className="font-medium text-gray-500">Aucune donnée extraite</p>
                    <p className="text-xs text-gray-400 mt-1">Lancez l'extraction depuis l'espace complet.</p>
                    <Link href={`/dashboard/verification?id=${doc.id}`} className="mt-4">
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        Ouvrir l'espace
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function ClientFileManager({
  client, documents: initialDocuments, currentDossier, creditsRestants, dossierFilter, onboardingDone = true
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Local docs state — updated via Supabase Realtime
  const [docs, setDocs] = useState(initialDocuments)

  // Sync when server re-renders with fresh data (router.refresh)
  useEffect(() => { setDocs(initialDocuments) }, [initialDocuments])

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('TOUS')
  const [isDragging, setIsDragging] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [selectedDocs, setSelectedDocs] = useState(new Set())
  const [selectedTemplate, setSelectedTemplate] = useState('NO_MODEL')
  const [isExtracting, setIsExtracting] = useState(false)
  const [drawerDoc, setDrawerDoc] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showWizard, setShowWizard] = useState(false)
  const [wizardOnComplete, setWizardOnComplete] = useState(null)
  const fileInputRef = useRef(null)
  const dragCounter = useRef(0)

  // ── Supabase Realtime: live document updates ───────────────────────────────
  // Requires Realtime to be enabled for the "Document" table in Supabase dashboard
  useEffect(() => {
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel(`docs-${client.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Document', filter: `client_id=eq.${client.id}` },
        (payload) => {
          const updated = payload.new
          setDocs(prev => prev.map(d =>
            d.id === updated.id
              ? {
                  ...d,
                  statut: updated.statut,
                  donnees_extraites: updated.donnees_extraites ?? d.donnees_extraites,
                  document_type: updated.document_type ?? d.document_type,
                  document_type_confidence: updated.document_type_confidence ?? d.document_type_confidence,
                  fournisseur_detecte: updated.fournisseur_detecte ?? d.fournisseur_detecte,
                  error_message: updated.error_message ?? d.error_message,
                }
              : d
          ))
          // Also update open drawer if it's the same doc
          setDrawerDoc(prev => prev?.id === updated.id ? { ...prev, statut: updated.statut, donnees_extraites: updated.donnees_extraites ?? prev.donnees_extraites } : prev)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [client.id])

  // Keyboard shortcut: Ctrl+U → open upload
  useEffect(() => {
    const handler = () => {
      if (creditsRestants > 0) setUploadOpen(true)
    }
    document.addEventListener('app:upload', handler)
    return () => document.removeEventListener('app:upload', handler)
  }, [creditsRestants])

  // Unique types for filter (template names + detected document_type labels)
  const docTypes = useMemo(() => {
    const types = new Set()
    docs.forEach(doc => {
      if (doc.template?.nom_modele) types.add(doc.template.nom_modele)
      if (doc.document_type && DOC_TYPE_CONFIG[doc.document_type]) {
        types.add(DOC_TYPE_CONFIG[doc.document_type].label)
      }
    })
    return Array.from(types)
  }, [docs])

  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      const matchSearch = !search || doc.nom_fichier?.toLowerCase().includes(search.toLowerCase())
      const docTypeLabel = doc.document_type ? DOC_TYPE_CONFIG[doc.document_type]?.label : null
      const matchType = typeFilter === 'TOUS' ||
        doc.template?.nom_modele === typeFilter ||
        docTypeLabel === typeFilter
      return matchSearch && matchType
    })
  }, [docs, search, typeFilter])

  const selectedDocIds = useMemo(() => Array.from(selectedDocs), [selectedDocs])

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (creditsRestants <= 0) { toast.error('Crédits épuisés — upload impossible.'); return }
    const files = Array.from(e.dataTransfer.files).filter(f =>
      f.type === 'application/pdf' || f.type.startsWith('image/')
    )
    if (files.length === 0) { toast.error('Seuls les PDF et images sont acceptés.'); return }
    await doUpload(files)
  }, [creditsRestants, dossierFilter])

  // ── Actions ────────────────────────────────────────────────────────────────

  const doUpload = async (files) => {
    setIsUploading(true)
    const id = toast.loading(`Upload de ${files.length} fichier(s)…`)
    try {
      const fd = new FormData()
      fd.append('client_id', client.id)
      if (dossierFilter) fd.append('dossier_id', dossierFilter)
      files.forEach(f => fd.append('file', f))
      await uploadToDriveAction(fd)
      toast.success(`${files.length} fichier(s) uploadé(s) !`, { id })
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'upload", { id })
    } finally {
      setIsUploading(false)
      setUploadOpen(false)
    }
  }

  const doExtract = async () => {
    setIsExtracting(true)
    const id = toast.loading('Mise en file d\'extraction…')
    try {
      const fd = new FormData()
      fd.append('client_id', client.id)
      fd.append('template_id', selectedTemplate)
      selectedDocIds.forEach(did => fd.append('documentIds', did))
      await extractDocumentsAction(fd)
      toast.success('Extraction lancée ! Les documents passent en traitement.', { id })
      setSelectedDocs(new Set())
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err.message || "Erreur lors de l'extraction", { id })
    } finally {
      setIsExtracting(false)
    }
  }

  const handleExtract = async () => {
    if (selectedDocIds.length === 0) { toast.error('Sélectionnez au moins un document.'); return }
    if (!onboardingDone) {
      setShowWizard(true)
      setWizardOnComplete(() => doExtract)
      return
    }
    await doExtract()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const ids = typeof deleteTarget === 'string' ? [deleteTarget] : deleteTarget
    setIsDeleting(true)
    const id = toast.loading('Suppression en cours…')
    try {
      const fd = new FormData()
      fd.append('client_id', client.id)
      ids.forEach(did => fd.append('documentIds', did))
      await deleteDocumentsAction(fd)
      toast.success('Document(s) supprimé(s).', { id })
      setSelectedDocs(prev => { const n = new Set(prev); ids.forEach(d => n.delete(d)); return n })
      setDeleteTarget(null)
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la suppression', { id })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCreateFolder = async (e) => {
    e.preventDefault()
    if (!folderName.trim()) return
    setIsCreatingFolder(true)
    const id = toast.loading('Création du dossier…')
    try {
      const fd = new FormData()
      fd.append('client_id', client.id)
      fd.append('nom', folderName.trim())
      await createFolderAction(fd)
      toast.success(`Dossier "${folderName.trim()}" créé.`, { id })
      setFolderName('')
      setCreateFolderOpen(false)
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err.message || 'Erreur lors de la création', { id })
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const toggleDoc = (docId) => {
    setSelectedDocs(prev => {
      const n = new Set(prev)
      n.has(docId) ? n.delete(docId) : n.add(docId)
      return n
    })
  }

  const hasFilters = search || typeFilter !== 'TOUS'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="relative min-h-[calc(100vh-80px)]"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* ── Drag overlay ── */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-indigo-600/10 backdrop-blur-[2px] border-4 border-dashed border-indigo-400 rounded-2xl flex flex-col items-center justify-center pointer-events-none">
          <UploadCloudIcon className="w-20 h-20 text-indigo-500 animate-bounce mb-4" />
          <p className="text-2xl font-bold text-indigo-700">Déposez vos fichiers ici</p>
          <p className="text-indigo-500 mt-1 text-sm">PDF et images acceptés</p>
        </div>
      )}

      <div className="p-4 md:p-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-full bg-white shadow-sm border shrink-0">
                <ArrowLeftIcon className="w-4 h-4 text-gray-600" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 truncate">Espace d'extraction — {client.nom_entreprise}</h1>
              <p className="text-xs md:text-sm text-gray-500">Uploadez vos fichiers, assignez un modèle et lancez l'extraction en lot</p>
            </div>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-sm text-sm font-semibold
            ${creditsRestants > 0 ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : 'bg-red-50 border-red-200 text-red-800'}`}>
            {creditsRestants > 0
              ? <SparklesIcon className="w-4 h-4 text-indigo-600" />
              : <AlertCircleIcon className="w-4 h-4 text-red-600" />}
            {creditsRestants} extraction{creditsRestants !== 1 ? 's' : ''} restante{creditsRestants !== 1 ? 's' : ''}
            <span className="text-xs opacity-70">(Bêta)</span>
          </div>
        </div>

        {/* ── Client info card ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 bg-indigo-50/40 border border-indigo-100 rounded-xl p-4 text-sm">
          {[['ICE', client.ice], ['IF', client.identifiant_fiscal], ['RC', client.registre_commerce], ['RIB', client.rib], ['Ville', client.ville]].map(([label, val]) => (
            <div key={label} className="flex flex-col">
              <span className="text-gray-400 text-[10px] uppercase tracking-wider mb-0.5">{label}</span>
              <span className="font-medium text-gray-800 truncate">{val || '—'}</span>
            </div>
          ))}
        </div>

        {/* ── Folder breadcrumb ── */}
        {currentDossier && (
          <div className="flex items-center justify-between p-3.5 bg-yellow-50 border border-yellow-200 rounded-xl">
            <div className="flex items-center gap-2 text-yellow-800 font-semibold">
              <FolderOpenIcon className="w-5 h-5 text-yellow-500 fill-yellow-200" />
              {currentDossier.nom}
            </div>
            <Link href={`/dashboard/clients/${client.id}`}>
              <Button variant="outline" size="sm" className="bg-white border-yellow-300 text-yellow-800 hover:bg-yellow-100">
                <ArrowLeftIcon className="w-3.5 h-3.5 mr-1.5" /> Racine
              </Button>
            </Link>
          </div>
        )}

        {/* ── Toolbar ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
          <div className="flex flex-wrap gap-2 items-center">
            {/* Upload */}
            {creditsRestants > 0 ? (
              <Button
                variant="outline"
                className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 gap-1.5"
                onClick={() => setUploadOpen(true)}
                disabled={isUploading}
              >
                {isUploading ? <Loader2Icon className="w-4 h-4 animate-spin" /> : <UploadCloudIcon className="w-4 h-4" />}
                Uploader
                <kbd className="ml-1 text-[10px] text-indigo-400 bg-indigo-50 border border-indigo-100 rounded px-1">⌘U</kbd>
              </Button>
            ) : (
              <Button disabled variant="outline" className="border-red-200 text-red-400 gap-1.5 cursor-not-allowed">
                <AlertCircleIcon className="w-4 h-4" /> Essai épuisé
              </Button>
            )}

            {/* New folder */}
            <Button
              variant="outline"
              className="border-gray-200 text-gray-700 hover:bg-gray-50 gap-1.5"
              onClick={() => setCreateFolderOpen(true)}
            >
              <FolderPlusIcon className="w-4 h-4" /> Nouveau dossier
            </Button>

            {/* Template + Extract (shown when docs selected) */}
            {selectedDocIds.length > 0 && (
              <>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="w-[160px] h-9 border-indigo-200">
                    <SelectValue placeholder="Modèle…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Options</SelectLabel>
                      <SelectItem value="NO_MODEL" className="font-semibold text-indigo-600">✨ IA Libre</SelectItem>
                      <SelectItem value="DEFAULT_FACTURE">Facture Générique</SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel>Vos Modèles</SelectLabel>
                      {client.cabinet.templates.map(t => (
                        <SelectItem key={t.id} value={t.id}>{t.nom_modele}</SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>

                <Button
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
                  onClick={handleExtract}
                  disabled={isExtracting}
                >
                  {isExtracting
                    ? <Loader2Icon className="w-4 h-4 animate-spin" />
                    : <PlayIcon className="w-4 h-4" />}
                  Extraire ({selectedDocIds.length})
                </Button>

                <Button
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => setDeleteTarget(selectedDocIds)}
                  disabled={isDeleting}
                >
                  <TrashIcon className="w-4 h-4" /> Supprimer ({selectedDocIds.length})
                </Button>
              </>
            )}
          </div>

          <span className="text-sm text-gray-400 whitespace-nowrap">
            {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Search + type filter ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Rechercher un document…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 bg-white"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[170px] h-9 bg-white gap-1.5">
              <FilterIcon className="w-3.5 h-3.5 text-gray-400" />
              <SelectValue placeholder="Type…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TOUS">Tous les types</SelectItem>
              {docTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 gap-1 h-9 px-2"
              onClick={() => { setSearch(''); setTypeFilter('TOUS') }}>
              <XIcon className="w-3.5 h-3.5" /> Effacer
            </Button>
          )}
        </div>

        {/* ── Folders ── */}
        {!dossierFilter && client.dossiers.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {client.dossiers.map(dossier => (
              <Link key={dossier.id} href={`/dashboard/clients/${client.id}?dossier=${dossier.id}`}>
                <div className="flex items-center gap-3 bg-white border border-yellow-200 rounded-xl p-3.5 hover:bg-yellow-50 hover:shadow-sm transition-all cursor-pointer group">
                  <FolderIcon className="w-8 h-8 text-yellow-400 fill-yellow-100 shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate text-sm">{dossier.nom}</p>
                    <p className="text-xs text-gray-400">{new Date(dossier.createdAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-gray-300 ml-auto shrink-0 group-hover:text-yellow-500 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── Card grid or empty state ── */}
        {isPending ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            {/* Simple file upload SVG illustration */}
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none" className="mb-6 opacity-50">
              <rect x="20" y="30" width="80" height="65" rx="8" fill="#e0e7ff" />
              <rect x="30" y="22" width="60" height="70" rx="6" fill="#c7d2fe" />
              <rect x="38" y="30" width="44" height="54" rx="4" fill="white" />
              <rect x="44" y="42" width="32" height="3" rx="1.5" fill="#a5b4fc" />
              <rect x="44" y="52" width="24" height="3" rx="1.5" fill="#a5b4fc" />
              <rect x="44" y="62" width="28" height="3" rx="1.5" fill="#a5b4fc" />
              <circle cx="85" cy="85" r="18" fill="#4f46e5" />
              <path d="M85 77v16M77 85h16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <h3 className="text-lg font-bold text-gray-700 mb-2">
              {hasFilters ? 'Aucun document ne correspond à cette recherche' : 'Aucun document ici'}
            </h3>
            <p className="text-sm text-gray-400 mb-5 max-w-xs">
              {hasFilters
                ? 'Essayez de modifier les filtres ou la recherche.'
                : creditsRestants > 0
                  ? 'Glissez-déposez des PDF sur la page, ou utilisez le bouton d\'upload.'
                  : 'Vos crédits d\'essai sont épuisés.'}
            </p>
            {!hasFilters && creditsRestants > 0 && (
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                onClick={() => setUploadOpen(true)}
              >
                <UploadCloudIcon className="w-4 h-4" /> Uploader des fichiers
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                isSelected={selectedDocs.has(doc.id)}
                onToggle={() => toggleDoc(doc.id)}
                onDoubleClick={() => setDrawerDoc(doc)}
                onDelete={() => setDeleteTarget([doc.id])}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Split-view drawer ── */}
      <SplitDrawer doc={drawerDoc} onClose={() => setDrawerDoc(null)} />

      {/* ── Upload dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Uploader des fichiers</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              const files = Array.from(fileInputRef.current?.files || [])
              if (files.length > 0) await doUpload(files)
            }}
            className="space-y-4 pt-2"
          >
            <div className="space-y-2">
              <Label>Fichiers (PDF, Images)</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                multiple
                required
                className="cursor-pointer"
              />
            </div>
            <p className="text-xs text-gray-400">Ou fermez cette fenêtre et glissez-déposez directement sur la page.</p>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isUploading}
            >
              {isUploading
                ? <><Loader2Icon className="w-4 h-4 mr-2 animate-spin" /> Upload en cours…</>
                : <><UploadCloudIcon className="w-4 h-4 mr-2" /> Envoyer les fichiers</>}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── New folder dialog ── */}
      <Dialog open={createFolderOpen} onOpenChange={setCreateFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Créer un dossier</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateFolder} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nom du dossier</Label>
              <Input
                placeholder="Ex: Banque 2024, Achats T1…"
                value={folderName}
                onChange={e => setFolderName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              disabled={isCreatingFolder || !folderName.trim()}
            >
              {isCreatingFolder
                ? <><Loader2Icon className="w-4 h-4 mr-2 animate-spin" /> Création…</>
                : 'Créer le dossier'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer les documents ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de supprimer{' '}
              <strong>
                {Array.isArray(deleteTarget) && deleteTarget.length === 1
                  ? docs.find(d => d.id === deleteTarget[0])?.nom_fichier || '1 document'
                  : `${deleteTarget?.length ?? 0} document(s)`}
              </strong>.
              {' '}Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting
                ? <><Loader2Icon className="w-4 h-4 mr-2 animate-spin" /> Suppression…</>
                : 'Supprimer définitivement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── First extraction wizard ── */}
      <FirstExtractionWizard
        open={showWizard}
        onComplete={() => {
          setShowWizard(false)
          if (wizardOnComplete) wizardOnComplete()
        }}
        onSkip={() => {
          setShowWizard(false)
          if (wizardOnComplete) wizardOnComplete()
        }}
      />
    </div>
  )
}
