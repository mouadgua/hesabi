import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { createTemplateFromImageAction } from '@/app/dashboard/actions'
import { SparklesIcon, BoxesIcon, FileJsonIcon } from "lucide-react"

import ManualCreator from './ManualCreator'
import ExcelModelImporter from './ExcelModelImporter'
import ModelEditor from './ModelEditor'

export default async function ModelsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return <div>Non autorisé</div>

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true }
  })

  // Récupérer les modèles du cabinet
  const templates = await prisma.templateExtraction.findMany({
    where: { cabinet_id: utilisateur.cabinet_id },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-4 md:p-8 space-y-6 bg-gray-50/30 min-h-[calc(100vh-80px)] w-full overflow-hidden">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BoxesIcon className="w-6 h-6 text-indigo-600" />
            Atelier des Modèles
          </h1>
          <p className="text-sm text-gray-500 mt-1">Créez des presets d'extraction réutilisables pour tous vos clients.</p>
        </div>

        {/* BOUTONS DE CRÉATION */}
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          {/* Import depuis Excel (Recommandé) */}
          <ExcelModelImporter />

          {/* Composant de création manuelle (Tags) */}
          <ManualCreator />
          
          {/* BOUTON MAGIQUE (Création par IA) */}
          <Dialog>
            <DialogTrigger className="w-full sm:w-auto inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md transition-all focus-visible:outline-none">
              <SparklesIcon className="w-4 h-4 mr-2" /> Générer par IA (Photo Excel)
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-purple-600"/> Nouvelle structure
                </DialogTitle>
                <DialogDescription>
                  Uploadez une capture d'écran d'un tableau vide (Excel, Sheets). L'IA en déduira les colonnes à extraire.
                </DialogDescription>
              </DialogHeader>
              <form action={createTemplateFromImageAction} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="nom_modele">Nom du preset *</Label>
                  <Input id="nom_modele" name="nom_modele" placeholder="Ex: Matrice Notes de Frais" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file">Image du tableau (Capture d'écran)</Label>
                  <Input id="file" name="file" type="file" accept="image/*" required className="cursor-pointer" />
                </div>
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white mt-2">
                  Générer le modèle
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* LISTE DES MODÈLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
        
        {/* Modèles par défaut générés par le système (Hardcodés pour l'exemple) */}
        <Card className="border-gray-200 shadow-sm opacity-80 bg-gray-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex justify-between items-center">
              Standard Facture
              <Badge variant="secondary">Système</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-500">
            <p className="mb-4">Modèle générique pour les factures et reçus.</p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white">Fournisseur</Badge>
              <Badge variant="outline" className="bg-white">Date</Badge>
              <Badge variant="outline" className="bg-white">TTC</Badge>
              <Badge variant="outline" className="bg-white">TVA</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Boucle sur les modèles personnalisés */}
        {templates.length === 0 ? (
          <div className="col-span-full p-8 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 gap-2 bg-white">
            <FileJsonIcon className="w-8 h-8 mb-2 opacity-50" />
            <p>Aucun modèle personnalisé.</p>
            <p className="text-xs">Utilisez le bouton "Création Manuelle" ou "Générer par IA" pour commencer.</p>
          </div>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="border-indigo-100 shadow-sm hover:shadow-md transition-shadow bg-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-center text-indigo-900">
                  {template.nom_modele}
                  <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100">Personnalisé</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-gray-500 font-mono bg-gray-50 p-3 rounded-md border max-h-32 overflow-y-auto mb-4 whitespace-pre-wrap">
                  {JSON.stringify(template.structure_json, null, 2)}
                </div>
                <ModelEditor template={{ id: template.id, nom_modele: template.nom_modele, structure_json: template.structure_json }} />
              </CardContent>
            </Card>
          ))
        )}
      </div>

    </div>
  )
}