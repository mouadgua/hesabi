"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from 'next-themes'
import {
  SparklesIcon, UploadIcon, FileTextIcon, CheckCircle2Icon,
  AlertCircleIcon, ArrowRightIcon, XIcon, DownloadIcon,
  ChevronRightIcon, RotateCcwIcon, ClockIcon, ChevronDownIcon,
  Trash2Icon, SunIcon, MoonIcon,
} from 'lucide-react'
import Aurora from '@/components/reactbits/Aurora'
import BlurText from '@/components/reactbits/BlurText'
import SpotlightCard from '@/components/reactbits/SpotlightCard'

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ACCEPTED_EXT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'
const MAX_MB = 10

const DOC_TYPE_LABELS = {
  facture: 'Facture',
  releve_bancaire: 'Relevé bancaire',
  bon_commande: 'Bon de commande',
  recu: 'Reçu',
  autre: 'Document',
}

const FIELD_GROUPS = {
  facture: [
    { label: 'Informations générales', fields: [{ key: 'numero_facture', label: 'N° facture' }, { key: 'date_facture', label: 'Date' }] },
    { label: 'Fournisseur', fields: [{ key: 'fournisseur', label: 'Fournisseur' }, { key: 'ice', label: 'ICE' }] },
    { label: 'Montants', fields: [{ key: 'montant_ht', label: 'Montant HT' }, { key: 'montant_tva', label: 'TVA' }, { key: 'taux_tva', label: 'Taux TVA' }, { key: 'montant_ttc', label: 'Total TTC' }] },
    { label: 'Lignes de détail', fields: [{ key: 'articles', label: 'Articles (tableau)' }] },
  ],
  releve_bancaire: [
    { label: 'Compte', fields: [{ key: 'banque', label: 'Banque' }, { key: 'titulaire', label: 'Titulaire' }, { key: 'iban', label: 'IBAN' }, { key: 'periode', label: 'Période' }] },
    { label: 'Soldes', fields: [{ key: 'solde_ouverture', label: 'Solde ouverture' }, { key: 'solde_cloture', label: 'Solde clôture' }] },
    { label: 'Transactions', fields: [{ key: 'lignes', label: 'Lignes (tableau)' }] },
  ],
  bon_commande: [
    { label: 'Informations', fields: [{ key: 'fournisseur', label: 'Fournisseur' }, { key: 'numero_bc', label: 'N° BC' }, { key: 'date', label: 'Date' }] },
    { label: 'Montants', fields: [{ key: 'total_ht', label: 'Total HT' }, { key: 'total_ttc', label: 'Total TTC' }] },
    { label: 'Détail', fields: [{ key: 'articles', label: 'Articles (tableau)' }] },
  ],
  recu: [
    { label: 'Informations', fields: [{ key: 'emetteur', label: 'Émetteur' }, { key: 'date', label: 'Date' }, { key: 'montant', label: 'Montant' }, { key: 'mode_paiement', label: 'Mode de paiement' }, { key: 'reference', label: 'Référence' }] },
  ],
}

const STEPS_FULL = ['Upload', 'Champs', 'Résultats']
const STEPS_FREE = ['Upload', 'Résultats']

// ── Animations ────────────────────────────────────────────────────────────────

const fadeUp = { hidden: { opacity: 0, y: 24 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } } }
const stagger = { show: { transition: { staggerChildren: 0.08 } } }

// ── Utilities ─────────────────────────────────────────────────────────────────

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function splitData(obj) {
  const scalars = {}, arrays = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') arrays[k] = v
    else scalars[k] = v
  }
  return { scalars, arrays }
}

function flattenForSheet(obj, prefix = '') {
  const rows = []
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (typeof item === 'object' && item !== null) rows.push(...flattenForSheet(item, `${key}[${i + 1}]`))
        else rows.push({ Champ: `${key}[${i + 1}]`, Valeur: String(item) })
      })
    } else if (typeof v === 'object') {
      rows.push(...flattenForSheet(v, key))
    } else {
      rows.push({ Champ: key, Valeur: String(v) })
    }
  }
  return rows
}

async function exportToExcel(data, docType, fileName) {
  const { utils, writeFile } = await import('xlsx')
  const wb = utils.book_new()
  const { scalars, arrays } = splitData(data)
  const scalarRows = Object.entries(scalars).map(([k, v]) => ({ Champ: k, Valeur: String(v) }))
  const ws1 = utils.json_to_sheet(scalarRows)
  ws1['!cols'] = [{ wch: 28 }, { wch: 50 }]
  utils.book_append_sheet(wb, ws1, DOC_TYPE_LABELS[docType] ?? 'Informations')
  for (const [fieldName, rows] of Object.entries(arrays)) {
    const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]
    const sheetRows = rows.map(r => Object.fromEntries(cols.map(c => [c, r[c] ?? ''])))
    const ws = utils.json_to_sheet(sheetRows, { header: cols })
    ws['!cols'] = cols.map(() => ({ wch: 22 }))
    utils.book_append_sheet(wb, ws, (fieldName.charAt(0).toUpperCase() + fieldName.slice(1)).slice(0, 31))
  }
  writeFile(wb, `${fileName ?? 'extraction'}.xlsx`)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-9 w-9" />
  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label="Changer le thème"
      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-white/10 hover:bg-white/20 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 transition-all cursor-pointer backdrop-blur-sm"
    >
      {theme === 'dark'
        ? <SunIcon className="size-4 text-amber-300" />
        : <MoonIcon className="size-4 text-slate-600" />
      }
    </button>
  )
}

function ArrayTable({ fieldName, rows }) {
  if (!rows.length) return null
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))]
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{fieldName}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10">
              {cols.map(c => <th key={c} className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50/60 dark:bg-white/[0.02]'}>
                {cols.map(c => <td key={c} className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{row[c] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ResultTable({ data }) {
  const { scalars, arrays } = splitData(data)
  const scalarEntries = Object.entries(scalars)
  const arrayEntries = Object.entries(arrays)
  if (!scalarEntries.length && !arrayEntries.length)
    return <p className="text-sm text-slate-400 italic">Aucune donnée extraite.</p>
  return (
    <div className="space-y-5">
      {scalarEntries.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-white/[0.04] border-b border-slate-200 dark:border-white/10">
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider w-2/5">Champ</th>
                <th className="text-left px-4 py-2.5 font-semibold text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {scalarEntries.map(([k, v], i) => (
                <tr key={k} className={i % 2 === 0 ? 'bg-white dark:bg-transparent' : 'bg-slate-50/60 dark:bg-white/[0.02]'}>
                  <td className="px-4 py-2.5 text-slate-400 font-mono text-xs">{k}</td>
                  <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200 font-medium break-words">{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {arrayEntries.map(([fieldName, rows]) => <ArrayTable key={fieldName} fieldName={fieldName} rows={rows} />)}
    </div>
  )
}

function FieldSelector({ groups, selected, onChange }) {
  const allKeys = groups.flatMap(g => g.fields.map(f => f.key))
  const allSelected = allKeys.every(k => selected.includes(k))
  const toggle = (key) => onChange(selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key])
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Champs à extraire</p>
        <button type="button" onClick={() => onChange(allSelected ? [] : allKeys)} className="text-xs text-[#1D9E75] hover:underline cursor-pointer">
          {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {groups.map(group => (
          <div key={group.label} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] p-3.5 space-y-2.5">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{group.label}</p>
            {group.fields.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={selected.includes(key)} onChange={() => toggle(key)} className="w-4 h-4 rounded border-slate-300 accent-[#1D9E75] cursor-pointer" />
                <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors">{label}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function HistorySection({ entries, onClear }) {
  const [openIndex, setOpenIndex] = useState(null)
  if (!entries.length) return null
  function fmt(ts) {
    const d = new Date(ts)
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="mt-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <ClockIcon className="size-4" />
          <span className="text-sm font-semibold">Historique local</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 text-xs font-medium">{entries.length}</span>
        </div>
        <button onClick={onClear} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors cursor-pointer">
          <Trash2Icon className="size-3" /> Effacer
        </button>
      </div>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={entry.ts} className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-hidden">
            {/* Row — div with role=button to avoid nesting real buttons inside a button */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              onKeyDown={e => e.key === 'Enter' && setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <FileTextIcon className="size-4 text-[#1D9E75] shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{entry.fileName ?? 'Document'}</p>
                  <p className="text-xs text-slate-400">{DOC_TYPE_LABELS[entry.docType] ?? 'Document'} · {fmt(entry.ts)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); exportToExcel(entry.data, entry.docType, entry.fileName?.replace(/\.[^.]+$/, '') ?? 'extraction') }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#1D9E75]/30 text-[#1D9E75] text-xs font-semibold hover:bg-[#1D9E75]/5 transition-colors"
                >
                  <DownloadIcon className="size-3" /> Excel
                </button>
                <ChevronDownIcon className={`size-4 text-slate-400 transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }} className="overflow-hidden">
                  <div className="px-4 pb-4 border-t border-slate-100 dark:border-white/[0.06] pt-3">
                    <ResultTable data={entry.data} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-3 text-center">Stocké uniquement dans votre navigateur — effacé si vous videz le cache.</p>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DemoPage() {
  const [step, setStep] = useState(0)
  const [email, setEmail] = useState('')
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [freeExtract, setFreeExtract] = useState(false)
  const [detectedType, setDetectedType] = useState(null)
  const [selectedFields, setSelectedFields] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const fileInputRef = useRef(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const STEPS = freeExtract ? STEPS_FREE : STEPS_FULL

  useEffect(() => {
    setMounted(true)
    try { setHistory(JSON.parse(localStorage.getItem('demo_history') || '[]')) } catch {}
    // Generate or restore a session token stored in sessionStorage
    try {
      let sid = sessionStorage.getItem('demo_session_id')
      if (!sid) {
        sid = crypto.randomUUID()
        sessionStorage.setItem('demo_session_id', sid)
      }
      setSessionId(sid)
    } catch {}
  }, [])

  useEffect(() => {
    if (step === 1 && !freeExtract && detectedType && FIELD_GROUPS[detectedType]) {
      setSelectedFields(FIELD_GROUPS[detectedType].flatMap(g => g.fields.map(f => f.key)))
    }
  }, [step, detectedType, freeExtract])

  const handleFile = useCallback((f) => {
    if (!f) return
    if (!ACCEPTED.includes(f.type)) { setError('Format non supporté. Utilisez PDF, JPG, PNG ou WebP.'); return }
    if (f.size > MAX_MB * 1024 * 1024) { setError(`Fichier trop volumineux (max ${MAX_MB} Mo).`); return }
    setFile(f); setError(null)
  }, [])

  const onDrop = useCallback((e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }, [handleFile])

  function reset() { setStep(0); setFile(null); setEmail(''); setDetectedType(null); setSelectedFields([]); setResult(null); setError(null) }

  async function runExtraction(fields) {
    setLoading(true); setError(null)
    try {
      const fileData = await toBase64(file)
      const res = await fetch('/api/demo-extraction', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mimeType: file.type, fileData, selectedFields: fields, sessionId }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setError(json.error || 'Une erreur est survenue.'); return }
      setDetectedType(json.docType)
      setResult({ docType: json.docType, data: json.data })
      setStep(2)
      try {
        const prev = JSON.parse(localStorage.getItem('demo_history') || '[]')
        const updated = [{ docType: json.docType, data: json.data, ts: Date.now(), fileName: file.name }, ...prev].slice(0, 5)
        localStorage.setItem('demo_history', JSON.stringify(updated))
        setHistory(updated)
      } catch {}
    } catch { setError('Impossible de contacter le serveur. Vérifiez votre connexion.') }
    finally { setLoading(false) }
  }

  async function handleContinue(e) {
    e.preventDefault(); if (!file || !email) return
    if (freeExtract) await runExtraction([])
    else { setDetectedType('facture'); setStep(1) }
  }

  async function handleExtract(e) { e.preventDefault(); await runExtraction(selectedFields) }

  const currentGroups = (detectedType && FIELD_GROUPS[detectedType]) ? FIELD_GROUPS[detectedType] : FIELD_GROUPS.facture
  const isDark = mounted && resolvedTheme === 'dark'
  const visualStep = freeExtract && step === 2 ? 1 : step

  return (
    <div className="min-h-screen bg-[#f5fbf7] dark:bg-[#060d09] text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* ── NAVBAR ───────────────────────────────────────────────────────── */}
      <nav className="fixed top-4 inset-x-0 mx-auto max-w-4xl z-50 px-4">
        <div className="bg-white/20 dark:bg-white/[0.04] backdrop-blur-2xl border border-white/40 dark:border-white/[0.08] shadow-lg dark:shadow-black/40 rounded-full h-14 flex items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#1D9E75] shadow-md shadow-[#1D9E75]/30">
              <SparklesIcon className="size-4 text-white" />
            </div>
            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">Hesabi</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden sm:block text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-[#1D9E75] dark:hover:text-[#1D9E75] transition-colors">Accueil</Link>
            <div className="hidden sm:block h-4 w-px bg-slate-200 dark:bg-white/10" />
            <ThemeToggle />
            <Link href="/login" className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white rounded-full px-4 py-1.5 text-sm font-semibold shadow-md shadow-[#1D9E75]/30 transition-all hover:scale-105 cursor-pointer">
              Connexion
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-16 overflow-hidden">

        {/* Aurora background */}
        <div className="absolute inset-0 z-0">
          <Aurora
            colorStops={isDark ? ['#1D9E75', '#047a55', '#0a3d2d'] : ['#a7f3d0', '#6ee7b7', '#d1fae5']}
            amplitude={1.1}
            blend={isDark ? 0.65 : 0.4}
            speed={0.5}
          />
        </div>
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#f5fbf7]/60 via-[#f5fbf7]/40 to-[#f5fbf7] dark:from-[#060d09]/60 dark:via-[#060d09]/40 dark:to-[#060d09]" />
        {/* Grid */}
        <div className="absolute inset-0 z-[2] bg-[linear-gradient(to_right,#1D9E7508_1px,transparent_1px),linear-gradient(to_bottom,#1D9E7508_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_40%,transparent_100%)]" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1D9E75]/10 dark:bg-[#1D9E75]/15 border border-[#1D9E75]/25 text-[#1D9E75] text-xs font-semibold backdrop-blur-sm">
                <SparklesIcon className="size-3" /> Démo gratuite — sans compte
              </span>
            </motion.div>

            <motion.div variants={fadeUp} className="flex justify-center">
              <BlurText
                text="Testez l'extraction IA"
                className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight text-center"
                delay={60}
                animateBy="words"
                direction="top"
              />
            </motion.div>

            <motion.p variants={fadeUp} className="text-slate-500 dark:text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Déposez un document comptable, choisissez les données à extraire, téléchargez en Excel.
            </motion.p>

            {/* Info pills */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-medium backdrop-blur-sm shadow-sm">
                <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
                2 extractions gratuites par session
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-blue-600 dark:text-blue-400 text-xs font-medium backdrop-blur-sm shadow-sm">
                <span className="size-2 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 shrink-0" />
                Propulsé par Gemini AI
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-amber-600 dark:text-amber-400 text-xs font-medium backdrop-blur-sm shadow-sm">
                <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                10–30 s selon la charge
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/70 dark:bg-white/[0.07] border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 text-xs font-medium backdrop-blur-sm shadow-sm">
                <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Extraction non garantie — version gratuite
              </span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CONTENT ──────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">

        {/* Disclaimer */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-6 flex items-start gap-3 p-4 rounded-2xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/[0.07] text-amber-800 dark:text-amber-300">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          <p className="text-xs leading-relaxed">
            <span className="font-bold">Avertissement —</span> Cette démo est à usage de test uniquement.{' '}
            <span className="font-semibold">N&apos;importez aucun document contenant des données personnelles, bancaires ou confidentielles.</span>{' '}
            Les résultats peuvent être incomplets ou inexacts — la version gratuite n&apos;offre aucune garantie d&apos;extraction.
            Hesabi décline toute responsabilité quant aux informations partagées sur cet espace.
          </p>
        </motion.div>

        {/* Step indicator */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="flex items-center justify-center gap-2 mb-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all duration-300 ${
                i === visualStep ? 'bg-[#1D9E75] text-white shadow-md shadow-[#1D9E75]/30'
                  : i < visualStep ? 'bg-[#1D9E75]/15 text-[#1D9E75] dark:bg-[#1D9E75]/20'
                  : 'bg-slate-100 dark:bg-white/[0.06] text-slate-400 dark:text-slate-500'
              }`}>
                {i < visualStep ? <CheckCircle2Icon className="size-3" /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < STEPS.length - 1 && <ChevronRightIcon className="size-3.5 text-slate-300 dark:text-slate-600" />}
            </div>
          ))}
        </motion.div>

        {/* ── Main card ─────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div key={step} variants={fadeUp} initial="hidden" animate="show" exit={{ opacity: 0, y: -16, transition: { duration: 0.2 } }}>
            <SpotlightCard
              spotlightColor={isDark ? 'rgba(29,158,117,0.12)' : 'rgba(29,158,117,0.07)'}
              className="rounded-2xl border border-slate-200/80 dark:border-white/[0.07] bg-white/90 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.3)] p-6 sm:p-10"
            >

              {/* ── STEP 0 : Upload ─────────────────────────── */}
              {step === 0 && (
                <form onSubmit={handleContinue} className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider" htmlFor="email">Votre email</label>
                    <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="vous@cabinet.ma" required
                      className="w-full bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 px-3.5 py-2.5 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:ring-2 focus:ring-[#1D9E75]/30 focus:border-[#1D9E75] outline-none transition-all"
                    />
                    <p className="mt-1 text-xs text-slate-400">2 extractions gratuites par session de navigation.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 uppercase tracking-wider">Document</label>
                    {!file ? (
                      <div
                        onDrop={onDrop}
                        onDragOver={e => { e.preventDefault(); setDragging(true) }}
                        onDragLeave={() => setDragging(false)}
                        onClick={() => fileInputRef.current?.click()}
                        className={`flex flex-col items-center justify-center gap-3 w-full h-44 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                          dragging ? 'border-[#1D9E75] bg-[#1D9E75]/5 dark:bg-[#1D9E75]/10 scale-[1.01]'
                            : 'border-slate-200 dark:border-white/10 hover:border-[#1D9E75]/50 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                        }`}
                      >
                        <motion.div animate={dragging ? { scale: 1.15 } : { scale: 1 }} transition={{ type: 'spring', stiffness: 300 }}>
                          <UploadIcon className={`size-8 transition-colors ${dragging ? 'text-[#1D9E75]' : 'text-slate-300 dark:text-slate-600'}`} />
                        </motion.div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 text-center px-4">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Cliquez ou déposez</span> votre fichier ici<br />
                          <span className="text-xs text-slate-400">PDF, JPG, PNG, WebP — max {MAX_MB} Mo</span>
                        </p>
                        <input ref={fileInputRef} type="file" accept={ACCEPTED_EXT} className="sr-only" onChange={e => handleFile(e.target.files[0])} />
                      </div>
                    ) : (
                      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-3 p-4 rounded-xl border border-[#1D9E75]/30 bg-[#1D9E75]/5 dark:bg-[#1D9E75]/10">
                        <FileTextIcon className="size-8 text-[#1D9E75] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{file.name}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} Mo</p>
                        </div>
                        <button type="button" onClick={() => setFile(null)} aria-label="Supprimer le fichier"
                          className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 text-slate-400 transition-colors cursor-pointer">
                          <XIcon className="size-4" />
                        </button>
                      </motion.div>
                    )}
                  </div>

                  {/* Free extraction toggle */}
                  <div onClick={() => setFreeExtract(v => !v)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                      freeExtract ? 'border-[#1D9E75] bg-[#1D9E75]/5 dark:bg-[#1D9E75]/10' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-white/[0.03]'
                    }`}>
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Extraction libre</p>
                      <p className="text-xs text-slate-400 mt-0.5">L&apos;IA extrait tout ce qu&apos;elle trouve — sans sélection de champs</p>
                    </div>
                    <div style={{ height: '22px', width: '40px' }}
                      className={`rounded-full relative transition-colors flex-shrink-0 ${freeExtract ? 'bg-[#1D9E75]' : 'bg-slate-200 dark:bg-white/20'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${freeExtract ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircleIcon className="size-4 mt-0.5 shrink-0" /><span>{error}</span>
                    </motion.div>
                  )}

                  <button type="submit" disabled={!file || !email || loading}
                    className="w-full flex items-center justify-center gap-2 bg-[#1D9E75] hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#1D9E75]/25 cursor-pointer text-sm">
                    {loading ? (
                      <><svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Extraction en cours…</>
                    ) : freeExtract ? (
                      <><SparklesIcon className="size-4" /> Extraire tout</>
                    ) : (
                      <>Choisir les champs <ChevronRightIcon className="size-4" /></>
                    )}
                  </button>
                </form>
              )}

              {/* ── STEP 1 : Field selection ────────────── */}
              {step === 1 && (
                <form onSubmit={handleExtract} className="space-y-6">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]">
                    <FileTextIcon className="size-5 text-slate-400 shrink-0" />
                    <span className="text-sm text-slate-700 dark:text-slate-300 truncate flex-1">{file?.name}</span>
                    <button type="button" onClick={() => setStep(0)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer shrink-0 transition-colors">changer</button>
                  </div>

                  <FieldSelector groups={currentGroups} selected={selectedFields} onChange={setSelectedFields} />

                  <div>
                    <p className="text-xs text-slate-400 mb-2">Type de document — forcer si besoin :</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(DOC_TYPE_LABELS).filter(([k]) => k !== 'autre').map(([k, label]) => (
                        <button key={k} type="button" onClick={() => setDetectedType(k)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                            detectedType === k ? 'bg-[#1D9E75] text-white border-[#1D9E75] shadow-md shadow-[#1D9E75]/25'
                              : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:border-[#1D9E75]/50 dark:hover:border-[#1D9E75]/30'
                          }`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                      <AlertCircleIcon className="size-4 mt-0.5 shrink-0" /><span>{error}</span>
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <button type="button" onClick={() => setStep(0)}
                      className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-white/10 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                      Retour
                    </button>
                    <button type="submit" disabled={loading || selectedFields.length === 0}
                      className="flex-[2] flex items-center justify-center gap-2 bg-[#1D9E75] hover:bg-[#0F6E56] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-[#1D9E75]/25 cursor-pointer text-sm">
                      {loading ? (
                        <><svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Extraction en cours…</>
                      ) : (
                        <><SparklesIcon className="size-4" /> Extraire les données</>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 2 : Results ────────────────────── */}
              {step === 2 && result && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2Icon className="size-5 text-[#1D9E75]" />
                      <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                        {DOC_TYPE_LABELS[result.docType] ?? 'Document'} — extraction réussie
                      </h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => exportToExcel(result.data, result.docType, file?.name?.replace(/\.[^.]+$/, '') ?? 'extraction')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#1D9E75] text-[#1D9E75] text-sm font-semibold hover:bg-[#1D9E75]/5 dark:hover:bg-[#1D9E75]/10 transition-colors cursor-pointer">
                        <DownloadIcon className="size-4" /> Exporter Excel
                      </button>
                      <button onClick={reset}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                        <RotateCcwIcon className="size-3.5" /> Nouveau
                      </button>
                    </div>
                  </div>

                  <ResultTable data={result.data} />

                  <div className="p-5 rounded-xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 text-center space-y-2">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Prêt à automatiser votre cabinet ?</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Hesabi traite, classe et vérifie tous vos documents. Historique complet, exports illimités.</p>
                    <Link href="/register"
                      className="inline-flex items-center gap-1.5 mt-2 px-5 py-2.5 bg-[#1D9E75] hover:bg-[#0F6E56] text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-[#1D9E75]/25 hover:shadow-lg hover:shadow-[#1D9E75]/30">
                      Créer un compte gratuit <ArrowRightIcon className="size-3.5" />
                    </Link>
                  </div>
                </div>
              )}
            </SpotlightCard>
          </motion.div>
        </AnimatePresence>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Votre fichier est traité en mémoire et n&apos;est jamais stocké sur nos serveurs lors de la démo.
        </p>

        <HistorySection
          entries={history}
          onClear={() => { localStorage.removeItem('demo_history'); setHistory([]) }}
        />
      </div>
    </div>
  )
}
