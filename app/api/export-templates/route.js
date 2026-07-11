import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

const NAME_MAX = 80

async function getAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true }
  })
  return utilisateur?.cabinet_id ? { user, cabinet_id: utilisateur.cabinet_id } : null
}

export async function GET() {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const templates = await prisma.exportTemplate.findMany({
    where:   { cabinet_id: auth.cabinet_id },
    orderBy: { createdAt: 'desc' },
    select:  { id: true, name: true, config: true, createdAt: true },
  })

  return NextResponse.json({ templates })
}

export async function POST(request) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let body
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const name = typeof body.name === 'string' ? body.name.trim().slice(0, NAME_MAX) : ''
  if (!name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const config = (typeof body.config === 'object' && body.config !== null) ? body.config : {}

  const template = await prisma.exportTemplate.create({
    data:   { cabinet_id: auth.cabinet_id, name, config },
    select: { id: true, name: true, config: true, createdAt: true },
  })

  return NextResponse.json({ template }, { status: 201 })
}

export async function DELETE(request) {
  const auth = await getAuth()
  if (!auth) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID manquant' }, { status: 400 })

  const existing = await prisma.exportTemplate.findFirst({
    where: { id, cabinet_id: auth.cabinet_id },
  })
  if (!existing) return NextResponse.json({ error: 'Configuration introuvable' }, { status: 404 })

  await prisma.exportTemplate.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
