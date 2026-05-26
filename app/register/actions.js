'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import prisma from '@/lib/prisma'

export async function registerUser(formData) {
  const nom      = (formData.get('nom') ?? '').trim()
  const email    = (formData.get('email') ?? '').trim().toLowerCase()
  const password = (formData.get('password') ?? '').trim()
  const betaKey  = (formData.get('beta_key') ?? '').trim().toUpperCase()

  // ── 1. Validate beta key ───────────────────────────────────────────────────
  if (!betaKey) {
    redirect('/register?error=' + encodeURIComponent("Clé d'accès bêta requise."))
  }

  const keyRecord = await prisma.betaKey.findUnique({ where: { key: betaKey } })

  if (!keyRecord) {
    redirect('/register?error=' + encodeURIComponent("Clé d'accès invalide."))
  }
  if (keyRecord.used) {
    redirect('/register?error=' + encodeURIComponent("Cette clé a déjà été utilisée."))
  }

  // ── 2. Create user via admin API (email auto-confirmed, no verification) ───
  const adminSupabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  const { data: adminData, error: adminError } = await adminSupabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: nom },
  })

  if (adminError) {
    redirect('/register?error=' + encodeURIComponent(adminError.message))
  }

  // ── 3. Mark key as consumed ────────────────────────────────────────────────
  await prisma.betaKey.update({
    where: { key: betaKey },
    data: { used: true, used_by: email, used_at: new Date() },
  })

  // ── 4. Pre-create Utilisateur (cabinet_id set later during onboarding) ────
  // This ensures the user exists in our DB even if they abandon the onboarding tour.
  await prisma.utilisateur.upsert({
    where: { id: adminData.user.id },
    create: {
      id: adminData.user.id,
      email,
      nom,
      role: 'EXPERT_COMPTABLE',
      onboarding_done: false,
    },
    update: {},
  })

  // ── 5. Sign in immediately (no email confirmation needed) ─────────────────
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    redirect('/login?message=' + encodeURIComponent('Compte créé — connectez-vous.'))
  }

  redirect('/onboarding')
}

export async function signUpWithGoogle() {
  const supabase = await createClient()
  const headersList = await headers()
  const origin = headersList.get('origin')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  })

  if (error) redirect('/register?error=' + encodeURIComponent(error.message))
  if (data.url) redirect(data.url)
}
