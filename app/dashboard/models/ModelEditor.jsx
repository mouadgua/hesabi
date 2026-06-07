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
import { XIcon, GripVerticalIcon, Trash2Icon, ChevronDownIcon, AlertTriangleIcon } from "lucide-react"
import { toast } from "sonner"

// ── Pseudo-values for JSON preview ───────────────────────────────────────────

const EXAMPLE_VALUES = {
  date: '15/03/2026', montant: '1 250,00', ttc: '1 250,00', ht: '1 050,00',
  tva: '200,00', fournisseur: 'Marjane Holdings', nom: 'Marjane Holdings',
  numero: 'FAC-2026-001', reference: 'REF-001', description: 'Fournitures bureau',
  quantite: '5', prix: '250,00', total: '1 250,00', rib: '011 810 0000123456 78',
  ice: '001234567000098', adresse: '12 Rue Hassan II, Casablanca',
  telephone: '+212 5 22 12 34 56', mode: 'Virement bancaire',
}

function exampleValue(fieldName) {
  const key = fieldName.toLowerCase().replace(/[_\s]/g, '')
  for (const [k, v] of Object.entries(EXAMPLE_VALUES)) {
    if (key.includes(k)) return v
  }
  return `valeur_${fieldName.slice(0, 8).toLowerCase()}`
}

// ── JSON preview panel ────────────────────────────────────────────────────────

function JsonPreview({ columns }) {
  const [expanded, setExpanded] = useState(false)
  if (columns.length === 0) return null

  const preview = Object.fromEntries(columns.map(c => [c, exampleValue(c)]))

  return (
    <div className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
      >
        <span>Aperçu JSON ({columns.length} champ{columns.length > 1 ? 's' : ''})</span>
        <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-white dark:bg-white/[0.02] p-3 overflow-auto max-h-40 leading-relaxed">
          {JSON.stringify(preview, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ModelEditor({ template, usageCount = 0 }) {
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

  // Validation
  const duplicateNames = columns.filter((c, i) => columns.indexOf(c) !== i)
  const hasDuplicates  = duplicateNames.length > 0
  const emptyNames     = columns.some(c => !c.trim())

  function addField(e) {
    e?.preventDefault()
    const val = newField.trim()
    if (!val) return
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
    if (hasDuplicates) { toast.error("Des champs ont le même nom. Corrigez-les avant d'enregistrer."); return }
    if (emptyNames) { toast.error("Un ou plusieurs champs ont un nom vide."); return }

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
          <Button variant="ghost" size="sm" className="flex-1 text-[#1D9E75] hover:text-[#0F6E56] hover:bg-[#1D9E75]/8 gap-1.5">
            <Pencil1Icon className="w-3.5 h-3.5" /> Modifier
          </Button>
        </DialogTrigger>

        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil1Icon className="w-4 h-4 text-[#1D9E75]" />
              Modifier le modèle
              {usageCount > 0 && (
                <span className="ml-auto text-xs font-normal text-slate-400 dark:text-slate-500">
                  Utilisé pour {usageCount} document{usageCount > 1 ? 's' : ''}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nom du modèle *</Label>
              <Input
                value={nomModele}
                onChange={e => setNomModele(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Champs <span className="text-gray-400 font-normal">({columns.length})</span></Label>
                {hasDuplicates && (
                  <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                    <AlertTriangleIcon className="w-3 h-3" />
                    Noms en doublon
                  </span>
                )}
              </div>

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
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {columns.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-4">Aucun champ — ajoutez-en ci-dessus.</p>
                )}
                {columns.map((col, idx) => {
                  const isDuplicate = columns.indexOf(col) !== idx
                  return (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      className={`flex items-center gap-2 bg-white dark:bg-white/[0.04] border rounded-lg px-3 py-2 shadow-sm transition-colors cursor-grab active:cursor-grabbing
                        ${isDuplicate
                          ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-500/5'
                          : 'border-slate-200 dark:border-white/[0.08] hover:border-[#1D9E75]/40'
                        }`}
                    >
                      <GripVerticalIcon className="w-4 h-4 text-gray-300 shrink-0" />
                      <Badge className="bg-[#1D9E75]/10 text-[#1D9E75] border-[#1D9E75]/20 font-mono text-[10px] shrink-0">
                        {idx + 1}
                      </Badge>
                      <Input
                        value={col}
                        onChange={e => renameField(idx, e.target.value)}
                        className="h-7 text-sm border-0 shadow-none focus-visible:ring-0 px-1 flex-1"
                      />
                      <button type="button" onClick={() => removeField(idx)} className="text-gray-300 hover:text-red-500 shrink-0 cursor-pointer">
                        <XIcon className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Live JSON preview */}
            <JsonPreview columns={columns} />

            <div className="flex items-center justify-between pt-2 border-t gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-600 transition-colors cursor-pointer"
              >
                <Trash2Icon className="w-3.5 h-3.5" /> Supprimer ce modèle
              </button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button
                  type="submit"
                  className="bg-[#1D9E75] hover:bg-[#0F6E56] text-white"
                  disabled={columns.length === 0 || hasDuplicates || emptyNames}
                >
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
