import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import prisma from '@/lib/prisma'

const ACCEPTED_EXTS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']

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

  let formData
  try { formData = await request.formData() }
  catch { return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 }) }

  const file = formData.get('file')
  const dossierId = formData.get('dossier_id') || null

  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  const ext = file.name.split('.').pop().toLowerCase()
  if (!ACCEPTED_EXTS.includes(ext)) {
    return NextResponse.json({
      error: `Format non supporté : ${file.name}. Seuls les PDF et images sont acceptés.`
    }, { status: 400 })
  }

  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true }
  })
  if (!utilisateur?.cabinet_id) {
    return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })
  }

  const cabinet = await prisma.cabinet.findUnique({
    where: { id: utilisateur.cabinet_id }, select: { id: true, credits: true }
  })
  if (!cabinet) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

  if (cabinet.credits < 1) {
    return NextResponse.json({ error: 'Crédits insuffisants. Rechargez votre compte.' }, { status: 400 })
  }

  const defaultClient = await getOrCreateDefaultClient(utilisateur.cabinet_id)

  const uniqueName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${ext}`
  const filePath = `${utilisateur.cabinet_id}/${uniqueName}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(filePath, bytes, { contentType: file.type || 'application/octet-stream' })

  if (uploadError) {
    return NextResponse.json({ error: "Erreur d'upload : " + uploadError.message }, { status: 500 })
  }

  const doc = await prisma.document.create({
    data: {
      client_id: defaultClient.id,
      dossier_id: dossierId,
      nom_fichier: file.name,
      chemin_storage: filePath,
      statut: 'A_EXTRAIRE',
    },
  })

  await prisma.cabinet.update({
    where: { id: cabinet.id },
    data: { credits: { decrement: 1 } },
  })

  return NextResponse.json({
    documentId: doc.id,
    nom_fichier: doc.nom_fichier,
    statut: doc.statut,
    createdAt: doc.createdAt.toISOString(),
  })
}
