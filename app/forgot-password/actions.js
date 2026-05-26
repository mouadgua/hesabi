'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export async function sendResetEmail(formData) {
  const email = (formData.get('email') ?? '').trim().toLowerCase()
  if (!email) redirect('/forgot-password?error=' + encodeURIComponent('Email requis.'))

  const headersList = await headers()
  const origin = headersList.get('origin')

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Always show success to avoid email enumeration
  if (error) console.error('[resetPassword]', error.message)

  redirect('/forgot-password?success=1')
}
