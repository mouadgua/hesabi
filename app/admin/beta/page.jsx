import prisma from '@/lib/prisma'
import BetaHub from './BetaHub'

export default async function AdminBetaPage() {
  const [keys, totalCabinets] = await Promise.all([
    prisma.betaKey.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.cabinet.count(),
  ])

  const lastCreditsLog = await prisma.adminLog.findFirst({
    where: { action: 'UPDATE_DEFAULT_CREDITS' },
    orderBy: { createdAt: 'desc' },
  })
  const defaultCredits = (lastCreditsLog?.details?.default_credits) ?? 15

  const rows = keys.map(k => ({
    id:         k.id,
    key:        k.key,
    email:      k.email,
    note:       k.note,
    used:       k.used,
    used_by:    k.used_by,
    used_at:    k.used_at?.toISOString() ?? null,
    expires_at: k.expires_at?.toISOString() ?? null,
    max_uses:   k.max_uses,
    use_count:  k.use_count,
    credits:    k.credits,
    is_active:  k.is_active,
    createdAt:  k.createdAt.toISOString(),
  }))

  return <BetaHub initialKeys={rows} totalCabinets={totalCabinets} defaultCredits={defaultCredits} />
}
