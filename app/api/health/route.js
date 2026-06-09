import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  let dbStatus = 'ok'
  let dbMs = null

  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    dbMs = Date.now() - dbStart
  } catch (err) {
    console.error('[health] DB check failed:', err)
    dbStatus = 'error'
  }

  const status = dbStatus === 'ok' ? 'ok' : 'degraded'
  const httpStatus = status === 'ok' ? 200 : 503

  return NextResponse.json(
    {
      status,
      db: dbStatus,
      db_ms: dbMs,
      uptime_ms: Date.now() - start,
      ts: new Date().toISOString(),
    },
    { status: httpStatus }
  )
}
