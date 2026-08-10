// app/login/actions.js
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { sanitizeEmail, validatePassword } from '@/lib/sanitize'
import { checkAuthRateLimit, resetAuthRateLimit, clientIp, formatRetryDelay } from '@/lib/authRateLimit'

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

  // Budget serré par compte (c'est lui qui arrête le brute force) et large
  // par IP (un cabinet entier partage une seule IP de bureau : le verrouiller
  // sur quelques fautes de frappe d'un employé serait un déni de service).
  const ip = clientIp(await headers())
  const checks = [
    ['login',   `email:${email}`],
    ['loginIp', `ip:${ip}`],
  ]
  for (const [action, id] of checks) {
    const rl = await checkAuthRateLimit(action, id)
    if (!rl.allowed) {
      console.warn(`[login] Rate limit atteint (${action} ${id})`)
      return redirect('/login?message=' + encodeURIComponent(
        `Trop de tentatives de connexion. Réessayez dans ${formatRetryDelay(rl.retryAfterSec)}.`
      ))
    }
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('[login] Supabase error:', error.message, error.status)
    let msg
    if (error.status >= 500 || error.status === 521 || !error.message) {
      msg = "Le service est temporairement indisponible. Réessayez dans quelques instants."
    } else if (error.message.includes('Email not confirmed')) {
      msg = "Veuillez confirmer votre email avant de vous connecter."
    } else if (error.message.includes('Invalid login') || error.message.includes('invalid_credentials')) {
      msg = "Email ou mot de passe incorrect."
    } else {
      msg = `Connexion impossible : ${error.message}`
    }
    return redirect('/login?message=' + encodeURIComponent(msg))
  }

  // Connexion réussie : on efface les compteurs, seuls les échecs doivent
  // s'accumuler. Sans cela, deux fautes de frappe suivies d'une réussite
  // continueraient de consommer le budget pendant tout le reste de la fenêtre.
  await Promise.all([
    resetAuthRateLimit('login',   `email:${email}`),
    resetAuthRateLimit('loginIp', `ip:${ip}`),
  ])

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