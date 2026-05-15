import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { FileChartColumnIcon, PlusIcon, ZapIcon, FingerprintIcon, Building2Icon } from "lucide-react"
import { addRuleAction } from './actions'

export default async function RulesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
  })

  // 1. Récupérer les règles de tous les clients de ce cabinet[cite: 1]
  const regles = await prisma.regleComptable.findMany({
    where: {
      client: { cabinet_id: utilisateur.cabinet_id }
    },
    include: { client: true }, // Pour avoir le nom du client[cite: 1]
    orderBy: { mot_cle_fournisseur: 'asc' }
  })

  // 2. Récupérer la liste des clients pour le formulaire d'ajout[cite: 1]
  const clients = await prisma.client.findMany({
    where: { cabinet_id: utilisateur.cabinet_id },
    orderBy: { nom_entreprise: 'asc' }
  })

  return (
    <div className="space-y-6">
      
      {/* En-tête avec bouton */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 flex items-center gap-2">
            Moteur de Règles Comptables
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Automatisez l'affectation des comptes de charge lors de l'extraction IA.
          </p>
        </div>

        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <PlusIcon className="w-4 h-4 mr-2" /> Nouvelle Règle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Créer une règle d'automatisation</DialogTitle>
              <DialogDescription>
                Associez un mot-clé fournisseur à un compte comptable spécifique.
              </DialogDescription>
            </DialogHeader>
            
            <form action={addRuleAction} className="space-y-4 pt-4">
              
              <div className="space-y-2">
                <Label htmlFor="client_id">Pour quel client ?</Label>
                {/* Utilisation d'un select HTML natif stylisé avec Tailwind pour la simplicité serveur */}
                <select 
                  id="client_id" 
                  name="client_id" 
                  required
                  className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Sélectionner une entreprise...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nom_entreprise}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mot_cle_fournisseur">Mot-clé ou Fournisseur</Label>
                <Input id="mot_cle_fournisseur" name="mot_cle_fournisseur" placeholder="Ex: MAROC TELECOM, ONCF, AWS..." required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="compte_charge_cible">Compte de charge ciblé</Label>
                <Input id="compte_charge_cible" name="compte_charge_cible" placeholder="Ex: 6141, 6145..." required />
              </div>

              <div className="flex items-center space-x-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100 mt-2">
                <input 
                  type="checkbox" 
                  id="affectation_automatique" 
                  name="affectation_automatique" 
                  className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  defaultChecked
                />
                <Label htmlFor="affectation_automatique" className="text-sm text-indigo-900 cursor-pointer">
                  Valider automatiquement la facture si cette règle s'applique
                </Label>
              </div>
              
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700">
                  Activer la règle
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tableau des règles */}
      {regles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4">
            <ZapIcon className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Aucune règle définie</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm">
            Commencez à créer des règles pour gagner du temps sur la saisie comptable.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Mot-clé détecté</TableHead>
                <TableHead>Compte affecté</TableHead>
                <TableHead>Automatisation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {regles.map((regle) => (
                <TableRow key={regle.id} className="hover:bg-gray-50/50 transition-colors">
                  <TableCell className="font-medium flex items-center gap-2 text-gray-900">
                    <Building2Icon className="w-4 h-4 text-gray-400" />
                    {regle.client.nom_entreprise}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200 font-mono">
                      <FingerprintIcon className="w-3 h-3 mr-1 inline-block" />
                      {regle.mot_cle_fournisseur}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-medium text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
                      {regle.compte_charge_cible}
                    </span>
                  </TableCell>
                  <TableCell>
                    {regle.affectation_automatique ? (
                      <span className="inline-flex items-center text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full ring-1 ring-inset ring-green-600/20">
                        <ZapIcon className="w-3 h-3 mr-1" /> Automatique
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded-full ring-1 ring-inset ring-amber-600/20">
                        Manuel
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}