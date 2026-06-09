'use server'

import { createClient } from '@/utils/supabase/server'
import { sanitizeName } from '@/lib/sanitize'

export async function updateProfileAction(formData) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Non autorisé')

  const fullName = sanitizeName(formData.get('fullName') || '', 100)
  if (!fullName) throw new Error('Nom invalide')

  const { error: updateError } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  })

  if (updateError) throw new Error('Erreur lors de la mise à jour du profil')
}
