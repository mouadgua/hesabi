import { NextResponse } from 'next/server'
import { alertStuckDocumentsRecovered } from '@/lib/alerts'
import { reclaimStaleDocuments } from '@/lib/recovery'

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

  // La règle vit dans lib/recovery.js : le répartiteur l'applique aussi, et un
  // seuil qui divergerait entre les deux donnerait des résultats contradictoires.
  const { count, cutoff } = await reclaimStaleDocuments()

  console.log(`[cron/recovery] Recovered ${count} stuck document(s)`)

  // Un ou deux documents, c'est le filet de sécurité qui fait son travail.
  // Un lot signale autre chose : worker interrompu, ou plafond de 90 s atteint.
  alertStuckDocumentsRecovered(count)

  return NextResponse.json({
    recovered: count,
    cutoff:    cutoff.toISOString(),
    ts:        new Date().toISOString(),
  })
}
