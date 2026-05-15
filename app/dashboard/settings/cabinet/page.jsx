import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BuildingIcon } from "lucide-react"
import { updateCabinetAction } from './actions'
import { redirect } from 'next/navigation'
import { CabinetForm } from './cabinet-form'

export default async function CabinetSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    include: { cabinet: true }
  })

  if (!utilisateur || !utilisateur.cabinet_id) redirect('/onboarding')

  const isAdmin = utilisateur.role === "EXPERT_COMPTABLE"

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Espace de travail</h1>
        <p className="text-sm text-gray-500 mt-1">
          Personnalisez l'environnement de votre cabinet.
        </p>
      </div>

      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BuildingIcon className="w-5 h-5 text-blue-600" /> Profil du Cabinet
          </CardTitle>
          <CardDescription>
            Le logo et ces informations apparaîtront sur vos exports officiels.
          </CardDescription>
        </CardHeader>
        
        {/* On appelle le composant client en lui passant les props nécessaires[cite: 6] */}
        <CabinetForm 
          initialCabinet={utilisateur.cabinet} 
          isAdmin={isAdmin} 
          action={updateCabinetAction} 
        />
        
      </Card>
    </div>
  )
}