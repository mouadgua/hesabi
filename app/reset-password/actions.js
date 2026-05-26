'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function updatePassword(formData) {
  const password = formData.get('password') ?? ''

  if (password.length < 6) {
    redirect('/reset-password?error=' + encodeURIComponent('Le mot de passe doit contenir au moins 6 caractères.'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    redirect('/reset-password?error=' + encodeURIComponent(error.message))
  }

  redirect('/dashboard')
}
