"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircleIcon } from "lucide-react"
import { toast } from "sonner"

const DOC_TYPES = [
  { value: "facture", label: "Facture" },
  { value: "releve_bancaire", label: "Relevé bancaire" },
  { value: "bon_commande", label: "Bon de commande" },
  { value: "recu", label: "Reçu" },
  { value: "autre", label: "Autre" },
]

export default function MissingFieldFeedback({ documentId, documentType }) {
  const [open, setOpen] = useState(false)
  const [fieldName, setFieldName] = useState("")
  const [docType, setDocType] = useState(documentType || "facture")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!fieldName.trim()) return
    setLoading(true)
    try {
      const res = await fetch("/api/feedback/missing-field", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_type: docType, field_name: fieldName.trim(), document_id: documentId ?? null }),
      })
      if (!res.ok) throw new Error()
      toast.success("Merci ! Votre suggestion a été enregistrée.")
      setFieldName("")
      setOpen(false)
    } catch {
      toast.error("Impossible d'envoyer le feedback.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 transition-colors mt-1">
          <PlusCircleIcon className="w-3.5 h-3.5" />
          Ce champ manque ?
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" align="start">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-800">Signaler un champ manquant</p>
            <p className="text-xs text-gray-500 mt-0.5">Dites-nous quel champ l'IA devrait extraire sur ce type de document.</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Type de document</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nom du champ manquant</Label>
            <Input
              value={fieldName}
              onChange={e => setFieldName(e.target.value)}
              placeholder="Ex: Numéro de TVA intracommunautaire"
              className="h-8 text-xs"
              required
            />
          </div>

          <Button type="submit" size="sm" className="w-full h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading || !fieldName.trim()}>
            {loading ? "Envoi…" : "Signaler"}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
