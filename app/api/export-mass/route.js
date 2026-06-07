import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import * as XLSX from 'xlsx'
import prisma from '@/lib/prisma'
import { createClient } from '@/utils/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const supabaseService = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse('Non autorisé', { status: 401 })

    const utilisateur = await prisma.utilisateur.findUnique({
      where: { id: user.id }, select: { cabinet_id: true }
    })
    if (!utilisateur?.cabinet_id) return new NextResponse('Cabinet introuvable', { status: 403 })

    // ── Parse + sanitize IDs ──────────────────────────────────────────────────
    const formData = await request.formData()
    const rawIds = formData.getAll('documentIds')
    const documentIds = rawIds.filter(id => typeof id === 'string' && /^[0-9a-f-]{36}$/.test(id))
    if (documentIds.length === 0) return new NextResponse('Aucun document.', { status: 400 })

    // ── Fetch documents — scoped to cabinet (IDOR prevention) ─────────────────
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds }, client: { cabinet_id: utilisateur.cabinet_id } }
    })
    if (documents.length === 0) return new NextResponse('Documents introuvables.', { status: 404 })

    // ── Build recap Excel ─────────────────────────────────────────────────────
    const rows = documents.map(doc => ({
      Fichier: doc.nom_fichier,
      Statut:  doc.statut,
      ...(doc.donnees_extraites || {}),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Recapitulatif')
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const zip = new JSZip()
    zip.file('00_Recapitulatif_Extraction.xlsx', excelBuffer)

    // ── Download originals from Supabase ──────────────────────────────────────
    for (const doc of documents) {
      const { data: fileBlob } = await supabaseService.storage
        .from('documents')
        .download(doc.chemin_storage)
      if (fileBlob) {
        const buffer   = await fileBlob.arrayBuffer()
        const safeName = doc.nom_fichier?.replace(/[^a-zA-Z0-9._-]/g, '_') ?? doc.id
        zip.file(`documents/${safeName}`, buffer)
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type':        'application/zip',
        'Content-Disposition': `attachment; filename="Mass_Export_${Date.now()}.zip"`,
      },
    })
  } catch (err) {
    console.error('Export mass error:', err)
    return new NextResponse('Erreur serveur.', { status: 500 })
  }
}
