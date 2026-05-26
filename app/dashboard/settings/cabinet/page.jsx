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
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Espace de travail</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Personnalisez l'environnement de votre cabinet.
        </p>
      </div>

      <Card className="rounded-2xl border border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-white/[0.04] backdrop-blur-xl shadow-sm overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
            <BuildingIcon className="w-5 h-5 text-[#1D9E75]" /> Profil du Cabinet
          </CardTitle>
          <CardDescription className="text-slate-500 dark:text-slate-400">
            Le logo et ces informations apparaîtront sur vos exports officiels.
          </CardDescription>
        </CardHeader>

        <CabinetForm
          initialCabinet={utilisateur.cabinet}
          isAdmin={isAdmin}
          action={updateCabinetAction}
        />

      </Card>
    </div>
  )
}