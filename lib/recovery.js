/**
 * lib/recovery.js — Rattrapage des documents restés en cours d'extraction
 *
 * Un document passe en EN_COURS_IA au moment où un répartiteur le réserve. Si
 * cette invocation meurt avant d'écrire son résultat — plafond de durée atteint,
 * fonction interrompue, panne réseau — le document reste dans cet état sans que
 * personne ne le reprenne. L'utilisateur voit « en cours » indéfiniment.
 *
 * Cette règle est appelée de deux endroits, et c'est délibéré :
 *
 *   1. le cron quotidien, comme filet en cas d'inactivité totale ;
 *   2. le répartiteur lui-même, au début de chaque exécution.
 *
 * Le second point est ce qui rend le rattrapage réactif. Le cron ne peut plus
 * tourner que toutes les 24 h sur le plan actuel de l'hébergeur, alors que le
 * répartiteur s'exécute à chaque mise en file : en pratique, un document bloqué
 * est donc repéré au prochain upload plutôt qu'au prochain jour.
 *
 * La logique vit ici plutôt qu'en double aux deux endroits : un seuil qui
 * divergerait entre les deux produirait des comportements contradictoires selon
 * qui passe en premier.
 */

import prisma from '@/lib/prisma'

// Au-delà de cette durée sans mise à jour, une extraction est considérée perdue.
// Nettement au-dessus du budget d'un lot (60 s) pour ne jamais couper un
// traitement encore vivant.
const STALE_AFTER_MS = 10 * 60 * 1000

/**
 * Repasse en REJETE les extractions restées trop longtemps sans progresser.
 *
 * Le document n'est pas remis en file automatiquement : sans compteur de
 * tentatives, un document qui échoue systématiquement repartirait en boucle et
 * consommerait le budget des autres. L'utilisateur relance explicitement.
 *
 * @returns {Promise<{ count: number, cutoff: Date }>}
 */
export async function reclaimStaleDocuments() {
  const cutoff = new Date(Date.now() - STALE_AFTER_MS)

  const { count } = await prisma.document.updateMany({
    where: {
      statut:    'EN_COURS_IA',
      updatedAt: { lt: cutoff },
    },
    data: {
      statut:        'REJETE',
      error_message: "Timeout serveur — relancez l'extraction.",
    },
  })

  return { count, cutoff }
}
