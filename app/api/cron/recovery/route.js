import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// Called every 5 minutes by Vercel Cron (see vercel.json)
// Passes EN_COURS_IA documents stuck for more than 10 minutes back to REJETE
// so users can relaunch the extraction manually.
export const maxDuration = 30

export async function GET(request) {
  // Same secret used by worker-extraction — reuse existing env var
  const workerSecret = process.env.WORKER_SECRET
  if (workerSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${workerSecret}`) {
      // Also accept the Vercel-Cron-Authorization header (Vercel sets it automatically)
      const cronHeader = request.headers.get('x-worker-secret')
      if (cronHeader !== workerSecret) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
      }
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
