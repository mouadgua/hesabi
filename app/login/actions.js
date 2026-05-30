// app/login/actions.js
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { sanitizeEmail, validatePassword } from '@/lib/sanitize'

export async function login(formData) {
  const supabase = await createClient()

  const email = sanitizeEmail(formData.get('email'))
  const password = formData.get('password')

  if (!email) {
    return redirect('/login?message=' + encodeURIComponent("Adresse email invalide."))
  }

  const pwCheck = validatePassword(password)
  if (!pwCheck.valid) {
    return redirect('/login?message=' + encodeURIComponent(pwCheck.message))
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('[login] Supabase error:', error.message, error.status)
    const msg = error.message?.includes('Email not confirmed')
      ? "Veuillez confirmer votre email avant de vous connecter."
      : `Identifiants incorrects (${error.message})`
    return redirect('/login?message=' + encodeURIComponent(msg))
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}

export async function signInWithGoogle() {
  const supabase = await createClient()
  
  // Récupération dynamique de l'URL racine de ton site
  const headersList = await headers()
  const origin = headersList.get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (data.url) {
    redirect(data.url)
  }
}

export async function logout() {
  const supabase = await createClient() // Correction: ajout du await
  await supabase.auth.signOut()
  redirect('/login')
}