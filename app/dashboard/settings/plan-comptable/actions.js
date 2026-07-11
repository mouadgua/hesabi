'use server'

import { revalidatePath } from 'next/cache'
import { createClient }   from '@/utils/supabase/server'
import { redirect }       from 'next/navigation'
import prisma             from '@/lib/prisma'

async function getCabinetId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const util = await prisma.utilisateur.findUnique({
    where:  { id: user.id },
    select: { cabinet_id: true },
  })
  if (!util?.cabinet_id) throw new Error('Cabinet introuvable')
  return util.cabinet_id
}

export async function createCompteAction(formData) {
  const cabinet_id = await getCabinetId()

  const code    = formData.get('code')?.trim()
  const libelle = formData.get('libelle')?.trim()
  const classe  = parseInt(formData.get('classe'), 10)

  if (!code || !libelle || isNaN(classe) || classe < 1 || classe > 8) {
    return { error: 'Champs invalides' }
  }

  // Prevent duplicate code within this cabinet
  const existing = await prisma.compteComptable.findFirst({
    where: { cabinet_id, code },
  })
  if (existing) return { error: `Le code ${code} existe déjà dans votre plan` }

  // Reject code collision with CGNC standards
  const cgnc = await prisma.compteComptable.findFirst({
    where: { code, is_standard: true },
  })
  if (cgnc) return { error: `Le code ${code} est déjà utilisé dans le plan CGNC standard` }

  await prisma.compteComptable.create({
    data: {
      cabinet_id,
      code,
      libelle,
      classe,
      actif:       true,
      is_standard: false,
    },
  })

  revalidatePath('/dashboard/settings/plan-comptable')
  return { success: true }
}

export async function updateCompteAction(formData) {
  const cabinet_id = await getCabinetId()

  const id      = formData.get('id')
  const libelle = formData.get('libelle')?.trim()
  const actif   = formData.get('actif') !== 'false'

  if (!id || !libelle) return { error: 'Données invalides' }

  // Security: ensure this compte belongs to this cabinet and is NOT standard
  const compte = await prisma.compteComptable.findFirst({
    where: { id, cabinet_id, is_standard: false },
  })
  if (!compte) return { error: 'Compte introuvable ou non modifiable' }

  await prisma.compteComptable.update({
    where: { id },
    data:  { libelle, actif },
  })

  revalidatePath('/dashboard/settings/plan-comptable')
  return { success: true }
}

export async function toggleActifAction(id, actif) {
  const cabinet_id = await getCabinetId()

  const compte = await prisma.compteComptable.findFirst({
    where: { id, cabinet_id, is_standard: false },
  })
  if (!compte) return { error: 'Compte introuvable ou non modifiable' }

  await prisma.compteComptable.update({
    where: { id },
    data:  { actif },
  })

  revalidatePath('/dashboard/settings/plan-comptable')
  return { success: true }
}
