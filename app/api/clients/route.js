import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { sanitizeText } from '@/lib/sanitize'

const UUID_RE = /^[0-9a-f-]{36}$/

async function getCabinetId(user) {
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true },
  })
  return utilisateur?.cabinet_id ?? null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const cabinetId = await getCabinetId(user)
  if (!cabinetId) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

  const clients = await prisma.client.findMany({
    where: { cabinet_id: cabinetId, nom_entreprise: { not: '_default' } },
    orderBy: { nom_entreprise: 'asc' },
    select: {
      id: true,
      nom_entreprise: true,
      _count: {
        select: {
          documents: { where: { statut: { in: ['A_VERIFIER', 'REJETE'] } } },
        },
      },
    },
  })

  return NextResponse.json({
    clients: clients.map(c => ({
      id:      c.id,
      nom:     c.nom_entreprise,
      pending: c._count.documents,
    })),
  })
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let body
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const nom = sanitizeText(body.nom, 100)
  if (!nom) return NextResponse.json({ error: 'Nom manquant' }, { status: 400 })
  if (nom === '_default') return NextResponse.json({ error: 'Nom réservé' }, { status: 400 })

  const cabinetId = await getCabinetId(user)
  if (!cabinetId) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

  const client = await prisma.client.create({
    data: { cabinet_id: cabinetId, nom_entreprise: nom, statut: 'ACTIF' },
    select: { id: true, nom_entreprise: true },
  })

  return NextResponse.json({ client: { id: client.id, nom: client.nom_entreprise, pending: 0 } }, { status: 201 })
}

export async function PATCH(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  let body
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  const id = typeof body.id === 'string' && UUID_RE.test(body.id) ? body.id : null
  if (!id) return NextResponse.json({ error: 'ID invalide' }, { status: 400 })

  const nom = sanitizeText(body.nom, 100)
  if (!nom) return NextResponse.json({ error: 'Nom manquant' }, { status: 400 })
  if (nom === '_default') return NextResponse.json({ error: 'Nom réservé' }, { status: 400 })

  const cabinetId = await getCabinetId(user)
  if (!cabinetId) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

  const existing = await prisma.client.findFirst({
    where: { id, cabinet_id: cabinetId },
  })
  if (!existing) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  await prisma.client.update({ where: { id }, data: { nom_entreprise: nom } })

  return NextResponse.json({ success: true })
}

export async function DELETE(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  const cabinetId = await getCabinetId(user)
  if (!cabinetId) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

  const existing = await prisma.client.findFirst({
    where: { id, cabinet_id: cabinetId, nom_entreprise: { not: '_default' } },
  })
  if (!existing) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  await prisma.client.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
