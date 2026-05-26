import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

async function getOrCreateDefaultClient(cabinetId) {
  const existing = await prisma.client.findFirst({
    where: { cabinet_id: cabinetId, nom_entreprise: '_default' },
  })
  if (existing) return existing
  return prisma.client.create({
    data: { cabinet_id: cabinetId, nom_entreprise: '_default', statut: 'ACTIF' },
  })
}

export async function POST(request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { name, parent_id } = await request.json()
  if (!name) return NextResponse.json({ error: 'Nom manquant' }, { status: 400 })

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true }
  })
  if (!utilisateur?.cabinet_id) {
    return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })
  }

  const defaultClient = await getOrCreateDefaultClient(utilisateur.cabinet_id)

  const existing = await prisma.dossier.findFirst({
    where: { client_id: defaultClient.id, nom: name, parent_id: parent_id ?? null },
  })
  if (existing) return NextResponse.json({ dossierId: existing.id })

  const dossier = await prisma.dossier.create({
    data: { nom: name, client_id: defaultClient.id, parent_id: parent_id ?? null },
  })

  return NextResponse.json({ dossierId: dossier.id })
}
