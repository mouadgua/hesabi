import prisma from '@/lib/prisma'
import RatingsHub from './RatingsHub'

export default async function AdminRatingsPage() {
  const ratings = await prisma.userRating.findMany({
    orderBy: { createdAt: 'desc' },
  })

  const rows = ratings.map(r => ({
    id:        r.id,
    email:     r.email,
    rating:    r.rating,
    comment:   r.comment,
    read:      r.read,
    createdAt: r.createdAt.toISOString(),
  }))

  const total = rows.length
  const avg   = total > 0 ? (rows.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : null
  const dist  = [5, 4, 3, 2, 1].map(n => ({
    star:  n,
    count: rows.filter(r => r.rating === n).length,
  }))

  return <RatingsHub rows={rows} avg={avg ? parseFloat(avg) : null} dist={dist} />
}
