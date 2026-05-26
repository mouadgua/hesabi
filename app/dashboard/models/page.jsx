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
import ShineWrapper from "@/components/reactbits/ShineWrapper"

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

  const templates = await prisma.templateExtraction.findMany({
    where: { cabinet_id: utilisateur.cabinet_id },
    orderBy: { createdAt: 'desc' }
  })

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">

      {/* HEADER — centered */}
      <div className="flex flex-col items-center text-center gap-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
            <BoxesIcon className="w-6 h-6 text-[#1D9E75]" />
            Atelier des Modèles
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-sm mx-auto">
            Créez des presets d'extraction réutilisables pour tous vos clients.
          </p>
        </div>

        {/* BUTTONS — spread evenly */}
        <div className="flex flex-wrap justify-center gap-3 w-full max-w-xl">
          <ExcelModelImporter />
          <ManualCreator />

          {/* Générer par IA — with shine effect */}
          <Dialog>
            <ShineWrapper borderRadius="rounded-md">
              <DialogTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-5 py-2 bg-[#1D9E75] hover:bg-[#0F6E56] text-white shadow-md shadow-[#1D9E75]/30 transition-all focus-visible:outline-none whitespace-nowrap">
                <SparklesIcon className="w-4 h-4 mr-2" /> Générer par IA (Photo Excel)
              </DialogTrigger>
            </ShineWrapper>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-[#1D9E75]"/> Nouvelle structure
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
                <Button type="submit" className="w-full bg-[#1D9E75] hover:bg-[#0F6E56] text-white mt-2">
                  Générer le modèle
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* LISTE DES MODÈLES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Modèle système */}
        <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/50 dark:bg-white/[0.02] backdrop-blur-xl shadow-sm opacity-70">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex justify-between items-center text-slate-700 dark:text-slate-300">
              Standard Facture
              <Badge variant="secondary" className="text-[10px]">Système</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-500 dark:text-slate-400">
            <p className="mb-4">Modèle générique pour les factures et reçus.</p>
            <div className="flex flex-wrap gap-2">
              {['Fournisseur', 'Date', 'TTC', 'TVA'].map(f => (
                <Badge key={f} variant="outline" className="text-[10px] border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">{f}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modèles personnalisés */}
        {templates.length === 0 ? (
          <div className="col-span-full p-10 border-2 border-dashed border-slate-200/60 dark:border-white/[0.07] rounded-2xl flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-2 bg-white/40 dark:bg-white/[0.02]">
            <FileJsonIcon className="w-9 h-9 mb-2 opacity-50" />
            <p className="text-sm font-medium">Aucun modèle personnalisé.</p>
            <p className="text-xs">Utilisez "Création Manuelle" ou "Générer par IA" pour commencer.</p>
          </div>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex justify-between items-center text-slate-800 dark:text-slate-100">
                  {template.nom_modele}
                  <Badge className="text-[10px] bg-[#E1F5EE] dark:bg-[#1D9E75]/10 text-[#085041] dark:text-[#1D9E75] border border-[#A8DCC9] dark:border-[#1D9E75]/20 hover:bg-[#E1F5EE]">Personnalisé</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50/80 dark:bg-white/[0.03] p-3 rounded-xl border border-slate-100 dark:border-white/[0.06] max-h-32 overflow-y-auto mb-4 whitespace-pre-wrap">
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
