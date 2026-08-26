import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/logger'

/**
 * Enregistre la réponse au questionnaire de satisfaction du tableau de bord.
 *
 * Cette route manquait. Le composant QualitySurvey était bien monté dans le
 * layout et la page d'administration lisait la table UserRating, mais rien
 * n'écrivait jamais dedans : le questionnaire ne touchait que localStorage.
 * L'écran d'administration affichait donc « aucun avis » quoi que fassent les
 * utilisateurs, et rien ne permettait de s'en apercevoir.
 *
 * Le questionnaire ne pose qu'une question fermée. La note stockée reflète donc
 * une réponse binaire, pas une appréciation sur cinq niveaux : on n'écrit que
 * les deux extrêmes, et le commentaire dit d'où vient la mesure. Fabriquer une
 * note intermédiaire donnerait une fausse précision à une question qui n'en a pas.
 */
export async function POST(request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    let body
    try { body = await request.json() }
    catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

    if (typeof body?.positive !== 'boolean') {
      return NextResponse.json({ error: 'Réponse manquante' }, { status: 400 })
    }

    // L'identité vient de la session, jamais du corps de la requête : un
    // user_id transmis par le client permettrait d'attribuer un avis à autrui.
    await prisma.userRating.create({
      data: {
        user_id: user.id,
        email:   user.email ?? null,
        rating:  body.positive ? 5 : 1,
        comment: body.positive
          ? 'Questionnaire rapide : ça se passe bien'
          : 'Questionnaire rapide : ça se passe mal — utilisateur orienté vers le support',
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    logger.exception('Enregistrement de l\'avis impossible', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
