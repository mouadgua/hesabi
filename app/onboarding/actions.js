'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { redirect } from 'next/navigation'

export async function setupWorkspace({ prenom }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("Non autorisé")

  await prisma.$transaction(async (tx) => {
    const cabinet = await tx.cabinet.create({
      data: { nom: `Cabinet de ${prenom}` },
    })

    await tx.utilisateur.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email,
        nom: prenom,
        cabinet_id: cabinet.id,
        role: 'EXPERT_COMPTABLE',
        onboarding_done: true,
      },
      update: {
        nom: prenom,
        cabinet_id: cabinet.id,
        onboarding_done: true,
      },
    })
  })

  redirect('/dashboard')
}
