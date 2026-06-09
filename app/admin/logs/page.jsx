import prisma from '@/lib/prisma'
import LogsHub from './LogsHub'

export default async function AdminLogsPage() {
  const logs = await prisma.adminLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  const rows = logs.map(l => ({
    id:        l.id,
    action:    l.action,
    entity:    l.entity,
    entity_id: l.entity_id,
    details:   l.details,
    ip:        l.ip,
    createdAt: l.createdAt.toISOString(),
  }))

  return <LogsHub rows={rows} />
}
