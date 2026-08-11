import { NextResponse } from 'next/server'
import { getDemoLog, getDemoStats } from '@/lib/rateLimiter'
import { getAICircuitStatus, getAICacheStats } from '@/lib/ai'

export async function GET(request) {
  // Use header instead of query param — secrets in URLs appear in access logs and CDN caches
  const secret = request.headers.get('x-admin-secret')

  if (!secret || secret !== process.env.DEMO_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    demo:    { stats: getDemoStats(), log: getDemoLog() },
    ai:      { circuit: await getAICircuitStatus(), cache: getAICacheStats() },
  })
}
