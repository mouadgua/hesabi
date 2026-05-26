import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import DashboardHome from './DashboardHome'

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // On récupère le cabinet_id de l'utilisateur
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { cabinet_id: true },
  })
  const cabinetId = utilisateur.cabinet_id

  // On fetch toutes les stats en parallèle pour la performance
  const [totalDocs, validatedDocs, pendingDocs, totalModeles, recentRaw] = await Promise.all([
    prisma.document.count({
      where: { client: { cabinet_id: cabinetId } },
    }),
    prisma.document.count({
      where: { client: { cabinet_id: cabinetId }, statut: 'VALIDE' },
    }),
    prisma.document.count({
      where: { client: { cabinet_id: cabinetId }, statut: 'A_VERIFIER' },
    }),
    prisma.templateExtraction.count({
      where: { cabinet_id: cabinetId },
    }),
    prisma.document.findMany({
      where: { client: { cabinet_id: cabinetId } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        nom_fichier: true,
        statut: true,
        document_type: true,
        createdAt: true,
        client: { select: { nom_entreprise: true } },
      },
    }),
  ])

  const firstName = (user.user_metadata?.full_name || user.email || 'Utilisateur')
    .split(' ')[0]

  // Mapping des documents pour le client component
  const recentDocs = recentRaw.map((d) => ({
    id: d.id,
    nom_fichier: d.nom_fichier ?? null,
    statut: d.statut,
    document_type: d.document_type ?? null,
    clientName: d.client?.nom_entreprise ?? null,
    createdAt: d.createdAt.toISOString(),
  }))

  return (
    <DashboardHome
      firstName={firstName}
      stats={{ totalDocs, validatedDocs, pendingDocs, totalModeles }}
      recentDocs={recentDocs}
    />
  )
}