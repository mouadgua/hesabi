"use client"

import { useState, useRef } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createTemplateFromColumnsAction } from "@/app/dashboard/actions"
import { FileSpreadsheetIcon, XIcon, StarIcon, GripVerticalIcon } from "lucide-react"
import { toast } from "sonner"

export default function ExcelModelImporter() {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState([])
  const [step, setStep] = useState("upload") // "upload" | "edit"
  const [nomModele, setNomModele] = useState("")
  const [dragIdx, setDragIdx] = useState(null)
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "binary" })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })
        const headers = (rows[0] || []).map(String).filter(Boolean)
        if (headers.length === 0) { toast.error("Aucun en-tête trouvé dans ce fichier."); return }
        setColumns(headers)
        setStep("edit")
      } catch {
        toast.error("Impossible de lire ce fichier Excel.")
      }
    }
    reader.readAsBinaryString(file)
  }

  function removeColumn(idx) {
    setColumns(prev => prev.filter((_, i) => i !== idx))
  }

  function renameColumn(idx, value) {
    setColumns(prev => prev.map((col, i) => i === idx ? value : col))
  }

  function handleDragStart(idx) { setDragIdx(idx) }
  function handleDragOver(e, idx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    setColumns(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(idx, 0, moved)
      return next
    })
    setDragIdx(idx)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!nomModele.trim()) { toast.error("Donnez un nom au modèle."); return }
    if (columns.length === 0) { toast.error("Ajoutez au moins une colonne."); return }

    const fd = new FormData()
    fd.append("nom_modele", nomModele.trim())
    fd.append("columns", JSON.stringify(columns))

    const toastId = toast.loading("Création du modèle…")
    try {
      await createTemplateFromColumnsAction(fd)
      toast.success("Modèle créé depuis votre fichier Excel.", { id: toastId })
      setOpen(false)
      setStep("upload")
      setColumns([])
      setNomModele("")
    } catch (err) {
      toast.error(err.message || "Erreur lors de la création.", { id: toastId })
    }
  }

  function handleOpenChange(v) {
    setOpen(v)
    if (!v) { setStep("upload"); setColumns([]); setNomModele("") }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <button className="relative w-full sm:w-auto inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all focus-visible:outline-none">
          <FileSpreadsheetIcon className="w-4 h-4 mr-2" />
          Importer depuis Excel
          <span className="absolute -top-2 -right-2 bg-amber-400 text-[9px] font-bold text-amber-900 px-1.5 py-0.5 rounded-full leading-none flex items-center gap-0.5">
            <StarIcon className="w-2.5 h-2.5" /> Recommandé
          </span>
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheetIcon className="w-5 h-5 text-emerald-600" />
            Modèle depuis un fichier Excel
          </DialogTitle>
          <DialogDescription>
            Importez un fichier .xlsx — les en-têtes de colonnes deviendront automatiquement les champs du modèle.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="space-y-4 pt-4">
            <div
              className="border-2 border-dashed border-emerald-200 bg-emerald-50/40 rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:bg-emerald-50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheetIcon className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-medium text-emerald-800">Cliquez pour sélectionner un fichier .xlsx</p>
              <p className="text-xs text-emerald-600">La première ligne doit contenir les en-têtes de colonnes</p>
            </div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="space-y-2">
              <Label htmlFor="nom_excel_modele">Nom du modèle *</Label>
              <Input
                id="nom_excel_modele"
                value={nomModele}
                onChange={e => setNomModele(e.target.value)}
                placeholder="Ex: Modèle Relevé Bancaire CIH"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Colonnes détectées <span className="text-gray-400 font-normal">({columns.length})</span></Label>
                <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => { setStep("upload"); setColumns([]) }}>
                  ← Rechoisir un fichier
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {columns.map((col, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:border-emerald-300 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <GripVerticalIcon className="w-4 h-4 text-gray-300 shrink-0" />
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 font-mono text-[10px] shrink-0">
                      {idx + 1}
                    </Badge>
                    <Input
                      value={col}
                      onChange={e => renameColumn(idx, e.target.value)}
                      className="h-7 text-sm border-0 shadow-none focus-visible:ring-0 px-1 flex-1"
                    />
                    <button type="button" onClick={() => removeColumn(idx)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400">Glissez pour réordonner. Cliquez sur un nom pour le renommer.</p>
            </div>

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={columns.length === 0}>
              Créer le modèle ({columns.length} champs)
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
