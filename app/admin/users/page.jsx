import prisma from '@/lib/prisma'
import UsersHub from './UsersHub'

export default async function AdminUsersPage() {

  const cabinets = await prisma.cabinet.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      utilisateurs: {
        select: {
          id: true, email: true, nom: true,
          role: true, createdAt: true, last_active_at: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  // Extraction count per cabinet via raw SQL
  const extractionRows = await prisma.$queryRaw`
    SELECT c.cabinet_id, COUNT(d.id)::int AS cnt
    FROM "Client" c
    LEFT JOIN "Document" d ON d.client_id = c.id
      AND d.statut IN ('A_VERIFIER','VALIDE','REJETE')
    GROUP BY c.cabinet_id
  `

  const extractionByCabinet = {}
  for (const row of extractionRows) {
    extractionByCabinet[row.cabinet_id] = Number(row.cnt)
  }

  const data = cabinets.map(cab => {
    const mainUser = cab.utilisateurs[0] ?? null
    return {
      id:             cab.id,
      nom:            cab.nom,
      email:          mainUser?.email          ?? '—',
      nom_user:       mainUser?.nom            ?? '—',
      plan:           cab.plan_abonnement,
      plan_status:    cab.plan_status,
      credits:        cab.credits,
      credits_limit:  cab.credits_limit,
      suspended:      cab.suspended,
      suspend_reason: cab.suspend_reason       ?? null,
      createdAt:      cab.createdAt.toISOString(),
      last_active:    mainUser?.last_active_at?.toISOString() ?? null,
      total_extractions: extractionByCabinet[cab.id] ?? 0,
      user_count:     cab.utilisateurs.length,
      utilisateurs:   cab.utilisateurs.map(u => ({
        id: u.id, email: u.email, nom: u.nom, role: u.role,
        createdAt: u.createdAt.toISOString(),
        last_active_at: u.last_active_at?.toISOString() ?? null,
      })),
    }
  })

  return <UsersHub initialData={data} />
}
