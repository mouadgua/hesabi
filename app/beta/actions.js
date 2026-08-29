'use server'

import { headers } from 'next/headers'
import prisma from '@/lib/prisma'
import { sanitizeText, sanitizeEmail } from '@/lib/sanitize'
import { checkAuthRateLimit, clientIp, formatRetryDelay } from '@/lib/authRateLimit'
import { logger } from '@/lib/logger'

const PORTEFEUILLE = ['<20', '20-50', '50-100', '>100']
const RECEPTION    = ['WhatsApp', 'Email', 'Physique', 'Mélange']
const PORTAIL      = ['Oui (portail client)', 'Non (je préfère tout gérer)', 'Ça dépend du client']
const BUDGET       = ['<200 DH', '200-500 DH', '500-1000 DH', '>1000 DH']
const FACTURATION  = ['Abonnement mensuel fixe', 'Par document traité', 'Par client géré', "À l'usage", "N'importe"]
const PAIEMENT     = ['Oui immédiatement', "Oui après 1 mois d'essai", 'Peut-être', 'Non']

const pick     = (v, a) => (a.includes(v) ? v : null)
const pickMany = (vs, a) => [...new Set((Array.isArray(vs) ? vs : []).filter(v => a.includes(v)))]
const scale    = (v, min, max) => {
  const n = Number.parseInt(v, 10)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/**
 * Demande d'accès bêta déposée depuis le site public, sans compte.
 *
 * Le pendant connecté (submitBetaFeedback) tient son identité de la session.
 * Ici il n'y en a pas : n'importe qui peut appeler cette action, et l'email
 * n'est qu'une chaîne fournie par le visiteur. Deux conséquences assumées —
 * une limite par adresse IP, sans quoi la table se remplirait au rythme d'un
 * script ; et aucune confiance accordée à cet email, qui sert à recontacter et
 * jamais à identifier ou à donner un droit.
 *
 * user_id reste nul : c'est ce qui distingue une demande d'accès d'un retour
 * d'utilisateur, sans avoir besoin d'une seconde table.
 */
export async function submitBetaRequest(payload) {
  try {
    const ip = clientIp(await headers())
    const rl = await checkAuthRateLimit('beta_request', `ip:${ip}`)
    if (!rl.allowed) {
      return { ok: false, error: `Trop de demandes. Réessayez dans ${formatRetryDelay(rl.retryAfterSec)}.` }
    }

    const nom = sanitizeText(payload?.nom_complet ?? '', 120)
    if (!nom) return { ok: false, error: 'Le nom complet est requis.' }

    const email = sanitizeEmail(payload?.email ?? '')
    if (!email) return { ok: false, error: 'Une adresse email valide est requise.' }

    const portefeuille = pick(payload?.portefeuille, PORTEFEUILLE)
    if (!portefeuille) return { ok: false, error: 'La taille du portefeuille est requise.' }

    await prisma.betaFeedback.create({
      data: {
        user_id: null,          // demande d'accès, pas retour d'un compte existant
        email,

        nom_complet:     nom,
        cabinet_nom:     sanitizeText(payload?.cabinet_nom ?? '', 120) || null,
        portefeuille,
        logiciel_actuel: sanitizeText(payload?.logiciel_actuel ?? '', 120) || null,

        reception:       pickMany(payload?.reception, RECEPTION),
        heures_saisie:   scale(payload?.heures_saisie, 1, 11),
        pire_experience: sanitizeText(payload?.pire_experience ?? '', 2000) || null,

        // Les questions sur le produit ne sont pas posées ici : noter la
        // précision d'une IA qu'on n'a jamais vue ne produirait que du bruit
        // dans les moyennes.

        portail_client:     pick(payload?.portail_client, PORTAIL),
        budget_mensuel:     pick(payload?.budget_mensuel, BUDGET),
        modele_facturation: pickMany(payload?.modele_facturation, FACTURATION),
        pret_a_payer:       pick(payload?.pret_a_payer, PAIEMENT),
        autres_cabinets:    sanitizeText(payload?.autres_cabinets ?? '', 500) || null,
      },
    })

    return { ok: true }
  } catch (err) {
    logger.exception('Demande d\'accès bêta impossible à enregistrer', err)
    return { ok: false, error: 'Erreur serveur. Réessayez dans un instant.' }
  }
}
