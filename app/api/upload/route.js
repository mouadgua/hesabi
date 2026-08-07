import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import prisma from '@/lib/prisma'
import { validateFileBytes, validateFileIntegrity } from '@/lib/sanitize'

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const ACCEPTED_EXTS  = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']
const ACCEPT_MIMES   = new Set(['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB server-side hard limit

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

  const file      = formData.get('file')
  const dossierId = formData.get('dossier_id') || null
  const clientId  = formData.get('client_id')  || null

  if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

  // ── Extension check ───────────────────────────────────────────────────────
  const ext = file.name.split('.').pop().toLowerCase()
  if (!ACCEPTED_EXTS.includes(ext)) {
    return NextResponse.json({
      error: `Format non supporté : ${file.name}. Seuls les PDF et images sont acceptés.`,
    }, { status: 400 })
  }

  // ── Server-side size check ────────────────────────────────────────────────
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo).' }, { status: 400 })
  }

  // ── MIME type check ───────────────────────────────────────────────────────
  if (!ACCEPT_MIMES.has(file.type)) {
    return NextResponse.json({ error: 'Type MIME non supporté.' }, { status: 400 })
  }

  // ── Magic bytes check — prevents disguised files ──────────────────────────
  const bytes  = Buffer.from(await file.arrayBuffer())
  const base64 = bytes.toString('base64')
  const bytesCheck = validateFileBytes(file.type, base64)
  if (!bytesCheck.valid) {
    return NextResponse.json({ error: bytesCheck.error }, { status: 400 })
  }

  // ── File integrity check — empty file / truncated PDF (defense in depth,
  // primary check happens client-side before the file is even sent) ────────
  const integrityCheck = validateFileIntegrity(file.type, bytes)
  if (!integrityCheck.valid) {
    return NextResponse.json({ error: integrityCheck.error }, { status: 400 })
  }

  // ── Cabinet + credits ─────────────────────────────────────────────────────
  const utilisateur = await prisma.utilisateur.findUnique({
    where: { id: user.id }, select: { cabinet_id: true }
  })
  if (!utilisateur?.cabinet_id) {
    return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })
  }

  const cabinet = await prisma.cabinet.findUnique({
    where: { id: utilisateur.cabinet_id }, select: { id: true }
  })
  if (!cabinet) return NextResponse.json({ error: 'Cabinet introuvable' }, { status: 403 })

  // ── Validate dossier_id belongs to this cabinet ───────────────────────────
  if (dossierId) {
    const validDossier = await prisma.dossier.findFirst({
      where: { id: dossierId, client: { cabinet_id: utilisateur.cabinet_id } }
    })
    if (!validDossier) {
      return NextResponse.json({ error: 'Dossier invalide.' }, { status: 400 })
    }
  }

  // ── Resolve target client (activeClient from sidebar or default) ─────────
  let targetClient
  if (clientId) {
    if (!/^[0-9a-f-]{36}$/.test(clientId)) {
      return NextResponse.json({ error: 'client_id invalide.' }, { status: 400 })
    }
    const validClient = await prisma.client.findFirst({
      where: { id: clientId, cabinet_id: utilisateur.cabinet_id },
    })
    if (!validClient) {
      return NextResponse.json({ error: 'Client invalide.' }, { status: 400 })
    }
    targetClient = validClient
  } else {
    targetClient = await getOrCreateDefaultClient(utilisateur.cabinet_id)
  }

  // ── Atomic credit deduction BEFORE upload — prevents race condition and orphan files
  const creditResult = await prisma.cabinet.updateMany({
    where: { id: cabinet.id, credits: { gte: 1 } },
    data:  { credits: { decrement: 1 } },
  })
  if (creditResult.count === 0) {
    return NextResponse.json({ error: 'Crédits insuffisants. Rechargez votre compte.' }, { status: 400 })
  }

  // ── Upload with UUID filename (no original name in path) ──────────────────
  const uniqueName = `${crypto.randomUUID()}.${ext}`
  const filePath   = `${utilisateur.cabinet_id}/${uniqueName}`

  const { error: uploadError } = await supabaseService.storage
    .from('documents')
    .upload(filePath, bytes, { contentType: file.type || 'application/octet-stream' })

  if (uploadError) {
    // Refund the credit since the upload failed
    await prisma.cabinet.update({
      where: { id: cabinet.id },
      data:  { credits: { increment: 1 } },
    }).catch(e => console.error('[upload] Failed to refund credit after upload error:', e))
    return NextResponse.json({ error: "Erreur d'upload." }, { status: 500 })
  }

  const doc = await prisma.document.create({
    data: {
      client_id:      targetClient.id,
      dossier_id:     dossierId,
      nom_fichier:    file.name.slice(0, 255),  // Store original name for display only
      chemin_storage: filePath,
      statut:         'A_EXTRAIRE',
    },
  })

  return NextResponse.json({
    documentId:  doc.id,
    nom_fichier: doc.nom_fichier,
    statut:      doc.statut,
    createdAt:   doc.createdAt.toISOString(),
  })
}
