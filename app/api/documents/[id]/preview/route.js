import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

/**
 * Lien d'aperçu temporaire pour un document.
 *
 * Le bucket est privé : c'est voulu, une facture ne doit pas être lisible par
 * quiconque devine son URL. L'aperçu passe donc par un lien signé, généré ici
 * après vérification que le document appartient bien au cabinet de la session.
 *
 * Le contrôle porte sur la relation, pas sur l'identifiant seul :
 * `client.cabinet_id` remonte jusqu'au cabinet, et un identifiant deviné qui
 * appartient à un autre cabinet ne renvoie rien. Sans cette jointure, connaître
 * un identifiant suffirait à lire la facture d'un concurrent.
 *
 * La durée de validité est courte — le lien sert à afficher une page, pas à
 * être partagé.
 */
const SIGNED_URL_TTL_SEC = 5 * 60

export async function GET(request, { params }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where:  { id: user.id },
      select: { cabinet_id: true },
    })
    if (!utilisateur?.cabinet_id) {
      return NextResponse.json({ error: 'Aucun cabinet associé' }, { status: 403 })
    }

    // La condition sur cabinet_id fait partie de la recherche, pas d'un contrôle
    // effectué après coup : un document d'un autre cabinet est introuvable, il
    // n'est pas « trouvé puis refusé ».
    const doc = await prisma.document.findFirst({
      where: { id, client: { cabinet_id: utilisateur.cabinet_id } },
      select: { id: true, nom_fichier: true, chemin_storage: true, statut: true },
    })
    if (!doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    if (!doc.chemin_storage) {
      return NextResponse.json({ error: 'Aucun fichier associé' }, { status: 404 })
    }

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )
    const { data, error } = await service.storage
      .from('documents')
      .createSignedUrl(doc.chemin_storage, SIGNED_URL_TTL_SEC)

    if (error || !data?.signedUrl) {
      logger.warn('Lien d\'aperçu impossible à générer', { documentId: id, raison: error?.message })
      return NextResponse.json({ error: 'Fichier indisponible' }, { status: 502 })
    }

    const ext  = (doc.nom_fichier?.split('.').pop() ?? '').toLowerCase()
    const kind = ext === 'pdf' ? 'pdf' : 'image'

    return NextResponse.json({
      url:       data.signedUrl,
      kind,
      filename:  doc.nom_fichier,
      statut:    doc.statut,
      expiresIn: SIGNED_URL_TTL_SEC,
    })
  } catch (err) {
    logger.exception('Aperçu de document en échec', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
