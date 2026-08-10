import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Called every 5 minutes by Vercel Cron (see vercel.json)
// Passes EN_COURS_IA documents stuck for more than 10 minutes back to REJETE
// so users can relaunch the extraction manually.
export const maxDuration = 30

export async function GET(request) {
  // Same secret used by worker-extraction — reuse existing env var.
  // A missing secret must never mean "no check": this route can flip every
  // in-flight document to REJETE, so it refuses to run rather than run open.
  const workerSecret = process.env.WORKER_SECRET
  if (!workerSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron/recovery] WORKER_SECRET not set — refusing all requests in production')
      return NextResponse.json({ error: 'Cron non configuré' }, { status: 503 })
    }
    console.warn('[cron/recovery] WORKER_SECRET not set — unauthenticated access allowed in dev only')
  } else {
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; manual calls may
    // use `x-worker-secret` instead.
    const bearer = request.headers.get('authorization')
    const custom = request.headers.get('x-worker-secret')
    if (bearer !== `Bearer ${workerSecret}` && custom !== workerSecret) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }
  }

  const cutoff = new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago

  const result = await prisma.document.updateMany({
    where: {
      statut:    'EN_COURS_IA',
      updatedAt: { lt: cutoff },
    },
    data: {
      statut:        'REJETE',
      error_message: "Timeout serveur — relancez l'extraction.",
    },
  })

  console.log(`[cron/recovery] Recovered ${result.count} stuck document(s)`)

  return NextResponse.json({
    recovered: result.count,
    cutoff:    cutoff.toISOString(),
    ts:        new Date().toISOString(),
  })
}
