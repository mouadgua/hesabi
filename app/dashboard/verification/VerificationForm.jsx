"use client"

import { useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { validateDocumentAction } from "@/app/dashboard/actions"
import { SubmitButton } from "@/components/ui/submit-button"
import MissingFieldFeedback from "@/components/MissingFieldFeedback"
import { CheckCircleIcon, BrainCircuitIcon, EyeOffIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"

// ── Field reconciliation ────────────────────────────────────────────────────

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
      if (match) {
        main[field] = extractedData[match]
        usedKeys.add(match)
      } else {
        main[field] = ''
      }
    }
  }

  const extras = {}
  for (const key of Object.keys(extractedData)) {
    if (!usedKeys.has(key)) extras[key] = extractedData[key]
  }

  return { main, extras }
}

// ── Field row ───────────────────────────────────────────────────────────────

function FieldRow({ fieldKey, value, isExtra, isExcluded, onToggleExclude, onBlur }) {
  const isComplex = typeof value === 'object' && value !== null
  const displayValue = isComplex ? JSON.stringify(value, null, 2) : String(value ?? '')
  const isEmpty = value === '' || value == null
  const labelName = fieldKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())

  return (
    <div className={`space-y-1 transition-opacity ${isExcluded ? 'opacity-40' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <Label
          htmlFor={fieldKey}
          className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5"
        >
          {labelName}
          {isEmpty && !isExcluded && (
            <Badge className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 text-[9px] font-bold px-1 py-0 h-4">
              Non trouvé
            </Badge>
          )}
          {isExtra && (
            <Badge className="bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 text-[9px] font-normal px-1 py-0 h-4">
              Extra
            </Badge>
          )}
        </Label>
        <button
          type="button"
          onClick={onToggleExclude}
          className="flex items-center gap-1 text-[10px] text-slate-300 dark:text-slate-600 hover:text-orange-500 dark:hover:text-orange-400 transition-colors shrink-0"
        >
          <EyeOffIcon className="w-3 h-3" />
          {isExcluded ? 'Réactiver' : 'Toujours inutile ?'}
        </button>
      </div>

      {isExcluded ? (
        <input type="hidden" name={fieldKey} value={displayValue} />
      ) : isComplex ? (
        <textarea
          id={fieldKey}
          name={fieldKey}
          defaultValue={displayValue}
          className="flex min-h-[120px] w-full rounded-md border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3 py-2 text-sm text-slate-600 dark:text-slate-300 font-mono"
          readOnly
        />
      ) : (
        <Input
          id={fieldKey}
          name={fieldKey}
          defaultValue={displayValue}
          className={`font-medium ${
            isEmpty
              ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 placeholder:text-amber-400 dark:placeholder:text-amber-600 text-slate-800 dark:text-slate-100'
              : 'bg-slate-50 dark:bg-white/[0.04] border-slate-200 dark:border-white/10 text-slate-800 dark:text-slate-100'
          }`}
          placeholder={isEmpty ? 'Non détecté — saisissez manuellement' : undefined}
          onBlur={e => onBlur(fieldKey, e.target.value)}
        />
      )}
    </div>
  )
}

// ── Main form ───────────────────────────────────────────────────────────────

export default function VerificationForm({ document, extractedData, hasPreferences, modelFields }) {
  const originalValues = useRef(
    Object.fromEntries(
      Object.entries(extractedData).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')])
    )
  )

  const { main, extras } = reconcileFields(extractedData, modelFields)
  const [excludedFields, setExcludedFields] = useState([])
  const [extrasOpen, setExtrasOpen] = useState(false)
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
    }).catch(err => console.warn("[corrections] save failed:", err))
  }

  function toggleExclude(fieldName) {
    setExcludedFields(prev =>
      prev.includes(fieldName) ? prev.filter(f => f !== fieldName) : [...prev, fieldName]
    )
    fetch('/api/corrections/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_type: document.document_type ?? 'autre',
        field_name: fieldName,
        original_value: null,
        corrected_value: '__EXCLUDED__',
        supplier_name: document.fournisseur_detecte ?? null,
      }),
    }).catch(err => console.warn("[corrections] exclude failed:", err))
  }

  return (
    <form action={validateDocumentAction} className="space-y-5 flex flex-col h-full">
      <input type="hidden" name="documentId" value={document.id} />
      <input type="hidden" name="clientId" value={document.client_id} />

      {hasPreferences && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-[#1D9E75]/10 border border-emerald-200 dark:border-[#1D9E75]/20 text-xs text-emerald-700 dark:text-[#1D9E75] font-medium">
          <BrainCircuitIcon className="w-3.5 h-3.5 shrink-0" />
          Extraction personnalisée selon vos préférences
        </div>
      )}

      {/* Main fields */}
      <div className="space-y-4 flex-1">
        {Object.entries(main).map(([key, value]) => (
          <FieldRow
            key={key}
            fieldKey={key}
            value={value}
            isExtra={false}
            isExcluded={excludedFields.includes(key)}
            onToggleExclude={() => toggleExclude(key)}
            onBlur={trackCorrection}
          />
        ))}
      </div>

      {/* Extra fields (collapsible) */}
      {hasExtras && (
        <div className="border-t border-slate-100 dark:border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setExtrasOpen(v => !v)}
            className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium transition-colors w-full"
          >
            {extrasOpen ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
            Autres données extraites
            <Badge className="bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 text-[10px] ml-1">
              {Object.keys(extras).length}
            </Badge>
          </button>
          {extrasOpen && (
            <div className="mt-3 space-y-4 pl-3 border-l-2 border-slate-100 dark:border-white/[0.06]">
              {Object.entries(extras).map(([key, value]) => (
                <FieldRow
                  key={key}
                  fieldKey={key}
                  value={value}
                  isExtra={true}
                  isExcluded={excludedFields.includes(key)}
                  onToggleExclude={() => toggleExclude(key)}
                  onBlur={trackCorrection}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="border-t border-slate-100 dark:border-white/[0.06] pt-3 pb-1">
        <MissingFieldFeedback documentId={document.id} documentType={document.document_type} />
      </div>

      {/* Sticky footer — dark mode aware */}
      <div className="pt-2 mt-auto border-t border-slate-100 dark:border-white/[0.06] flex gap-3 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm pb-2 shrink-0 z-10">
        <SubmitButton
          type="submit"
          className="flex-1 bg-[#1D9E75] hover:bg-[#0F6E56] text-white shadow-md h-11"
          loadingText="Enregistrement…"
        >
          <CheckCircleIcon className="w-5 h-5 mr-2" /> Valider et Enregistrer
        </SubmitButton>
      </div>
    </form>
  )
}
