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
  FolderOpenIcon, Trash2Icon, ChevronRightIcon, AlertCircleIcon,
  CheckCircle2Icon, ClockIcon, FolderIcon, AlertTriangleIcon,
} from "lucide-react"
import { FirstVisitHint } from "@/components/first-visit-hint"
import AIErrorModal, { getAIErrorCode } from "@/components/ai-error-modal"

// ── Constants ────────────────────────────────────────────────────────────────

const ACCEPTED_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']
const ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.heic'

// ── Status badge ─────────────────────────────────────────────────────────────

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

// ── Main component ───────────────────────────────────────────────────────────

export default function ExtractionHub({ initialDocuments, templates, credits: initialCredits }) {
  const router = useRouter()
  const [docs, setDocs] = useState(initialDocuments)
  const [credits, setCredits] = useState(initialCredits)
  const [selectedDocIds, setSelectedDocIds] = useState(new Set())
  const [templateId, setTemplateId] = useState('NO_MODEL')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [aiError, setAiError] = useState(null) // { code, filename, docId }
  const [, startTransition] = useTransition()
  const dragCounter = useRef(0)
  const singleRef = useRef(null)
  const multipleRef = useRef(null)
  const folderRef = useRef(null)

  useEffect(() => { setDocs(initialDocuments) }, [initialDocuments])
  useEffect(() => { setCredits(initialCredits) }, [initialCredits])

  // ── Supabase Realtime — listen to all Document updates ────────────────────

  useEffect(() => {
    const supabase = createBrowserSupabase()
    const channel = supabase
      .channel('hub-docs')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'Document',
      }, ({ new: updated }) => {
        setDocs(prev => prev.map(d =>
          d.id === updated.id
            ? { ...d, statut: updated.statut, document_type: updated.document_type ?? d.document_type, error_message: updated.error_message ?? d.error_message }
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

  // ── Polling fallback — refresh server data while docs are processing ───────
  // Fires router.refresh() every 4s when any doc is EN_COURS_IA so the
  // server-side status propagates even if Supabase Realtime isn't active.

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
        toast.error(`Format non supporté : ${file.name}. Seuls les PDF et images sont acceptés.`)
      } else {
        valid.push(file)
      }
    }
    return valid
  }

  // ── Core upload (sequential, progress bar) ───────────────────────────────

  async function uploadSequential(files, getDossierId = () => null) {
    setUploadProgress({ current: 0, total: files.length })
    const uploaded = []

    for (const file of files) {
      const fd = new FormData()
      fd.append('file', file)
      const dossierId = await getDossierId(file)
      if (dossierId) fd.append('dossier_id', dossierId)

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const data = await res.json()
        if (res.ok) {
          uploaded.push({
            id: data.documentId,
            nom_fichier: file.name,
            statut: 'A_EXTRAIRE',
            document_type: null,
            dossier_id: dossierId,
            dossier_nom: null,
            error_message: null,
            createdAt: new Date().toISOString(),
          })
        } else {
          toast.error(data.error ?? `Échec : ${file.name}`)
        }
      } catch {
        toast.error(`Connexion perdue pour ${file.name}`)
      }
      setUploadProgress(p => ({ ...p, current: p.current + 1 }))
    }

    setUploadProgress(null)
    if (uploaded.length > 0) {
      setDocs(prev => [...uploaded, ...prev])
      setCredits(c => c - uploaded.length)
      toast.success(`${uploaded.length} fichier${uploaded.length > 1 ? 's' : ''} uploadé${uploaded.length > 1 ? 's' : ''}.`)
    }
  }

  // ── Upload handlers ───────────────────────────────────────────────────────

  async function handleFiles(rawFiles) {
    const valid = validateFiles(rawFiles)
    if (valid.length === 0) return
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
      const parts = path.split('/')
      const name = parts[parts.length - 1]
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
  function onDragOver(e) { e.preventDefault() }
  function onDrop(e) {
    e.preventDefault(); dragCounter.current = 0; setIsDragging(false)
    handleFiles([...e.dataTransfer.files])
  }

  // ── Selection & extraction ────────────────────────────────────────────────

  const extractableDocs = docs.filter(d => d.statut === 'A_EXTRAIRE')
  const allSelected = extractableDocs.length > 0 && extractableDocs.every(d => selectedDocIds.has(d.id))

  function toggleSelectAll() {
    setSelectedDocIds(allSelected ? new Set() : new Set(extractableDocs.map(d => d.id)))
  }

  function toggleDoc(id) {
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function handleExtract() {
    if (selectedDocIds.size === 0) { toast.error("Sélectionnez au moins un fichier à extraire."); return }
    const ids = [...selectedDocIds]
    const fd = new FormData()
    fd.append('template_id', templateId)
    ids.forEach(id => fd.append('documentIds', id))

    setDocs(prev => prev.map(d => ids.includes(d.id) ? { ...d, statut: 'EN_COURS_IA' } : d))
    setSelectedDocIds(new Set())

    startTransition(async () => {
      try {
        await extractDocumentsAction(fd)
        toast.success(`Extraction lancée pour ${ids.length} document${ids.length > 1 ? 's' : ''}.`)
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

  return (
    <div
      className="min-h-[calc(100vh-60px)] relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
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
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Extraction</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Déposez vos documents et lancez l'extraction IA en lot
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

        {/* ── Upload zone ── */}
        <div className="bg-white/70 dark:bg-white/[0.04] border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6 space-y-5 hover:border-[#1D9E75]/50 dark:hover:border-[#1D9E75]/30 transition-colors backdrop-blur-xl shadow-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            <UploadCloudIcon className="w-11 h-11 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-600 dark:text-slate-300">Glissez vos fichiers ici ou cliquez pour uploader</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">PDF et images (JPG, PNG, WEBP, HEIC) — plusieurs fichiers acceptés</p>
          </div>

          {/* Mode buttons */}
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              type="button" variant="outline" size="sm" className="gap-2 h-9"
              onClick={() => singleRef.current?.click()}
            >
              <FileTextIcon className="w-4 h-4 text-red-400" /> Fichier unique
            </Button>
            <Button
              type="button" variant="outline" size="sm" className="gap-2 h-9"
              onClick={() => multipleRef.current?.click()}
            >
              <ImageIcon className="w-4 h-4 text-blue-400" /> Plusieurs fichiers
            </Button>
            <Button
              type="button" variant="outline" size="sm"
              className="gap-2 h-9 bg-emerald-50 dark:bg-[#1D9E75]/10 border-emerald-200 dark:border-[#1D9E75]/20 text-emerald-700 dark:text-[#1D9E75] hover:bg-emerald-100 dark:hover:bg-[#1D9E75]/20 hover:border-emerald-300 dark:hover:border-[#1D9E75]/40"
              onClick={() => folderRef.current?.click()}
            >
              <FolderIcon className="w-4 h-4" /> Dossier complet
            </Button>
          </div>

          {/* Hidden file inputs */}
          <input
            ref={singleRef} type="file" accept={ACCEPT_ATTR} className="hidden"
            onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }}
          />
          <input
            ref={multipleRef} type="file" accept={ACCEPT_ATTR} multiple className="hidden"
            onChange={e => { handleFiles([...e.target.files]); e.target.value = '' }}
          />
          <input
            ref={folderRef} type="file" className="hidden"
            {...{ webkitdirectory: '', directory: '' }}
            onChange={e => { handleFolderFiles([...e.target.files]); e.target.value = '' }}
          />

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

        {/* ── Action bar (shown when files exist) ── */}
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
        ) : (
          <div className="bg-white/80 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.07] rounded-xl overflow-hidden shadow-sm divide-y divide-slate-100/80 dark:divide-white/[0.04] backdrop-blur-xl">
            {docs.map(doc => {
              const isSelectable = doc.statut === 'A_EXTRAIRE'
              const isSelected = selectedDocIds.has(doc.id)

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
