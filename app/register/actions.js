'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import prisma from '@/lib/prisma'
import { headers } from 'next/headers'
import { sanitizeName, sanitizeEmail, validatePassword, sanitizeBetaKey } from '@/lib/sanitize'
import { checkAuthRateLimit, clientIp, formatRetryDelay } from '@/lib/authRateLimit'

export async function registerUser(formData) {
  // Limité par IP : sans cela, une clé bêta volée permet d'énumérer les
  // adresses déjà inscrites en boucle via les messages d'erreur.
  const rl = await checkAuthRateLimit('register', `ip:${clientIp(await headers())}`)
  if (!rl.allowed) {
    redirect('/register?error=' + encodeURIComponent(
      `Trop de tentatives d'inscription. Réessayez dans ${formatRetryDelay(rl.retryAfterSec)}.`
    ))
  }

  const nom      = sanitizeName(formData.get('nom') ?? '')
  const email    = sanitizeEmail(formData.get('email') ?? '')
  const password = formData.get('password') ?? ''
  const betaKey  = sanitizeBetaKey(formData.get('beta_key') ?? '')

  if (!nom) {
    redirect('/register?error=' + encodeURIComponent("Nom invalide."))
  }
  if (!email) {
    redirect('/register?error=' + encodeURIComponent("Adresse email invalide."))
  }

  const pwCheck = validatePassword(password)
  if (!pwCheck.valid) {
    redirect('/register?error=' + encodeURIComponent(pwCheck.message))
  }

  // ── 1. Validate beta key ───────────────────────────────────────────────────
  if (!betaKey) {
    redirect('/register?error=' + encodeURIComponent("Clé d'accès bêta requise."))
  }

  const keyRecord = await prisma.betaKey.findUnique({ where: { key: betaKey } })

  if (!keyRecord) {
    redirect('/register?error=' + encodeURIComponent("Clé d'accès invalide."))
  }
  // Le schéma porte is_active, expires_at, max_uses/use_count et email :
  // aucun n'était vérifié, une clé révoquée ou expirée restait utilisable.
  if (!keyRecord.is_active) {
    redirect('/register?error=' + encodeURIComponent("Cette clé a été révoquée."))
  }
  if (keyRecord.expires_at && keyRecord.expires_at < new Date()) {
    redirect('/register?error=' + encodeURIComponent("Cette clé a expiré."))
  }
  // max_uses null = usage unique, régi par le drapeau `used`.
  if (keyRecord.max_uses == null) {
    if (keyRecord.used) {
      redirect('/register?error=' + encodeURIComponent("Cette clé a déjà été utilisée."))
    }
  } else if (keyRecord.use_count >= keyRecord.max_uses) {
    redirect('/register?error=' + encodeURIComponent("Cette clé a atteint sa limite d'utilisations."))
  }
  // Clé nominative : réservée à une adresse précise.
  if (keyRecord.email && keyRecord.email.toLowerCase() !== email) {
    redirect('/register?error=' + encodeURIComponent("Cette clé est réservée à une autre adresse email."))
  }

  // Consommation atomique : le contrôle ci-dessus et la mise à jour finale sont
  // deux requêtes distinctes, donc deux inscriptions simultanées avec la même
  // clé passeraient toutes les deux. On réserve la clé maintenant, en une seule
  // opération conditionnelle — même parade que pour les crédits.
  // Pour une clé à usage unique (max_uses null), le drapeau `used` doit basculer
  // dans CETTE requête. Il ne l'était qu'après la création du compte : la
  // condition `used: false` restait donc vraie entre-temps, et deux inscriptions
  // simultanées avec la même clé passaient toutes les deux. Seul use_count était
  // incrémenté, ce qui ne protégeait rien puisqu'il n'était pas la condition.
  // En l'écrivant ici, la condition s'exclut elle-même : la deuxième requête ne
  // trouve plus de ligne correspondante.
  const claim = await prisma.betaKey.updateMany({
    where: {
      key:       betaKey,
      is_active: true,
      ...(keyRecord.max_uses == null
        ? { used: false }
        : { use_count: { lt: keyRecord.max_uses } }),
    },
    data: keyRecord.max_uses == null
      ? { use_count: { increment: 1 }, used: true }
      : { use_count: { increment: 1 } },
  })
  if (claim.count === 0) {
    redirect('/register?error=' + encodeURIComponent("Cette clé vient d'être utilisée. Demandez-en une nouvelle."))
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
    // La clé a été réservée juste avant : on la relâche, sinon un email déjà
    // pris consommerait définitivement une clé valide.
    // La libération doit annuler exactement ce que la réservation a écrit :
    // sans remettre `used` à false, une clé à usage unique serait définitivement
    // perdue parce qu'une adresse email était déjà prise.
    await prisma.betaKey.updateMany({
      where: { key: betaKey },
      data:  keyRecord.max_uses == null
        ? { use_count: { decrement: 1 }, used: false }
        : { use_count: { decrement: 1 } },
    }).catch(e => console.error('[register] Libération de la clé impossible :', e.message))
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
