import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import ExtractionHub from './ExtractionHub'

const UUID_RE = /^[0-9a-f-]{36}$/

export default async function ExtractionPage({ searchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { cabinet_id: true },
  })
  if (!utilisateur?.cabinet_id) redirect('/onboarding')

  const params = await searchParams
  const activeClientId =
    typeof params?.client === 'string' && UUID_RE.test(params.client)
      ? params.client
      : null

  const VALID_STATUTS = new Set(['A_EXTRAIRE', 'EN_COURS_IA', 'A_VERIFIER', 'VALIDE', 'REJETE'])
  const VALID_TYPES   = new Set(['facture', 'releve_bancaire', 'bon_commande', 'recu', 'autre'])

  const initialSearch = typeof params?.q === 'string' ? params.q.slice(0, 200) : ''
  const initialStatut = VALID_STATUTS.has(params?.statut) ? params.statut : ''
  const initialType   = VALID_TYPES.has(params?.type)     ? params.type   : ''

  const [templates, cabinet, rawDocs, activeClient, dossiers] = await Promise.all([
    prisma.templateExtraction.findMany({
      where: { cabinet_id: utilisateur.cabinet_id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nom_modele: true },
    }),
    prisma.cabinet.findUnique({
      where: { id: utilisateur.cabinet_id },
      select: { credits: true },
    }),
    prisma.document.findMany({
      where: {
        client: { cabinet_id: utilisateur.cabinet_id },
        ...(activeClientId ? { client_id: activeClientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { dossier: { select: { nom: true } } },
    }),
    activeClientId
      ? prisma.client.findFirst({
          where: { id: activeClientId, cabinet_id: utilisateur.cabinet_id },
          select: { id: true, nom_entreprise: true },
        })
      : null,
    // Arborescence des dossiers du cabinet. Chargée entière plutôt que niveau
    // par niveau : un cabinet en compte quelques dizaines, et la parcourir
    // côté navigateur évite un aller-retour à chaque ouverture de dossier.
    prisma.dossier.findMany({
      where: {
        client: { cabinet_id: utilisateur.cabinet_id },
        ...(activeClientId ? { client_id: activeClientId } : {}),
      },
      select: { id: true, nom: true, parent_id: true, client_id: true },
      orderBy: { nom: 'asc' },
    }),
  ])

  const documents = rawDocs.map(d => ({
    id:            d.id,
    nom_fichier:   d.nom_fichier ?? null,
    statut:        d.statut,
    document_type: d.document_type ?? null,
    confidence:    d.document_type_confidence ?? null,
    fournisseur:   d.fournisseur_detecte ?? null,
    dossier_id:    d.dossier_id ?? null,
    dossier_nom:   d.dossier?.nom ?? null,
    error_message: d.error_message ?? null,
    createdAt:     d.createdAt.toISOString(),
  }))

  return (
    <ExtractionHub
      initialDocuments={documents}
      dossiers={dossiers}
      templates={templates}
      credits={cabinet?.credits ?? 0}
      activeClient={activeClient ? { id: activeClient.id, nom: activeClient.nom_entreprise } : null}
      initialSearch={initialSearch}
      initialStatut={initialStatut}
      initialType={initialType}
    />
  )
}
