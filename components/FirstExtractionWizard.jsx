"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2Icon, ChevronRightIcon, ChevronLeftIcon, SparklesIcon } from "lucide-react"
import { toast } from "sonner"

const LOGICIELS = [
  { id: "sage", label: "Sage", icon: "🟦" },
  { id: "cegid", label: "Cegid", icon: "🟩" },
  { id: "dext", label: "Dext", icon: "🟧" },
  { id: "quickbooks", label: "QuickBooks", icon: "🟨" },
  { id: "odoo", label: "Odoo", icon: "🟪" },
  { id: "autre", label: "Autre / Manuel", icon: "⬜" },
]

const FIELD_GROUPS = [
  {
    label: "Identification",
    fields: [
      { id: "fournisseur", label: "Fournisseur / Émetteur" },
      { id: "ice", label: "ICE (identifiant fiscal)" },
      { id: "numero_facture", label: "Numéro de facture" },
    ],
  },
  {
    label: "Montants",
    fields: [
      { id: "montant_ht", label: "Montant HT" },
      { id: "montant_tva", label: "Montant TVA" },
      { id: "montant_ttc", label: "Montant TTC" },
      { id: "taux_tva", label: "Taux de TVA" },
    ],
  },
  {
    label: "Dates & Référence",
    fields: [
      { id: "date_facture", label: "Date de facture" },
      { id: "date_echeance", label: "Date d'échéance" },
      { id: "reference_paiement", label: "Référence paiement" },
    ],
  },
  {
    label: "Divers",
    fields: [
      { id: "categorie", label: "Catégorie comptable" },
      { id: "mode_paiement", label: "Mode de paiement" },
      { id: "rib", label: "RIB / IBAN" },
    ],
  },
]

const DEFAULT_FIELDS = ["fournisseur", "montant_ht", "montant_tva", "montant_ttc", "date_facture", "numero_facture"]

export default function FirstExtractionWizard({ open, onComplete, onSkip }) {
  const [step, setStep] = useState(1)
  const [logiciel, setLogiciel] = useState(null)
  const [selectedFields, setSelectedFields] = useState(DEFAULT_FIELDS)
  const [loading, setLoading] = useState(false)

  function toggleField(fieldId) {
    setSelectedFields(prev =>
      prev.includes(fieldId) ? prev.filter(f => f !== fieldId) : [...prev, fieldId]
    )
  }

  async function handleFinish() {
    setLoading(true)
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logiciel, preferred_fields: selectedFields }),
      })
      toast.success("Préférences enregistrées ! L'IA va maintenant s'adapter à vos besoins.")
      onComplete()
    } catch {
      toast.error("Erreur lors de la sauvegarde des préférences.")
      onComplete()
    } finally {
      setLoading(false)
    }
  }

  async function handleSkip() {
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logiciel: null, preferred_fields: [] }),
      })
    } catch {}
    onSkip()
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onInteractOutside={e => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <SparklesIcon className="w-5 h-5 text-[#1D9E75]" />
            <DialogTitle className="text-lg">Personnalisez votre extraction</DialogTitle>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? "bg-[#1D9E75]" : "bg-slate-200"}`} />
            ))}
          </div>
        </DialogHeader>

        <div className="mt-2">
          {/* STEP 1 — Logiciel comptable */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Quel logiciel comptable utilisez-vous ? L'IA adaptera le format des données exportées.</p>
              <div className="grid grid-cols-2 gap-2">
                {LOGICIELS.map(l => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLogiciel(l.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all ${
                      logiciel === l.id
                        ? "border-[#1D9E75] bg-[#1D9E75]/8"
                        : "border-gray-200 hover:border-gray-300 bg-white"
                    }`}
                  >
                    <span className="text-xl">{l.icon}</span>
                    <span className="text-sm font-medium text-gray-800">{l.label}</span>
                    {logiciel === l.id && <CheckCircle2Icon className="w-4 h-4 text-[#1D9E75] ml-auto" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Champs à extraire */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">Quels champs souhaitez-vous extraire systématiquement ? <span className="text-gray-400">(Vous pourrez modifier cela plus tard)</span></p>
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {FIELD_GROUPS.map(group => (
                  <div key={group.label}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">{group.label}</p>
                    <div className="space-y-1">
                      {group.fields.map(field => {
                        const selected = selectedFields.includes(field.id)
                        return (
                          <button
                            key={field.id}
                            type="button"
                            onClick={() => toggleField(field.id)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-sm text-left transition-all ${
                              selected
                                ? "border-[#1D9E75]/30 bg-[#1D9E75]/8 text-[#1D9E75]/90"
                                : "border-gray-100 bg-white text-gray-600 hover:border-gray-200"
                            }`}
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                              selected ? "border-[#1D9E75] bg-[#1D9E75]" : "border-gray-300"
                            }`}>
                              {selected && <CheckCircle2Icon className="w-3 h-3 text-white" />}
                            </div>
                            {field.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">{selectedFields.length} champ{selectedFields.length !== 1 ? "s" : ""} sélectionné{selectedFields.length !== 1 ? "s" : ""}</p>
            </div>
          )}

          {/* STEP 3 — Confirmation */}
          {step === 3 && (
            <div className="space-y-4 text-center py-2">
              <div className="bg-[#1D9E75]/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto">
                <SparklesIcon className="w-8 h-8 text-[#1D9E75]" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Tout est prêt !</h3>
                <p className="text-sm text-gray-500 mt-1">
                  L'IA va extraire <strong>{selectedFields.length} champs</strong> en priorité
                  {logiciel && logiciel !== "autre" && (
                    <> et formater les données pour <strong>{LOGICIELS.find(l => l.id === logiciel)?.label}</strong></>
                  )}.
                </p>
              </div>
              {selectedFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {selectedFields.slice(0, 6).map(f => (
                    <Badge key={f} className="bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20 text-[10px]">
                      {f.replace(/_/g, " ")}
                    </Badge>
                  ))}
                  {selectedFields.length > 6 && (
                    <Badge className="bg-gray-100 text-gray-500 border-gray-200 text-[10px]">
                      +{selectedFields.length - 6} autres
                    </Badge>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Passer cette étape
          </button>

          <div className="flex gap-2">
            {step > 1 && (
              <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)}>
                <ChevronLeftIcon className="w-4 h-4 mr-1" /> Retour
              </Button>
            )}
            {step < 3 ? (
              <Button size="sm" className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white" onClick={() => setStep(s => s + 1)}>
                Suivant <ChevronRightIcon className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white" onClick={handleFinish} disabled={loading}>
                {loading ? "Enregistrement…" : "Lancer l'extraction"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
