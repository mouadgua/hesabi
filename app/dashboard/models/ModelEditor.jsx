"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { updateTemplateAction, deleteTemplateAction } from "@/app/dashboard/actions"
import { Pencil1Icon } from "@radix-ui/react-icons"
import { XIcon, GripVerticalIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

export default function ModelEditor({ template }) {
  const initialColumns = Object.keys(
    typeof template.structure_json === "object" && template.structure_json !== null
      ? template.structure_json
      : {}
  )

  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState(initialColumns)
  const [nomModele, setNomModele] = useState(template.nom_modele)
  const [newField, setNewField] = useState("")
  const [dragIdx, setDragIdx] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function addField(e) {
    e?.preventDefault()
    const val = newField.trim()
    if (!val || columns.includes(val)) return
    setColumns(prev => [...prev, val])
    setNewField("")
  }

  function removeField(idx) {
    setColumns(prev => prev.filter((_, i) => i !== idx))
  }

  function renameField(idx, value) {
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

  async function handleSave(e) {
    e.preventDefault()
    if (!nomModele.trim()) { toast.error("Donnez un nom au modèle."); return }
    if (columns.length === 0) { toast.error("Ajoutez au moins un champ."); return }

    const fd = new FormData()
    fd.append("template_id", template.id)
    fd.append("nom_modele", nomModele.trim())
    fd.append("columns", JSON.stringify(columns))

    const tid = toast.loading("Enregistrement…")
    try {
      await updateTemplateAction(fd)
      toast.success("Modèle mis à jour.", { id: tid })
      setOpen(false)
    } catch (err) {
      toast.error(err.message || "Erreur lors de la mise à jour.", { id: tid })
    }
  }

  async function handleDelete() {
    const fd = new FormData()
    fd.append("template_id", template.id)
    const tid = toast.loading("Suppression…")
    try {
      await deleteTemplateAction(fd)
      toast.success("Modèle supprimé.", { id: tid })
      setConfirmDelete(false)
      setOpen(false)
    } catch (err) {
      toast.error(err.message || "Erreur.", { id: tid })
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) { setColumns(initialColumns); setNomModele(template.nom_modele) } }}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 gap-1.5">
            <Pencil1Icon className="w-3.5 h-3.5" /> Modifier
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil1Icon className="w-4 h-4 text-indigo-500" />
              Modifier le modèle
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label>Nom du modèle *</Label>
              <Input
                value={nomModele}
                onChange={e => setNomModele(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Champs <span className="text-gray-400 font-normal">({columns.length})</span></Label>

              {/* Add field */}
              <div className="flex gap-2">
                <Input
                  value={newField}
                  onChange={e => setNewField(e.target.value)}
                  placeholder="Ajouter un champ…"
                  onKeyDown={e => e.key === "Enter" && addField(e)}
                />
                <Button type="button" variant="secondary" onClick={addField} disabled={!newField.trim()}>
                  Ajouter
                </Button>
              </div>

              {/* Field list */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {columns.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Aucun champ — ajoutez-en ci-dessus.</p>
                )}
                {columns.map((col, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm hover:border-indigo-300 transition-colors cursor-grab active:cursor-grabbing"
                  >
                    <GripVerticalIcon className="w-4 h-4 text-gray-300 shrink-0" />
                    <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 font-mono text-[10px] shrink-0">
                      {idx + 1}
                    </Badge>
                    <Input
                      value={col}
                      onChange={e => renameField(idx, e.target.value)}
                      className="h-7 text-sm border-0 shadow-none focus-visible:ring-0 px-1 flex-1"
                    />
                    <button type="button" onClick={() => removeField(idx)} className="text-gray-300 hover:text-red-500 shrink-0">
                      <XIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2Icon className="w-3.5 h-3.5" /> Supprimer ce modèle
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={columns.length === 0}>
                  Enregistrer
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer «&nbsp;{template.nom_modele}&nbsp;» ?</AlertDialogTitle>
            <AlertDialogDescription>
              Ce modèle sera définitivement supprimé. Les documents déjà extraits avec ce modèle ne seront pas affectés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
