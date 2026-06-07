"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { createBrowserSupabase } from "@/utils/supabase/client"
import { extractDocumentsAction, deleteDocumentsAction } from "@/app/dashboard/actions"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectGroup, SelectItem,
  SelectLabel, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  UploadCloudIcon, FileTextIcon, ImageIcon, Loader2Icon, SparklesIcon,
  Trash2Icon, ChevronRightIcon, AlertCircleIcon,
  CheckCircle2Icon, ClockIcon, FolderIcon, AlertTriangleIcon,
  CreditCardIcon, WifiOffIcon, ShieldAlertIcon, UsersIcon, XIcon,
  SearchIcon, FilterXIcon,
} from "lucide-react"
import { FirstVisitHint } from "@/components/first-visit-hint"
import AIErrorModal, { getAIErrorCode } from "@/components/ai-error-modal"

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_EXTS  = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']
const ACCEPT_ATTR    = '.pdf,.jpg,.jpeg,.png,.webp,.heic'
const MAX_RETRIES    = 2

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CFG = {
  A_EXTRAIRE:  { label: 'En attente',  cn: 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10',                   Icon: ClockIcon,        spin: false },
  EN_COURS_IA: { label: 'En cours…',   cn: 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20',                     Icon: Loader2Icon,      spin: true  },
  A_VERIFIER:  { label: 'À vérifier',  cn: 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',               Icon: SparklesIcon,     spin: false },
  VALIDE:      { label: 'Validé',      cn: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',   Icon: CheckCircle2Icon, spin: false },
  REJETE:      { label: 'Erreur IA',   cn: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20',                           Icon: AlertCircleIcon,  spin: false },
}

function StatusBadge({ statut }) {
  const { label, cn, Icon, spin } = STATUS_CFG[statut] ?? STATUS_CFG.A_EXTRAIRE
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${cn}`}>
      <Icon className={`w-3 h-3 shrink-0 ${spin ? 'animate-spin' : ''}`} />
      {label}
    </span>
  )
}

function DocFileIcon({ filename }) {
  const ext = (filename?.split('.').pop() ?? '').toLowerCase()
  if (ext === 'pdf') return <FileTextIcon className="w-4 h-4 text-red-400 shrink-0" />
  return <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
}

// ── Confidence badge (fiabilité IA) ───────────────────────────────────────────

function ConfidenceBadge({ confidence }) {
  if (confidence == null) return null
  if (confidence >= 0.75) return null // bon score → pas besoin d'alerter
  const low = confidence < 0.5
  return (
    <span title={`Fiabilité IA : ${Math.round(confidence * 100)}%`}
      className={`hidden md:inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0
        ${low
          ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400'
          : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
        }`}
    >
      <AlertTriangleIcon className="w-2.5 h-2.5 shrink-0" />
      {Math.round(confidence * 100)}%
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ExtractionHub({
  initialDocuments, templates, credits: initialCredits, activeClient,
  initialSearch = '', initialStatut = '', initialType = '',
}) {
  const router = useRouter()
  const [docs, setDocs] = useState(initialDocuments)
  const [credits, setCredits] = useState(initialCredits)
  const [selectedDocIds, setSelectedDocIds] = useState(new Set())
  const [templateId, setTemplateId] = useState('NO_MODEL')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [aiError, setAiError] = useState(null)
  const [isIOS, setIsIOS] = useState(false)
  const [, startTransition] = useTransition()

  // ── Search & filter state ─────────────────────────────────────────────────
  const [query,        setQuery]        = useState(initialSearch)
  const [statutFilter, setStatutFilter] = useState(initialStatut)
  const [typeFilter,   setTypeFilter]   = useState(initialType)

  const dragCounter = useRef(0)
  const singleRef = useRef(null)
  const multipleRef = useRef(null)
  const folderRef = useRef(null)

  useEffect(() => { setDocs(initialDocuments) }, [initialDocuments])
  useEffect(() => { setCredits(initialCredits) }, [initialCredits])

  // ── Sync filters to URL (debounced 300ms for text) ────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const p = new URLSearchParams()
      if (activeClient?.id) p.set('client', activeClient.id)
      if (query)            p.set('q',      query)
      if (statutFilter)     p.set('statut', statutFilter)
      if (typeFilter)       p.set('type',   typeFilter)
      const qs = p.toString()
      router.replace(qs ? `/dashboard/extraction?${qs}` : '/dashboard/extraction', { scroll: false })
    }, 300)
    return () => clearTimeout(timer)
  }, [query, statutFilter, typeFilter])

  // ── iOS / mobile detection (folder upload not supported on iOS) ───────────
  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent))
  }, [])

  // ── Supabase Realtime — listen to Document updates ────────────────────────

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel('hub-docs')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'Document',
      }, ({ new: updated }) => {
        setDocs(prev => prev.map(d =>
          d.id === updated.id
            ? {
                ...d,
                statut:        updated.statut,
                document_type: updated.document_type ?? d.document_type,
                confidence:    updated.document_type_confidence ?? d.confidence,
                error_message: updated.error_message ?? d.error_message,
              }
            : d
        ))
        if (updated.statut === 'REJETE') {
          const code = getAIErrorCode(updated.error_message)
          if (code) {
            const doc = initialDocuments.find(d => d.id === updated.id)
            setAiError({ code, filename: doc?.nom_fichier ?? updated.nom_fichier, docId: updated.id })
          }
        }
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // ── Polling while processing ───────────────────────────────────────────────

  useEffect(() => {
    const hasProcessing = docs.some(d => d.statut === 'EN_COURS_IA')
    if (!hasProcessing) return
    const timer = setInterval(() => {
      startTransition(() => router.refresh())
    }, 4000)
    return () => clearInterval(timer)
  }, [docs])

  // ── File validation ───────────────────────────────────────────────────────

  function validateFiles(fileList) {
    const valid = []
    for (const file of fileList) {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!ACCEPTED_EXTS.includes(ext)) {
        toast.error(`Format non supporté : ${file.name}`)
      } else {
        valid.push(file)
      }
    }
    return valid
  }

  // ── Duplicate detection ───────────────────────────────────────────────────

  function findDuplicates(files) {
    return files.filter(f =>
      docs.some(d => d.nom_fichier === f.name && !['REJETE'].includes(d.statut))
    )
  }

  // ── Core upload with retry ────────────────────────────────────────────────

  async function uploadSequential(files, getDossierId = () => null) {
    setUploadProgress({ current: 0, total: files.length })
    const uploaded = []

    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      const dossierId = await getDossierId(file)
      if (dossierId) fd.append('dossier_id', dossierId)
      // Attach to active client so docs stay visible in filtered view after reload
      if (activeClient?.id) fd.append('client_id', activeClient.id)

      let success = false
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 800 * attempt))
        }
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          const data = await res.json()
          if (res.ok) {
            uploaded.push({
              id:            data.documentId,
              nom_fichier:   file.name,
              statut:        'A_EXTRAIRE',
              document_type: null,
              confidence:    null,
              dossier_id:    dossierId,
              dossier_nom:   null,
              error_message: null,
              createdAt:     new Date().toISOString(),
            })
            success = true
            break
          } else if (res.status === 400 && data.error?.includes('Crédits')) {
            toast.error(data.error, {
              action: { label: 'Voir les plans', onClick: () => router.push('/dashboard/settings/billing') }
            })
            success = true // don't retry credit errors
            break
          } else {
            if (attempt === MAX_RETRIES) toast.error(data.error ?? `Échec : ${file.name}`)
          }
        } catch {
          if (attempt === MAX_RETRIES) {
            toast.error(`Connexion perdue pour ${file.name}. Vérifiez votre connexion internet.`, {
              action: { label: 'Réessayer', onClick: () => handleFiles([file]) }
            })
          }
        }
      }

      setUploadProgress(p => ({ ...p, current: p.current + 1 }))
      if (!success) continue
    }

    setUploadProgress(null)
    if (uploaded.length > 0) {
      setDocs(prev => [...uploaded, ...prev])
      setCredits(c => c - uploaded.length)
      toast.success(`${uploaded.length} fichier${uploaded.length > 1 ? 's uploadés' : ' uploadé'}.`)
    }
  }

  // ── Upload handlers ───────────────────────────────────────────────────────

  async function handleFiles(rawFiles) {
    const valid = validateFiles(rawFiles)
    if (valid.length === 0) return

    // Duplicate detection
    const dupes = findDuplicates(valid)
    if (dupes.length > 0) {
      const names = dupes.map(f => f.name).join(', ')
      toast.warning(`Fichier déjà présent : ${names}. L'upload continuera quand même.`)
    }

    await uploadSequential(valid)
  }

  async function handleFolderFiles(rawFiles) {
    const valid = validateFiles(rawFiles)
    if (valid.length === 0) return

    const uniquePaths = [...new Set(
      valid.flatMap(f => {
        const parts = f.webkitRelativePath.split('/')
        parts.pop()
        return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
      }).filter(Boolean)
    )].sort((a, b) => a.split('/').length - b.split('/').length)

    const pathToId = {}
    const toastId = toast.loading('Création de la structure de dossiers…')
    for (const path of uniquePaths) {
      const parts    = path.split('/')
      const name     = parts[parts.length - 1]
      const parentPath = parts.slice(0, -1).join('/')
      const parentId = parentPath ? pathToId[parentPath] : null
      try {
        const res = await fetch('/api/folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, parent_id: parentId }),
        })
        if (res.ok) { const d = await res.json(); pathToId[path] = d.dossierId }
      } catch { /* non-blocking */ }
    }
    toast.dismiss(toastId)

    await uploadSequential(valid, async (file) => {
      const parts = file.webkitRelativePath.split('/')
      parts.pop()
      const folderPath = parts.join('/')
      return folderPath ? pathToId[folderPath] ?? null : null
    })
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  function onDragEnter(e) { e.preventDefault(); dragCounter.current++; setIsDragging(true) }
  function onDragLeave(e) { e.preventDefault(); if (--dragCounter.current === 0) setIsDragging(false) }
  function onDragOver(e)  { e.preventDefault() }
  function onDrop(e) {
    e.preventDefault(); dragCounter.current = 0; setIsDragging(false)
    if (credits <= 0) { toast.error("Crédits épuisés. Rechargez votre compte pour uploader."); return }
    handleFiles([...e.dataTransfer.files])
  }

  // ── Filtered docs (search + status + type) ───────────────────────────────

  const filteredDocs = docs.filter(doc => {
    if (query) {
      const q = query.toLowerCase()
      const inName     = doc.nom_fichier?.toLowerCase().includes(q)
      const inSupplier = doc.fournisseur?.toLowerCase().includes(q)
      const inFolder   = doc.dossier_nom?.toLowerCase().includes(q)
      if (!inName && !inSupplier && !inFolder) return false
    }
    if (statutFilter && doc.statut !== statutFilter) return false
    if (typeFilter   && doc.document_type !== typeFilter) return false
    return true
  })

  const hasActiveFilter = query || statutFilter || typeFilter

  function clearFilters() {
    setQuery('')
    setStatutFilter('')
    setTypeFilter('')
  }

  // ── Selection & extraction ────────────────────────────────────────────────

  const extractableDocs = filteredDocs.filter(d => d.statut === 'A_EXTRAIRE')
  const allSelected     = extractableDocs.length > 0 && extractableDocs.every(d => selectedDocIds.has(d.id))

  function toggleSelectAll() {
    setSelectedDocIds(allSelected ? new Set() : new Set(extractableDocs.map(d => d.id)))
  }
  function toggleDoc(id) {
    setSelectedDocIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })
  }

  function handleExtract() {
    if (selectedDocIds.size === 0) { toast.error("Sélectionnez au moins un fichier à extraire."); return }
    const ids = [...selectedDocIds]
    const fd  = new FormData()
    fd.append('template_id', templateId)
    ids.forEach(id => fd.append('documentIds', id))

    setDocs(prev => prev.map(d => ids.includes(d.id) ? { ...d, statut: 'EN_COURS_IA' } : d))
    setSelectedDocIds(new Set())

    toast.info('Extraction lancée. Vous pouvez fermer cet onglet — le traitement continue en arrière-plan.', { duration: 5000 })

    startTransition(async () => {
      try {
        await extractDocumentsAction(fd)
      } catch (err) {
        toast.error(err.message ?? "Erreur lors du lancement de l'extraction.")
        setDocs(prev => prev.map(d => ids.includes(d.id) ? { ...d, statut: 'A_EXTRAIRE' } : d))
      }
    })
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  function confirmDelete(id, name) { setDeleteTarget({ id, name }) }

  function executeDelete() {
    if (!deleteTarget) return
    const { id } = deleteTarget
    setDeleteTarget(null)
    setDocs(prev => prev.filter(d => d.id !== id))
    const fd = new FormData()
    fd.append('documentIds', id)
    startTransition(async () => {
      try {
        await deleteDocumentsAction(fd)
      } catch {
        toast.error("La suppression a échoué.")
        startTransition(() => router.refresh())
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const uploadDisabled = credits <= 0

  return (
    <div
      className="min-h-[calc(100vh-60px)] relative"
      onDragEnter={!uploadDisabled ? onDragEnter : undefined}
      onDragLeave={!uploadDisabled ? onDragLeave : undefined}
      onDragOver={!uploadDisabled ? onDragOver : undefined}
      onDrop={!uploadDisabled ? onDrop : undefined}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none border-4 border-dashed border-[#1D9E75]/60 rounded-xl bg-[#1D9E75]/5 backdrop-blur-[2px]">
          <UploadCloudIcon className="w-20 h-20 text-[#1D9E75] animate-bounce mb-4" />
          <p className="text-2xl font-semibold text-[#0F6E56] dark:text-[#1D9E75]">Déposez vos fichiers ici</p>
          <p className="text-sm text-[#1D9E75] mt-1">PDF et images acceptés</p>
        </div>
      )}

      <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-5">

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Extraction</h1>
              {activeClient && (
                <Link
                  href="/dashboard/extraction"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#1D9E75]/10 border border-[#1D9E75]/20 text-xs font-medium text-[#085041] dark:text-[#1D9E75] hover:bg-[#1D9E75]/20 transition-colors"
                >
                  <UsersIcon className="w-3 h-3" />
                  {activeClient.nom}
                  <XIcon className="w-3 h-3 opacity-60" />
                </Link>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {activeClient
                ? `Documents de ${activeClient.nom}`
                : 'Déposez vos documents et lancez l\'extraction IA en lot'}
            </p>
          </div>
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-sm font-medium self-start
            ${credits > 3
              ? 'bg-[#E1F5EE] dark:bg-[#1D9E75]/10 border-[#1D9E75]/20 text-[#085041] dark:text-[#1D9E75]'
              : credits > 0
              ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-400'
              : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'}`}>
            <SparklesIcon className="w-3.5 h-3.5" />
            {credits} extraction{credits !== 1 ? 's' : ''} restante{credits !== 1 ? 's' : ''}
            <span className="opacity-60 text-xs">(Bêta)</span>
          </div>
        </div>

        {/* ── Banner quota épuisé ── */}
        {credits <= 0 && (
          <div className="flex items-center gap-4 px-4 py-3.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-sm">
            <ShieldAlertIcon className="w-5 h-5 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-700 dark:text-red-400">Quota épuisé</p>
              <p className="text-red-600/80 dark:text-red-400/70 text-xs mt-0.5">
                Vous avez utilisé toutes vos extractions bêta. Passez à un plan pour continuer.
              </p>
            </div>
            <Link href="/dashboard/settings/billing">
              <Button size="sm" className="shrink-0 bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs">
                <CreditCardIcon className="w-3.5 h-3.5" />
                Voir les plans
              </Button>
            </Link>
          </div>
        )}

        {/* ── Low credits warning ── */}
        {credits > 0 && credits <= 2 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangleIcon className="w-4 h-4 shrink-0" />
            <span>Il ne vous reste que <strong>{credits} extraction{credits > 1 ? 's' : ''}</strong>. Chaque upload décompte 1 crédit.</span>
          </div>
        )}

        {/* ── Upload zone ── */}
        <div className={`border-2 border-dashed rounded-2xl p-6 space-y-5 backdrop-blur-xl shadow-sm transition-colors
          ${uploadDisabled
            ? 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.05] opacity-60 cursor-not-allowed'
            : 'bg-white/70 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 hover:border-[#1D9E75]/50 dark:hover:border-[#1D9E75]/30'
          }`}>
          <div className="flex flex-col items-center gap-2 text-center">
            <UploadCloudIcon className="w-11 h-11 text-slate-300 dark:text-slate-600" />
            {uploadDisabled
              ? <p className="font-medium text-slate-400 dark:text-slate-500">Upload désactivé — quota épuisé</p>
              : <p className="font-medium text-slate-600 dark:text-slate-300">Glissez vos fichiers ici ou cliquez pour uploader</p>
            }
            <p className="text-xs text-slate-400 dark:text-slate-500">PDF et images (JPG, PNG, WEBP, HEIC) — plusieurs fichiers acceptés</p>
          </div>

          {/* Mode buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button" variant="outline" size="sm" className="gap-2 h-9"
              disabled={uploadDisabled}
              onClick={() => singleRef.current?.click()}
            >
              <FileTextIcon className="w-4 h-4 text-red-400" /> Fichier unique
            </Button>
            <Button
              type="button" variant="outline" size="sm" className="gap-2 h-9"
              disabled={uploadDisabled}
              onClick={() => multipleRef.current?.click()}
            >
              <ImageIcon className="w-4 h-4 text-blue-400" /> Plusieurs fichiers
            </Button>

            {/* Dossier complet — masqué sur iOS (webkitdirectory non supporté) */}
            {!isIOS ? (
              <Button
                type="button" variant="outline" size="sm"
                className="gap-2 h-9 bg-emerald-50 dark:bg-[#1D9E75]/10 border-emerald-200 dark:border-[#1D9E75]/20 text-emerald-700 dark:text-[#1D9E75] hover:bg-emerald-100 dark:hover:bg-[#1D9E75]/20 hover:border-emerald-300 dark:hover:border-[#1D9E75]/40"
                disabled={uploadDisabled}
                onClick={() => folderRef.current?.click()}
              >
                <FolderIcon className="w-4 h-4" /> Dossier complet
              </Button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 px-3 py-2">
                <WifiOffIcon className="w-3.5 h-3.5" />
                Dossier non supporté sur iOS
              </span>
            )}
          </div>

          {/* Hidden file inputs */}
          <input ref={singleRef} type="file" accept={ACCEPT_ATTR} className="hidden" disabled={uploadDisabled}
            onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }} />
          <input ref={multipleRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden" disabled={uploadDisabled}
            onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }} />
          <input ref={folderRef} type="file" className="hidden" disabled={uploadDisabled}
            {...{ webkitdirectory: '', directory: '' }}
            onChange={e => { handleFolderFiles([...e.target.files]); e.target.value = '' }} />

          {/* Upload progress */}
          {uploadProgress && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs font-medium text-[#1D9E75]">
                <span>Upload en cours…</span>
                <span>{uploadProgress.current} / {uploadProgress.total} fichiers</span>
              </div>
              <div className="h-1.5 bg-[#E1F5EE] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1D9E75] rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((uploadProgress.current / uploadProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Search & filter bar ── */}
        {docs.length > 0 && (
          <div className="space-y-2">
            {/* Search input */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher par nom, fournisseur, dossier…"
                className="w-full pl-9 pr-9 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.05] text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-[#1D9E75]/50 dark:focus:border-[#1D9E75]/40 focus:ring-2 focus:ring-[#1D9E75]/10 transition-all backdrop-blur-xl shadow-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <XIcon className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Filter chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Statut chips */}
              {[
                { v: 'A_EXTRAIRE',  l: 'En attente'  },
                { v: 'EN_COURS_IA', l: 'En cours'    },
                { v: 'A_VERIFIER',  l: 'À vérifier'  },
                { v: 'VALIDE',      l: 'Validé'      },
                { v: 'REJETE',      l: 'Erreur IA'   },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStatutFilter(prev => prev === v ? '' : v)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer
                    ${statutFilter === v
                      ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                      : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-[#1D9E75]/40 hover:text-[#1D9E75]'
                    }`}
                >
                  {l}
                </button>
              ))}

              {/* Divider */}
              <span className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-0.5" />

              {/* Type chips */}
              {[
                { v: 'facture',         l: 'Facture'    },
                { v: 'releve_bancaire', l: 'Relevé'     },
                { v: 'bon_commande',    l: 'Bon cmd'    },
                { v: 'recu',            l: 'Reçu'       },
              ].map(({ v, l }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTypeFilter(prev => prev === v ? '' : v)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer
                    ${typeFilter === v
                      ? 'bg-slate-700 dark:bg-slate-200 border-slate-700 dark:border-slate-200 text-white dark:text-slate-900'
                      : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-white/20 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                  {l}
                </button>
              ))}

              {/* Clear all */}
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-auto flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-full border border-red-200 dark:border-red-500/20 text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors cursor-pointer"
                >
                  <FilterXIcon className="w-3 h-3" />
                  Effacer les filtres
                </button>
              )}

              {/* Result count */}
              {hasActiveFilter && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">
                  {filteredDocs.length} / {docs.length} document{docs.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Action bar ── */}
        {docs.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white/80 dark:bg-white/[0.05] border border-slate-200/70 dark:border-white/[0.08] rounded-xl shadow-sm sticky top-2 z-20 backdrop-blur-xl">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-[#1D9E75]"
              />
              {allSelected
                ? 'Tout désélectionner'
                : `Tout sélectionner${extractableDocs.length > 0 ? ` (${extractableDocs.length})` : ''}`}
            </label>

            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger className="h-8 w-52 text-xs bg-white dark:bg-white/[0.05] border-slate-200 dark:border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[10px]">Modèles rapides</SelectLabel>
                    <SelectItem value="NO_MODEL" className="text-xs font-semibold text-[#1D9E75]">
                      ✨ IA Libre
                    </SelectItem>
                    <SelectItem value="DEFAULT_FACTURE" className="text-xs">
                      Facture générique
                    </SelectItem>
                  </SelectGroup>
                  {templates.length > 0 && (
                    <SelectGroup>
                      <SelectLabel className="text-[10px]">Vos modèles</SelectLabel>
                      {templates.map(t => (
                        <SelectItem key={t.id} value={t.id} className="text-xs">
                          {t.nom_modele}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>

              <Button
                onClick={handleExtract}
                disabled={selectedDocIds.size === 0}
                className="h-8 text-xs gap-1.5 px-4 disabled:opacity-40"
              >
                <SparklesIcon className="w-3.5 h-3.5" />
                Extraire {selectedDocIds.size > 0 ? `(${selectedDocIds.size})` : ''}
              </Button>
            </div>
          </div>
        )}

        {/* ── Document list / empty state ── */}
        {docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-200 dark:border-white/[0.07] rounded-2xl bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm space-y-2">
            <UploadCloudIcon className="w-12 h-12 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Glissez vos fichiers ici ou cliquez pour uploader</p>
            <p className="text-xs text-slate-400 dark:text-slate-600">Vos extractions apparaîtront ici</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-slate-200 dark:border-white/[0.07] rounded-2xl bg-white/40 dark:bg-white/[0.02] backdrop-blur-sm space-y-2">
            <SearchIcon className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aucun document ne correspond à la recherche</p>
            <button
              type="button"
              onClick={clearFilters}
              className="mt-1 text-xs text-[#1D9E75] hover:underline cursor-pointer"
            >
              Effacer les filtres
            </button>
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.07] rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100/80 dark:divide-white/[0.04] backdrop-blur-xl">
            {filteredDocs.map(doc => {
              const isSelectable = doc.statut === 'A_EXTRAIRE'
              const isSelected   = selectedDocIds.has(doc.id)

              return (
                <div
                  key={doc.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03] ${isSelected ? 'bg-[#E1F5EE]/30 dark:bg-[#1D9E75]/5' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={!isSelectable}
                    onChange={() => toggleDoc(doc.id)}
                    className="rounded border-gray-300 text-[#1D9E75] shrink-0 disabled:opacity-30 cursor-pointer"
                  />

                  <DocFileIcon filename={doc.nom_fichier} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {doc.nom_fichier ?? 'Sans nom'}
                    </p>
                    {doc.dossier_nom && (
                      <p className="text-[10px] text-slate-400 dark:text-slate-600 flex items-center gap-1 mt-0.5">
                        <FolderIcon className="w-2.5 h-2.5" />
                        {doc.dossier_nom}
                      </p>
                    )}
                  </div>

                  {doc.document_type && (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 px-1.5 py-0.5 rounded-full capitalize hidden sm:inline-flex shrink-0">
                      {doc.document_type.replace(/_/g, ' ')}
                    </span>
                  )}

                  {/* Confidence badge — warns on low AI reliability */}
                  <ConfidenceBadge confidence={doc.confidence} />

                  <StatusBadge statut={doc.statut} />

                  {doc.statut === 'REJETE' && doc.error_message && (
                    <span
                      title={doc.error_message}
                      className="hidden md:flex items-center gap-1 text-[10px] text-red-500 max-w-[120px] truncate"
                    >
                      <AlertTriangleIcon className="w-3 h-3 shrink-0" />
                      {doc.error_message}
                    </span>
                  )}

                  <div className="flex items-center gap-1 shrink-0 ml-1">
                    {(doc.statut === 'A_VERIFIER' || doc.statut === 'VALIDE') && (
                      <Link href={`/dashboard/verification/${doc.id}`}>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-[#1D9E75] hover:bg-[#E1F5EE] dark:hover:bg-[#1D9E75]/10"
                          title="Vérifier"
                        >
                          <ChevronRightIcon className="w-4 h-4" />
                        </Button>
                      </Link>
                    )}
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                      onClick={() => confirmDelete(doc.id, doc.nom_fichier ?? 'ce document')}
                      title="Supprimer"
                    >
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>
              «&nbsp;{deleteTarget?.name}&nbsp;» sera définitivement supprimé. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FirstVisitHint />

      {aiError && (
        <AIErrorModal
          errorCode={aiError.code}
          filename={aiError.filename}
          onClose={() => setAiError(null)}
          onRetry={() => {
            setAiError(null)
            if (aiError.docId) {
              setSelectedDocIds(new Set([aiError.docId]))
              setDocs(prev => prev.map(d => d.id === aiError.docId ? { ...d, statut: 'A_EXTRAIRE', error_message: null } : d))
            }
          }}
        />
      )}
    </div>
  )
}
