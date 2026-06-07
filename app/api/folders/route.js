import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'
import { sanitizeText } from '@/lib/sanitize'

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

  let body
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Corps invalide' }, { status: 400 }) }

  // ── Sanitize name ─────────────────────────────────────────────────────────
  const name = sanitizeText(body.name, 100)
  if (!name) return NextResponse.json({ error: 'Nom manquant ou invalide' }, { status: 400 })

  // ── Sanitize parent_id — UUID format only ─────────────────────────────────
  const rawParentId = body.parent_id
  const parentId = typeof rawParentId === 'string' && /^[0-9a-f-]{36}$/.test(rawParentId)
    ? rawParentId : null

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true }
  })
  if (!utilisateur?.cabinet_id) {
    return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })
  }

  // ── If parent_id provided, verify it belongs to this cabinet ─────────────
  if (parentId) {
    const parentDossier = await prisma.dossier.findFirst({
      where: { id: parentId, client: { cabinet_id: utilisateur.cabinet_id } }
    })
    if (!parentDossier) {
      return NextResponse.json({ error: 'Dossier parent invalide' }, { status: 400 })
    }
  }

  const defaultClient = await getOrCreateDefaultClient(utilisateur.cabinet_id)

  const existing = await prisma.dossier.findFirst({
    where: { client_id: defaultClient.id, nom: name, parent_id: parentId },
  })
  if (existing) return NextResponse.json({ dossierId: existing.id })

  const dossier = await prisma.dossier.create({
    data: { nom: name, client_id: defaultClient.id, parent_id: parentId },
  })

  return NextResponse.json({ dossierId: dossier.id })
}
