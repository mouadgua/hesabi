"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  DownloadIcon, FileSpreadsheetIcon, AlignJustifyIcon,
  CalendarIcon, BookOpenIcon, SlidersHorizontalIcon,
  ChevronUpIcon, ChevronDownIcon,
} from "lucide-react"

// ── Column registry ──────────────────────────────────────────────────────────

const KNOWN_COLUMNS = [
  { key: 'fournisseur',    label: 'Fournisseur' },
  { key: 'emetteur',       label: 'Émetteur' },
  { key: 'date_facture',   label: 'Date facture' },
  { key: 'date',           label: 'Date' },
  { key: 'numero_facture', label: 'N° Facture' },
  { key: 'reference',      label: 'Référence' },
  { key: 'montant_ht',     label: 'Montant HT' },
  { key: 'montant_tva',    label: 'TVA' },
  { key: 'taux_tva',       label: 'Taux TVA' },
  { key: 'montant_ttc',    label: 'Montant TTC' },
  { key: 'montant',        label: 'Montant' },
  { key: 'ice',            label: 'ICE' },
  { key: 'mode_paiement',  label: 'Mode paiement' },
  { key: 'categorie',      label: 'Catégorie' },
  { key: 'banque',         label: 'Banque' },
  { key: 'rib',            label: 'RIB' },
  { key: 'titulaire',      label: 'Titulaire' },
  { key: 'periode',        label: 'Période' },
  { key: 'solde_ouverture',label: 'Solde ouverture' },
  { key: 'solde_cloture',  label: 'Solde clôture' },
  { key: 'numero_bc',      label: 'N° Bon commande' },
  { key: 'total_ht',       label: 'Total HT' },
  { key: 'total_ttc',      label: 'Total TTC' },
]

const DEFAULT_KEYS = ['fournisseur', 'date_facture', 'montant_ht', 'montant_tva', 'montant_ttc']

const GROUP_OPTIONS = [
  { key: 'month',    label: 'Mois' },
  { key: 'compte',   label: 'Compte comptable' },
  { key: 'client',   label: 'Client' },
  { key: 'supplier', label: 'Fournisseur' },
]

// ── Preset modes ─────────────────────────────────────────────────────────────

const MODES = [
  { id: 'simple',  label: 'Liste simple',          Icon: AlignJustifyIcon },
  { id: 'monthly', label: 'Par mois',              Icon: CalendarIcon },
  { id: 'compte',  label: 'Par compte comptable',  Icon: BookOpenIcon },
  { id: 'custom',  label: 'Personnalisé',           Icon: SlidersHorizontalIcon },
]

// ── Mini preview illustrations ───────────────────────────────────────────────

function ModeIllustration({ type, active }) {
  const accent = active ? 'bg-blue-400' : 'bg-slate-300 dark:bg-white/20'
  const muted  = 'bg-slate-200 dark:bg-white/10'

  if (type === 'simple') return (
    <div className="mt-3 space-y-1.5">
      {[72, 52, 68, 44].map((w, i) => (
        <div key={i} className={`h-1.5 rounded-full ${muted}`} style={{ width: `${w}%` }} />
      ))}
    </div>
  )

  if (type === 'monthly') return (
    <div className="mt-3 space-y-1.5">
      <div className={`h-1.5 rounded-full ${accent}`} style={{ width: '78%' }} />
      <div className={`h-1.5 rounded-full ${muted}`} style={{ width: '55%' }} />
      <div className={`h-1.5 rounded-full ${muted}`} style={{ width: '38%' }} />
    </div>
  )

  if (type === 'compte') return (
    <div className="mt-3 space-y-1.5">
      <div className={`h-1.5 rounded-full ${accent}`} style={{ width: '68%' }} />
      <div className="flex items-center gap-1.5">
        <div className="w-3 shrink-0" />
        <div className={`h-1.5 rounded-full ${muted}`} style={{ width: '50%' }} />
      </div>
      <div className={`h-1.5 rounded-full ${muted}`} style={{ width: '60%' }} />
    </div>
  )

  return (
    <div className="mt-3 space-y-1.5">
      {[44, 64, 34, 54].map((w, i) => (
        <div key={i} className={`h-1.5 rounded-full ${muted}`} style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function colLabel(key) {
  return KNOWN_COLUMNS.find(c => c.key === key)?.label
    ?? key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatCell(val) {
  if (val === null || val === undefined || val === '') return '—'
  if (Array.isArray(val)) return `[${val.length} lignes]`
  if (typeof val === 'object') return JSON.stringify(val).slice(0, 24) + '…'
  return String(val)
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ExportModal({ selectedDocs, trigger }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode]   = useState('simple')
  const [groupBy, setGroupBy] = useState([])

  // Columns available from actual documents
  const availableKeys = useMemo(() => {
    const keys = new Set()
    selectedDocs.forEach(doc => {
      if (doc.donnees_extraites) {
        Object.keys(doc.donnees_extraites).forEach(k => {
          const v = doc.donnees_extraites[k]
          if (!Array.isArray(v)) keys.add(k) // skip complex arrays
        })
      }
    })
    return Array.from(keys)
  }, [selectedDocs])

  // Build ordered column list
  const allCols = useMemo(() => {
    const known = KNOWN_COLUMNS.filter(c => availableKeys.includes(c.key))
    const extras = availableKeys
      .filter(k => !KNOWN_COLUMNS.find(c => c.key === k))
      .map(k => ({ key: k, label: colLabel(k) }))
    return [...known, ...extras]
  }, [availableKeys])

  // Custom mode: ordered checked columns
  const [customCols, setCustomCols] = useState(() =>
    KNOWN_COLUMNS.filter(c => DEFAULT_KEYS.includes(c.key) && availableKeys.includes(c.key))
  )
  const [checkedKeys, setCheckedKeys] = useState(
    () => new Set(DEFAULT_KEYS.filter(k => availableKeys.includes(k)))
  )

  // Final columns to export
  const exportCols = useMemo(() => {
    if (mode === 'custom') return customCols.map(c => c.key)
    return DEFAULT_KEYS.filter(k => availableKeys.includes(k))
  }, [mode, customCols, availableKeys])

  // Preview table (first 8 rows, first 6 columns)
  const previewCols = exportCols.slice(0, 6)
  const previewRows = selectedDocs.slice(0, 8).map(doc => {
    const data = doc.donnees_extraites || {}
    return previewCols.map(k => formatCell(data[k]))
  })

  function toggleColumn(col) {
    setCheckedKeys(prev => {
      const next = new Set(prev)
      if (next.has(col.key)) {
        next.delete(col.key)
        setCustomCols(c => c.filter(x => x.key !== col.key))
      } else {
        next.add(col.key)
        setCustomCols(c => [...c, col])
      }
      return next
    })
  }

  function moveCol(idx, dir) {
    setCustomCols(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function toggleGroupBy(key) {
    setGroupBy(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            disabled={selectedDocs.length === 0}
            className="inline-flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 dark:bg-white/[0.04] dark:border-emerald-800/40 dark:text-emerald-400 dark:hover:bg-emerald-900/20 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <DownloadIcon className="w-3.5 h-3.5" /> Exporter
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="!max-w-4xl p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-5 border-b border-slate-100 dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Configurer l'export Excel</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {selectedDocs.length} facture{selectedDocs.length > 1 ? 's' : ''} prête{selectedDocs.length > 1 ? 's' : ''} à exporter. Choisissez comment les organiser.
          </p>
        </div>

        <form action="/api/export" method="POST" className="p-6 space-y-5 overflow-y-auto max-h-[calc(90vh-130px)]">
          {/* Hidden inputs */}
          {selectedDocs.map(doc => (
            <input key={doc.id} type="hidden" name="documentIds" value={doc.id} />
          ))}
          <input type="hidden" name="columns" value={JSON.stringify(exportCols)} />
          <input type="hidden" name="mode"    value={mode} />
          <input type="hidden" name="groupBy" value={JSON.stringify(groupBy)} />

          {/* Mode cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`rounded-xl border-2 p-3.5 text-left transition-all cursor-pointer ${
                  mode === m.id
                    ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-500/10 dark:border-blue-400/70'
                    : 'border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.14]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <m.Icon className={`w-3.5 h-3.5 shrink-0 ${
                    mode === m.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
                  }`} />
                  <span className={`text-xs font-semibold leading-tight ${
                    mode === m.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {m.label}
                  </span>
                </div>
                <ModeIllustration type={m.id} active={mode === m.id} />
              </button>
            ))}
          </div>

          {/* Preview table */}
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.05]">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Aperçu du fichier Excel</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                Aperçu sur {Math.min(8, selectedDocs.length)} facture{selectedDocs.length !== 1 ? 's' : ''} — {selectedDocs.length} au total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/[0.05] bg-white dark:bg-transparent">
                    {previewCols.length === 0 ? (
                      <th className="px-4 py-3 text-left font-semibold text-slate-500 dark:text-slate-400">
                        Aucune colonne sélectionnée
                      </th>
                    ) : previewCols.map(k => (
                      <th key={k} className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap font-mono">
                        {colLabel(k)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                  {previewRows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(1, previewCols.length)} className="px-4 py-8 text-center text-slate-400 dark:text-slate-600">
                        Aucune donnée extraite disponible pour l'aperçu
                      </td>
                    </tr>
                  ) : (
                    previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2.5 text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Custom mode options */}
          {mode === 'custom' && (
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.07] overflow-hidden bg-white dark:bg-white/[0.02]">
              <div className="grid sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-white/[0.05]">

                {/* Column list */}
                <div className="p-4">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">Colonnes à inclure</p>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {allCols.map(col => {
                      const checked = checkedKeys.has(col.key)
                      const idx = customCols.findIndex(c => c.key === col.key)
                      return (
                        <div key={col.key} className="flex items-center gap-2 group">
                          <Checkbox
                            id={`col-${col.key}`}
                            checked={checked}
                            onCheckedChange={() => toggleColumn(col)}
                            className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          />
                          <Label htmlFor={`col-${col.key}`} className="flex-1 text-xs cursor-pointer text-slate-700 dark:text-slate-300 select-none">
                            {col.label}
                          </Label>
                          {checked && (
                            <div className="flex gap-px opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => moveCol(idx, -1)}
                                disabled={idx === 0}
                                className="p-0.5 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors"
                              >
                                <ChevronUpIcon className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveCol(idx, 1)}
                                disabled={idx === customCols.length - 1}
                                className="p-0.5 text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 disabled:opacity-20 transition-colors"
                              >
                                <ChevronDownIcon className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Group by */}
                <div className="p-4">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">Grouper par</p>
                  <div className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-2.5 min-h-9 text-xs text-slate-400 dark:text-slate-600 mb-3 leading-relaxed">
                    {groupBy.length === 0
                      ? 'Aucun regroupement — liste à plat'
                      : groupBy.map(k => GROUP_OPTIONS.find(g => g.key === k)?.label).join(' → ')
                    }
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {GROUP_OPTIONS.map(g => {
                      const active = groupBy.includes(g.key)
                      return (
                        <button
                          key={g.key}
                          type="button"
                          onClick={() => toggleGroupBy(g.key)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                            active
                              ? 'bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/40 dark:text-blue-400'
                              : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20 bg-white dark:bg-transparent'
                          }`}
                        >
                          <span className="font-bold">{active ? '✓' : '+'}</span>
                          {g.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 underline transition-colors"
            >
              Enregistrer comme modèle
            </button>

            <div className="flex items-center gap-3">
              {/* CSV secondary */}
              <button
                type="submit"
                name="format"
                value="csv"
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors underline"
                disabled={exportCols.length === 0}
              >
                Exporter en CSV
              </button>

              {/* Primary CTA */}
              <button
                type="submit"
                name="format"
                value="excel"
                disabled={exportCols.length === 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FileSpreadsheetIcon className="w-4 h-4" />
                Générer le fichier Excel
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
