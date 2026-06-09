import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin-auth'

export async function PATCH(request, { params }) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  const { read } = await request.json()

  await prisma.userRating.update({
    where: { id },
    data:  { read: Boolean(read) },
  })

  return NextResponse.json({ ok: true })
}
