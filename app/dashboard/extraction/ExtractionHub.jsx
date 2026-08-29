"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { createBrowserSupabase } from "@/utils/supabase/client"
import { extractDocumentsAction, deleteDocumentsAction, moveDocumentsAction } from "@/app/dashboard/actions"
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
  CreditCardIcon, WifiOffIcon, ShieldAlertIcon, UsersIcon, XIcon, EyeIcon,
  FolderPlusIcon, PencilIcon, FolderInputIcon, HomeIcon, CornerLeftUpIcon,
  SearchIcon, FilterXIcon,
} from "lucide-react"
import { FirstVisitHint } from "@/components/first-visit-hint"
import AIErrorModal, { getAIErrorCode } from "@/components/ai-error-modal"
import DocumentPreview from "@/components/document-preview"
import { validateFileClientSide } from "@/lib/clientValidation"

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_EXTS  = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']
const ACCEPT_ATTR    = '.pdf,.jpg,.jpeg,.png,.webp,.heic'
const MAX_RETRIES    = 2
const POOL_SIZE      = 12 // concurrent uploads per batch — keeps small batches (1-5 files) just as fast

// ── Batch resilience (localStorage) ───────────────────────────────────────────
// Tracks which files (by fingerprint) were already successfully uploaded, so a
// batch interrupted by a network drop / page reload can be resumed by simply
// re-selecting the same files — already-done ones are skipped automatically.

const PROGRESS_KEY   = 'hesabi_upload_progress'
const FP_MAX_AGE_MS  = 48 * 60 * 60 * 1000
const FP_MAX_ENTRIES = 3000

function fingerprintOf(file) {
  return `${file.name}__${file.size}__${file.lastModified}`
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return { lastBatch: null, doneFingerprints: {} }
    const data = JSON.parse(raw)
    const now = Date.now()
    const doneFingerprints = {}
    for (const [fp, at] of Object.entries(data.doneFingerprints ?? {})) {
      if (now - at < FP_MAX_AGE_MS) doneFingerprints[fp] = at
    }
    return { lastBatch: data.lastBatch ?? null, doneFingerprints }
  } catch {
    return { lastBatch: null, doneFingerprints: {} }
  }
}

function saveProgress(progress) {
  try {
    const entries = Object.entries(progress.doneFingerprints)
    const doneFingerprints = entries.length > FP_MAX_ENTRIES
      ? Object.fromEntries(entries.sort((a, b) => b[1] - a[1]).slice(0, FP_MAX_ENTRIES))
      : progress.doneFingerprints
    localStorage.setItem(PROGRESS_KEY, JSON.stringify({ ...progress, doneFingerprints }))
  } catch { /* localStorage unavailable — resilience degrades silently, upload still works */ }
}

function clearLastBatch() {
  const progress = loadProgress()
  progress.lastBatch = null
  saveProgress(progress)
}

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
  dossiers = [],
  initialSearch = '', initialStatut = '', initialType = '',
}) {
  const router = useRouter()
  const [docs, setDocs] = useState(initialDocuments)

  // L'abonnement temps réel ne doit être ouvert qu'une fois : le faire dépendre
  // de la liste rouvrirait le canal Supabase à chaque mise à jour de document.
  // Ce ref donne au gestionnaire la liste courante sans créer cette dépendance
  // — il lisait jusqu'ici `initialDocuments`, figé au montage, et ne retrouvait
  // donc pas le nom d'un fichier ajouté pendant la session.
  const docsRef = useRef(docs)
  useEffect(() => { docsRef.current = docs }, [docs])
  const [credits, setCredits] = useState(initialCredits)
  const [selectedDocIds, setSelectedDocIds] = useState(new Set())
  const [templateId, setTemplateId] = useState('NO_MODEL')
  const [lang, setLang]             = useState('fr')
  const [uploadProgress, setUploadProgress] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [creditsModal, setCreditsModal] = useState(null) // { files, folderGetter, available }
  const [aiError, setAiError] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  // null = racine. On garde l'identifiant plutôt que le chemin : un dossier
  // renommé ou déplacé ne casse pas la position courante.
  const [dossierCourant, setDossierCourant] = useState(null)
  const [renommage, setRenommage]   = useState(null)  // { id, nom }
  const [suppression, setSuppression] = useState(null) // { id, nom }
  const [deplacement, setDeplacement] = useState(false)
  const [deplacerDossier, setDeplacerDossier] = useState(null) // { id, nom }
  const [creation, setCreation] = useState(null) // { nom }
  const [isIOS, setIsIOS] = useState(false)
  const [resumeBanner, setResumeBanner] = useState(null) // { batchId, total, done }
  const [, startTransition] = useTransition()

  const progressRef = useRef(null) // in-memory mirror of localStorage progress during an active batch

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
    // `activeClient` est une prop dérivée de l'URL par le composant serveur :
    // la réécrire ici reproduit la valeur d'où elle vient, sans boucle. Sans
    // cette dépendance, changer de client laissait l'URL sur l'ancien — un
    // rechargement ou un lien partagé perdait la sélection.
  }, [query, statutFilter, typeFilter, activeClient?.id, router])

  // ── iOS / mobile detection (folder upload not supported on iOS) ───────────
  useEffect(() => {
    setIsIOS(/iPhone|iPad|iPod/i.test(navigator.userAgent))
  }, [])

  // ── Detect an interrupted batch from a previous session ───────────────────
  useEffect(() => {
    const { lastBatch } = loadProgress()
    if (lastBatch && lastBatch.done < lastBatch.total) {
      setResumeBanner(lastBatch)
    }
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
            const doc = docsRef.current.find(d => d.id === updated.id)
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
  }, [docs, router])

  // ── File validation (extension + client-side corruption checks) ──────────
  // Runs all checks concurrently — these are local/in-memory operations
  // (no network), so even 700 files validate in well under a second.

  async function validateFiles(fileList) {
    const results = await Promise.all(fileList.map(async (file) => {
      const ext = file.name.split('.').pop().toLowerCase()
      if (!ACCEPTED_EXTS.includes(ext)) {
        return { file, error: `Format non supporté : ${file.name}` }
      }
      const check = await validateFileClientSide(file)
      if (!check.valid) return { file, error: check.error }
      return { file, error: null }
    }))

    const valid  = []
    const errors = []
    for (const r of results) {
      if (r.error) errors.push(r.error)
      else valid.push(r.file)
    }
    if (errors.length > 0) {
      const shown = errors.slice(0, 5)
      shown.forEach(e => toast.error(e))
      if (errors.length > shown.length) {
        toast.error(`+ ${errors.length - shown.length} autre(s) fichier(s) rejeté(s).`)
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

  // ── Credits precheck (server-verified) — avoids starting a batch the ─────
  // cabinet can't afford. Read-only: the atomic decrement in /api/upload
  // remains the sole source of truth against race conditions.
  async function checkCreditsSufficient(count) {
    try {
      const res = await fetch(`/api/upload/precheck?count=${count}`)
      if (!res.ok) return { sufficient: count <= credits, credits }
      return await res.json()
    } catch {
      return { sufficient: count <= credits, credits }
    }
  }

  // ── Fingerprint-based resume: split a selection into files already ───────
  // uploaded (skip) vs. still needing upload, and register a batch in
  // localStorage so progress survives a page reload.
  function prepareBatch(valid) {
    const progress = loadProgress()
    const toUpload = []
    let alreadyDoneCount = 0
    for (const f of valid) {
      if (fingerprintOf(f) in progress.doneFingerprints) alreadyDoneCount++
      else toUpload.push(f)
    }
    if (alreadyDoneCount > 0) {
      toast.info(`${alreadyDoneCount} fichier${alreadyDoneCount > 1 ? 's' : ''} déjà envoyé${alreadyDoneCount > 1 ? 's' : ''} précédemment, ignoré${alreadyDoneCount > 1 ? 's' : ''}.`)
    }

    const batchId = crypto.randomUUID()
    progress.lastBatch = { batchId, total: valid.length, done: alreadyDoneCount }
    saveProgress(progress)
    progressRef.current = progress
    setResumeBanner(null)

    return { batchId, toUpload, total: valid.length, alreadyDoneCount }
  }

  function markFingerprintDone(fp, batchId) {
    const progress = progressRef.current
    if (!progress) return
    progress.doneFingerprints[fp] = Date.now()
    if (progress.lastBatch?.batchId === batchId) {
      progress.lastBatch.done += 1
      if (progress.lastBatch.done >= progress.lastBatch.total) {
        progress.lastBatch = null
        setResumeBanner(null)
      }
    }
    saveProgress(progress)
  }

  // ── Core upload with retry + bounded concurrency ──────────────────────────

  async function uploadWithPool(files, getDossierId, batchId, batchTotal, startCount) {
    setUploadProgress({ current: startCount, total: batchTotal })
    const uploaded = []
    // Fichiers déjà présents : comptés à part, ni ajoutés à la liste ni facturés.
    const duplicates = []
    let doneCount = startCount
    let idx = 0

    async function uploadOne(file) {
      const fd = new FormData()
      fd.append('file', file)
      const dossierId = await getDossierId(file)
      if (dossierId) fd.append('dossier_id', dossierId)
      // Attach to active client so docs stay visible in filtered view after reload
      if (activeClient?.id) fd.append('client_id', activeClient.id)

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, 800 * attempt))
        }
        try {
          const res = await fetch('/api/upload', { method: 'POST', body: fd })
          const data = await res.json()

          // Un doublon revient en HTTP 200 avec { duplicate, existingDocument }
          // et SANS documentId. Le code ne testait que res.ok : il ajoutait donc
          // une ligne portant `id: undefined` — incliquable, et en double dès le
          // deuxième doublon du lot, d'où l'avertissement de clé React. Pire, il
          // décomptait un crédit que le serveur n'avait pas facturé.
          if (data?.duplicate) {
            duplicates.push(file.name)
            // Marqué traité : le fichier a bien été soumis et statué. Sans cela
            // il serait renvoyé à chaque relance du même lot, pour être écarté
            // de nouveau à chaque fois.
            markFingerprintDone(fingerprintOf(file), batchId)
            return true   // traité, mais ni ajouté à la liste ni facturé
          }

          if (res.ok && data?.documentId) {
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
            markFingerprintDone(fingerprintOf(file), batchId)
            return true
          } else if (res.status === 400 && data.error?.includes('Crédits')) {
            toast.error(data.error, {
              action: { label: 'Voir les plans', onClick: () => router.push('/dashboard/settings/billing') }
            })
            return false // don't retry credit errors
          } else {
            if (attempt === MAX_RETRIES) toast.error(data.error ?? `Échec : ${file.name}`)
          }
        } catch {
          if (attempt === MAX_RETRIES) {
            toast.error(`Connexion perdue pour ${file.name}. Relancez le même lot pour reprendre — les fichiers déjà envoyés seront ignorés.`)
          }
        }
      }
      return false
    }

    async function worker() {
      while (idx < files.length) {
        const i = idx++
        await uploadOne(files[i])
        doneCount++
        setUploadProgress({ current: doneCount, total: batchTotal })
      }
    }

    const workerCount = Math.min(POOL_SIZE, files.length)
    await Promise.all(Array.from({ length: workerCount }, worker))

    setUploadProgress(null)
    if (duplicates.length > 0) {
      toast.info(
        `${duplicates.length} fichier${duplicates.length > 1 ? 's étaient déjà présents' : ' était déjà présent'} ` +
        `et ${duplicates.length > 1 ? 'ont' : 'a'} été ignoré${duplicates.length > 1 ? 's' : ''} — aucun crédit consommé.`,
        { duration: 6000 }
      )
    }

    if (uploaded.length > 0) {
      // Déduplication à l'insertion : la cause du doublon est corrigée plus
      // haut, mais une liste d'affichage ne doit jamais pouvoir contenir deux
      // fois le même identifiant — c'est ce qui produit des lignes fantômes et
      // des clés React en conflit.
      setDocs(prev => {
        const vus = new Set(prev.map(d => d.id))
        return [...uploaded.filter(d => d.id && !vus.has(d.id)), ...prev]
      })
      setCredits(c => c - uploaded.length)
      const failedCount = files.length - uploaded.length - duplicates.length
      toast.success(
        `${uploaded.length} fichier${uploaded.length > 1 ? 's uploadés' : ' uploadé'}` +
        (failedCount > 0 ? ` (${failedCount} en échec — relancez le même lot pour les reprendre).` : '.')
      )
    }
  }

  // ── Upload handlers ───────────────────────────────────────────────────────

  async function handleFiles(rawFiles) {
    const valid = await validateFiles(rawFiles)
    if (valid.length === 0) return

    // Duplicate detection
    const dupes = findDuplicates(valid)
    if (dupes.length > 0) {
      const names = dupes.map(f => f.name).join(', ')
      // Ce contrôle compare les NOMS avec la liste affichée. La déduplication
      // réelle se fait sur le contenu, côté serveur : un même nom avec un
      // contenu différent sera bien envoyé, un contenu identique sera écarté
      // sans consommer de crédit. Le message disait « l'upload continuera quand
      // même », ce qui laissait croire à un doublon accepté.
      toast.warning(
        `Nom déjà utilisé : ${names}. Si le contenu est identique, le fichier sera ignoré sans consommer de crédit.`
      )
    }

    const { batchId, toUpload, total, alreadyDoneCount } = prepareBatch(valid)
    if (toUpload.length === 0) {
      toast.success('Tous les fichiers de cette sélection ont déjà été envoyés.')
      return
    }

    // Batch credits precheck — only relevant for multi-file batches still needing upload.
    // Single-file uploads are already covered by the per-file atomic check.
    if (toUpload.length > 1) {
      const check = await checkCreditsSufficient(toUpload.length)
      if (!check.sufficient) {
        setCreditsModal({ files: toUpload, available: check.credits, batchId, total, alreadyDoneCount })
        return
      }
    }

    await uploadWithPool(toUpload, () => null, batchId, total, alreadyDoneCount)
  }

  async function runFolderUpload(files, batchId, total, alreadyDoneCount) {
    const uniquePaths = [...new Set(
      files.flatMap(f => {
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
          body: JSON.stringify({ name, parent_id: parentId, client_id: activeClient?.id ?? null }),
        })
        if (res.ok) { const d = await res.json(); pathToId[path] = d.dossierId }
      } catch { /* non-blocking */ }
    }
    toast.dismiss(toastId)

    await uploadWithPool(files, async (file) => {
      const parts = file.webkitRelativePath.split('/')
      parts.pop()
      const folderPath = parts.join('/')
      return folderPath ? pathToId[folderPath] ?? null : null
    }, batchId, total, alreadyDoneCount)
  }

  async function handleFolderFiles(rawFiles) {
    const valid = await validateFiles(rawFiles)
    if (valid.length === 0) return

    const { batchId, toUpload, total, alreadyDoneCount } = prepareBatch(valid)
    if (toUpload.length === 0) {
      toast.success('Tous les fichiers de ce dossier ont déjà été envoyés.')
      return
    }

    if (toUpload.length > 1) {
      const check = await checkCreditsSufficient(toUpload.length)
      if (!check.sufficient) {
        setCreditsModal({ files: toUpload, available: check.credits, isFolder: true, batchId, total, alreadyDoneCount })
        return
      }
    }

    await runFolderUpload(toUpload, batchId, total, alreadyDoneCount)
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

  // ── Actions sur les dossiers ──────────────────────────────────────────────

  /**
   * `candidat` est-il le dossier `racine` lui-même, ou l'un de ses descendants ?
   *
   * Sert à retirer de la liste des destinations celles qui créeraient un cycle :
   * déplacer un dossier dans son propre sous-dossier détacherait la branche de
   * l'arborescence. La boucle est bornée pour la même raison qu'ailleurs — une
   * donnée déjà incohérente ne doit pas figer le rendu.
   */
  function estDescendant(candidat, racine) {
    if (candidat === racine) return true
    const parents = new Map(dossiers.map(d => [d.id, d.parent_id ?? null]))
    let courant = candidat
    let garde = 0
    while (courant && garde++ < 200) {
      if (courant === racine) return true
      courant = parents.get(courant) ?? null
    }
    return false
  }


  // window.prompt était la seule boîte native de l'application : impossible à
  // styler, ignorée par certains navigateurs, et hors du thème sombre.
  async function creerDossier(nomBrut) {
    const nom = nomBrut?.trim()
    if (!nom) return
    try {
      const res = await fetch('/api/folders', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        // La route lit `parent_id`, pas `parentId`. Envoyer la mauvaise clé
        // ne produisait aucune erreur : le champ était simplement ignoré et
        // tous les dossiers créés atterrissaient à la racine.
        body:    JSON.stringify({
          name:      nom,
          parent_id: dossierCourant,
          // Le dossier suit le client sur lequel on travaille. Sans cela il
          // partait sous le client technique, et n'apparaissait donc jamais
          // dans la vue de ce client.
          client_id: activeClient?.id ?? null,
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Création impossible')
      toast.success(`Dossier « ${nom} » créé.`)
      setCreation(null)
      router.refresh()
    } catch (err) { toast.error(err.message) }
  }

  async function renommerDossier(id, nom) {
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ nom }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Renommage impossible')
      toast.success('Dossier renommé.')
      setRenommage(null)
      router.refresh()
    } catch (err) { toast.error(err.message) }
  }

  async function supprimerDossier(id) {
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(d.error ?? 'Suppression impossible')
      // Le contenu remonte plutôt que de disparaître : on le dit, sinon
      // l'utilisateur croit avoir perdu ce que contenait le dossier.
      const parts = []
      if (d.documentsDeplaces > 0) parts.push(`${d.documentsDeplaces} document${d.documentsDeplaces > 1 ? 's' : ''}`)
      if (d.dossiersDeplaces  > 0) parts.push(`${d.dossiersDeplaces} sous-dossier${d.dossiersDeplaces > 1 ? 's' : ''}`)
      toast.success(parts.length
        ? `Dossier supprimé — ${parts.join(' et ')} remonté${parts.length > 1 || d.documentsDeplaces > 1 ? 's' : ''} d'un niveau.`
        : 'Dossier supprimé.')
      setSuppression(null)
      router.refresh()
    } catch (err) { toast.error(err.message) }
  }

  async function deplacerLeDossier(id, cible) {
    try {
      const res = await fetch(`/api/folders/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ parent_id: cible }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Déplacement impossible')
      toast.success('Dossier déplacé.')
      setDeplacerDossier(null)
      router.refresh()
    } catch (err) { toast.error(err.message) }
  }

  async function deplacerDocuments(cible) {
    const ids = [...selectedDocIds]
    if (ids.length === 0) return
    const fd = new FormData()
    fd.append('dossier_id', cible ?? 'RACINE')
    ids.forEach(id => fd.append('documentIds', id))
    try {
      const { moved } = await moveDocumentsAction(fd)
      toast.success(`${moved} document${moved > 1 ? 's déplacés' : ' déplacé'}.`)
      setSelectedDocIds(new Set())
      setDeplacement(false)
      router.refresh()
    } catch (err) { toast.error(err.message ?? 'Déplacement impossible') }
  }

  // ── Filtered docs (search + status + type) ───────────────────────────────

  // Dossiers directement contenus dans le dossier courant.
  const sousDossiers = dossiers.filter(d => (d.parent_id ?? null) === dossierCourant)

  // Fil d'Ariane, reconstruit en remontant les parents. La boucle est bornée :
  // une donnée incohérente (un dossier se référençant lui-même) ferait sinon
  // tourner le rendu à l'infini.
  const chemin = (() => {
    const parId = new Map(dossiers.map(d => [d.id, d]))
    const out = []
    let id = dossierCourant
    let garde = 0
    while (id && garde++ < 50) {
      const d = parId.get(id)
      if (!d) break
      out.unshift(d)
      id = d.parent_id ?? null
    }
    return out
  })()

  // Une recherche porte sur tout le cabinet, pas sur le dossier ouvert : chercher
  // une facture en sachant déjà où elle est rangée n'aurait aucun intérêt.
  const enRecherche = Boolean(query || statutFilter || typeFilter)

  const filteredDocs = docs.filter(doc => {
    if (!enRecherche && (doc.dossier_id ?? null) !== dossierCourant) return false
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

  // `explicitIds` permet de lancer une extraction depuis l'aperçu, sur un seul
  // document, sans passer par la sélection de la liste — celle-ci resterait
  // sinon à cocher/décocher juste pour traiter la pièce qu'on a sous les yeux.
  function handleExtract(explicitIds) {
    const ids = Array.isArray(explicitIds) && explicitIds.length
      ? explicitIds
      : [...selectedDocIds]
    if (ids.length === 0) { toast.error("Sélectionnez au moins un fichier à extraire."); return }
    const fd  = new FormData()
    fd.append('template_id', templateId)
    fd.append('lang', lang)
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

        {/* ── Resume banner (interrupted batch from a previous session) ── */}
        {resumeBanner && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-400">
            <AlertTriangleIcon className="w-4 h-4 shrink-0" />
            <span className="flex-1">
              Un envoi de <strong>{resumeBanner.total} fichiers</strong> a été interrompu ({resumeBanner.done}/{resumeBanner.total} envoyés).
              Re-sélectionnez les mêmes fichiers pour reprendre — les fichiers déjà envoyés seront automatiquement ignorés.
            </span>
            <button
              type="button"
              onClick={() => { clearLastBatch(); setResumeBanner(null) }}
              className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 shrink-0 cursor-pointer"
              title="Ignorer"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
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

          {/* Rappel bêta au moment du dépôt. L'avertissement de l'inscription a pu
              être accepté des semaines plus tôt : le moment où le risque se
              matérialise est celui-ci, pas celui de la création du compte.
              Discret à dessein — un bandeau anxiogène finit par ne plus être lu. */}
          <p className="flex items-start gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 leading-snug pt-0.5">
            <ShieldAlertIcon className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              Bêta — vos documents sont conservés sur nos serveurs.
              Évitez les pièces contenant des données sensibles.
            </span>
          </p>

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

        {/* Fil d'Ariane — n'apparaît qu'une fois entré quelque part. À la racine
            il n'apprendrait rien, et occuperait une ligne pour le dire.
            Masqué pendant une recherche, dont les résultats viennent de partout. */}
        {!enRecherche && chemin.length > 0 && (
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 flex-wrap text-[13px] px-0.5">
            {/* Remonter d'un niveau — n'apparaît qu'à partir du deuxième, où
                « racine » et « parent » cessent de désigner le même endroit.
                Au premier niveau il ferait doublon avec le retour à la racine. */}
            {chemin.length > 1 && (
              <button
                type="button"
                onClick={() => { setDossierCourant(chemin[chemin.length - 2].id); setSelectedDocIds(new Set()) }}
                title={`Remonter vers « ${chemin[chemin.length - 2].nom} »`}
                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 hover:text-[#1D9E75] hover:border-[#1D9E75]/50 transition-colors cursor-pointer"
              >
                <CornerLeftUpIcon className="w-4 h-4" />
              </button>
            )}

            {/* Retour à la racine. Rendu comme un bouton et non comme le simple
                texte d'un fil d'Ariane : c'est l'action la plus demandée une fois
                descendu de plusieurs niveaux, et rien ne signalait qu'elle en
                était une. */}
            <button
              type="button"
              onClick={() => { setDossierCourant(null); setSelectedDocIds(new Set()) }}
              title="Revenir à la racine"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] font-medium text-slate-600 dark:text-slate-300 hover:text-[#1D9E75] hover:border-[#1D9E75]/50 transition-colors cursor-pointer"
            >
              <HomeIcon className="w-3.5 h-3.5" /> Racine
            </button>
            {chemin.map((d, i) => (
              <span key={d.id} className="inline-flex items-center gap-1">
                <ChevronRightIcon className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
                {i === chemin.length - 1 ? (
                  <span className="font-medium text-slate-800 dark:text-slate-200">{d.nom}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setDossierCourant(d.id); setSelectedDocIds(new Set()) }}
                    className="text-slate-500 dark:text-slate-400 hover:text-[#1D9E75] transition-colors cursor-pointer"
                  >
                    {d.nom}
                  </button>
                )}
              </span>
            ))}

            <button
              type="button"
              onClick={() => setCreation({ nom: '' })}
              className="ml-auto inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-[#1D9E75] transition-colors cursor-pointer"
            >
              <FolderPlusIcon className="w-3.5 h-3.5" /> Nouveau dossier
            </button>
          </nav>
        )}

        {/* À la racine le fil d'Ariane est masqué : le bouton de création doit
            malgré tout rester atteignable, sinon on ne peut créer un dossier
            qu'une fois déjà entré dans un autre. */}
        {!enRecherche && chemin.length === 0 && (
          <div className="flex justify-end px-0.5">
            <button
              type="button"
              onClick={() => setCreation({ nom: '' })}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-[#1D9E75] transition-colors cursor-pointer"
            >
              <FolderPlusIcon className="w-3.5 h-3.5" /> Nouveau dossier
            </button>
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
              {/* FR / EN language toggle */}
              <div className="flex h-8 rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden shrink-0">
                {['fr', 'en'].map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLang(l)}
                    className={`px-3 text-[11px] font-semibold uppercase tracking-wide transition-colors cursor-pointer
                      ${lang === l
                        ? 'bg-[#1D9E75] text-white'
                        : 'bg-white dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.08]'
                      }`}
                  >
                    {l}
                  </button>
                ))}
              </div>

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
                variant="outline"
                onClick={() => setDeplacement(true)}
                disabled={selectedDocIds.size === 0}
                className="h-8 text-xs gap-1.5 px-3 disabled:opacity-40"
              >
                <FolderInputIcon className="w-3.5 h-3.5" /> Déplacer
              </Button>

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
        ) : (filteredDocs.length === 0 && (enRecherche || sousDossiers.length === 0)) ? (
          // L'état vide doit tenir compte des sous-dossiers : un dossier qui ne
          // contient que d'autres dossiers n'a aucun document à ce niveau, et
          // affichait donc « aucun document » en masquant ce qu'il contenait
          // réellement — un cul-de-sac dont on ne pouvait plus descendre.
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

            {/* Dossiers du niveau courant, en tête — comme dans un explorateur.
                Masqués pendant une recherche : les résultats viennent alors de
                partout, et proposer d'« entrer » quelque part n'aurait pas de sens. */}
            {!enRecherche && sousDossiers.map(d => {
              const nbDocs = docs.filter(x => x.dossier_id === d.id).length
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => { setDossierCourant(d.id); setSelectedDocIds(new Set()) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50/70 dark:hover:bg-white/[0.03] cursor-pointer"
                >
                  <span className="w-4 shrink-0" />
                  <FolderIcon className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {d.nom}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums shrink-0">
                    {nbDocs} document{nbDocs > 1 ? 's' : ''}
                  </span>

                  {/* Rendus comme des <span> : cette ligne est déjà un bouton,
                      et un bouton imbriqué dans un bouton est invalide. */}
                  <span
                    role="button" tabIndex={0} title="Renommer"
                    onClick={e => { e.stopPropagation(); setRenommage({ id: d.id, nom: d.nom }) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setRenommage({ id: d.id, nom: d.nom }) } }}
                    className="p-1 rounded text-slate-400 hover:text-[#1D9E75] hover:bg-[#E1F5EE] dark:hover:bg-[#1D9E75]/10 cursor-pointer shrink-0"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </span>
                  <span
                    role="button" tabIndex={0} title="Déplacer le dossier"
                    onClick={e => { e.stopPropagation(); setDeplacerDossier({ id: d.id, nom: d.nom }) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setDeplacerDossier({ id: d.id, nom: d.nom }) } }}
                    className="p-1 rounded text-slate-400 hover:text-[#1D9E75] hover:bg-[#E1F5EE] dark:hover:bg-[#1D9E75]/10 cursor-pointer shrink-0"
                  >
                    <FolderInputIcon className="w-3.5 h-3.5" />
                  </span>
                  <span
                    role="button" tabIndex={0} title="Supprimer le dossier"
                    onClick={e => { e.stopPropagation(); setSuppression({ id: d.id, nom: d.nom }) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setSuppression({ id: d.id, nom: d.nom }) } }}
                    className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer shrink-0"
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </span>

                  <ChevronRightIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                </button>
              )
            })}

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
                    {/* Le nom ouvre l'aperçu : c'est l'élément qu'on vise
                        naturellement pour « voir » un document, plutôt qu'une
                        icône supplémentaire dans une rangée déjà chargée. */}
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate block w-full text-left hover:text-[#1D9E75] dark:hover:text-[#1D9E75] transition-colors cursor-pointer focus-visible:outline-none focus-visible:underline"
                      title="Aperçu du document"
                    >
                      {doc.nom_fichier ?? 'Sans nom'}
                    </button>
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
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-[#1D9E75] hover:bg-[#E1F5EE] dark:hover:bg-[#1D9E75]/10"
                      onClick={() => setPreviewDoc(doc)}
                      title="Aperçu"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />
                    </Button>
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

      <AlertDialog open={!!creditsModal} onOpenChange={open => !open && setCreditsModal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crédits insuffisants</AlertDialogTitle>
            <AlertDialogDescription>
              {creditsModal?.available > 0 ? (
                <>
                  Vous avez sélectionné <strong>{creditsModal?.files.length} fichiers</strong>, mais il ne vous reste que{' '}
                  <strong>{creditsModal?.available} extraction{creditsModal?.available > 1 ? 's' : ''}</strong>.
                  Voulez-vous uploader uniquement les {creditsModal?.available} premiers fichiers couverts par votre quota, ou annuler ?
                </>
              ) : (
                <>
                  Vous avez sélectionné <strong>{creditsModal?.files.length} fichiers</strong>, mais votre quota d'extractions est épuisé.
                  Rechargez votre compte pour continuer.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCreditsModal(null)}>Annuler</AlertDialogCancel>
            {creditsModal?.available > 0 && (
              <AlertDialogAction
                onClick={() => {
                  const { files, available, isFolder, batchId, total, alreadyDoneCount } = creditsModal
                  const truncated = files.slice(0, available)
                  setCreditsModal(null)
                  if (isFolder) runFolderUpload(truncated, batchId, total, alreadyDoneCount)
                  else uploadWithPool(truncated, () => null, batchId, total, alreadyDoneCount)
                }}
              >
                Uploader les {creditsModal?.available} premiers
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FirstVisitHint />

      {/* Créer un dossier */}
      <AlertDialog open={!!creation} onOpenChange={v => !v && setCreation(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nouveau dossier</AlertDialogTitle>
            <AlertDialogDescription>
              {chemin.length > 0
                ? `Il sera créé dans « ${chemin[chemin.length - 1].nom} ».`
                : 'Il sera créé à la racine.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <input
            autoFocus
            placeholder="Factures 2026"
            value={creation?.nom ?? ''}
            onChange={e => setCreation({ nom: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter' && creation?.nom?.trim()) creerDossier(creation.nom) }}
            className="w-full rounded-xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]/40"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={!creation?.nom?.trim()}
              onClick={() => creerDossier(creation.nom)}
              className="bg-[#1D9E75] hover:bg-[#0F6E56]"
            >
              Créer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Renommer un dossier */}
      <AlertDialog open={!!renommage} onOpenChange={v => !v && setRenommage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renommer le dossier</AlertDialogTitle>
            <AlertDialogDescription>Son contenu n&apos;est pas modifié.</AlertDialogDescription>
          </AlertDialogHeader>
          <input
            autoFocus
            value={renommage?.nom ?? ''}
            onChange={e => setRenommage(r => ({ ...r, nom: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter' && renommage?.nom?.trim()) renommerDossier(renommage.id, renommage.nom.trim()) }}
            className="w-full rounded-xl border border-slate-200 dark:border-white/[0.12] bg-white dark:bg-white/[0.04] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1D9E75]/40"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              disabled={!renommage?.nom?.trim()}
              onClick={() => renommerDossier(renommage.id, renommage.nom.trim())}
              className="bg-[#1D9E75] hover:bg-[#0F6E56]"
            >
              Renommer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Supprimer un dossier — en disant ce qu'il advient du contenu */}
      <AlertDialog open={!!suppression} onOpenChange={v => !v && setSuppression(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer « {suppression?.nom} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              Rien n&apos;est perdu : les documents et sous-dossiers qu&apos;il contient
              remontent d&apos;un niveau. Seul le dossier disparaît.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => supprimerDossier(suppression.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer le dossier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Déplacer un dossier. Les destinations invalides sont retirées de la
          liste plutôt que refusées après coup : le dossier lui-même, et ses
          descendants — l'y déplacer créerait un cycle et ferait disparaître la
          branche. Le serveur refait le contrôle, l'affichage n'en est que le
          reflet. */}
      <AlertDialog open={!!deplacerDossier} onOpenChange={v => !v && setDeplacerDossier(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Déplacer « {deplacerDossier?.nom} »</AlertDialogTitle>
            <AlertDialogDescription>
              Son contenu le suit. Choisissez le dossier qui le contiendra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
            <button
              type="button" onClick={() => deplacerLeDossier(deplacerDossier.id, null)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
            >
              <FolderIcon className="w-4 h-4 text-slate-400" /> Racine (aucun parent)
            </button>
            {deplacerDossier && dossiers
              .filter(d => !estDescendant(d.id, deplacerDossier.id))
              .map(d => (
                <button
                  key={d.id} type="button"
                  onClick={() => deplacerLeDossier(deplacerDossier.id, d.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
                >
                  <FolderIcon className="w-4 h-4 text-amber-400" /> {d.nom}
                </button>
              ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Déplacer les documents sélectionnés */}
      <AlertDialog open={deplacement} onOpenChange={v => !v && setDeplacement(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Déplacer {selectedDocIds.size} document{selectedDocIds.size > 1 ? 's' : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>Choisissez la destination.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
            <button
              type="button" onClick={() => deplacerDocuments(null)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
            >
              <FolderIcon className="w-4 h-4 text-slate-400" /> Racine (aucun dossier)
            </button>
            {dossiers.map(d => (
              <button
                key={d.id} type="button" onClick={() => deplacerDocuments(d.id)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"
              >
                <FolderIcon className="w-4 h-4 text-amber-400" /> {d.nom}
              </button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentPreview
        doc={previewDoc}
        open={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        onExtract={d => handleExtract([d.id])}
        onDelete={d => confirmDelete(d.id, d.nom_fichier ?? 'ce document')}
        onVerify={d => router.push(`/dashboard/verification/${d.id}`)}
      />

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
