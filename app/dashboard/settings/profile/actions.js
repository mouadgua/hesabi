'use server'

import { createClient } from '@/utils/supabase/server'
import { headers } from 'next/headers'
import { sanitizeName, validatePassword } from '@/lib/sanitize'
import { checkAuthRateLimit, clientIp, formatRetryDelay } from '@/lib/authRateLimit'
import { logger } from '@/lib/logger'

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

/**
 * Change le mot de passe depuis l'espace connecté.
 *
 * Il n'existait aucun moyen de le faire sans se déconnecter et passer par
 * « mot de passe oublié » — donc sans attendre un email, sur un chemin dont on
 * vient de découvrir qu'il était cassé.
 *
 * Le mot de passe actuel est exigé, alors que Supabase ne le demande pas : une
 * session valide lui suffit. Sans cette vérification, quiconque trouve un poste
 * resté ouvert peut changer le mot de passe et verrouiller le titulaire hors de
 * son propre compte. La contrainte est faible pour l'utilisateur légitime, et
 * décisive pour l'autre.
 *
 * Les erreurs sont RENVOYÉES, jamais levées. Le message d'une exception dans
 * une Server Action n'atteint pas le navigateur en production : Next le
 * remplace par un texte générique pour ne pas divulguer de détails serveur.
 * En levant, les refus s'inscrivaient bien dans les journaux — vérifié — mais
 * l'utilisateur voyait un formulaire qui ne réagissait pas.
 */
export async function changePasswordAction(formData) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user?.email) return { ok: false, error: 'Non autorisé' }

  const actuel = formData.get('currentPassword') ?? ''
  const nouveau = formData.get('newPassword') ?? ''
  const confirmation = formData.get('confirmPassword') ?? ''

  if (!actuel) return { ok: false, error: 'Saisissez votre mot de passe actuel.' }
  if (nouveau !== confirmation) return { ok: false, error: 'Les deux mots de passe ne correspondent pas.' }
  if (nouveau === actuel) return { ok: false, error: 'Le nouveau mot de passe doit être différent de l\'actuel.' }

  const check = validatePassword(nouveau)
  if (!check.valid) return { ok: false, error: check.message }

  // Limité comme une connexion : cette action éprouve un mot de passe, elle
  // offrirait sinon un oracle pour le deviner à l'abri des limites du login.
  const rl = await checkAuthRateLimit('login', `pwchange:${user.email}`)
  if (!rl.allowed) {
    return { ok: false, error: `Trop de tentatives. Réessayez dans ${formatRetryDelay(rl.retryAfterSec)}.` }
  }

  // Vérification du mot de passe actuel. signInWithPassword renouvelle la
  // session en cas de succès, ce qui est sans conséquence ici : c'est le même
  // utilisateur, sur le même appareil.
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: actuel,
  })
  if (authError) {
    logger.warn('Changement de mot de passe refusé — mot de passe actuel invalide', {
      ip: clientIp(await headers()),
    })
    return { ok: false, error: 'Mot de passe actuel incorrect.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: nouveau })
  if (updateError) {
    logger.exception('Changement de mot de passe impossible', updateError)
    return { ok: false, error: 'Erreur lors du changement de mot de passe.' }
  }

  return { ok: true }
}
