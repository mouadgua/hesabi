'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { checkAuthRateLimit, clientIp } from '@/lib/authRateLimit'

export async function sendResetEmail(formData) {
  const email = (formData.get('email') ?? '').trim().toLowerCase()
  if (!email) redirect('/forgot-password?error=' + encodeURIComponent('Email requis.'))

  const headersList = await headers()
  const origin = headersList.get('origin')

  // Serré par adresse (empêche d'inonder la boîte d'un tiers), large par IP
  // pour ne pas bloquer un cabinet entier partageant une seule sortie réseau.
  // La réponse reste identique quoi qu'il arrive : signaler le blocage
  // révélerait l'existence du compte.
  const ip = clientIp(headersList)
  for (const [action, id] of [['passwordReset', `email:${email}`], ['passwordResetIp', `ip:${ip}`]]) {
    const rl = await checkAuthRateLimit(action, id)
    if (!rl.allowed) {
      console.warn(`[resetPassword] Rate limit atteint (${action} ${id})`)
      redirect('/forgot-password?success=1')
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  // Always show success to avoid email enumeration
  if (error) console.error('[resetPassword]', error.message)

  redirect('/forgot-password?success=1')
}
