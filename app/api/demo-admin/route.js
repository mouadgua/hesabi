import { NextResponse } from 'next/server'
import { getDemoLog, getDemoStats } from '@/lib/rateLimiter'
import { getAICircuitStatus, getAICacheStats } from '@/lib/ai'

export async function GET(request) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (!secret || secret !== process.env.DEMO_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    demo:    { stats: getDemoStats(), log: getDemoLog() },
    ai:      { circuit: getAICircuitStatus(), cache: getAICacheStats() },
  })
}
