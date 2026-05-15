'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function setupWorkspace(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("Non autorisé")

  // On utilise une TRANSACTION Prisma pour s'assurer que si la création
  // du cabinet échoue, la création de l'utilisateur n'est pas sauvegardée
  await prisma.$transaction(async (tx) => {
    
    // 1. On crée le Cabinet
    const nouveauCabinet = await tx.cabinet.create({
      data: {
        nom: formData.nomCabinet,
        plan_abonnement: "ESSAI_GRATUIT",
      }
    })

    // 2. On crée l'Utilisateur et on le lie au Cabinet
    await tx.utilisateur.create({
      data: {
        id: user.id, // On utilise EXACTEMENT l'ID de Supabase
        email: user.email,
        nom: formData.nomComplet,
        cabinet_id: nouveauCabinet.id,
        role: "EXPERT_COMPTABLE", // Il est le premier, c'est le boss
      }
    })
  })

  // 3. Une fois terminé, on l'envoie sur son beau tableau de bord
  redirect('/dashboard')
}