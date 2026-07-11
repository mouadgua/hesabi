"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  DownloadIcon, FileSpreadsheetIcon, TableIcon, GripVerticalIcon,
  PlusIcon, Trash2Icon, SaveIcon, ChevronDownIcon, AlertCircleIcon, XIcon,
} from "lucide-react"

// ── Field labels (mirrors server-side FIELD_LABELS) ───────────────────────────
const FIELD_LABELS = {
  fournisseur:     { fr: 'Fournisseur',      en: 'Supplier'           },
  date_facture:    { fr: 'Date Facture',      en: 'Invoice Date'       },
  numero_facture:  { fr: 'N° Facture',        en: 'Invoice Number'     },
  montant_ht:      { fr: 'Montant HT',        en: 'Amount Excl. Tax'   },
  montant_tva:     { fr: 'TVA',               en: 'Tax Amount'         },
  taux_tva:        { fr: 'Taux TVA',          en: 'Tax Rate'           },
  montant_ttc:     { fr: 'Montant TTC',       en: 'Amount Incl. Tax'   },
  ice:             { fr: 'ICE',               en: 'Tax ID (ICE)'       },
  categorie:       { fr: 'Catégorie',         en: 'Category'           },
  articles:        { fr: 'Articles',          en: 'Items'              },
  banque:          { fr: 'Banque',            en: 'Bank'               },
  titulaire:       { fr: 'Titulaire',         en: 'Account Holder'     },
  rib:             { fr: 'RIB',               en: 'Bank Account (RIB)' },
  periode:         { fr: 'Période',           en: 'Period'             },
  solde_ouverture: { fr: 'Solde Ouverture',   en: 'Opening Balance'    },
  solde_cloture:   { fr: 'Solde Clôture',     en: 'Closing Balance'    },
  lignes:          { fr: 'Lignes',            en: 'Lines'              },
  libelle:         { fr: 'Libellé',           en: 'Description'        },
  debit:           { fr: 'Débit',             en: 'Debit'              },
  credit:          { fr: 'Crédit',            en: 'Credit'             },
  numero_bc:       { fr: 'N° Bon Commande',   en: 'PO Number'          },
  total_ht:        { fr: 'Total HT',          en: 'Total Excl. Tax'    },
  total_ttc:       { fr: 'Total TTC',         en: 'Total Incl. Tax'    },
  designation:     { fr: 'Désignation',       en: 'Description'        },
  quantite:        { fr: 'Quantité',          en: 'Quantity'           },
  prix_unitaire:   { fr: 'Prix Unitaire',     en: 'Unit Price'         },
  emetteur:        { fr: 'Émetteur',          en: 'Issuer'             },
  montant:         { fr: 'Montant',           en: 'Amount'             },
  mode_paiement:   { fr: 'Mode Paiement',     en: 'Payment Method'     },
  reference:       { fr: 'Référence',         en: 'Reference'          },
  date:            { fr: 'Date',              en: 'Date'               },
}

function colLabel(key, lang) {
  const entry = FIELD_LABELS[key]
  if (entry) return entry[lang] ?? entry.fr
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function initColumns(docs, lang) {
  const seen = new Set()
  const cols = []
  docs.forEach(doc => {
    if (!doc.donnees_extraites) return
    Object.keys(doc.donnees_extraites).forEach(key => {
      if (!seen.has(key)) {
        seen.add(key)
        cols.push({ key, label: colLabel(key, lang), order: cols.length, include: true, formula: null })
      }
    })
  })
  return cols.sort((a, b) => a.key.localeCompare(b.key))
}

const PRESET_LABELS = {
  simple:      { fr: 'Liste',      en: 'List'       },
  par_mois:    { fr: 'Par mois',   en: 'By month'   },
  par_compte:  { fr: 'Par compte', en: 'By account' },
  personnalise: { fr: 'Avancé',   en: 'Advanced'   },
}

const GROUPBY_LABELS = {
  mois:        { fr: 'Mois',        en: 'Month'    },
  fournisseur: { fr: 'Fournisseur', en: 'Supplier' },
  categorie:   { fr: 'Catégorie',   en: 'Category' },
}

// ── Sortable column row (advanced mode) ──────────────────────────────────────
function SortableColumnRow({ col, lang, onUpdate, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 bg-white dark:bg-zinc-900 ${col.include ? '' : 'opacity-40'}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-gray-400 hover:text-gray-600 flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="w-4 h-4" />
      </button>

      <Checkbox
        checked={col.include}
        onCheckedChange={v => onUpdate({ ...col, include: !!v })}
        className="flex-shrink-0"
      />

      <input
        type="text"
        value={col.label}
        onChange={e => onUpdate({ ...col, label: e.target.value })}
        className="flex-1 min-w-0 text-xs bg-transparent border-none outline-none focus:ring-0 font-medium text-gray-700 dark:text-gray-200"
        placeholder={colLabel(col.key, lang)}
      />

      {col.formula && (
        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1 rounded flex-shrink-0">
          ={col.formula}
        </span>
      )}

      {col.key.startsWith('_calc_') && (
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 flex-shrink-0"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ExportModal({ selectedDocs, trigger }) {
  const [open, setOpen]             = useState(false)
  const [preset, setPreset]         = useState('simple')
  const [lang, setLang]             = useState('fr')
  const [columns, setColumns]       = useState([])
  const [groupBy, setGroupBy]       = useState([])
  const [subtotals, setSubtotals]   = useState(false)
  const [savedTemplates, setSavedTemplates] = useState([])
  const [templateName, setTemplateName]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [calcLabel, setCalcLabel]   = useState('')
  const [calcFormula, setCalcFormula] = useState('')
  const [showCalcForm, setShowCalcForm] = useState(false)

  const hasComplexLines = useMemo(() => (
    selectedDocs.some(doc =>
      doc.donnees_extraites &&
      Object.values(doc.donnees_extraites).some(v =>
        Array.isArray(v) && v.length > 0 && typeof v[0] === 'object'
      )
    )
  ), [selectedDocs])

  // Init columns on open
  useEffect(() => {
    if (open) setColumns(initColumns(selectedDocs, lang))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-label columns when lang changes (only auto-labeled ones)
  useEffect(() => {
    setColumns(prev => prev.map(c => ({
      ...c,
      label: FIELD_LABELS[c.key]
        ? colLabel(c.key, lang)
        : c.label,
    })))
  }, [lang])

  // Fetch saved templates
  useEffect(() => {
    if (!open) return
    fetch('/api/export-templates')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.templates) setSavedTemplates(d.templates) })
      .catch(() => {})
  }, [open])

  function applyPreset(p) {
    setPreset(p)
    if (p === 'simple')     { setGroupBy([]);              setSubtotals(false) }
    if (p === 'par_mois')   { setGroupBy(['mois']);        setSubtotals(true)  }
    if (p === 'par_compte') { setGroupBy(['fournisseur']); setSubtotals(true)  }
    // 'personnalise' keeps current settings
  }

  function loadTemplate(t) {
    const { preset: p, lang: l, columns: cols, groupBy: gb, subtotals: sub } = t.config || {}
    if (p)   applyPreset(p)
    if (l)   setLang(l)
    if (cols) setColumns(cols)
    if (gb)  setGroupBy(gb)
    if (typeof sub === 'boolean') setSubtotals(sub)
  }

  async function deleteTemplate(id, name) {
    await fetch(`/api/export-templates?id=${id}`, { method: 'DELETE' })
    setSavedTemplates(prev => prev.filter(t => t.id !== id))
    toast.success(`"${name}" supprimé`)
  }

  async function handleSaveTemplate() {
    const trimmed = templateName.trim()
    if (!trimmed) return
    setSaving(true)
    try {
      const config = {
        preset,
        lang,
        columns: columns.map((c, i) => ({ ...c, order: i })),
        groupBy,
        subtotals,
      }
      const res = await fetch('/api/export-templates', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: trimmed, config }),
      })
      if (res.ok) {
        const { template } = await res.json()
        setSavedTemplates(prev => [template, ...prev])
        setTemplateName('')
        toast.success(`"${template.name}" sauvegardé`)
      }
    } finally {
      setSaving(false)
    }
  }

  function addCalcColumn() {
    const label   = calcLabel.trim()
    const formula = calcFormula.replace(/\s/g, '').toLowerCase()
    if (!label || !formula) return
    if (!/^[a-z_]{1,50}[+-][a-z_]{1,50}$/.test(formula)) {
      toast.error('Formule invalide — utilisez le format champ1+champ2 ou champ1-champ2')
      return
    }
    const newKey = `_calc_${Date.now()}`
    setColumns(prev => [...prev, { key: newKey, label, formula, order: prev.length, include: true }])
    setCalcLabel('')
    setCalcFormula('')
    setShowCalcForm(false)
  }

  // DnD setup
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd({ active, over }) {
    if (active.id !== over?.id) {
      setColumns(cols => {
        const oi = cols.findIndex(c => c.key === active.id)
        const ni = cols.findIndex(c => c.key === over.id)
        return arrayMove(cols, oi, ni)
      })
    }
  }

  const updateColumn = useCallback((updated) => {
    setColumns(prev => prev.map(c => c.key === updated.key ? updated : c))
  }, [])

  const removeColumn = useCallback((key) => {
    setColumns(prev => prev.filter(c => c.key !== key))
  }, [])

  // Serialize config for the form hidden input
  const configValue = useMemo(() => JSON.stringify({
    preset,
    lang,
    columns: columns.map((c, i) => ({ ...c, order: i })).filter(c => c.include),
    groupBy,
    subtotals,
  }), [preset, lang, columns, groupBy, subtotals])

  const anySelected = columns.some(c => c.include)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="text-emerald-700 border-emerald-200 hover:bg-emerald-50 h-10 shadow-sm"
            disabled={selectedDocs.length === 0}
          >
            <DownloadIcon className="w-4 h-4 mr-2" /> Exporter
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileSpreadsheetIcon className="w-5 h-5 text-emerald-600" />
            Configuration de l'export
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-5 pt-4 pb-2 flex-shrink-0">
          {/* Saved templates row */}
          {savedTemplates.length > 0 && (
            <div className="flex gap-2 items-center">
              <span className="text-xs text-gray-500 whitespace-nowrap">Configurations :</span>
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {savedTemplates.map(t => (
                  <div key={t.id} className="flex items-center gap-0.5 bg-gray-100 dark:bg-zinc-800 rounded-full px-2 py-0.5">
                    <button
                      type="button"
                      onClick={() => loadTemplate(t)}
                      className="text-xs text-gray-700 dark:text-gray-200 hover:text-emerald-700 font-medium"
                    >
                      {t.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTemplate(t.id, t.name)}
                      className="text-gray-400 hover:text-red-500 ml-1"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preset tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden text-xs font-semibold">
            {['simple', 'par_mois', 'par_compte', 'personnalise'].map(p => (
              <button
                key={p}
                type="button"
                onClick={() => applyPreset(p)}
                className={`flex-1 py-2 transition-colors ${
                  preset === p
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                {PRESET_LABELS[p][lang]}
              </button>
            ))}
          </div>

          {/* FR / EN toggle */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Langue de l'export :</span>
            <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden text-xs">
              {['fr', 'en'].map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1 font-semibold transition-colors ${
                    lang === l ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-5 py-2 min-h-0">
          {/* Complex lines notice */}
          {hasComplexLines && (
            <div className="mb-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex items-start gap-2">
              <AlertCircleIcon className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 dark:text-blue-300">
                {lang === 'en'
                  ? 'Array fields (e.g. bank lines) will be auto-formatted in a separate Excel sheet.'
                  : 'Les champs tableau (ex: lignes bancaires) seront formatés dans un onglet Excel séparé.'}
              </p>
            </div>
          )}

          {/* Grouping info for presets */}
          {(preset === 'par_mois' || preset === 'par_compte') && (
            <div className="mb-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                {preset === 'par_mois'
                  ? (lang === 'en' ? 'Documents grouped by invoice month with monthly subtotals.' : 'Documents groupés par mois de facture avec sous-totaux mensuels.')
                  : (lang === 'en' ? 'Documents grouped by supplier with subtotals per supplier.' : 'Documents groupés par fournisseur avec sous-totaux par fournisseur.')}
              </p>
            </div>
          )}

          {/* ADVANCED MODE: dnd-kit sortable list */}
          {preset === 'personnalise' ? (
            <div className="space-y-3">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={columns.map(c => c.key)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-1.5">
                    {columns.map(col => (
                      <SortableColumnRow
                        key={col.key}
                        col={col}
                        lang={lang}
                        onUpdate={updateColumn}
                        onRemove={() => removeColumn(col.key)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add calculated column */}
              <div className="border border-dashed border-gray-200 dark:border-zinc-700 rounded-lg p-3">
                <button
                  type="button"
                  onClick={() => setShowCalcForm(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium hover:text-emerald-700 w-full"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Add calculated column' : 'Ajouter une colonne calculée'}
                  <ChevronDownIcon className={`w-3.5 h-3.5 ml-auto transition-transform ${showCalcForm ? 'rotate-180' : ''}`} />
                </button>

                {showCalcForm && (
                  <div className="mt-2 space-y-2">
                    <input
                      type="text"
                      value={calcLabel}
                      onChange={e => setCalcLabel(e.target.value)}
                      placeholder={lang === 'en' ? 'Column name (e.g. Profit)' : 'Nom de la colonne (ex: Bénéfice)'}
                      className="w-full text-xs border border-gray-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="text"
                      value={calcFormula}
                      onChange={e => setCalcFormula(e.target.value)}
                      placeholder="montant_ttc-montant_ht"
                      className="w-full text-xs border border-gray-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent font-mono outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <p className="text-[10px] text-gray-400">
                      {lang === 'en' ? 'Format: field1+field2 or field1-field2' : 'Format : champ1+champ2 ou champ1-champ2'}
                    </p>
                    <Button type="button" size="sm" onClick={addCalcColumn} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
                      {lang === 'en' ? 'Add' : 'Ajouter'}
                    </Button>
                  </div>
                )}
              </div>

              {/* GroupBy selector */}
              <div className="border border-gray-200 dark:border-zinc-700 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  {lang === 'en' ? 'Group by' : 'Grouper par'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupBy([])}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      groupBy.length === 0
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'border-gray-200 text-gray-600 hover:border-emerald-400'
                    }`}
                  >
                    {lang === 'en' ? 'None' : 'Aucun'}
                  </button>
                  {['mois', 'fournisseur', 'categorie'].map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGroupBy(groupBy[0] === g ? [] : [g])}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        groupBy[0] === g
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'border-gray-200 text-gray-600 hover:border-emerald-400'
                      }`}
                    >
                      {GROUPBY_LABELS[g][lang]}
                    </button>
                  ))}
                </div>

                {groupBy.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <Checkbox
                      id="subtotals"
                      checked={subtotals}
                      onCheckedChange={v => setSubtotals(!!v)}
                    />
                    <Label htmlFor="subtotals" className="text-xs cursor-pointer">
                      {lang === 'en' ? 'Include subtotals per group' : 'Inclure des sous-totaux par groupe'}
                    </Label>
                  </div>
                )}
              </div>

              {/* Save template */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={templateName}
                  onChange={e => setTemplateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                  placeholder={lang === 'en' ? 'Configuration name...' : 'Nom de la configuration...'}
                  className="flex-1 text-xs border border-gray-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!templateName.trim() || saving}
                  onClick={handleSaveTemplate}
                  className="h-8 text-xs shrink-0 gap-1"
                >
                  <SaveIcon className="w-3.5 h-3.5" />
                  {lang === 'en' ? 'Save' : 'Sauvegarder'}
                </Button>
              </div>
            </div>
          ) : (
            /* SIMPLE / PAR MOIS / PAR COMPTE — checkbox grid */
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500">
                  {lang === 'en' ? 'Select columns to include:' : 'Sélectionnez les colonnes à inclure :'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const allOn = columns.every(c => c.include)
                    setColumns(prev => prev.map(c => ({ ...c, include: !allOn })))
                  }}
                  className="text-xs text-emerald-600 hover:underline"
                >
                  {columns.every(c => c.include)
                    ? (lang === 'en' ? 'Deselect all' : 'Tout désélectionner')
                    : (lang === 'en' ? 'Select all' : 'Tout sélectionner')}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {columns.map(col => (
                  <div
                    key={col.key}
                    className="flex items-center gap-2 border border-gray-100 dark:border-zinc-800 rounded-md px-2.5 py-2 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={col.include}
                      onCheckedChange={v => setColumns(prev => prev.map(c => c.key === col.key ? { ...c, include: !!v } : c))}
                    />
                    <Label htmlFor={`col-${col.key}`} className="text-xs font-medium cursor-pointer truncate uppercase">
                      {col.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: export buttons */}
        <div className="px-5 pb-5 pt-3 border-t flex-shrink-0">
          <form action="/api/export" method="POST" className="flex gap-3">
            {selectedDocs.map(doc => (
              <input key={doc.id} type="hidden" name="documentIds" value={doc.id} />
            ))}
            <input type="hidden" name="config" value={configValue} />

            <Button
              type="submit"
              name="format"
              value="excel"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              disabled={!anySelected}
              onClick={() => setTimeout(() => setOpen(false), 800)}
            >
              <FileSpreadsheetIcon className="w-4 h-4 mr-2" />
              {lang === 'en' ? 'Excel' : 'Excel'}
            </Button>

            <Button
              type="submit"
              name="format"
              value="csv"
              variant="outline"
              className="flex-1 text-gray-700 hover:bg-gray-100 shadow-sm"
              disabled={!anySelected}
              onClick={() => setTimeout(() => setOpen(false), 800)}
            >
              <TableIcon className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
