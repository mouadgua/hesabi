import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import DashboardHome from './DashboardHome'

export default async function DashboardHomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div>Non autorisé</div>

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id },
    select: { cabinet_id: true }
  })

  const cabinetId = utilisateur.cabinet_id

  const [totalClients, totalModeles, documentsAVerifier, documentsExtraits, clientsList] = await Promise.all([
    prisma.client.count({ where: { cabinet_id: cabinetId, statut: 'ACTIF' } }),
    prisma.templateExtraction.count({ where: { cabinet_id: cabinetId } }),
    prisma.document.count({ where: { client: { cabinet_id: cabinetId }, statut: 'A_VERIFIER' } }),
    prisma.document.count({ where: { client: { cabinet_id: cabinetId }, statut: 'VALIDE' } }),
    prisma.client.findMany({
      where: { cabinet_id: cabinetId, statut: 'ACTIF' },
      include: { _count: { select: { documents: { where: { statut: 'A_VERIFIER' } } } } },
      orderBy: { createdAt: 'desc' }
    })
  ])

  const clients = clientsList.map(c => ({
    id: c.id,
    nom_entreprise: c.nom_entreprise,
    ice: c.ice,
    pendingDocs: c._count.documents,
    createdAt: c.createdAt.toISOString(),
  }))

  return (
    <DashboardHome
      stats={{ totalClients, totalModeles, documentsAVerifier, documentsExtraits }}
      clients={clients}
    />
  )
}
