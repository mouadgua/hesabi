import prisma from '@/lib/prisma'
import { getDemoLog } from '@/lib/rateLimiter'
import EmailsHub from './EmailsHub'

export default async function AdminEmailsPage() {
  const [attempts, utilisateurs] = await Promise.all([
    prisma.demoAttempt.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.utilisateur.findMany({ select: { email: true } }),
  ])

  const registeredEmails = new Set(utilisateurs.map(u => u.email.toLowerCase()))

  const byEmail = new Map()
  for (const a of attempts) {
    const key = a.email.toLowerCase()
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        id:             a.id,
        email:          a.email,
        ip_hash:        a.ip_hash,
        demo_completed: a.status === 'SUCCESS',
        converted:      registeredEmails.has(key),
        contacted:      false,
        createdAt:      a.createdAt.toISOString(),
        doc_type:       a.doc_type,
        source:         'db',
      })
    }
  }

  // Merge in-memory log for emails not yet in DB
  const memLog = getDemoLog()
  for (const e of memLog) {
    if (e.status !== 'SUCCESS') continue
    const key = e.email.toLowerCase()
    if (!byEmail.has(key)) {
      byEmail.set(key, {
        id:             `mem_${key}`,
        email:          e.email,
        ip_hash:        null,
        demo_completed: true,
        converted:      registeredEmails.has(key),
        contacted:      false,
        createdAt:      e.ts,
        doc_type:       e.docType,
        source:         'memory',
      })
    }
  }

  const rows = [...byEmail.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  return <EmailsHub initialRows={rows} />
}
