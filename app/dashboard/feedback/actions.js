'use server'

import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { sanitizeText } from '@/lib/sanitize'
import { logger } from '@/lib/logger'

const PORTEFEUILLE = ['<20', '20-50', '50-100', '>100']
const RECEPTION    = ['WhatsApp', 'Email', 'Physique', 'Mélange']
const PORTAIL      = ['Oui (portail client)', 'Non (je préfère tout gérer)', 'Ça dépend du client']
const BUDGET       = ['<200 DH', '200-500 DH', '500-1000 DH', '>1000 DH']
const FACTURATION  = ['Abonnement mensuel fixe', 'Par document traité', 'Par client géré', "À l'usage", "N'importe"]
const PAIEMENT     = ['Oui immédiatement', "Oui après 1 mois d'essai", 'Peut-être', 'Non']

/** N'accepte qu'une valeur de la liste — un champ libre déguisé fausserait les comptages. */
const pick = (v, allowed) => (allowed.includes(v) ? v : null)

/** Idem pour les choix multiples, avec dédoublonnage. */
const pickMany = (values, allowed) =>
  [...new Set((Array.isArray(values) ? values : []).filter(v => allowed.includes(v)))]

/** Une échelle hors bornes ne vaut rien : mieux vaut l'absence qu'une valeur fausse. */
const scale = (v, min, max) => {
  const n = Number.parseInt(v, 10)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/**
 * Enregistre un retour de bêta-testeur.
 *
 * L'identité vient de la session, jamais du formulaire : elle sert à recontacter
 * la personne, et un champ transmis par le navigateur permettrait d'attribuer un
 * avis à quelqu'un d'autre.
 *
 * Chaque réponse fermée est validée contre sa liste. Ce questionnaire sert à
 * décider d'un prix : une valeur arbitraire acceptée ici deviendrait une
 * statistique fausse plus tard.
 */
export async function submitBetaFeedback(payload) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Non autorisé' }

    const nom = sanitizeText(payload?.nom_complet ?? '', 120)
    if (!nom) return { ok: false, error: 'Le nom complet est requis.' }

    const portefeuille = pick(payload?.portefeuille, PORTEFEUILLE)
    if (!portefeuille) return { ok: false, error: 'La taille du portefeuille est requise.' }

    await prisma.betaFeedback.create({
      data: {
        user_id: user.id,
        email:   user.email ?? null,

        nom_complet:     nom,
        cabinet_nom:     sanitizeText(payload?.cabinet_nom ?? '', 120) || null,
        portefeuille,
        logiciel_actuel: sanitizeText(payload?.logiciel_actuel ?? '', 120) || null,

        reception:       pickMany(payload?.reception, RECEPTION),
        heures_saisie:   scale(payload?.heures_saisie, 1, 11),
        pire_experience: sanitizeText(payload?.pire_experience ?? '', 2000) || null,

        nps:          scale(payload?.nps, 0, 5),
        precision_ia: scale(payload?.precision_ia, 1, 5),
        review_room:  scale(payload?.review_room, 1, 5),
        surprise:     sanitizeText(payload?.surprise ?? '', 2000) || null,
        bugs:         sanitizeText(payload?.bugs ?? '', 2000) || null,

        portail_client:     pick(payload?.portail_client, PORTAIL),
        budget_mensuel:     pick(payload?.budget_mensuel, BUDGET),
        modele_facturation: pickMany(payload?.modele_facturation, FACTURATION),
        pret_a_payer:       pick(payload?.pret_a_payer, PAIEMENT),
        autres_cabinets:    sanitizeText(payload?.autres_cabinets ?? '', 500) || null,
      },
    })

    return { ok: true }
  } catch (err) {
    logger.exception('Enregistrement du retour bêta impossible', err)
    return { ok: false, error: 'Erreur serveur. Réessayez dans un instant.' }
  }
}

// Note : les listes ci-dessus ne sont pas exportées. Un fichier « use server »
// ne peut exposer que des fonctions asynchrones — exporter un objet casse le
// module entier au chargement, et l'erreur ne survient qu'à l'appel. Le
// composant déclare les mêmes listes de son côté ; la validation serveur reste
// l'autorité, l'affichage n'en est que le reflet.
