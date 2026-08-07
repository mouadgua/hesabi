"use client"

import { useRef, useState } from "react"
import { validateDocumentAction } from "@/app/dashboard/actions"
import { SubmitButton } from "@/components/ui/submit-button"
import MissingFieldFeedback from "@/components/MissingFieldFeedback"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import CompteCombobox from "@/components/CompteCombobox"
import {
  BrainCircuitIcon, CheckCircleIcon, PencilIcon,
  ChevronDownIcon, ChevronUpIcon, BookOpenIcon, EyeOffIcon,
} from "lucide-react"

// ── helpers ─────────────────────────────────────────────────────────────────

function reconcileFields(extractedData, modelFields) {
  if (!modelFields || modelFields.length === 0) {
    return { main: extractedData, extras: {} }
  }
  const main = {}
  const usedKeys = new Set()
  for (const field of modelFields) {
    if (extractedData[field] !== undefined) {
      main[field] = extractedData[field]
      usedKeys.add(field)
    } else {
      const match = Object.keys(extractedData).find(
        k => k.toLowerCase().trim() === field.toLowerCase().trim()
      )
      if (match) { main[field] = extractedData[match]; usedKeys.add(match) }
      else main[field] = ''
    }
  }
  const extras = {}
  for (const key of Object.keys(extractedData)) {
    if (!usedKeys.has(key)) extras[key] = extractedData[key]
  }
  return { main, extras }
}

function formatLabel(key) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// ── FieldRow ─────────────────────────────────────────────────────────────────

function FieldRow({ fieldKey, value, editMode, isExtra, isExcluded, onToggle, onBlur }) {
  const isComplex = typeof value === 'object' && value !== null
  const displayValue = isComplex ? JSON.stringify(value, null, 2) : String(value ?? '')
  const isEmpty = value === '' || value == null

  // Hide undetected fields when not in edit mode — no clutter for the user
  if (isEmpty && !editMode && !isExcluded) return null

  if (isExcluded) {
    return (
      <div className="flex items-center gap-3 py-2.5 opacity-40">
        <span className="w-36 shrink-0 text-xs font-medium text-slate-400 uppercase tracking-wide">{formatLabel(fieldKey)}</span>
        <span className="flex-1 text-sm text-slate-400 italic">Exclu</span>
        <input type="hidden" name={fieldKey} value={displayValue} />
        <button type="button" onClick={onToggle} className="text-[10px] text-slate-400 hover:text-emerald-600 transition-colors shrink-0">Réactiver</button>
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-3 py-3 group">
      <span className="w-36 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide leading-relaxed">
        {formatLabel(fieldKey)}
        {isExtra && <span className="ml-1 text-[9px] text-slate-400 normal-case tracking-normal">(extra)</span>}
      </span>

      <div className="flex-1 min-w-0">
        {isComplex ? (
          <textarea
            name={fieldKey}
            defaultValue={displayValue}
            readOnly={!editMode}
            rows={2}
            className="w-full text-sm text-slate-800 dark:text-slate-200 bg-transparent border-0 p-0 focus:outline-none font-mono resize-none leading-relaxed"
            onBlur={e => onBlur(fieldKey, e.target.value)}
          />
        ) : (
          <input
            name={fieldKey}
            defaultValue={displayValue}
            readOnly={!editMode}
            placeholder={isEmpty ? '— non détecté' : undefined}
            className={`w-full text-sm font-medium bg-transparent border-0 p-0 focus:outline-none transition-all ${
              isEmpty
                ? 'text-amber-500 dark:text-amber-400 placeholder:text-amber-400'
                : 'text-slate-800 dark:text-slate-200'
            } ${editMode ? 'border-b border-slate-300 dark:border-white/20 pb-0.5' : ''}`}
            onBlur={e => onBlur(fieldKey, e.target.value)}
          />
        )}
      </div>

      {editMode && (
        <button
          type="button"
          onClick={onToggle}
          className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 text-[10px] text-slate-300 hover:text-orange-400 transition-all shrink-0"
          title="Exclure ce champ"
        >
          <EyeOffIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VerificationForm({
  document,
  extractedData,
  hasPreferences,
  modelFields,
  comptes = [],
  suggestionCompteId = null,
  existingCompteId = null,
}) {
  const originalValues = useRef(
    Object.fromEntries(
      Object.entries(extractedData).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')])
    )
  )

  const { main, extras } = reconcileFields(extractedData, modelFields)
  const [editMode,        setEditMode]        = useState(false)
  const [excludedFields,  setExcludedFields]  = useState([])
  const [extrasOpen,      setExtrasOpen]      = useState(false)
  const [selectedCompteId, setSelectedCompteId] = useState(existingCompteId ?? suggestionCompteId ?? null)
  const hasExtras = Object.keys(extras).length > 0

  async function trackCorrection(fieldName, currentValue) {
    const original = originalValues.current[fieldName] ?? ''
    if (currentValue === original) return
    fetch('/api/corrections/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: document.document_type ?? 'autre',
        field_name: fieldName,
        original_value: original,
        corrected_value: currentValue,
        supplier_name: document.fournisseur_detecte ?? null,
      }),
    }).catch(() => {})
  }

  function toggleExclude(fieldName) {
    setExcludedFields(prev =>
      prev.includes(fieldName) ? prev.filter(f => f !== fieldName) : [...prev, fieldName]
    )
  }

  return (
    <form action={validateDocumentAction} className="flex flex-col h-full">
      <input type="hidden" name="documentId" value={document.id} />
      <input type="hidden" name="clientId" value={document.client_id} />

      {/* AI preferences banner */}
      {hasPreferences && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-emerald-50 dark:bg-[#1D9E75]/10 border border-emerald-200 dark:border-[#1D9E75]/20 text-xs text-emerald-700 dark:text-[#1D9E75] font-medium shrink-0">
          <BrainCircuitIcon className="w-3.5 h-3.5 shrink-0" />
          Extraction personnalisée selon vos préférences
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Champs extraits</h3>
        <button
          type="button"
          onClick={() => setEditMode(v => !v)}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <PencilIcon className="w-3 h-3" />
          {editMode ? 'Terminer' : 'Modifier'}
        </button>
      </div>

      {/* Fields — scrollable */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="divide-y divide-slate-100 dark:divide-white/[0.04]">
          {Object.entries(main).map(([key, value]) => (
            <FieldRow
              key={key}
              fieldKey={key}
              value={value}
              editMode={editMode}
              isExtra={false}
              isExcluded={excludedFields.includes(key)}
              onToggle={() => toggleExclude(key)}
              onBlur={trackCorrection}
            />
          ))}
        </div>

        {/* Extra fields */}
        {hasExtras && (
          <div className="mt-3 pt-3 border-t border-dashed border-slate-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setExtrasOpen(v => !v)}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium transition-colors w-full py-1"
            >
              {extrasOpen ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
              Autres données extraites
              <Badge className="bg-slate-100 dark:bg-white/[0.06] text-slate-400 border-slate-200 dark:border-white/10 text-[10px] ml-0.5">
                {Object.keys(extras).length}
              </Badge>
            </button>
            {extrasOpen && (
              <div className="divide-y divide-slate-100 dark:divide-white/[0.04] mt-1">
                {Object.entries(extras).map(([key, value]) => (
                  <FieldRow
                    key={key}
                    fieldKey={key}
                    value={value}
                    editMode={editMode}
                    isExtra
                    isExcluded={excludedFields.includes(key)}
                    onToggle={() => toggleExclude(key)}
                    onBlur={trackCorrection}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Missing field feedback */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06]">
          <MissingFieldFeedback documentId={document.id} documentType={document.document_type} />
        </div>
      </div>

      {/* Compte comptable */}
      {comptes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/[0.06] shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpenIcon className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Compte comptable</span>
            </div>
            {suggestionCompteId && !existingCompteId && (
              <Badge className="bg-[#E1F5EE] dark:bg-[#1D9E75]/10 text-[#1D9E75] border-[#A8DCC9] dark:border-[#1D9E75]/20 text-[10px] font-semibold">
                Suggéré
              </Badge>
            )}
            {existingCompteId && (
              <Badge className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20 text-[10px] font-semibold">
                Assigné
              </Badge>
            )}
          </div>
          <CompteCombobox
            comptes={comptes}
            value={selectedCompteId}
            onChange={setSelectedCompteId}
            suggestionId={suggestionCompteId}
            placeholder="Affecter un compte CGNC..."
          />
          {suggestionCompteId && !existingCompteId && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1.5 leading-relaxed">
              Basé sur les validations précédentes de votre cabinet.
            </p>
          )}
          <input type="hidden" name="compte_id" value={selectedCompteId ?? ''} />
        </div>
      )}

      {/* Action buttons */}
      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/[0.06] flex gap-3 shrink-0 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm pb-2 z-10">
        <Button
          type="button"
          variant="outline"
          className="h-10 px-5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
          onClick={() => setEditMode(v => !v)}
        >
          {editMode ? 'Annuler' : 'Modifier'}
        </Button>
        <SubmitButton
          type="submit"
          className="flex-1 h-10 bg-[#1D9E75] hover:bg-[#0F6E56] text-white shadow-sm"
          loadingText="Enregistrement…"
        >
          <CheckCircleIcon className="w-4 h-4 mr-2" />
          Valider l'écriture
        </SubmitButton>
      </div>
    </form>
  )
}
