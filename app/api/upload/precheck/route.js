import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

// Read-only check — no decrement here. The atomic updateMany in /api/upload
// remains the single source of truth for credit deduction; this route only
// lets the UI warn the user before a batch starts.
export async function GET(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const count = parseInt(searchParams.get('count') ?? '0', 10)
  if (!Number.isFinite(count) || count < 0) {
    return NextResponse.json({ error: 'count invalide' }, { status: 400 })
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true }
  })
  if (!utilisateur?.cabinet_id) {
    return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })
  }

  const cabinet = await prisma.cabinet.findUnique({
    where: { id: utilisateur.cabinet_id }, select: { credits: true }
  })
  if (!cabinet) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

  return NextResponse.json({
    credits:    cabinet.credits,
    requested:  count,
    sufficient: cabinet.credits >= count,
  })
}
