"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createManualTemplateAction } from '@/app/dashboard/actions'
import { PlusIcon, XIcon, HandIcon } from "lucide-react"

const SUGGESTED_TAGS = ["Date de facture", "Nom Fournisseur", "Montant HT", "Montant TVA", "Montant TTC", "Numéro de facture", "ICE", "Catégorie"]

export default function ManualCreator() {
  const [tags, setTags] = useState([])
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)

  // Ajouter un tag depuis l'input
  const handleAddTag = (e) => {
    e.preventDefault()
    if (inputValue.trim() && !tags.includes(inputValue.trim())) {
      setTags([...tags, inputValue.trim()])
      setInputValue("")
    }
  }

  // Ajouter un tag depuis les suggestions
  const addSuggestedTag = (tag) => {
    if (!tags.includes(tag)) setTags([...tags, tag])
  }

  // Supprimer un tag
  const removeTag = (tagToRemove) => {
    setTags(tags.filter(t => t !== tagToRemove))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="w-full sm:w-auto inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 shadow-sm transition-all">
        <HandIcon className="w-4 h-4 mr-2 text-gray-500" /> Création Manuelle
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandIcon className="w-5 h-5 text-gray-600"/> Construire un modèle avec des tags
          </DialogTitle>
          <DialogDescription>
            Définissez les champs que l'IA devra chercher dans vos documents.
          </DialogDescription>
        </DialogHeader>

        <form action={async (formData) => {
          await createManualTemplateAction(formData)
          setOpen(false) // Ferme la modale après succès
          setTags([]) // Reset
        }} className="space-y-6 pt-4">
          
          <div className="space-y-2">
            <Label htmlFor="nom_modele">Nom du preset *</Label>
            <Input id="nom_modele" name="nom_modele" placeholder="Ex: Modèle Notes de Frais" required />
          </div>

          {/* Champ caché pour envoyer les tags au serveur */}
          <input type="hidden" name="tags" value={JSON.stringify(tags)} />

          <div className="space-y-3">
            <Label>Champs à extraire (Tags)</Label>
            
            {/* L'input pour taper un tag personnalisé */}
            <div className="flex gap-2">
              <Input 
                value={inputValue} 
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ex: Taux de change..."
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(e)}
              />
              <Button type="button" onClick={handleAddTag} variant="secondary">Ajouter</Button>
            </div>

            {/* Zone d'affichage des tags sélectionnés */}
            <div className="flex flex-wrap gap-2 p-3 bg-gray-50 min-h-[60px] rounded-md border border-dashed border-gray-300">
              {tags.length === 0 && <span className="text-sm text-gray-400">Aucun tag ajouté.</span>}
              {tags.map((tag, i) => (
                <Badge key={i} className="bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border-indigo-200 pr-1 flex items-center">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="ml-1 text-indigo-500 hover:text-indigo-900 rounded-full p-0.5">
                    <XIcon className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          {/* Les suggestions rapides */}
          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs text-gray-500 uppercase">Tags Suggérés</Label>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_TAGS.filter(t => !tags.includes(t)).map((tag, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="cursor-pointer hover:bg-gray-100 text-gray-600 font-normal transition-colors"
                  onClick={() => addSuggestedTag(tag)}
                >
                  <PlusIcon className="w-3 h-3 mr-1 opacity-50" /> {tag}
                </Badge>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full bg-gray-900 hover:bg-black text-white" disabled={tags.length === 0}>
            Enregistrer le modèle
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}