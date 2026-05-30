import { NextResponse } from 'next/server'
import { getDemoLog, getDemoStats } from '@/lib/rateLimiter'

export async function GET(request) {
  const secret = request.nextUrl.searchParams.get('secret')

  if (!secret || secret !== process.env.DEMO_ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = getDemoStats()
  const log = getDemoLog()

  return NextResponse.json({ stats, log })
}
