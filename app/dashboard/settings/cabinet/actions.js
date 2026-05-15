'use server'

import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function updateCabinetAction(formData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error("Non autorisé")

  // Vérification de sécurité des rôles[cite: 4]
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { cabinet_id: true, role: true }
  })

  if (!utilisateur || utilisateur.role !== "EXPERT_COMPTABLE") {
    throw new Error("Seul l'administrateur peut modifier ces paramètres.")
  }

  const nom_cabinet = formData.get('nom_cabinet')
  const logoFile = formData.get('logo') // On récupère le fichier depuis le formulaire[cite: 4]

  let logoUrlToSave = undefined

  // S'il y a un fichier et qu'il n'est pas vide[cite: 4]
  if (logoFile && logoFile.size > 0) {
    const fileExt = logoFile.name.split('.').pop()
    const fileName = `${utilisateur.cabinet_id}-${Date.now()}.${fileExt}`

    // Upload dans le bucket 'logos' de Supabase[cite: 4]
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('logos')
      .upload(fileName, logoFile, { upsert: true })

    if (uploadError) {
      throw new Error("Erreur lors de l'upload de l'image: " + uploadError.message)
    }

    // Récupération de l'URL publique[cite: 4]
    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(fileName)
      
    logoUrlToSave = publicUrl
  }

  // Mise à jour du cabinet dans Prisma avec les nouveaux champs optionnels[cite: 4]
  await prisma.cabinet.update({
    where: { id: utilisateur.cabinet_id },
    data: {
      nom: nom_cabinet,
      ice: formData.get('ice') || null,
      identifiant_fiscal: formData.get('identifiant_fiscal') || null,
      registre_commerce: formData.get('registre_commerce') || null,
      patente: formData.get('patente') || null,
      adresse: formData.get('adresse') || null,
      ville: formData.get('ville') || null,
      code_postal: formData.get('code_postal') || null,
      telephone: formData.get('telephone') || null,
      site_web: formData.get('site_web') || null,
      ...(logoUrlToSave && { logo_url: logoUrlToSave }) // Met à jour l'URL seulement si on a uploadé une image[cite: 4]
    }
  })

  revalidatePath('/dashboard/settings/cabinet')
  revalidatePath('/dashboard') 
}