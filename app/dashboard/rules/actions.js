'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function addRuleAction(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("Non autorisé")

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { cabinet_id: true }
  })

  // Récupération des champs du formulaire
  const client_id = formData.get('client_id')
  const mot_cle_fournisseur = formData.get('mot_cle_fournisseur')
  const compte_charge_cible = formData.get('compte_charge_cible')
  const affectation_automatique = formData.get('affectation_automatique') === 'on' // Checkbox

  // Vérification de sécurité : le client appartient-il bien au cabinet de l'utilisateur ?
  const clientDb = await prisma.client.findUnique({
    where: { id: client_id }
  })

  if (!clientDb || clientDb.cabinet_id !== utilisateur.cabinet_id) {
    throw new Error("Action non autorisée sur ce client.")
  }

  // Création de la règle
  await prisma.regleComptable.create({
    data: {
      client_id,
      mot_cle_fournisseur,
      compte_charge_cible,
      affectation_automatique,
    }
  })

  revalidatePath('/dashboard/rules')
}